import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { ingestDocument } from '../services/ingestion';
import { logger } from '../utils/logger';
import { acquireLock, releaseLock } from '../utils/jobLock';
import multer from 'multer';
import { config } from '../utils/config';

const TAG = 'DocumentsCtrl';

export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileSize },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, TXT`));
    },
  }).array('files', 50);

  try {
    await new Promise<void>((resolve, reject) => {
      upload(req as any, res as any, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (err: any) {
    logger.warn(TAG, 'Upload rejected — multer error', { error: err?.message ?? String(err) });
    res.status(400).json({ error: err?.message ?? 'Upload error' });
    return;
  }

  const files = (req as any).files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    logger.warn(TAG, 'Upload rejected — no files in request');
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  // Create DB rows for each file
  const created: { id: string; filename: string; status: string }[] = [];
  for (const file of files) {
    logger.info(TAG, `Upload received`, { filename: file.originalname, mimeType: file.mimetype, sizeBytes: file.size });
    const doc = await prisma.document.create({
      data: {
        filename: file.originalname,
        mimeType: file.mimetype,
        fileData: Buffer.from(file.buffer) as any,
        status: 'QUEUED',
        progress: 0,
      },
    });
    created.push({ id: doc.id, filename: doc.filename, status: doc.status });
  }

  logger.info(TAG, `Files created, scheduling ingestion`, { count: created.length });

  // Background ingestion in batches of 3
  void (async () => {
    const BATCH = 3;
    for (let i = 0; i < created.length; i += BATCH) {
      const chunk = created.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (c) => {
          try {
            acquireLock(`ingest:${c.id}`);
            await ingestDocument(c.id);
          } catch (e) {
            logger.error(TAG, `Ingestion failed for document`, e, { documentId: c.id });
          } finally {
            releaseLock(`ingest:${c.id}`);
          }
        })
      );
    }
  })();

  res.status(202).json(created);
};

export const listDocuments = async (_req: Request, res: Response): Promise<void> => {
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      filename: true,
      mimeType: true,
      status: true,
      progress: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(docs);
};

export const getDocument = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      status: true,
      progress: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
};

export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: { filename: true, mimeType: true, fileData: true },
  });
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.send(doc.fileData);
};

export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  await prisma.document.delete({ where: { id: docId } });
  res.status(204).end();
};

export default {
  uploadDocument,
  listDocuments,
  getDocument,
  downloadDocument,
  deleteDocument,
};

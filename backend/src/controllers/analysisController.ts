import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import { Prisma } from '@prisma/client';
import { analyzeDocument } from '../services/extraction';
import { logger } from '../utils/logger';
import { acquireLock, releaseLock } from '../utils/jobLock';

const TAG = 'AnalysisCtrl';

export const startAnalysis = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  const force = String(req.query.force || '').toLowerCase() === 'true';
  logger.info(TAG, `Analysis requested`, { documentId: docId });

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: { id: true, status: true },
  });

  if (!doc) {
    logger.warn(TAG, `Document not found`, { documentId: docId });
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (doc.status !== 'READY') {
    logger.warn(TAG, `Document not ready`, { documentId: docId, status: doc.status });
    res.status(400).json({ error: `Document is not ready for analysis. Current status: ${doc.status}` });
    return;
  }

  const existing = await prisma.documentAnalysis.findUnique({ where: { documentId: doc.id } });
  // Only block if actively running — PARTIAL/DONE/FAILED can all be re-triggered
  if (existing?.status === 'RUNNING') {
    logger.warn(TAG, `Analysis already running (DB check)`, { documentId: docId });
    res.status(409).json({ error: 'Analysis is already running' });
    return;
  }

  // In-memory lock — prevents race condition when two requests arrive before the DB row is created
  if (!acquireLock(`analysis:${doc.id}`)) {
    logger.warn(TAG, `Analysis already running (in-memory lock)`, { documentId: docId });
    res.status(409).json({ error: 'Analysis is already running' });
    return;
  }

  logger.info(TAG, `Queuing analysis`, { documentId: docId, previousStatus: existing?.status ?? 'none' });
  // If client requested a forced reanalysis, clear prior saved passes so
  // analyzeDocument will run all passes from scratch.
  if (force && existing) {
    logger.info(TAG, `Force reanalysis requested — clearing previous results`, { documentId: docId });
    await prisma.documentAnalysis.update({
      where: { documentId: doc.id },
      data: {
        fixedFields: Prisma.JsonNull,
        dynamicFields: Prisma.JsonNull,
        specialFields: Prisma.JsonNull,
        errorMessage: null,
        status: 'RUNNING',
      },
    });
  }
  void analyzeDocument(doc.id).finally(() => releaseLock(`analysis:${doc.id}`));

  res.status(202).json({ documentId: doc.id, status: 'RUNNING', message: 'Analysis started' });
};

export const reanalyse = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  logger.info(TAG, `Reanalyse requested`, { documentId: docId });

  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { id: true, status: true } });
  if (!doc) {
    logger.warn(TAG, `Document not found`, { documentId: docId });
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (doc.status !== 'READY') {
    logger.warn(TAG, `Document not ready for reanalysis`, { documentId: docId, status: doc.status });
    res.status(400).json({ error: `Document is not ready for analysis. Current status: ${doc.status}` });
    return;
  }

  const existing = await prisma.documentAnalysis.findUnique({ where: { documentId: doc.id } });
  if (existing?.status === 'RUNNING') {
    logger.warn(TAG, `Analysis already running`, { documentId: docId });
    res.status(409).json({ error: 'Analysis is already running' });
    return;
  }

  if (!acquireLock(`analysis:${doc.id}`)) {
    logger.warn(TAG, `Analysis already running (in-memory lock)`, { documentId: docId });
    res.status(409).json({ error: 'Analysis is already running' });
    return;
  }

  // Remove previous analysis row entirely so a fresh analysis starts.
  if (existing) {
    try {
      await prisma.documentAnalysis.delete({ where: { documentId: doc.id } });
      logger.info(TAG, `Previous analysis deleted for reanalysis`, { documentId: docId });
    } catch (err) {
      logger.warn(TAG, `Failed to delete previous analysis — will attempt to continue`, { documentId: docId, err: String(err) });
    }
  }

  logger.info(TAG, `Queuing fresh analysis`, { documentId: docId });
  void analyzeDocument(doc.id).finally(() => releaseLock(`analysis:${doc.id}`));
  res.status(202).json({ documentId: doc.id, status: 'RUNNING', message: 'Reanalysis started' });
};

export const getAnalysis = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  const analysis = await prisma.documentAnalysis.findUnique({ where: { documentId: docId } });
  if (!analysis) {
    res.status(404).json({ error: 'No analysis found for this document' });
    return;
  }

  res.json({
    id: analysis.id,
    documentId: analysis.documentId,
    status: analysis.status,
    errorMessage: analysis.errorMessage,
    fixedFields: analysis.fixedFields,
    dynamicFields: analysis.dynamicFields,
    specialFields: analysis.specialFields,
    sources: analysis.sources,
    modelName: analysis.modelName,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
  });
};

export default { startAnalysis, reanalyse, getAnalysis };

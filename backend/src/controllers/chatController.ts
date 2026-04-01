import { Request, Response } from 'express';
import { chatWithDocument, DocumentNotFoundError, AnalysisNotReadyError, ChatTurn } from '../services/chat';
import { logger } from '../utils/logger';

const TAG = 'ChatCtrl';

export const chat = async (req: Request, res: Response): Promise<void> => {
  const docId = req.params.id as string;
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required and must be a non-empty string' });
    return;
  }
  if (message.trim().length > 2000) {
    res.status(400).json({ error: 'message must be 2000 characters or fewer' });
    return;
  }
  if (!Array.isArray(history)) {
    res.status(400).json({ error: 'history must be an array' });
    return;
  }

  logger.info(TAG, 'Chat request received', {
    documentId: docId,
    messageLength: message.length,
    historyTurns: history.length,
  });

  try {
    const reply = await chatWithDocument(docId, message.trim(), history as ChatTurn[]);
    res.json({ reply });
  } catch (err) {
    if (err instanceof DocumentNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof AnalysisNotReadyError) {
      res.status(409).json({ error: err.message });
      return;
    }
    logger.error(TAG, 'Chat request failed', err as Error, { documentId: docId });
    res.status(500).json({ error: 'Chat request failed. Please try again.' });
  }
};

export default { chat };

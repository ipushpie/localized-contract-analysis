import { Router } from 'express';
import analysisController from '../controllers/analysisController';
import chatController from '../controllers/chatController';

const router = Router();

// POST /documents/:id/analyze — trigger analysis
router.post('/:id/analyze', analysisController.startAnalysis);
router.post('/:id/reanalyse', analysisController.reanalyse);

// GET /documents/:id/analysis — get analysis result
router.get('/:id/analysis', analysisController.getAnalysis);

// POST /documents/:id/chat — RAG-based chat about the contract
router.post('/:id/chat', chatController.chat);

export default router;

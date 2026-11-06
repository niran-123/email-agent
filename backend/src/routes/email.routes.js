// backend/src/routes/email.routes.js
// Routes for email-level operations and AI analysis triggers.

import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  triggerEmailSummarize,
  getEmailSummary,
} from '../controllers/analysis.controller.js';

const router = Router();

router.use(requireAuth);

// AI Analysis endpoints for specific emails
router.post('/:id/summarize', triggerEmailSummarize);
router.get('/:id/summary', getEmailSummary);

export default router;


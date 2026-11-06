// backend/src/routes/summary.routes.js
// Routes for querying and viewing AI generated summaries.

import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  listSummaries,
  getSummaryById,
} from '../controllers/analysis.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listSummaries);
router.get('/:id', getSummaryById);

export default router;


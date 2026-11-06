// backend/src/routes/action.routes.js
// Routes for querying action items extracted from analyzed emails.

import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { listActionItems } from '../controllers/analysis.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listActionItems);

export default router;


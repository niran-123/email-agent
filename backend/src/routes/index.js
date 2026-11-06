// backend/src/routes/index.js
// Central route registry — import and mount all route modules here.

import { Router } from 'express';
import healthRouter from './health.routes.js';
import authRouter from './auth.routes.js';
import gmailRouter from './gmail.routes.js';
import webhookRouter from './webhook.routes.js';
import emailRouter from './email.routes.js';
import summaryRouter from './summary.routes.js';
import actionRouter from './action.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/gmail', gmailRouter);
router.use('/webhooks', webhookRouter);
router.use('/emails', emailRouter);
router.use('/summaries', summaryRouter);
router.use('/actions', actionRouter);

export default router;

// backend/src/routes/webhook.routes.js

import { Router } from 'express';
import { handleGmailWebhook } from '../controllers/webhook.controller.js';

const router = Router();

// POST /api/webhooks/gmail (Google Cloud Pub/Sub push destination)
router.post('/gmail', handleGmailWebhook);

export default router;


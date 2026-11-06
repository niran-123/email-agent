// backend/src/routes/gmail.routes.js

import { Router } from 'express';
import {
  getGmailStatus,
  getProfile,
  syncEmails,
  getSyncedEmails,
  disconnectGmail,
  startWatch,
  renewWatch,
  getSyncStatus,
} from '../controllers/gmail.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Protect all Gmail endpoints
router.use(requireAuth);

router.get('/status', getGmailStatus);
router.get('/profile', getProfile);
router.post('/sync', syncEmails);
router.get('/sync/status', getSyncStatus);
router.get('/emails', getSyncedEmails);
router.post('/watch/start', startWatch);
router.post('/watch/renew', renewWatch);
router.delete('/disconnect', disconnectGmail);

export default router;

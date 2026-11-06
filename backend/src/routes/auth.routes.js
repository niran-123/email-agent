// backend/src/routes/auth.routes.js

import { Router } from 'express';
import { getGoogleAuth, handleGoogleCallback, getMe, logout } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.get('/google', authLimiter, getGoogleAuth);
router.get('/google/callback', handleGoogleCallback);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;


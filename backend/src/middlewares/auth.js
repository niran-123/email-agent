// backend/src/middlewares/auth.js
// Authentication middleware: validates JWT from Authorization header or cookie.

import { verifyJwtToken } from '../utils/token.js';
import { User } from '../models/user.model.js';
import { EmailAccount } from '../models/emailAccount.model.js';
import { AppError } from './errorHandler.js';

export async function requireAuth(req, res, next) {
  try {
    let token = null;

    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.mm_token) {
      token = req.cookies.mm_token;
    }

    if (!token) {
      return next(new AppError('Authentication required: please log in.', 401, 'UNAUTHORIZED'));
    }

    let decoded;
    try {
      decoded = verifyJwtToken(token);
    } catch (err) {
      return next(new AppError('Invalid or expired authentication session.', 401, 'TOKEN_EXPIRED'));
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new AppError('User account not found.', 401, 'USER_NOT_FOUND'));
    }

    req.user = user;

    // Optionally attach the user's primary connected EmailAccount
    const account = await EmailAccount.findOne({
      userId: user._id,
      connectionStatus: 'connected',
    });
    req.emailAccount = account || null;

    next();
  } catch (err) {
    next(err);
  }
}


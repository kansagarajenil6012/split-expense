import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { unauthorized } from '../utils/app-error.js';
import usersRepository from '../repositories/users.repository.js';

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw unauthorized('Access token required');
    }

    const token = header.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await usersRepository.findById(decoded.sub);
    if (!user || user.deleted_at || !user.is_active) {
      throw unauthorized('Invalid or expired token');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(unauthorized('Invalid or expired token'));
    }
    next(err);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();

    const token = header.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await usersRepository.findById(decoded.sub);
    if (user && !user.deleted_at && user.is_active) req.user = user;
    next();
  } catch {
    next();
  }
};

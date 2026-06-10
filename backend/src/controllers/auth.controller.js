import authService from '../services/auth.service.js';
import refreshTokensRepository from '../repositories/refresh-tokens.repository.js';
import { success, created } from '../utils/api-response.js';

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.validated.body, req);
    created(res, result);
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.validated.body, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const googleLogin = async (req, res, next) => {
  try {
    const result = await authService.googleLogin(req.validated.body, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const firebaseLogin = async (req, res, next) => {
  try {
    const result = await authService.firebasePhoneLogin(req.validated.body, req);
    success(res, result);
  } catch (err) { next(err); }
};

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.validated.body;
    const result = await authService.refresh(refreshToken);
    success(res, result);
  } catch (err) { next(err); }
};

export const logout = async (req, res, next) => {
  try {
    await authService.logout(req.body.refreshToken);
    success(res, { message: 'Logged out' });
  } catch (err) { next(err); }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    success(res, user);
  } catch (err) { next(err); }
};

export const saveFCMToken = async (req, res, next) => {
  try {
    const { fcmToken, refreshToken } = req.body;
    await refreshTokensRepository.updateFCMToken(refreshToken, fcmToken);
    success(res, { message: 'FCM token saved' });
  } catch (err) { next(err); }
};

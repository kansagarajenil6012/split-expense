import { Router } from 'express';
import { validate } from '../../middleware/validate-request.js';
import { authenticate } from '../../middleware/authenticate.js';
import { registerSchema, loginSchema, googleLoginSchema, refreshSchema, firebaseLoginSchema } from '../../validators/auth.validator.js';
import * as authController from '../../controllers/auth.controller.js';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/google', validate(googleLoginSchema), authController.googleLogin);
router.post('/firebase', validate(firebaseLoginSchema), authController.firebaseLogin);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);
router.post('/fcm-token', authenticate, authController.saveFCMToken);
router.get('/me', authenticate, authController.getMe);

export default router;

import { Router } from 'express';
import { register, login, getCurrentUser, logout } from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { validateRegister, validateLogin } from '../middleware/validation.middleware.js';

const router = Router();

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.get('/me', authenticateJWT, getCurrentUser);
router.post('/logout', authenticateJWT, logout);

export default router;

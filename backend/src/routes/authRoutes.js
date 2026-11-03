import express from 'express';
import { alterarSenha, login, logout, me, register } from '../controllers/authController.js';
import { requireAuth, requireGestor } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/nova-senha', requireAuth, alterarSenha);
router.post('/register', requireAuth, requireGestor, register);

export default router;

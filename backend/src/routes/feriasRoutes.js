// backsist/routes/feriasRoutes.js
import express from 'express';
import { getPeriodosValidos, criarSolicitacaoFerias } from '../controllers/feriasController.js';
import { requireSelfOrGestor } from '../middleware/auth.js';

const router = express.Router();

router.get('/periodos/:matricula', requireSelfOrGestor((req) => req.params.matricula), getPeriodosValidos);
router.post('/solicitacao', requireSelfOrGestor((req) => req.body.matricula), criarSolicitacaoFerias);

export default router;

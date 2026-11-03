import { SESSION_COOKIE, verifySession } from '../auth/session.js';

function readSessionCookie(req) {
  const cookies = (req.headers.cookie ?? '').split(';').map((cookie) => cookie.trim());
  const entry = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1);
}

export function requireAuth(req, res, next) {
  const token = readSessionCookie(req);
  if (!token) {
    return res.status(401).json({ error: 'Sessão obrigatória.' });
  }

  try {
    req.user = verifySession(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

export function requireGestor(req, res, next) {
  if (!req.user?.gestor) {
    return res.status(403).json({ error: 'Acesso restrito à gestão.' });
  }
  return next();
}

// O servidor só acessa os próprios dados; a gestão acessa os de qualquer matrícula.
export const requireSelfOrGestor = (readMatricula) => (req, res, next) => {
  if (req.user?.gestor || String(readMatricula(req)) === req.user?.matricula) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito aos próprios dados.' });
};

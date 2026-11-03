import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'sessao';
const SESSION_HOURS = 8;
const MIN_SECRET_LENGTH = 32;

// IDs de tipo_user com acesso de gestão (gerente/secretaria). Vazio = ninguém (falha fechada).
const gestorTypeIds = () =>
  (process.env.GESTOR_TIPOS_USUARIO ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map(Number);

export const isGestor = (tipoUsuario) => gestorTypeIds().includes(tipoUsuario);

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET é obrigatório e precisa de ao menos ${MIN_SECRET_LENGTH} caracteres.`);
  }
  return value;
}

export const assertAuthConfig = () => {
  secret();
};

export const signSession = (user) =>
  jwt.sign({ tipo: user.ID_TIPO_USER ?? null }, secret(), {
    algorithm: 'HS256',
    subject: user.MATRICULA,
    expiresIn: `${SESSION_HOURS}h`,
  });

export function verifySession(token) {
  const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] });
  return { matricula: payload.sub, tipo: payload.tipo, gestor: isGestor(payload.tipo) };
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

export const sessionCookieMaxAge = SESSION_HOURS * 60 * 60 * 1000;

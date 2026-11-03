import bcrypt from 'bcryptjs';
import prisma from '../prismaClient.js';
import {
  SESSION_COOKIE,
  isGestor,
  sessionCookieMaxAge,
  sessionCookieOptions,
  signSession,
} from '../auth/session.js';

const LOGIN_ERROR = 'Matrícula ou senha inválidas.';
const MIN_PASSWORD_LENGTH = 8;
// Mantém o custo de bcrypt.compare quando a matrícula não existe.
const UNKNOWN_USER_HASH = bcrypt.hashSync('usuario-inexistente', 10);

export const login = async (req, res) => {
  const { matricula, senha } = req.body;

  if (!matricula || typeof senha !== 'string' || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const user = await prisma.cadastro.findUnique({
      where: { MATRICULA: String(matricula) },
    });
    const senhaCorreta = await bcrypt.compare(senha, user?.SENHA ?? UNKNOWN_USER_HASH);

    if (!user || !senhaCorreta) {
      return res.status(401).json({ error: LOGIN_ERROR });
    }

    res.cookie(SESSION_COOKIE, signSession(user), {
      ...sessionCookieOptions(),
      maxAge: sessionCookieMaxAge,
    });

    return res.status(200).json({
      message: 'Login realizado com sucesso.',
      nome: user.NOME,
      tipo: user.ID_TIPO_USER,
      matricula: user.MATRICULA,
      gestor: isGestor(user.ID_TIPO_USER),
      primeiro_acesso: user.primeiro_acesso,
      senhaPadrao: senha === user.MATRICULA,
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

export const logout = (req, res) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  return res.status(204).end();
};

export const me = (req, res) => {
  const { matricula, tipo, gestor } = req.user;
  return res.status(200).json({ matricula, tipo, gestor });
};

export const alterarSenha = async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  const { matricula } = req.user;

  if (typeof senhaAtual !== 'string' || typeof novaSenha !== 'string' || !senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }
  if (novaSenha.length < MIN_PASSWORD_LENGTH || novaSenha === matricula) {
    return res.status(400).json({
      error: `A nova senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres e não pode ser a matrícula.`,
    });
  }

  try {
    const user = await prisma.cadastro.findUnique({ where: { MATRICULA: matricula } });
    if (!user || !(await bcrypt.compare(senhaAtual, user.SENHA))) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    await prisma.cadastro.update({
      where: { MATRICULA: matricula },
      data: { SENHA: await bcrypt.hash(novaSenha, 10), primeiro_acesso: false },
    });

    return res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar a senha:', error);
    return res.status(500).json({ error: 'Erro ao atualizar a senha.' });
  }
};

export const register = async (req, res) => {
  const { matricula, senha, nome, email, id_gerencia } = req.body;

  if (!matricula || !senha || !nome || !email || !id_gerencia) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const existingUser = await prisma.cadastro.findUnique({
      where: { MATRICULA: String(matricula) },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Matrícula já cadastrada.' });
    }

    const newUser = await prisma.cadastro.create({
      data: {
        MATRICULA: String(matricula),
        SENHA: await bcrypt.hash(String(senha), 10),
        NOME: String(nome),
        EMAIL: String(email),
        ID_GERENCIA: Number(id_gerencia),
        DATA_CRIACAO: new Date(),
      },
    });

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso.',
      user: { MATRICULA: newUser.MATRICULA, NOME: newUser.NOME },
    });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.GESTOR_TIPOS_USUARIO = '2';

const SERVIDOR = { MATRICULA: '1001', NOME: 'Servidora Teste', ID_TIPO_USER: 1, primeiro_acesso: true };
const GESTOR = { MATRICULA: '2002', NOME: 'Gestor Teste', ID_TIPO_USER: 2, primeiro_acesso: false };
const SENHA = 'senha-forte-123';

let users;
const prisma = {
  cadastro: {
    findUnique: async ({ where }) => users.get(where.MATRICULA) ?? null,
    update: mock.fn(async ({ where, data }) => Object.assign(users.get(where.MATRICULA), data)),
    create: mock.fn(async ({ data }) => data),
  },
  periodos: { findMany: async () => [], findFirst: async () => null },
  funcionarios: { findMany: async () => [], findUnique: async () => null, count: async () => 0 },
  gerencia: { findMany: async () => [] },
  ferias_gozo: { findMany: async () => [], count: async () => 0 },
};

mock.module(new URL('../src/prismaClient.js', import.meta.url).href, { defaultExport: prisma });

const { createApp } = await import('../src/app.js');

let server;
let baseUrl;

const request = (path, { cookie, body, method } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

const loginAs = async (user, senha = SENHA) => {
  const res = await request('/login', { body: { matricula: user.MATRICULA, senha } });
  assert.equal(res.status, 200);
  return res.headers.get('set-cookie').split(';')[0];
};

const PROTECTED_ROUTES = [
  ['GET', '/me'],
  ['POST', '/nova-senha'],
  ['POST', '/register'],
  ['GET', '/solicitar-ferias/periodos/1001'],
  ['POST', '/solicitar-ferias/solicitacao'],
  ['GET', '/tela/funcionarios/count'],
  ['GET', '/tela/ferias/mes-atual'],
  ['GET', '/tela/ferias/agendadas'],
  ['GET', '/tela/ferias/solicitacoes'],
  ['GET', '/gerencias'],
  ['GET', '/gerencias/funcionarios'],
  ['GET', '/gerencias/emferias'],
  ['GET', '/gerencias/GAB/funcionarios'],
  ['POST', '/gerencias/gerar-periodos'],
];

const GESTAO_ROUTES = PROTECTED_ROUTES.filter(
  ([, path]) => path === '/register' || path.startsWith('/tela') || path.startsWith('/gerencias'),
);

before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  const SENHA_HASH = bcrypt.hashSync(SENHA, 4);
  users = new Map([
    [SERVIDOR.MATRICULA, { ...SERVIDOR, SENHA: SENHA_HASH }],
    [GESTOR.MATRICULA, { ...GESTOR, SENHA: SENHA_HASH }],
  ]);
  prisma.cadastro.update.mock.resetCalls();
  prisma.cadastro.create.mock.resetCalls();
});

describe('sessão', () => {
  for (const [method, path] of PROTECTED_ROUTES) {
    it(`${method} ${path} responde 401 sem sessão`, async () => {
      const res = await request(path, { method, body: method === 'POST' ? {} : undefined });
      assert.equal(res.status, 401);
    });
  }

  it('recusa token assinado com outro segredo', async () => {
    const forged = jwt.sign({ tipo: 2 }, 'outro-segredo-com-pelo-menos-32-caracteres', { subject: '2002' });
    const res = await request('/me', { cookie: `sessao=${forged}` });
    assert.equal(res.status, 401);
  });

  it('recusa token sem assinatura', async () => {
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const payload = Buffer.from('{"sub":"2002","tipo":2}').toString('base64url');
    const res = await request('/me', { cookie: `sessao=${header}.${payload}.` });
    assert.equal(res.status, 401);
  });

  it('recusa token expirado', async () => {
    const expired = jwt.sign({ tipo: 2 }, process.env.JWT_SECRET, { subject: '2002', expiresIn: -10 });
    const res = await request('/me', { cookie: `sessao=${expired}` });
    assert.equal(res.status, 401);
  });
});

describe('login', () => {
  it('abre sessão em cookie HttpOnly sem devolver hash nem token no corpo', async () => {
    const res = await request('/login', { body: { matricula: '1001', senha: SENHA } });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /^sessao=.+; Max-Age=28800; Path=\/; Expires=.+; HttpOnly; SameSite=Lax$/);
    assert.deepEqual(Object.keys(body).sort(), ['gestor', 'matricula', 'message', 'nome', 'primeiro_acesso', 'senhaPadrao', 'tipo']);
    assert.equal(body.gestor, false);
  });

  it('informa a sessão atual em /me', async () => {
    const cookie = await loginAs(GESTOR);
    const res = await request('/me', { cookie });
    assert.deepEqual(await res.json(), { matricula: '2002', tipo: 2, gestor: true });
  });

  it('marca o cookie como Secure em produção', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const res = await request('/login', { body: { matricula: '1001', senha: SENHA } });
      assert.match(res.headers.get('set-cookie'), /; Secure/);
    } finally {
      delete process.env.NODE_ENV;
    }
  });

  it('responde igual para matrícula inexistente e senha errada', async () => {
    const unknown = await request('/login', { body: { matricula: '9999', senha: SENHA } });
    const wrong = await request('/login', { body: { matricula: '1001', senha: 'senha-errada' } });

    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(await unknown.json(), await wrong.json());
  });

  it('exige matrícula e senha', async () => {
    const res = await request('/login', { body: { matricula: '1001' } });
    assert.equal(res.status, 400);
  });

  it('sinaliza senha padrão para forçar a troca', async () => {
    users.get('1001').SENHA = bcrypt.hashSync('1001', 4);
    const res = await request('/login', { body: { matricula: '1001', senha: '1001' } });
    assert.equal((await res.json()).senhaPadrao, true);
  });

  it('encerra a sessão no logout', async () => {
    const res = await request('/logout', { body: {} });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('set-cookie'), /^sessao=;/);
  });
});

describe('papéis', () => {
  for (const [method, path] of GESTAO_ROUTES) {
    it(`${method} ${path} responde 403 para servidor`, async () => {
      const cookie = await loginAs(SERVIDOR);
      const res = await request(path, { cookie, method, body: method === 'POST' ? {} : undefined });
      assert.equal(res.status, 403);
    });
  }

  it('sem GESTOR_TIPOS_USUARIO ninguém acessa a gestão', async () => {
    const configured = process.env.GESTOR_TIPOS_USUARIO;
    delete process.env.GESTOR_TIPOS_USUARIO;
    try {
      const cookie = await loginAs(GESTOR);
      assert.equal((await request('/gerencias', { cookie })).status, 403);
    } finally {
      process.env.GESTOR_TIPOS_USUARIO = configured;
    }
  });

  it('a gestão acessa as rotas de gestão', async () => {
    const cookie = await loginAs(GESTOR);
    assert.equal((await request('/gerencias', { cookie })).status, 200);
  });

  it('o servidor consulta os próprios períodos', async () => {
    const cookie = await loginAs(SERVIDOR);
    assert.equal((await request('/solicitar-ferias/periodos/1001', { cookie })).status, 200);
  });

  it('o servidor não consulta períodos de outra matrícula', async () => {
    const cookie = await loginAs(SERVIDOR);
    assert.equal((await request('/solicitar-ferias/periodos/2002', { cookie })).status, 403);
  });

  it('o servidor não solicita férias em nome de outra matrícula', async () => {
    const cookie = await loginAs(SERVIDOR);
    const res = await request('/solicitar-ferias/solicitacao', { cookie, body: { matricula: '2002' } });
    assert.equal(res.status, 403);
  });

  it('a gestão consulta períodos de qualquer matrícula', async () => {
    const cookie = await loginAs(GESTOR);
    assert.equal((await request('/solicitar-ferias/periodos/1001', { cookie })).status, 200);
  });
});

describe('POST /nova-senha', () => {
  it('troca a própria senha com a senha atual, ignorando matrícula no corpo', async () => {
    const cookie = await loginAs(SERVIDOR);
    const res = await request('/nova-senha', {
      cookie,
      body: { matricula: '2002', senhaAtual: SENHA, novaSenha: 'nova-senha-456' },
    });

    assert.equal(res.status, 200);
    assert.equal(prisma.cadastro.update.mock.callCount(), 1);
    assert.equal(prisma.cadastro.update.mock.calls[0].arguments[0].where.MATRICULA, '1001');
    assert.equal(users.get('1001').primeiro_acesso, false);
    assert.ok(bcrypt.compareSync('nova-senha-456', users.get('1001').SENHA));
  });

  it('nega a troca com senha atual errada', async () => {
    const cookie = await loginAs(SERVIDOR);
    const res = await request('/nova-senha', { cookie, body: { senhaAtual: 'errada-123', novaSenha: 'nova-senha-456' } });

    assert.equal(res.status, 401);
    assert.equal(prisma.cadastro.update.mock.callCount(), 0);
  });

  it('recusa senha curta ou igual à matrícula', async () => {
    const cookie = await loginAs(SERVIDOR);
    for (const novaSenha of ['curta', '1001']) {
      const res = await request('/nova-senha', { cookie, body: { senhaAtual: SENHA, novaSenha } });
      assert.equal(res.status, 400);
    }
  });

  it('nunca escreve senha nem hash no log', async () => {
    const log = mock.method(console, 'log', () => {});
    try {
      const cookie = await loginAs(SERVIDOR);
      await request('/nova-senha', { cookie, body: { senhaAtual: SENHA, novaSenha: 'nova-senha-456' } });
      const written = log.mock.calls.flatMap((call) => call.arguments).join(' ');
      assert.ok(!written.includes('nova-senha-456'));
      assert.ok(!written.includes('$2'));
    } finally {
      log.mock.restore();
    }
  });
});

describe('POST /register', () => {
  const novo = { matricula: '3003', senha: '3003', nome: 'Novo', email: 'novo@example.test', id_gerencia: 1 };

  it('a gestão cadastra com senha em hash', async () => {
    const cookie = await loginAs(GESTOR);
    const res = await request('/register', { cookie, body: novo });

    assert.equal(res.status, 201);
    const { data } = prisma.cadastro.create.mock.calls[0].arguments[0];
    assert.notEqual(data.SENHA, novo.senha);
    assert.ok(bcrypt.compareSync(novo.senha, data.SENHA));
  });

  it('recusa matrícula já cadastrada', async () => {
    const cookie = await loginAs(GESTOR);
    const res = await request('/register', { cookie, body: { ...novo, matricula: '1001' } });
    assert.equal(res.status, 409);
  });
});

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-chars';
process.env.GESTOR_TIPOS_USUARIO = '2';

// Dados fictícios: nenhuma matrícula, nome ou sigla real.
const FUNC_A = { MATRICULA_F: '9001', NOME: 'Pessoa A', SIGLA_GERENCIA: 'GX', GERENCIA: 'Gerência X' };
const FUNC_B = { MATRICULA_F: '9002', NOME: 'Pessoa B', SIGLA_GERENCIA: 'GY', GERENCIA: 'Gerência Y' };
const GOZO = {
  ID: 7,
  MES_INICIO: new Date('2026-03-02T00:00:00Z'),
  MES_FIM: new Date('2026-03-31T00:00:00Z'),
  SALDO: '30',
  TIPO: 'integral',
  PERCEPCAO: 'não',
  ANO: '2026',
};

let state;
const fail = () => {
  throw new Error('falha simulada do banco');
};

const prisma = {
  cadastro: { findUnique: async () => null },
  gerencia: { findMany: async () => state.gerencias() },
  funcionarios: {
    count: async () => state.totalFuncionarios(),
    findMany: async (args) => state.funcionarios(args),
  },
  periodos: {
    count: async ({ where }) => state.contarPeriodos(where),
    findMany: async (args) => state.periodosValidos(args),
    findUnique: async ({ where }) => state.periodoExistente(where),
    create: mock.fn(async ({ data }) => data),
  },
  ferias_gozo: {
    count: async () => state.feriasNoMes(),
    findMany: async ({ where }) => state.gozoPorAno(where.ANO),
  },
};

mock.module(new URL('../src/prismaClient.js', import.meta.url).href, { defaultExport: prisma });

const { createApp } = await import('../src/app.js');
const { signSession } = await import('../src/auth/session.js');
const { gerarPeriodosAquisitivos } = await import('../src/utils/feriasService.js');

const GESTOR_COOKIE = `sessao=${signSession({ MATRICULA: '2002', ID_TIPO_USER: 2 })}`;
const SERVIDOR_COOKIE = `sessao=${signSession({ MATRICULA: '9001', ID_TIPO_USER: 1 })}`;

let server;
let baseUrl;

const get = (path, cookie = GESTOR_COOKIE) => fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie } });
const post = (path, cookie = GESTOR_COOKIE) =>
  fetch(`${baseUrl}${path}`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });

before(async () => {
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
  await new Promise((resolve) => {
    server = createApp().listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  state = {
    gerencias: async () => [{ SIGLA_GERENCIA: 'GX', GERENCIA: 'Gerência X' }],
    totalFuncionarios: async () => 2,
    funcionarios: async () => [],
    contarPeriodos: async () => 0,
    periodosValidos: async () => [],
    periodoExistente: async () => null,
    feriasNoMes: async () => 0,
    gozoPorAno: async () => [],
  };
  prisma.periodos.create.mock.resetCalls();
});

describe('painel da gestão (/tela)', () => {
  it('devolve os totais de funcionários, férias no mês, agendadas e solicitadas', async () => {
    state.feriasNoMes = async () => 3;
    state.contarPeriodos = async (where) => (where.STATUS === 2 ? 4 : 5);

    assert.deepEqual(await (await get('/tela/funcionarios/count')).json(), { total: 2 });
    assert.deepEqual(await (await get('/tela/ferias/mes-atual')).json(), { total: 3 });
    assert.deepEqual(await (await get('/tela/ferias/agendadas')).json(), { total: 5 });
    assert.deepEqual(await (await get('/tela/ferias/solicitacoes')).json(), { total: 4 });
  });

  it('responde 500 sem detalhes quando o banco falha', async () => {
    state.totalFuncionarios = fail;
    state.feriasNoMes = fail;
    state.contarPeriodos = fail;

    for (const path of ['/tela/funcionarios/count', '/tela/ferias/mes-atual', '/tela/ferias/agendadas', '/tela/ferias/solicitacoes']) {
      const res = await get(path);
      assert.equal(res.status, 500, path);
      assert.doesNotMatch(JSON.stringify(await res.json()), /falha simulada/);
    }
  });

  it('nega o painel a quem não é da gestão', async () => {
    assert.equal((await get('/tela/funcionarios/count', SERVIDOR_COOKIE)).status, 403);
  });
});

describe('gerências', () => {
  it('lista as gerências', async () => {
    const res = await get('/gerencias');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ SIGLA_GERENCIA: 'GX', GERENCIA: 'Gerência X' }]);
  });

  it('resume cada funcionário com o período mais recente e marca ausências com ---', async () => {
    state.funcionarios = async () => [
      { ...FUNC_A, gerencia: { SIGLA_GERENCIA: 'GX' }, periodos: [{ PERIODO_AQUISITIVO_EM_ABERTO: '2025/2026', ID: 7, ferias_gozo: [GOZO] }] },
      { ...FUNC_B, gerencia: null, periodos: [] },
    ];

    const body = await (await get('/gerencias/funcionarios')).json();

    assert.equal(body.length, 2);
    assert.deepEqual(
      { ...body[0], ferias_gozo: undefined },
      { MATRICULA_F: '9001', NOME: 'Pessoa A', SIGLA_GERENCIA: 'GX', PERIODO_AQUISITIVO_EM_ABERTO: '2025/2026', ID_PERIODO: 7, ferias_gozo: undefined },
    );
    assert.equal(body[0].ferias_gozo.length, 1);
    assert.deepEqual(body[1], {
      MATRICULA_F: '9002',
      NOME: 'Pessoa B',
      SIGLA_GERENCIA: '---',
      PERIODO_AQUISITIVO_EM_ABERTO: '---',
      ID_PERIODO: null,
      ferias_gozo: null,
    });
  });

  it('devolve início e fim das férias por sigla, com filtro de nome sem diferenciar caixa', async () => {
    let received;
    state.funcionarios = async (args) => {
      received = args.where;
      return [{ ...FUNC_A, gerencia: {}, periodos: [{ PERIODO_AQUISITIVO_EM_ABERTO: '2025/2026', ferias_gozo: [GOZO] }] }];
    };

    const res = await get('/gerencias/GX/funcionarios?nome=pessoa');
    const [item] = await res.json();

    assert.equal(res.status, 200);
    assert.deepEqual(received, { SIGLA_GERENCIA: 'GX', NOME: { contains: 'pessoa', mode: 'insensitive' } });
    assert.equal(item.ID_PERIODO, 7);
    assert.equal(item.MES_INICIO, '2026-03-02T00:00:00.000Z');
    assert.equal(item.MES_FIM, '2026-03-31T00:00:00.000Z');
    assert.equal(item.SALDO, '30');
  });

  it('busca por sigla sem filtro de nome e sem férias registradas', async () => {
    let received;
    state.funcionarios = async (args) => {
      received = args.where;
      return [{ ...FUNC_B, gerencia: {}, periodos: [] }];
    };

    const [item] = await (await get('/gerencias/GY/funcionarios')).json();

    assert.deepEqual(received, { SIGLA_GERENCIA: 'GY' });
    assert.equal(item.MES_FIM, null);
    assert.equal(item.ferias_gozo, null);
  });

  it('lista férias do ano corrente e recorre ao ano seguinte quando não há nenhuma', async () => {
    const anoAtual = String(new Date().getFullYear());
    const anos = [];
    state.gozoPorAno = async (ano) => {
      anos.push(ano);
      return ano === anoAtual
        ? []
        : [{ ...GOZO, periodos: [{ PERIODO_AQUISITIVO_EM_ABERTO: '2025/2026', funcionarios: FUNC_A }] }, { ...GOZO, ID: 8, periodos: [] }];
    };

    const body = await (await get('/gerencias/emferias')).json();

    assert.deepEqual(anos, [anoAtual, String(Number(anoAtual) + 1)]);
    assert.equal(body[0].NOME, 'Pessoa A');
    assert.equal(body[0].PERIODO_AQUISITIVO_EM_ABERTO, '2025/2026');
    assert.deepEqual(
      [body[1].MATRICULA_F, body[1].NOME, body[1].SIGLA_GERENCIA, body[1].PERIODO_AQUISITIVO_EM_ABERTO],
      [null, null, null, null],
    );
  });

  it('responde 500 em todas as consultas de gerência quando o banco falha', async () => {
    state.gerencias = fail;
    state.funcionarios = fail;
    state.gozoPorAno = fail;

    for (const path of ['/gerencias', '/gerencias/funcionarios', '/gerencias/GX/funcionarios', '/gerencias/emferias']) {
      assert.equal((await get(path)).status, 500, path);
    }
    assert.equal((await post('/gerencias/gerar-periodos')).status, 500);
  });
});

describe('geração de períodos aquisitivos', () => {
  const funcionarios = [
    { MATRICULA_F: '9001', DATA_ADMISSAO: new Date('2024-06-15T12:00:00Z') },
    { MATRICULA_F: '9002', DATA_ADMISSAO: new Date('2025-01-10T12:00:00Z') },
    { MATRICULA_F: '9003', DATA_ADMISSAO: null },
  ];

  it('cria o período ano/ano+1 só para quem tem admissão e ainda não tem o período (rota)', async () => {
    state.funcionarios = async () => funcionarios;
    state.periodoExistente = async (where) =>
      where.MATRICULA_SEM_PONTO_PERIODO_AQUISITIVO_EM_ABERTO.MATRICULA_SEM_PONTO === '9002' ? { ID: 1 } : null;

    const res = await post('/gerencias/gerar-periodos');

    assert.equal(res.status, 200);
    assert.deepEqual(
      prisma.periodos.create.mock.calls.map((call) => call.arguments[0].data),
      [{ MATRICULA_SEM_PONTO: '9001', PERIODO_AQUISITIVO_EM_ABERTO: '2024/2025' }],
    );
  });

  it('aplica a mesma regra no serviço reutilizável', async () => {
    state.funcionarios = async () => funcionarios;

    const result = await gerarPeriodosAquisitivos();

    assert.equal(result.success, true);
    assert.deepEqual(
      prisma.periodos.create.mock.calls.map((call) => call.arguments[0].data.PERIODO_AQUISITIVO_EM_ABERTO),
      ['2024/2025', '2025/2026'],
    );
  });

  it('informa falha no serviço sem lançar exceção', async () => {
    state.funcionarios = fail;

    assert.deepEqual(await gerarPeriodosAquisitivos(), { success: false, message: 'Erro ao gerar períodos aquisitivos.' });
  });

  it('não permite que um servidor gere períodos', async () => {
    assert.equal((await post('/gerencias/gerar-periodos', SERVIDOR_COOKIE)).status, 403);
  });
});

describe('períodos válidos do servidor', () => {
  it('consulta apenas períodos em aberto da matrícula da sessão', async () => {
    let received;
    state.periodosValidos = async (args) => {
      received = args.where;
      return [{ PERIODO_AQUISITIVO_EM_ABERTO: '2025/2026' }];
    };

    const res = await get('/solicitar-ferias/periodos/9001', SERVIDOR_COOKIE);

    assert.equal(res.status, 200);
    assert.deepEqual(received, { MATRICULA_SEM_PONTO: '9001', status_ferias: { ID_STATUS: 2 } });
    assert.deepEqual(await res.json(), [{ PERIODO_AQUISITIVO_EM_ABERTO: '2025/2026' }]);
  });

  it('responde 500 quando a consulta falha', async () => {
    state.periodosValidos = fail;
    assert.equal((await get('/solicitar-ferias/periodos/9001', SERVIDOR_COOKIE)).status, 500);
  });
});

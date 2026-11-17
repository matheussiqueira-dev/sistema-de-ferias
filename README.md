# Sistema de Férias

Sistema interno para solicitação e acompanhamento de férias de servidores:

- o servidor consulta seus períodos aquisitivos em aberto e solicita férias;
- a gestão acompanha o painel (servidores, férias do mês, agendadas e solicitadas), as gerências e quem está em férias;
- a gestão cadastra acessos e gera períodos aquisitivos.

## Stack

- **API** (`backend/`): Node.js 22 (ESM, JavaScript), Express 4, Prisma 6 com PostgreSQL (schema `sist_ferias`), `bcryptjs`, `jsonwebtoken` e `date-fns`. Testes com o test runner nativo do Node (`node --test`), com o Prisma substituído por mock.
- **Web** (`frontend/`): Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Axios e Font Awesome.

A sessão fica em cookie HttpOnly assinado com JWT. O frontend envia o cookie em todas as chamadas (`withCredentials`).

## Requisitos

- Node.js 22 e npm
- PostgreSQL com o schema `sist_ferias` (estrutura em `backend/prisma/schema.prisma`)

## Configuração da API

```bash
cd backend
npm ci
cp .env.example .env
```

Variáveis (ver `backend/.env.example`):

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | conexão PostgreSQL |
| `JWT_SECRET` | obrigatório; a API não inicia sem ele |
| `GESTOR_TIPOS_USUARIO` | IDs de `tipo_user` com acesso de gestão, separados por vírgula; vazio bloqueia a gestão |
| `CORS_ORIGIN` | origem do frontend (padrão `http://localhost:3000`) |
| `PORT` | porta da API (padrão `3001`) |

Nunca versione o `.env`.

## Execução local

```bash
# API (porta 3001)
cd backend
npm run dev

# Web (porta 3000)
cd frontend
npm ci
npm run dev
```

O frontend usa `NEXT_PUBLIC_API_URL` (padrão `http://localhost:3001`) para chegar à API.

## Verificações

```bash
cd backend && npm test            # testes da API
cd backend && npm run test:coverage
cd frontend && npm run lint
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

## Rotas da API

| Método e caminho | Acesso |
| --- | --- |
| `POST /login`, `POST /logout` | público |
| `GET /me`, `POST /nova-senha` | sessão |
| `POST /register` | gestão |
| `GET /solicitar-ferias/periodos/:matricula`, `POST /solicitar-ferias/solicitacao` | o próprio servidor ou a gestão |
| `GET /tela/funcionarios/count`, `GET /tela/ferias/mes-atual`, `GET /tela/ferias/agendadas`, `GET /tela/ferias/solicitacoes` | gestão |
| `GET /gerencias`, `GET /gerencias/funcionarios`, `GET /gerencias/emferias`, `GET /gerencias/:sigla/funcionarios`, `POST /gerencias/gerar-periodos` | gestão |

## Licença

MIT. Ver `LICENSE`.

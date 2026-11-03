# Plano de Evolução — sistema-de-ferias

> Documento vivo, revisado semanalmente. Última revisão: 2026-11-03.
> Regra central: nenhuma mudança entra sem estar ligada a um objetivo desta página e sem manter ou melhorar as métricas da seção 2.

## 1. Identidade do projeto

- **Propósito:** sistema interno de solicitação e acompanhamento de férias de servidores de um órgão público municipal: o servidor solicita o período, a gerência aprova ou reprova e a secretaria acompanha o controle geral.
- **Tipo:** web app (Next.js) + API REST (Express) com banco PostgreSQL via Prisma.
- **Stack:** backend Node.js (ESM, JavaScript), Express 4.22.3, Prisma 6.9.0 (`@prisma/client` e CLI), `bcryptjs` 3.0.2, `date-fns` 4 + `date-fns-tz` 3, `jsonwebtoken` 9 (sessão em cookie HttpOnly); frontend Next.js 15.5.28 (App Router, Turbopack no dev), React 19, Tailwind CSS 3.4, Recharts 3, Axios 1.21.0, Font Awesome 6, ESLint 9 (`eslint-config-next` 15.1.6), TypeScript 5.
- **Gerenciador de pacotes:** npm, dois lockfiles (`backend/package-lock.json`, `frontend/package-lock.json`).
- **Deploy:** nenhum configurado (sem `vercel.json`, Dockerfile ou compose no HEAD).
- **Estrutura:** `backend/server.js` (inicialização), `backend/src/app.js` (`createApp`), `backend/src/auth/session.js` e `backend/src/middleware/auth.js` (sessão e papéis), `backend/src/controllers/` e `backend/src/routes/` (auth, férias, gerências, painel, solicitação), `backend/src/utils/feriasService.js`, `backend/test/`, `backend/prisma/schema.prisma` (schema `sist_ferias`); `frontend/src/app/` (rotas `/`, `/login`, `/tela`, `/solicitar-ferias`, `/gerencias`, `/cadastro-funcionario`, `/alterar-senha`, `/nova-senha`, `/periodo-aquisitivo`), `frontend/components/` (formulários, cabeçalho, filtros, cards), `frontend/lib/http.ts` (cliente com credenciais).
- **Comandos:** install `cd backend && npm ci` e `cd frontend && npm ci` · dev `cd backend && npm run dev` (exige `JWT_SECRET`, ver `backend/.env.example`) e `cd frontend && npm run dev` · lint `cd frontend && npm run lint` · typecheck `cd frontend && npx tsc --noEmit` · test `cd backend && npm test` · build `cd frontend && npm run build`

## 2. Estado atual (baseline)

| Verificação | Comando | Resultado | Data |
| --- | --- | --- | --- |
| Instalação | `npm ci` (backend) / `npm ci` (frontend) | PASS / PASS | 2026-11-03 |
| Lint | `npm run lint` (frontend) | PASS: 0 erros, 8 avisos (variáveis sem uso e `no-img-element`); backend sem linter | 2026-11-03 |
| Typecheck | `npx tsc --noEmit` (frontend) | PASS (0 erros) | 2026-11-03 |
| Testes | `cd backend && npm test` | PASS: 46 passando / 0 falhando (Prisma substituído por mock); frontend sem testes | 2026-11-03 |
| Cobertura | `npm run test:coverage` (backend) | 63,3% de linhas no total; `middleware/auth.js` e rotas 100%; `controllers` de férias, gerência e painel abaixo de 30% | 2026-11-03 |
| Build | `npm run build` (frontend) | PASS com respostas de fonte simuladas (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`); build com Google Fonts real não verificado até B8/B10. `npx prisma validate`: não verificado (download dos engines bloqueado) | 2026-11-03 |
| Vulnerabilidades (audit) | `npm audit` | prod: 0 nos dois pacotes (Next, Express e Axios atualizados pelo dono em 2026-10-28); com dev: backend 0, frontend 16 moderate (`minimatch` via ESLint, GHSA-g3hv-75wg-m249) | 2026-11-03 |
| CI no GitHub | — | nenhum workflow (B10) | 2026-11-03 |

Observações: **este documento descreve falhas e não deve ser publicado; o repositório está privado (conferido na API do GitHub em 2026-11-03).** Desde 2026-11-03 a API exige sessão: cookie HttpOnly com JWT, `JWT_SECRET` obrigatório na inicialização e `GESTOR_TIPOS_USUARIO` com os IDs de `tipo_user` de gestão. Sem esse valor ninguém acessa painel, gerências nem cadastro: os IDs não estão no repositório e precisam vir do dono (seção 9). Nenhum fluxo foi exercitado contra banco real; a integração entre frontend e API foi conferida por tipos e build, sem navegador. As descrições abaixo são da baseline de 2026-10-23 e ainda valem onde não citam autenticação. Por leitura do código: `POST /nova-senha` (`backend/src/routes/authRoutes.js:7` → `authController.js:40-73`) troca a senha de qualquer matrícula sem senha atual e registra a senha recebida em texto puro no log (`authController.js:47-48`); `POST /register` (`server.js:80`) é público; rotas de gerências e painel devolvem nome e matrícula sem autenticação; o login distingue usuário inexistente de senha errada (enumeração); a rota `/login` está duplicada (`server.js:33` e `:38`); `server.js:23-26` registra todas as URLs. O README descreve uma versão anterior (backend TypeScript, frontend estático, compose e seed) que só existe no histórico, e contém contas por papel com senha e credenciais do Adminer. Há dados institucionais reais no HEAD (nome do órgão, siglas e lista de gerências, logotipo em `frontend/public/` e `frontend/assets/`) e uma matrícula fixa em `frontend/components/solicitacao_ferias.tsx:31`; nenhum valor é reproduzido aqui. `nova-senha/page.tsx` e `periodo-aquisitivo/page.tsx` estão vazios. Nenhuma rota foi executada contra banco.

## 3. Histórico e trajetória

Sete commits, todos de Matheus Henrique Dias Siqueira:

- **2025-10-02 — primeira versão.** Backend Express/Prisma em TypeScript com frontend estático e calendário; dois commits de documentação de execução.
- **2025-10-04 — integração.** Painel de férias com aprovação da gerência.
- **2025-10-06 — reescrita.** `Atualiza frontend e backend do sistema de férias` (`11ff751`): troca para Next.js 15 e backend em JavaScript; remove a API TypeScript, o compose, o seed e o `.env.example`, que continuam acessíveis no histórico.
- **2025-11-16 / 2026-10-11 — manutenção.** Licença MIT pela interface do GitHub e `.gitignore` de dados locais.

Arquivos com mais mudanças (todos já apagados no HEAD): `backend/tsconfig.json`, `backend/src/routes/ferias.ts`, `backend/src/index.ts` e `backend/src/config.ts` (3 commits cada). Mensagens mistas (Conventional Commits e frases livres em português). Débitos deixados pela reescrita: README desatualizado, dependências sem uso (`jsonwebtoken`, `bcrypt` duplicado com `bcryptjs`, `@prisma/client`, `prisma` e `cors` no frontend), `solicitacaoRoutes.js` não montado e com import sem extensão, `postcss.config.js` e `.mjs` duplicados, metadados padrão do template `create-next-app` em `layout.tsx`. Sem atividade de código desde 2025-10-06.

## 4. Objetivos definidos (critério de parada)

Cada objetivo tem métrica, baseline e meta. Atingida a meta, o objetivo sai do ciclo ativo e passa a ser apenas monitorado (sem novas mudanças por ele).

| # | Eixo | Objetivo | Métrica | Baseline | Meta | Prioridade | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O1 | Segurança | Eliminar a exposição pública e as falhas exploráveis | rotas sensíveis sem autenticação; segredos/credenciais no HEAD e no histórico | todas as rotas abertas; credenciais no README e no histórico | 0 rotas sensíveis abertas; repositório privado ou histórico purgado (decisão do dono) | P0 | monitorado (meta atingida em 2026-11-03, `03a00b4`: 14 rotas com sessão testadas; repositório privado) |
| O2 | Funcionamento | Build e typecheck verdes | `npm run build`, `tsc --noEmit`, `npm run lint` | FAIL / 1 erro / 11 erros | PASS / 0 / 0 | P0 | monitorado (meta atingida em 2026-11-03, `56446c0`; build com fonte simulada) |
| O3 | Segurança | Dependências sem vulnerabilidade crítica | critical+high (prod) | backend 10, frontend 7 | 0 critical e 0 high nos dois pacotes | P1 | monitorado (meta atingida em 2026-10-28, `fe4ab18` e `13c7289`) |
| O4 | Cobertura de testes | Testar regras de férias e autorização | nº de testes; cobertura de `feriasService.js` e controllers | 46 testes; 63,3% (2026-11-03) | ≥ 20 testes; ≥ 70% de linhas no backend | P1 | ativo |
| O5 | Qualidade/Manutenibilidade | README e manifests verdadeiros | divergências entre README e código; dependências sem uso | README de versão removida; 5 dependências sem uso | README descreve o código atual; 0 dependências sem uso | P2 | ativo |
| O6 | Dados e privacidade | Nenhum dado institucional ou pessoal real no repositório | ocorrências de nome do órgão, siglas, logotipo e matrícula fixa | presentes no HEAD | 0 ocorrências (dados fictícios) se o projeto for publicado | P0 | ativo |

## 5. Guardrails

- Mudança só com objetivo associado (O#) ou item de backlog (B#); refatoração sem ganho mensurável é proibida.
- Nenhuma métrica da seção 2 pode piorar; se piorar, a mudança é revertida.
- Upgrade de versão major, mudança de arquitetura, remoção de funcionalidade e alteração de deploy exigem aprovação do dono (entram em "Decisões pendentes").
- No máximo uma feature nova por semana, de risco baixo, atrás de testes.
- Nenhuma evolução funcional antes da decisão sobre visibilidade (O1): só correções de segurança.
- Nenhum valor sensível (e-mail institucional, senha, matrícula, código de cargo) em commits, issues, PRs ou documentos; achados citam apenas `caminho:linha`.
- Testes e desenvolvimento só com dados fictícios e banco local descartável; nunca contra o banco do órgão.
- Reescrita de histórico (purga) só com aprovação explícita e separada do dono.

## 6. Backlog priorizado

- P0 = quebra funcionamento/segurança · P1 = risco alto · P2 = qualidade · P3 = melhoria

- [x] **B1 (P0, O1)** (2026-11-03; visibilidade `private` conferida na API do GitHub; publicação segue dependendo de sanitização) Decidir a visibilidade: tornar o repositório privado ou sanitizar — decisão registrada; se privado, visibilidade conferida no GitHub.
- [x] **B2 (P0, O1)** (2026-11-03, `03a00b4`, `abfa6dc`; cookie HttpOnly em vez de token no navegador; servidor só acessa os próprios dados) Exigir autenticação (JWT com segredo obrigatório por variável) em todas as rotas exceto login, com papéis servidor/gerente/secretaria — testes de rota: 401 sem token e 403 com papel insuficiente em cada rota.
- [x] **B3 (P0, O1)** (2026-11-03, `03a00b4`; matrícula vem da sessão, senha atual exigida) Reescrever `POST /nova-senha`: exige sessão e senha atual (ou token de redefinição de uso único) e nunca registra senha ou hash no log — teste de troca negada sem credencial; `grep -n "console.log" authController.js` sem campos de senha.
- [x] **B4 (P0, O1)** (2026-11-03, `03a00b4`; rota duplicada removida de `server.js`, que também devolvia o hash) Fechar `POST /register` (somente papel administrativo) e unificar a rota `/login` duplicada com mensagem única para falha — testes de registro anônimo negado e resposta idêntica para usuário inexistente e senha errada.
- [ ] **B5 (P0, O6)** (parcial 2026-11-03: matrícula fixa do formulário substituída pela sessão) Remover do HEAD credenciais e dados institucionais (contas do README, credenciais do Adminer, logotipo, siglas, lista de gerências, matrícula fixa) e planejar a purga do histórico — busca por cada padrão sem resultado no HEAD; plano de purga aprovado à parte.
- [x] **B6 (P0, O2)** (2026-11-03, `abfa6dc`, `56446c0`) Corrigir os 11 erros de lint, o erro de tipos em `alterar-senha/page.tsx` e as páginas vazias (`nova-senha`, `periodo-aquisitivo`) — `npm run lint`, `tsc --noEmit` e `npm run build` com exit 0.
- [x] **B7 (P1, O3)** (2026-10-28, `fe4ab18`, `13c7289`; `bcrypt` removido em 2026-11-03, `03a00b4`) Atualizar dependências na mesma major (`express` 4.x, `next` 15.5.x, `axios`, `form-data`) e remover `bcrypt` em favor de `bcryptjs` — `npm audit --omit=dev` com 0 critical e 0 high nos dois pacotes.
- [ ] **B8 (P1, O2)** Trocar `next/font/google` por fontes locais — `npm run build` sem acesso a `fonts.googleapis.com`.
- [ ] **B9 (P1, O4)** Testes do backend (Node test runner + supertest) para cálculo de períodos em `feriasService.js` e decisões de aprovação — ≥ 20 testes verdes sem banco real (Prisma mockado).
- [ ] **B10 (P1, O2)** Criar CI com jobs `api` (testes, audit) e `web` (lint, typecheck, build) — dois jobs verdes no PR.
- [ ] **B11 (P2, O5)** Reescrever o README para o código atual (Next.js + Express JS), sem credenciais, e remover dependências sem uso (`jsonwebtoken` até B2, `@prisma/client`, `prisma`, `cors` no frontend) — README conferido contra `package.json`; `npx depcheck` sem itens não usados.
- [ ] **B12 (P2, O5)** Montar ou remover `solicitacaoRoutes.js` (import sem extensão, `prisma` não importado) e corrigir `gerenciaController.js:94-95` (`ferias.MES` inexistente) — teste de rota cobre o caminho corrigido.
- [ ] **B14 (P1, O1)** Corrigir `criarSolicitacaoFerias`, que grava em `periodos` campos inexistentes no schema (`MATRICULA`, `PERIODO_AQUISITIVO`, `DIAS_SOL`, `MES`, `ANO`), e validar datas no servidor — teste de rota com Prisma mockado confere o payload contra o schema; solicitação concluída em banco descartável.
- [ ] **B15 (P1, O1)** Limitar tentativas de login por IP e matrícula — teste recebe 429 após o limite.
- [ ] **B13 (P3, O5)** Limpar resíduos de template (`layout.tsx`, `frontend/README.md`, `next.config.ts`, `postcss.config` duplicado) e corrigir `package.json` do backend (`name`, `license` MIT, scripts `dev`/`start`) — arquivos coerentes com o `LICENSE`.

## 7. Radar técnico

Itens a pesquisar e reavaliar toda semana (novas versões, bibliotecas, práticas). Cada entrada traz fonte e veredito.

| Data | Item | Fonte | Veredito (adotar / avaliar / descartar) | Motivo |
| --- | --- | --- | --- | --- |
| 2026-11-03 | Prisma 7.10 (lock em 6.9.0) | https://github.com/prisma/orm/releases/tag/7.10.0 | avaliar | major; só com banco descartável e aprovação |
| 2026-11-03 | Next.js 16.4.4 e Express 5.3.0 (lock em 15.5.28 e 4.22.3) | https://www.npmjs.com/package/next | avaliar | majors; sem aviso aberto nas linhas atuais |
| 2026-11-03 | `node --test` com `mock.module` | https://nodejs.org/api/test.html | adotado | testes de rota sem dependência nova (no lugar de supertest) |
| 2026-10-23 | Next.js 15.5.28 | https://nextjs.org/blog | adotado | aplicado em `fe4ab18` |
| 2026-10-23 | GitHub: remoção de dados sensíveis do histórico | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository | adotar | procedimento oficial para B5 (`git filter-repo` + pedido de limpeza de cache) |
| 2026-10-23 | OWASP ASVS 5.0 (autenticação e gestão de sessão) | https://owasp.org/www-project-application-security-verification-standard/ | adotar | checklist para B2 a B4 |
| 2026-10-23 | Prisma 6.x atual (lock em 6.9.0) | https://github.com/prisma/prisma/releases | avaliar | atualizar na mesma major junto de B7 |
| 2026-10-23 | `next/font/local` | https://nextjs.org/docs/app/api-reference/components/font | adotar | build sem rede externa (B8) |

## 8. Ideias de features

| # | Feature | Valor para o usuário/portfólio | Risco | Status (proposta / aprovada / implementada / descartada) |
| --- | --- | --- | --- | --- |
| F1 | Versão de portfólio com dados fictícios ("sistema interno de RH"), sem referência ao órgão | permite mostrar o fluxo de aprovação sem expor dados reais | médio (depende de autorização e sanitização) | proposta |
| F2 | Validação de regras de férias (período aquisitivo, fracionamento, antecedência mínima) no servidor | regra de negócio testável e visível | médio | proposta |
| F3 | Trilha de auditoria de decisões (quem aprovou, quando, observação) | rastreabilidade exigida em RH público | baixo | proposta |
| F4 | Exportação CSV do controle geral para a secretaria | relatório sem acesso direto ao banco | baixo | proposta |

## 9. Decisões pendentes do dono

- O sistema esteve ou está em uso real, com dados reais? O repositório já está privado; publicar exige sanitizar.
- **Quais `ID_TIPO_USER` são de gestão?** Sem `GESTOR_TIPOS_USUARIO` o painel, as gerências e o cadastro ficam bloqueados para todos.
- Há autorização do órgão para publicar uma versão derivada, mesmo com dados fictícios?
- A matrícula fixa em `solicitacao_ferias.tsx:31` pertence a uma pessoa real (entra na purga do histórico)?
- Existe fork ou clone público que exija pedido de remoção ao GitHub?
- As contas e a senha do README existiram em algum ambiente real (trocar antes de qualquer outra ação)?
- O projeto entra no portfólio depois de sanitizado?
- Aprova a purga do histórico e os upgrades de dependências listados em B7?

## 10. Registro semanal

| Data | Auditoria | Mudanças (commits) | Métricas | Próximo foco |
| --- | --- | --- | --- | --- |
| 2026-10-23 | Documento inicial e baseline | — | ver seção 2 | O1/B1 |
| 2026-11-03 | install, lint, tipos, build com fonte simulada e audit; sem feature (guardrail: só segurança) | `03a00b4` sessão, papéis e troca de senha; `abfa6dc` frontend com cookie; `56446c0` build restaurado | testes 0 → 46; lint 11 → 0 erros; typecheck 1 → 0; build FAIL → PASS; prod 0 vulnerabilidades | B5, B14, B8–B10; IDs de gestão aguardam o dono |

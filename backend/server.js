import 'dotenv/config';
import { assertAuthConfig } from './src/auth/session.js';
import { createApp } from './src/app.js';

assertAuthConfig();

const PORT = Number(process.env.PORT ?? 3001);
createApp().listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

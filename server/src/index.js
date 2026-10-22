import { config } from './config/env.js';
import { initRepository } from './repositories/index.js';
import { createApp } from './app.js';

try {
  await initRepository(config);
} catch (err) {
  console.error(`Falha ao inicializar o banco (${config.dbDriver}): ${err.message}`);
  process.exit(1);
}

if (config.dbDriver === 'memory') console.warn('DB_DRIVER=memory: dados ficam só em memória e somem ao reiniciar.');

const server = createApp(config).listen(config.port, () => {
  console.log(`HidrataMais ouvindo na porta ${config.port} (db: ${config.dbDriver})`);
});

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));

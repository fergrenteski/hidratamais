// Cria banco e containers no Cosmos DB se não existirem.
// Usado no boot do backend e também executável direto: `npm run init:cosmos`.
import { CosmosClient } from '@azure/cosmos';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function initCosmos({ endpoint, key, database }) {
  if (!endpoint || !key) throw new Error('COSMOS_ENDPOINT e COSMOS_KEY são obrigatórios para DB_DRIVER=cosmos');
  const client = new CosmosClient({ endpoint, key });

  // Throughput compartilhado no nível do banco (400 RU/s) para caber no free tier (1000 RU/s).
  const { database: db } = await client.databases.createIfNotExists({ id: database, throughput: 400 });
  const { container: users } = await db.containers.createIfNotExists({
    id: 'users',
    partitionKey: { paths: ['/id'] },
  });
  const { container: intakes } = await db.containers.createIfNotExists({
    id: 'intakes',
    partitionKey: { paths: ['/userId'] },
  });
  return { client, db, users, intakes };
}

// Executado direto? (comparação sem caixa: no Windows o drive pode vir como c: ou C:)
if (process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  const { config } = await import('../src/config/env.js');
  await initCosmos(config.cosmos);
  console.log(`Cosmos pronto: banco "${config.cosmos.database}" com containers users e intakes.`);
}

import { createMemoryRepository } from './memory.repository.js';
import { createCosmosRepository } from './cosmos.repository.js';

let repo;

export async function initRepository(config) {
  repo = config.dbDriver === 'cosmos' ? await createCosmosRepository(config.cosmos) : createMemoryRepository();
  return repo;
}

export const getRepository = () => {
  if (!repo) throw new Error('Repositório não inicializado');
  return repo;
};

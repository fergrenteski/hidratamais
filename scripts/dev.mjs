// Sobe a API (:8080) e o Vite (:5173) juntos. Funciona em Windows, macOS e Linux.
import { spawn } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(`Node ${process.versions.node} é antigo demais. Instale o Node 22 LTS (22.12 ou mais novo) em https://nodejs.org`);
  process.exit(1);
}

const run = (dir) => spawn(`npm run dev --prefix ${dir}`, { stdio: 'inherit', shell: true });
const children = [run('server'), run('client')];

// Se um cair, derruba o outro para não ficar meio app rodando.
for (const child of children) {
  child.on('exit', (code) => {
    children.forEach((c) => c.kill());
    process.exit(code ?? 0);
  });
}

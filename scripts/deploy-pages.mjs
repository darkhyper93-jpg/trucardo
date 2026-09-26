// Publica dist/ en la rama gh-pages del repo (GitHub Pages "deploy from branch").
// Arma el commit con un índice temporal del mismo repo: usa su identidad y credenciales.
// Uso: npm run deploy
import { execFileSync, execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const index = resolve('.git', 'deploy-index');
const env = { ...process.env, GIT_INDEX_FILE: index };
const git = (args, extraEnv) =>
  execFileSync('git', args, { env: extraEnv ?? process.env, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

// Comando fijo, sin nada interpolado.
execSync('npm run build', { stdio: 'inherit' });
writeFileSync('dist/.nojekyll', '');

try {
  rmSync(index, { force: true });
  git(['--work-tree=dist', 'add', '--all', '--force', '.'], env);
  const tree = git(['write-tree'], env);
  const commit = git(['commit-tree', tree, '-m', `Publicar Trucardo ${new Date().toISOString().slice(0, 16)}`]);
  git(['push', '--force', 'origin', `${commit}:refs/heads/gh-pages`]);
} finally {
  rmSync(index, { force: true });
}
console.log('Publicado en la rama gh-pages.');

// Publica dist/ en la rama gh-pages del repo (GitHub Pages "deploy from branch").
// Uso: npm run deploy
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

const remote = git(['remote', 'get-url', 'origin']);
// Misma identidad que el repo (email noreply de GitHub, no el personal).
const identity = ['-c', `user.name=${git(['config', 'user.name'])}`, '-c', `user.email=${git(['config', 'user.email'])}`];

execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });
writeFileSync('dist/.nojekyll', '');
rmSync('dist/.git', { recursive: true, force: true });

try {
  git(['init', '-q', '-b', 'gh-pages'], 'dist');
  git(['add', '-A'], 'dist');
  git([...identity, 'commit', '-q', '-m', `Publicar Trucardo ${new Date().toISOString().slice(0, 16)}`], 'dist');
  git(['push', '-q', '-f', remote, 'gh-pages'], 'dist');
} finally {
  rmSync('dist/.git', { recursive: true, force: true });
}
console.log('Publicado en la rama gh-pages.');

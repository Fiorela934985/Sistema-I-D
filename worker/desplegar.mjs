// Arma la carpeta del sitio (worker/sitio) y publica el Worker con el sitio y la API en la misma dirección.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, '..');
const sitio = path.join(aqui, 'sitio');
fs.rmSync(sitio, { recursive: true, force: true });
fs.mkdirSync(sitio);
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'data', 'assets']) {
  fs.cpSync(path.join(raiz, f), path.join(sitio, f), { recursive: true });
}
execSync('npx --yes wrangler@4 deploy', { cwd: aqui, stdio: 'inherit' });

import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = resolve(root, 'release');
const output = resolve(releaseDir, 'markdown-reader-pro.zip');

await mkdir(releaseDir, { recursive: true });
await rm(output, { force: true });

if (process.platform === 'win32') {
  await run('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${resolve(root, 'dist', '*')}" -DestinationPath "${output}" -Force`
  ]);
} else {
  await run('zip', ['-r', output, '.'], { cwd: resolve(root, 'dist') });
}

console.log(`Created ${output}`);

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

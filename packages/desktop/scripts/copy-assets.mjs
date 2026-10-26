import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicAssets = resolve(root, 'public/assets');
const coreAssets = dirname(fileURLToPath(import.meta.resolve('@md-reader/core/assets/github-markdown-light.css')));
const coreStyles = dirname(fileURLToPath(import.meta.resolve('@md-reader/core/styles/reader.css')));

await mkdir(publicAssets, { recursive: true });

await cp(coreAssets, publicAssets, { recursive: true, force: true });
await cp(resolve(coreStyles, 'reader.css'), resolve(publicAssets, 'reader.css'), { force: true });

console.log('Desktop assets copied to public/assets');

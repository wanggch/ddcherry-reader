import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const assets = resolve(dist, 'assets');

await rm(dist, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await cp(resolve(root, 'public'), dist, { recursive: true });

await Promise.all([
  bundle('src/content-script/index.ts', 'assets/contentScript.js', 'iife'),
  bundle('src/extension/background.js', 'assets/background.js', 'iife'),
  bundle('src/options/options.ts', 'assets/options.js', 'iife')
]);

await Promise.all([
  copyAsset('@md-reader/core/assets/github-markdown-light.css', 'assets/github-markdown-light.css'),
  copyAsset('@md-reader/core/assets/github-markdown-dark.css', 'assets/github-markdown-dark.css'),
  copyAsset('@md-reader/core/assets/highlight-github.css', 'assets/highlight-github.css'),
  copyAsset('@md-reader/core/assets/highlight-github-dark.css', 'assets/highlight-github-dark.css'),
  copyAsset('@md-reader/core/assets/katex.min.css', 'assets/katex.min.css'),
  copyKatexWoff2Fonts(),
  copyAsset('@md-reader/core/styles/reader.css', 'assets/reader.css'),
  copyAsset('./src/styles/options.css', 'assets/options.css')
]);

async function bundle(entry, outfile, format) {
  await esbuild.build({
    entryPoints: [resolve(root, entry)],
    outfile: resolve(dist, outfile),
    bundle: true,
    format,
    platform: 'browser',
    target: ['chrome88', 'firefox78', 'edge88'],
    sourcemap: false,
    minify: true,
    legalComments: 'none',
    logLevel: 'info',
    loader: { '.ts': 'ts' }
  });
}

async function copyAsset(from, to) {
  const resolved = from.startsWith('./') || from.startsWith('../') || from.startsWith('/')
    ? resolve(root, from)
    : fileURLToPath(import.meta.resolve(from));
  await cp(resolved, resolve(dist, to), { recursive: true });
}

async function copyKatexWoff2Fonts() {
  const source = fileURLToPath(import.meta.resolve('@md-reader/core/assets/fonts'));
  const target = resolve(dist, 'assets/fonts');
  await mkdir(target, { recursive: true });

  const { readdir, copyFile } = await import('node:fs/promises');
  const files = await readdir(source);
  await Promise.all(
    files
      .filter((file) => file.endsWith('.woff2'))
      .map((file) => copyFile(resolve(source, file), resolve(target, file)))
  );
}

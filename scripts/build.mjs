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
  bundle('src/extension/content-script.js', 'assets/contentScript.js', 'iife'),
  bundle('src/extension/background.js', 'assets/background.js', 'iife'),
  bundle('src/options/options.js', 'assets/options.js', 'iife')
]);

await Promise.all([
  copyAsset('node_modules/github-markdown-css/github-markdown-light.css', 'assets/github-markdown-light.css'),
  copyAsset('node_modules/github-markdown-css/github-markdown-dark.css', 'assets/github-markdown-dark.css'),
  copyAsset('node_modules/highlight.js/styles/github.css', 'assets/highlight-github.css'),
  copyAsset('node_modules/highlight.js/styles/github-dark.css', 'assets/highlight-github-dark.css'),
  copyAsset('node_modules/katex/dist/katex.min.css', 'assets/katex.min.css'),
  copyKatexWoff2Fonts(),
  copyAsset('src/styles/reader.css', 'assets/reader.css'),
  copyAsset('src/styles/options.css', 'assets/options.css')
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
    logLevel: 'info'
  });
}

async function copyAsset(from, to) {
  await cp(resolve(root, from), resolve(dist, to), { recursive: true });
}

async function copyKatexWoff2Fonts() {
  const source = resolve(root, 'node_modules/katex/dist/fonts');
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

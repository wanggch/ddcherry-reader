import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const distAssets = resolve(dist, 'assets');
const stylesDir = resolve(root, 'src/styles');
const STYLE_MODULES = [
  'tokens.css',
  'themes.css',
  'base.css',
  'chrome.css',
  'sidebar.css',
  'content.css',
  'code.css',
  'overlays.css',
  'print.css'
];

async function copyPackageAsset(spec, to) {
  const source = fileURLToPath(import.meta.resolve(spec));
  await cp(source, resolve(distAssets, to), { recursive: true });
}

async function copyKatexFonts() {
  const source = fileURLToPath(import.meta.resolve('katex/dist/fonts'));
  const target = resolve(distAssets, 'fonts');
  await mkdir(target, { recursive: true });
  const { readdir, copyFile } = await import('node:fs/promises');
  const files = await readdir(source);
  await Promise.all(
    files
      .filter((file) => file.endsWith('.woff2'))
      .map((file) => copyFile(resolve(source, file), resolve(target, file)))
  );
}

async function buildReaderCss() {
  const parts = [];
  for (const file of STYLE_MODULES) {
    parts.push(`/* >>> ${file} <<< */\n`);
    parts.push(await readFile(resolve(stylesDir, file), 'utf8'));
    parts.push('\n');
  }
  const combined = parts.join('');
  // Keep source aggregate in sync for consumers that read src/styles/reader.css.
  await writeFile(resolve(stylesDir, 'reader.css'), combined);
  await mkdir(resolve(dist, 'styles'), { recursive: true });
  await cp(stylesDir, resolve(dist, 'styles'), { recursive: true, force: true });
  await writeFile(resolve(dist, 'styles/reader.css'), combined);
}

await mkdir(distAssets, { recursive: true });
await buildReaderCss();

await Promise.all([
  copyPackageAsset('github-markdown-css/github-markdown-light.css', 'github-markdown-light.css'),
  copyPackageAsset('github-markdown-css/github-markdown-dark.css', 'github-markdown-dark.css'),
  copyPackageAsset('highlight.js/styles/github.css', 'highlight-github.css'),
  copyPackageAsset('highlight.js/styles/github-dark.css', 'highlight-github-dark.css'),
  copyPackageAsset('katex/dist/katex.min.css', 'katex.min.css'),
  copyKatexFonts()
]);

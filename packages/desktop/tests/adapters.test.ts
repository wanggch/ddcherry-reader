import { describe, expect, it } from 'vitest';
import { TauriAssetResolver } from '../src/adapters/tauri-asset-resolver.js';

describe('TauriAssetResolver', () => {
  it('resolves assets under /assets/', () => {
    const resolver = new TauriAssetResolver();
    expect(resolver.resolve('reader.css')).toBe('/assets/reader.css');
    expect(resolver.resolve('fonts/katex.woff2')).toBe('/assets/fonts/katex.woff2');
    expect(resolver.resolve('highlight-github.css')).toBe('/assets/highlight-github.css');
  });

  it('strips a redundant assets/ prefix to avoid double nesting', () => {
    const resolver = new TauriAssetResolver();
    expect(resolver.resolve('assets/highlight-github-dark.css')).toBe('/assets/highlight-github-dark.css');
    expect(resolver.resolve('/assets/reader.css')).toBe('/assets/reader.css');
  });
});

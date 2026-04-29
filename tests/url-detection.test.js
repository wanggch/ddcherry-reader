import { describe, expect, it } from 'vitest';
import { isMarkdownUrl, isProbablyRawMarkdownDocument } from '../src/extension/url-detection.js';

describe('isMarkdownUrl', () => {
  it.each([
    ['file:///Users/me/readme.md'],
    ['file:///C:/docs/spec.markdown'],
    ['https://example.com/notes.mkd?raw=1'],
    ['https://example.com/guide.mdx#intro'],
    ['http://example.com/plain.txt']
  ])('accepts supported Markdown-like URLs: %s', (url) => {
    expect(isMarkdownUrl(url)).toBe(true);
  });

  it.each([
    ['https://example.com/index.html'],
    ['chrome://extensions'],
    ['about:blank'],
    ['https://example.com/readme.md/image.png']
  ])('rejects non-Markdown URLs: %s', (url) => {
    expect(isMarkdownUrl(url)).toBe(false);
  });
});

describe('isProbablyRawMarkdownDocument', () => {
  it('accepts plain preformatted Markdown bodies', () => {
    document.body.innerHTML = '<pre># Title\n\n- item</pre>';
    expect(isProbablyRawMarkdownDocument(window.location.href, document)).toBe(true);
  });

  it('rejects already-rendered HTML documents', () => {
    document.body.innerHTML = '<main><h1>Title</h1><p>Body</p></main>';
    expect(isProbablyRawMarkdownDocument('https://example.com/index.html', document)).toBe(false);
  });
});

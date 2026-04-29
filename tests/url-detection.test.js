import { describe, expect, it } from 'vitest';
import { isMarkdownUrl, isProbablyRawMarkdownDocument } from '../src/extension/url-detection.js';

describe('isMarkdownUrl', () => {
  it.each([
    ['file:///Users/me/readme.md'],
    ['file:///C:/docs/spec.markdown'],
    ['file:///Users/me/notes.mkd'],
    ['file:///Users/me/guide.mdx'],
    ['file:///Users/me/plain.txt']
  ])('accepts supported Markdown-like URLs: %s', (url) => {
    expect(isMarkdownUrl(url)).toBe(true);
  });

  it.each([
    ['file:///Users/me/index.html'],
    ['chrome://extensions'],
    ['about:blank'],
    ['file:///Users/me/readme.md/image.png'],
    ['https://example.com/readme.md'],
    ['http://example.com/readme.md']
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
    expect(isProbablyRawMarkdownDocument('file:///Users/me/index.html', document)).toBe(false);
  });
});

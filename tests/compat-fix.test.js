import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { prepareMarkdownDocumentForRendering } from '../src/extension/compat-fix.js';

describe('prepareMarkdownDocumentForRendering', () => {
  it('captures extensionless HTTP raw Markdown and rebuilds a standards-mode document', () => {
    const dom = new JSDOM('<pre># Title\n\nInline math $a^2$.</pre>', {
      url: 'http://192.168.31.253:9000/docs/2.0.0/'
    });

    const result = prepareMarkdownDocumentForRendering(
      dom.window.location.href,
      dom.window.document
    );

    expect(result.markdown).toBe('# Title\n\nInline math $a^2$.');
    expect(result.didRewriteDocument).toBe(true);
    expect(dom.window.document.compatMode).toBe('CSS1Compat');
    expect(dom.window.document.body.textContent).toBe('');
  });

  it('does not rewrite ordinary HTML pages even when they are in quirks mode', () => {
    const dom = new JSDOM('<main><h1>Title</h1><p>Body</p></main>', {
      url: 'https://example.com/page'
    });

    const result = prepareMarkdownDocumentForRendering(
      dom.window.location.href,
      dom.window.document
    );

    expect(result.markdown).toBe('');
    expect(result.didRewriteDocument).toBe(false);
    expect(dom.window.document.compatMode).toBe('BackCompat');
    expect(dom.window.document.querySelector('main')).not.toBeNull();
  });
});

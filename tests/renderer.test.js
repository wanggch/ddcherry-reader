import { describe, expect, it } from 'vitest';
import { renderMarkdown, extractToc, parseCustomCssImports } from '../src/markdown/renderer.js';

describe('renderMarkdown', () => {
  it('renders GitHub flavored Markdown with task lists, tables, footnotes, emoji, math, and Mermaid blocks', async () => {
    const markdown = [
      '# Project Plan',
      '',
      '- [x] Ship MVP :rocket:',
      '- [ ] Add polish',
      '',
      '| Feature | Status |',
      '| --- | --- |',
      '| TOC | Done |',
      '',
      'Water is H~2~O and 2^10^ is 1024.',
      '',
      'Inline math $a^2 + b^2 = c^2$.',
      '',
      '```mermaid',
      'flowchart TD',
      '  A --> B',
      '```',
      '',
      'A note.[^1]',
      '',
      '[^1]: Footnote body'
    ].join('\n');

    const result = await renderMarkdown(markdown, { sanitize: true });

    expect(result.html).toContain('<h1 id="project-plan"');
    expect(result.html).toContain('contains-task-list');
    expect(result.html).toContain('task-list-item-checkbox');
    expect(result.html).toContain('<table>');
    expect(result.html).toContain('🚀');
    expect(result.html).toContain('<sub>2</sub>');
    expect(result.html).toContain('<sup>10</sup>');
    expect(result.html).toContain('katex');
    expect(result.html).toContain('mermaid');
    expect(result.html).toContain('footnotes');
    expect(result.toc).toEqual([{ id: 'project-plan', level: 1, text: 'Project Plan' }]);
  });

  it('sanitizes unsafe script content while preserving allowed Markdown HTML', async () => {
    const markdown = [
      '# Safe',
      '',
      '<script>window.evil = true</script>',
      '<details><summary>More</summary><p>Allowed details</p></details>'
    ].join('\n');

    const result = await renderMarkdown(markdown, { sanitize: true });

    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('<details>');
    expect(result.html).toContain('Allowed details');
  });
});

describe('extractToc', () => {
  it('extracts heading hierarchy from rendered HTML', () => {
    const toc = extractToc(`
      <h1 id="intro">Intro</h1>
      <h2 id="install">Install <a href="#install">#</a></h2>
      <h3 id="local-files">Local Files</h3>
    `);

    expect(toc).toEqual([
      { id: 'intro', level: 1, text: 'Intro' },
      { id: 'install', level: 2, text: 'Install' },
      { id: 'local-files', level: 3, text: 'Local Files' }
    ]);
  });
});

describe('parseCustomCssImports', () => {
  it('collects CSS imports and returns Markdown without import comments', () => {
    const parsed = parseCustomCssImports([
      '<!-- @import "style.css" -->',
      '<!-- @import "./theme/print.css" -->',
      '# Document'
    ].join('\n'));

    expect(parsed.imports).toEqual(['style.css', './theme/print.css']);
    expect(parsed.markdown.trim()).toBe('# Document');
  });
});

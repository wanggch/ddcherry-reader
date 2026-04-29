import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { enhanceMermaidDiagrams } from '../src/extension/mermaid-viewer.js';

describe('enhanceMermaidDiagrams', () => {
  it('adds a fullscreen control that opens and closes a cloned Mermaid diagram', () => {
    document.body.innerHTML = `
      <div id="root">
        <main class="md-reader-content">
          <div class="mermaid" data-processed="true">
            <svg viewBox="0 0 100 50"><text>A to B</text></svg>
          </div>
        </main>
      </div>
    `;

    const root = document.getElementById('root');

    enhanceMermaidDiagrams(root);

    const button = root.querySelector('.md-reader-mermaid-zoom');
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Fullscreen Mermaid diagram');
    expect(button.querySelector('svg').getAttribute('width')).toBe('13');
    expect(button.innerHTML).toContain('<circle cx="11" cy="11" r="7"');
    expect(button.innerHTML).toContain('<path d="m21 21-4.35-4.35"');

    button.click();

    const viewer = root.querySelector('.md-reader-mermaid-viewer');
    expect(viewer.hidden).toBe(false);
    expect(viewer.querySelector('.mermaid svg text').textContent).toBe('A to B');

    viewer.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(viewer.hidden).toBe(true);
    expect(viewer.querySelector('.md-reader-mermaid-viewer__canvas').innerHTML).toBe('');
  });

  it('is idempotent and skips failed Mermaid diagrams', () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-processed="true"><svg></svg></div>
        <div class="mermaid mermaid-error">Mermaid render error</div>
      </div>
    `;

    const root = document.getElementById('root');

    enhanceMermaidDiagrams(root);
    enhanceMermaidDiagrams(root);

    expect(root.querySelectorAll('.md-reader-mermaid-zoom')).toHaveLength(1);
    expect(root.querySelector('.mermaid-error').closest('.md-reader-mermaid-frame')).toBeNull();
  });

  it('scales fullscreen Mermaid SVGs toward the viewport instead of keeping the inline size', () => {
    const css = readFileSync('src/styles/reader.css', 'utf8');

    expect(css).toContain('.md-reader-mermaid-viewer__canvas');
    expect(css).toContain('padding: 24px;');
    expect(css).toContain('width: 28px;');
    expect(css).toContain('height: 28px;');
    expect(css).toContain('width: min(1680px, 98vw);');
    expect(css).toContain('height: min(1040px, 92vh);');
    expect(css).toContain('min-width: clamp(920px, 92vw, 1680px);');
    expect(css).not.toContain('.md-reader-mermaid-viewer__diagram :is(text, tspan, .label, .nodeLabel, .edgeLabel, .cluster-label)');
    expect(css).not.toContain('font-size: 1.18em !important;');
  });
});

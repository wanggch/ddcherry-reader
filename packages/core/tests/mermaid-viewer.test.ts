import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { enhanceMermaidDiagrams } from '../src/ui/mermaid-viewer.js';

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
    if (!root) throw new Error('root not found');

    enhanceMermaidDiagrams(root);

    const button = root.querySelector('.md-reader-mermaid-zoom');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('aria-label')).toBe('Fullscreen Mermaid diagram');
    expect(button?.querySelector('svg')?.getAttribute('width')).toBe('13');
    expect(button?.innerHTML).toContain('<circle cx="11" cy="11" r="7"');
    expect(button?.innerHTML).toContain('<path d="m21 21-4.35-4.35"');

    (button as HTMLElement)?.click();

    const viewer = root.querySelector('.md-reader-mermaid-viewer') as HTMLElement | null;
    expect(viewer?.hidden).toBe(false);
    expect(viewer?.querySelector('.mermaid svg text')?.textContent).toBe('A to B');

    viewer?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(viewer?.hidden).toBe(true);
    expect(viewer?.querySelector('.md-reader-mermaid-viewer__canvas')?.innerHTML).toBe('');
  });

  it('releases Mermaid inline max-width on the fullscreen clone so the diagram can grow', () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-processed="true">
          <svg viewBox="0 0 240 80" width="100%" style="max-width: 240px;"><text>Small</text></svg>
        </div>
        <div class="mermaid" data-processed="true">
          <svg viewBox="0 0 180 90" width="100%" style="max-width: 180px;"><text>Other</text></svg>
        </div>
      </div>
    `;

    const root = document.getElementById('root');
    if (!root) throw new Error('root not found');

    enhanceMermaidDiagrams(root);

    const buttons = root.querySelectorAll('.md-reader-mermaid-zoom');
    (buttons[0] as HTMLElement).click();

    const viewerSvg = root.querySelector('.md-reader-mermaid-viewer__diagram > svg') as SVGSVGElement | null;
    expect(viewerSvg?.getAttribute('viewBox')).toBe('0 0 240 80');
    expect(viewerSvg?.style.maxWidth).toBe('');
    expect(viewerSvg?.getAttribute('style') ?? '').not.toMatch(/max-width:\s*240px/);

    const inlineSvgs = root.querySelectorAll('.md-reader-mermaid-frame > .mermaid > svg');
    expect((inlineSvgs[0] as SVGSVGElement).style.maxWidth).toBe('240px');
    expect((inlineSvgs[1] as SVGSVGElement).style.maxWidth).toBe('180px');

    root.querySelector('.md-reader-mermaid-viewer__close')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect((inlineSvgs[0] as SVGSVGElement).style.maxWidth).toBe('240px');
    expect((inlineSvgs[1] as SVGSVGElement).style.maxWidth).toBe('180px');
    expect(root.querySelector('.md-reader-mermaid-viewer__diagram > svg')).toBeNull();
  });

  it('is idempotent and skips failed Mermaid diagrams', () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-processed="true"><svg></svg></div>
        <div class="mermaid mermaid-error">Mermaid render error</div>
      </div>
    `;

    const root = document.getElementById('root');
    if (!root) throw new Error('root not found');

    enhanceMermaidDiagrams(root);
    enhanceMermaidDiagrams(root);

    expect(root.querySelectorAll('.md-reader-mermaid-zoom')).toHaveLength(1);
    expect(root.querySelector('.mermaid-error')?.closest('.md-reader-mermaid-frame')).toBeNull();
  });

  it('fits fullscreen Mermaid SVGs inside the viewer without horizontal scrollbars', () => {
    const css = readFileSync('src/styles/overlays.css', 'utf8');
    const canvasRule = css.match(/\.md-reader-mermaid-viewer__canvas\s*\{[^}]+\}/)?.[0] ?? '';
    const diagramRule = css.match(/\.md-reader-mermaid-viewer__diagram\s*\{[^}]+\}/)?.[0] ?? '';
    const svgRule = css.match(/\.md-reader-mermaid-viewer__diagram svg\s*\{[^}]+\}/)?.[0] ?? '';

    expect(css).toContain('.md-reader-mermaid-viewer__canvas');
    expect(css).toContain('padding: 24px;');
    expect(css).toContain('width: 28px;');
    expect(css).toContain('height: 28px;');
    expect(css).toContain('width: min(1680px, 98vw);');
    expect(css).toContain('height: min(1040px, 92vh);');
    expect(canvasRule).toContain('overflow: hidden;');
    expect(diagramRule).toContain('width: 100%;');
    expect(diagramRule).toContain('height: 100%;');
    expect(svgRule).toContain('width: 100%;');
    expect(svgRule).toContain('height: 100%;');
    expect(svgRule).toContain('max-width: 100%;');
    expect(svgRule).toContain('max-height: 100%;');
    expect(svgRule).toContain('min-width: 0;');
    expect(svgRule).not.toContain('min-width: clamp(920px, 92vw, 1680px);');
    expect(svgRule).not.toContain('max-width: none;');
    expect(css).not.toContain('.md-reader-mermaid-viewer__diagram :is(text, tspan, .label, .nodeLabel, .edgeLabel, .cluster-label)');
    expect(css).not.toContain('font-size: 1.18em !important;');
  });

  it('keeps fitting fullscreen Mermaid diagrams centered while allowing tall diagrams to scroll from the edge', () => {
    const css = readFileSync('src/styles/overlays.css', 'utf8');
    const canvasRule = css.match(/\.md-reader-mermaid-viewer__canvas\s*\{[^}]+\}/)?.[0] ?? '';

    expect(canvasRule).toContain('place-items: safe center;');
    expect(canvasRule).toContain('box-sizing: border-box;');
    expect(canvasRule).not.toContain('place-items: start center;');
    expect(canvasRule).not.toContain('place-items: center;');
  });
});

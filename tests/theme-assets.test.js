import { describe, expect, it } from 'vitest';
import { ensureThemeStyles } from '../src/extension/theme-assets.js';

describe('ensureThemeStyles', () => {
  it('keeps only the active GitHub and highlight stylesheets in the page', () => {
    const runtimeUrl = (path) => `chrome-extension://extension/${path}`;

    ensureThemeStyles('light', document, runtimeUrl);
    ensureThemeStyles('dark', document, runtimeUrl);

    const themeLinks = [...document.querySelectorAll('link[data-md-reader-theme-style]')];
    const staticLinks = [...document.querySelectorAll('link[data-md-reader-static-style]')];

    expect(themeLinks).toHaveLength(2);
    expect(themeLinks.map((link) => link.id).sort()).toEqual([
      'md-reader-github-theme',
      'md-reader-highlight-theme'
    ]);
    expect(themeLinks.every((link) => link.disabled === false)).toBe(true);
    expect(document.querySelector('#md-reader-github-theme').href).toContain('github-markdown-dark.css');
    expect(document.querySelector('#md-reader-highlight-theme').href).toContain('highlight-github-dark.css');
    expect(document.querySelector('#md-reader-github-light')).toBeNull();
    expect(document.querySelector('#md-reader-github-dark')).toBeNull();
    expect(staticLinks.map((link) => link.id).sort()).toEqual([
      'md-reader-katex',
      'md-reader-layout'
    ]);
  });
});

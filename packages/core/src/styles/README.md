# Reader styles

Source modules are concatenated into `reader.css` at build time (`scripts/copy-assets.mjs`).

| File | Responsibility |
|------|----------------|
| `tokens.css` | Spacing, geometry, font stacks, default semantics |
| `themes.css` | Per-theme **color** tokens only |
| `base.css` | Document base, selection, scrollbar, reduced-motion |
| `chrome.css` | Toolbar, progress, theme/more menus, font-size control |
| `sidebar.css` | Shell grid, TOC, file tree |
| `content.css` | Reading measure, headings, tables, admonitions, footnotes |
| `code.css` | Code blocks via `--md-reader-code-*` tokens |
| `overlays.css` | Mermaid, lightbox, loader |
| `print.css` | Print rules |
| `reader.css` | Generated aggregate (do not hand-edit long-term) |

## Density

Desktop sets `html[data-md-reader-density="desktop"]` for thinner chrome and icon-first toolbar labels.

## Custom CSS

Prefer overriding tokens (not deep selectors):

```css
:root {
  --md-reader-content-measure: 40rem;
  --md-reader-content-leading: 1.8;
  --md-reader-font-reading: "Source Han Serif SC", serif;
  --md-reader-font-ui: system-ui, sans-serif;
  --md-reader-font-mono: "JetBrains Mono", ui-monospace, monospace;
  --md-reader-code-bg: #0b0d10;
  --md-reader-code-border: #30363d;
  --md-reader-inline-code-bg: rgba(110, 118, 129, 0.28);
  --md-reader-toolbar-height: 40px;
  --md-reader-tab-height: 34px;
}
```

### Common tokens

| Token | Meaning |
|-------|---------|
| `--md-reader-bg` | Page background |
| `--md-reader-panel` | Surfaces / menus |
| `--md-reader-text` / `--md-reader-muted` | Body / secondary text |
| `--md-reader-accent` / `--md-reader-accent-soft` | Brand actions |
| `--md-reader-border` / `--md-reader-border-subtle` | Dividers |
| `--md-reader-code-bg` | Fenced code background |
| `--md-reader-content-measure` | Reading column max width |
| `--md-reader-content-leading` | Body line-height |
| `--md-reader-font-ui` / `reading` / `mono` | Font stacks |
| `--md-reader-chrome-height` | Tabs + toolbar (progress / sticky) |

Markdown files can still use `<!-- @import "custom.css" -->` for document-local styles.

import { preparedMarkdownDocument } from './compat-fix.js';
import mermaid from 'mermaid';
import { getRawMarkdownFromDocument, isProbablyRawMarkdownDocument } from './url-detection.js';
import { DEFAULT_PREFERENCES, getPreferences, savePreferences } from './preferences.js';
import { ensureThemeStyles } from './theme-assets.js';

const REFRESH_INTERVAL_MS = 2000;

let originalMarkdown = '';
let renderedMarkdown = '';
let preferences = { ...DEFAULT_PREFERENCES };
let rawMode = false;
let refreshTimer = null;
let rendererModulePromise = null;

main().catch((error) => {
  showFallbackError(error);
});

async function main() {
  preferences = await getPreferences();

  const isMarkdownDocument = preparedMarkdownDocument.isMarkdownDocument
    || isProbablyRawMarkdownDocument(window.location.href, document);

  if (!preferences.enabled || !isMarkdownDocument) {
    return;
  }

  originalMarkdown = preparedMarkdownDocument.isMarkdownDocument
    ? preparedMarkdownDocument.markdown
    : getRawMarkdownFromDocument(document);
  rawMode = preferences.rawMode;

  await renderReader(originalMarkdown);
  startAutoRefresh();
}

async function renderReader(markdown) {
  renderedMarkdown = markdown;

  if (rawMode) {
    mountReader({
      html: `<pre class="md-reader-raw">${escapeHtml(markdown)}</pre>`,
      toc: [],
      cssImports: []
    });
    return;
  }

  const { renderMarkdown } = await getRendererModule();
  const result = await renderMarkdown(markdown, { sanitize: true });
  mountReader(result);
  await injectCustomCss(result.cssImports);
  await renderMermaid();
}

function getRendererModule() {
  rendererModulePromise ??= import('../markdown/renderer.js');
  return rendererModulePromise;
}

function mountReader(result) {
  const effectiveTheme = resolveTheme(preferences.theme);
  document.documentElement.dataset.mdReaderTheme = effectiveTheme;
  ensureThemeStyles(effectiveTheme);
  document.body.dataset.mdReaderRendered = 'true';
  document.title = document.title || inferTitle(renderedMarkdown) || 'Markdown Reader Pro';
  document.body.innerHTML = '';

  const root = document.createElement('div');
  root.id = 'md-reader-root';
  root.className = `md-reader md-reader--toc-${preferences.tocPosition}`;
  root.dataset.theme = effectiveTheme;
  root.innerHTML = `
    <header class="md-reader-toolbar" role="banner">
      <div class="md-reader-toolbar__brand">Markdown Reader Pro</div>
      <nav class="md-reader-toolbar__actions" aria-label="Reader actions">
        <button type="button" data-action="toggle-toc" aria-label="Toggle table of contents">TOC</button>
        <button type="button" data-action="toggle-theme" aria-label="Toggle theme">${effectiveTheme === 'dark' ? 'Dark' : 'Light'}</button>
        <button type="button" data-action="toggle-raw" aria-label="Toggle raw Markdown">${rawMode ? 'Preview' : 'Raw'}</button>
        <button type="button" data-action="refresh" aria-label="Refresh Markdown">Refresh</button>
        <button type="button" data-action="settings" aria-label="Open settings">Settings</button>
      </nav>
    </header>
    <div class="md-reader-progress" aria-hidden="true"></div>
    <div class="md-reader-shell">
      ${renderToc(result.toc)}
      <main class="md-reader-content markdown-body" tabindex="-1">${result.html}</main>
    </div>
    <div class="md-reader-lightbox" hidden>
      <button type="button" aria-label="Close image preview">Close</button>
      <img alt="">
    </div>
  `;

  document.body.append(root);
  bindReaderEvents(root);
  updateProgress();
}

function renderToc(toc) {
  if (!preferences.toc || rawMode || toc.length === 0) {
    return '<aside class="md-reader-sidebar" hidden></aside>';
  }

  const items = toc.map((item) => `
    <a class="md-reader-toc__item md-reader-toc__item--h${item.level}" href="#${item.id}">
      ${escapeHtml(item.text)}
    </a>
  `).join('');

  return `
    <aside class="md-reader-sidebar" aria-label="Table of contents">
      <div class="md-reader-sidebar__title">Contents</div>
      <nav class="md-reader-toc">${items}</nav>
    </aside>
  `;
}

function bindReaderEvents(root) {
  const toolbar = root.querySelector('.md-reader-toolbar');

  root.querySelector('[data-action="toggle-toc"]')?.addEventListener('click', () => {
    const sidebar = root.querySelector('.md-reader-sidebar');
    if (sidebar) {
      sidebar.hidden = !sidebar.hidden;
      root.classList.toggle('md-reader--sidebar-hidden', sidebar.hidden);
    }
  });

  root.querySelector('[data-action="toggle-theme"]')?.addEventListener('click', async () => {
    const current = resolveTheme(preferences.theme);
    preferences = {
      ...preferences,
      theme: current === 'dark' ? 'light' : 'dark'
    };
    await savePreferences({ theme: preferences.theme });
    await renderReader(renderedMarkdown);
  });

  root.querySelector('[data-action="toggle-raw"]')?.addEventListener('click', async () => {
    rawMode = !rawMode;
    await savePreferences({ rawMode });
    await renderReader(renderedMarkdown);
  });

  root.querySelector('[data-action="refresh"]')?.addEventListener('click', refreshFromSource);

  root.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
    globalThis.chrome?.runtime?.openOptionsPage?.();
    globalThis.browser?.runtime?.openOptionsPage?.();
  });

  root.querySelectorAll('.md-reader-toc__item').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', link.getAttribute('href'));
    });
  });

  root.querySelectorAll('.md-reader-content img').forEach((image) => {
    image.addEventListener('click', () => openLightbox(root, image));
  });

  root.querySelector('.md-reader-lightbox button')?.addEventListener('click', () => {
    root.querySelector('.md-reader-lightbox').hidden = true;
  });

  document.addEventListener('scroll', () => {
    updateProgress();
    if (toolbar) {
      toolbar.classList.toggle('md-reader-toolbar--scrolled', window.scrollY > 4);
    }
  }, { passive: true });

  observeActiveHeading(root);
}

function observeActiveHeading(root) {
  const headings = [...root.querySelectorAll('.md-reader-content [id]')];
  const tocLinks = [...root.querySelectorAll('.md-reader-toc__item')];
  if (headings.length === 0 || tocLinks.length === 0) {
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    const activeId = visible[0]?.target.id;
    if (!activeId) {
      return;
    }

    tocLinks.forEach((link) => {
      const isActive = decodeURIComponent(link.getAttribute('href').slice(1)) === activeId;
      link.classList.toggle('md-reader-toc__item--active', isActive);
    });
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

  headings.forEach((h) => observer.observe(h));
}

async function refreshFromSource() {
  try {
    const response = await fetch(window.location.href, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Refresh failed: ${response.status}`);
    }

    const nextMarkdown = await response.text();
    if (nextMarkdown !== renderedMarkdown) {
      await renderReader(nextMarkdown);
    }
  } catch {
    window.location.reload();
  }
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  if (!preferences.autoRefresh || window.location.protocol !== 'file:') {
    return;
  }

  refreshTimer = setInterval(refreshFromSource, REFRESH_INTERVAL_MS);
}

async function injectCustomCss(imports) {
  document.querySelectorAll('style[data-md-reader-custom-css]').forEach((node) => node.remove());

  await Promise.all(imports.map(async (importPath) => {
    try {
      const href = new URL(importPath, window.location.href).href;
      const response = await fetch(href, { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const style = document.createElement('style');
      style.dataset.mdReaderCustomCss = href;
      style.textContent = await response.text();
      document.head.append(style);
    } catch {
      // Custom CSS is optional; rendering should not fail when it is unavailable.
    }
  }));
}

async function renderMermaid() {
  const diagrams = [...document.querySelectorAll('.mermaid')];
  if (diagrams.length === 0) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: resolveTheme(preferences.theme) === 'dark' ? 'dark' : 'default'
  });

  try {
    if (typeof mermaid.run === 'function') {
      await mermaid.run({ nodes: diagrams });
    } else {
      mermaid.init(undefined, diagrams);
    }
  } catch (error) {
    diagrams.forEach((diagram) => {
      diagram.classList.add('mermaid-error');
      diagram.textContent = `Mermaid render error: ${error.message}`;
    });
  }
}

function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function openLightbox(root, sourceImage) {
  const lightbox = root.querySelector('.md-reader-lightbox');
  const preview = lightbox.querySelector('img');
  preview.src = sourceImage.currentSrc || sourceImage.src;
  preview.alt = sourceImage.alt || 'Markdown image preview';
  lightbox.hidden = false;
}

function updateProgress() {
  const progress = document.querySelector('.md-reader-progress');
  if (!progress) {
    return;
  }

  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
  progress.style.transform = `scaleX(${ratio})`;
}

function inferTitle(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function showFallbackError(error) {
  const raw = originalMarkdown || getRawMarkdownFromDocument(document);
  document.body.innerHTML = `
    <main class="md-reader-fallback">
      <h1>Markdown render failed</h1>
      <pre>${escapeHtml(error?.stack || error?.message || String(error))}</pre>
      <textarea readonly>${escapeHtml(raw)}</textarea>
    </main>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

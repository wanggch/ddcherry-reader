import { preparedMarkdownDocument } from './compat-fix.js';
import mermaid from 'mermaid';
import { getRawMarkdownFromDocument, isProbablyRawMarkdownDocument } from './url-detection.js';
import { DEFAULT_PREFERENCES, getPreferences, savePreferences } from './preferences.js';
import { ensureThemeStyles } from './theme-assets.js';

const REFRESH_INTERVAL_MS = 2000;
const THEME_CYCLE = ['light', 'paper', 'mint', 'vue', 'dark', 'night', 'purple', 'black'];
const THEME_ICONS = {
  light: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  dark: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  paper: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  mint: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  vue: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 19h20L12 2z"/><path d="M12 6l-6 10h12L12 6z"/></svg>`,
  night: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19c0-1.7-1.3-3-3-3c-1.1 0-2.1.6-2.6 1.5c-.3.5-.1 1.1.4 1.3c.2.1.3.2.4.4c.2.5.1 1.1-.3 1.4c-.5.4-1.1.4-1.6.1c-.9-.6-1.5-1.6-1.5-2.7c0-2.2 1.8-4 4-4c1.3 0 2.5.6 3.2 1.6c.5.7.8 1.6.8 2.5c0 2.5-2 4.5-4.5 4.5c-.4 0-.8 0-1.2-.1"/><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`,
  purple: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  black: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`
};
const THEME_LABELS = {
  light: 'Light',
  paper: 'Paper',
  mint: 'Mint',
  vue: 'Vue',
  dark: 'Dark',
  night: 'Night',
  purple: 'Purple',
  black: 'Black'
};

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
  const loader = showLoader();

  if (rawMode) {
    mountReader({
      html: `<pre class="md-reader-raw">${escapeHtml(markdown)}</pre>`,
      toc: [],
      cssImports: []
    });
    loader?.remove();
    return;
  }

  try {
    const { renderMarkdown } = await getRendererModule();
    const result = await renderMarkdown(markdown, { sanitize: true });
    mountReader(result);
    applyLazyLoading();
    addCopyButtons();
    await injectCustomCss(result.cssImports);
    await renderMermaid();
  } finally {
    loader?.remove();
  }
}

function getRendererModule() {
  rendererModulePromise ??= import('../markdown/renderer.js');
  return rendererModulePromise;
}

function mountReader(result) {
  const effectiveTheme = resolveTheme(preferences.theme);
  document.documentElement.dataset.mdReaderTheme = effectiveTheme;
  ensureThemeStyles(effectiveTheme);
  document.documentElement.style.setProperty('--md-reader-font-size', `${Math.max(12, Math.min(24, preferences.fontSize || 16))}px`);
  document.body.dataset.mdReaderRendered = 'true';
  document.title = document.title || inferTitle(renderedMarkdown) || 'Markdown Reader Pro';
  document.body.innerHTML = '';

  const root = document.createElement('div');
  root.id = 'md-reader-root';
  const hasSidebar = !rawMode && preferences.toc && result.toc?.length > 0;
  root.className = `md-reader md-reader--toc-${preferences.tocPosition}${hasSidebar ? '' : ' md-reader--sidebar-hidden'}`;
  root.dataset.theme = effectiveTheme;
  root.innerHTML = `
    <header class="md-reader-toolbar" role="banner">
      <div class="md-reader-toolbar__brand">
        <span class="md-reader-toolbar__brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </span>
        <span class="md-reader-toolbar__brand-text">MD Reader</span>
      </div>
      <nav class="md-reader-toolbar__actions" aria-label="Reader actions">
        <button type="button" data-action="toggle-toc" aria-label="Toggle table of contents" title="目录">
          <span class="md-reader-btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </span>
          <span class="md-reader-btn-label">目录</span>
        </button>
        <div class="md-reader-theme-dropdown">
          <button type="button" data-action="toggle-theme" aria-label="切换主题" title="切换主题" aria-haspopup="true" aria-expanded="false">
            <span class="md-reader-btn-icon">${THEME_ICONS[effectiveTheme] || THEME_ICONS.light}</span>
            <span class="md-reader-btn-label">主题</span>
            <span class="md-reader-btn-chevron">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </button>
          <div class="md-reader-theme-menu" role="menu" hidden>
            ${THEME_CYCLE.map(t => `
              <button type="button" role="menuitem" data-theme="${t}" class="md-reader-theme-menu__item${t === effectiveTheme ? ' md-reader-theme-menu__item--active' : ''}">
                <span class="md-reader-theme-menu__icon">${THEME_ICONS[t]}</span>
                <span class="md-reader-theme-menu__label">${THEME_LABELS[t]}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <!-- 
        <button type="button" data-action="toggle-raw" aria-label="Toggle raw Markdown" title="${rawMode ? '预览' : '源码'}">
          <span class="md-reader-btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${rawMode
                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                : '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'
              }
            </svg>
          </span>
          <span class="md-reader-btn-label">${rawMode ? '预览' : '源码'}</span>
        </button>
        <button type="button" data-action="refresh" aria-label="Refresh Markdown" title="刷新">
          <span class="md-reader-btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </span>
          <span class="md-reader-btn-label">刷新</span>
        </button>
        -->
        <div class="md-reader-font-size" title="字号 ${preferences.fontSize}px">
          <button type="button" data-action="font-decrease" aria-label="减小字号" title="减小字号">
            <span class="md-reader-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </span>
          </button>
          <span class="md-reader-font-size__value">${preferences.fontSize}</span>
          <button type="button" data-action="font-increase" aria-label="增大字号" title="增大字号">
            <span class="md-reader-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </span>
          </button>
        </div>
        <!-- 
        <button type="button" data-action="settings" aria-label="Open settings" title="设置">
          <span class="md-reader-btn-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span class="md-reader-btn-label">设置</span>
        </button>
        -->
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

  const themeDropdown = root.querySelector('.md-reader-theme-dropdown');
  const themeBtn = root.querySelector('[data-action="toggle-theme"]');
  const themeMenu = root.querySelector('.md-reader-theme-menu');

  function openThemeMenu() {
    themeMenu.hidden = false;
    themeBtn.setAttribute('aria-expanded', 'true');
  }

  function closeThemeMenu() {
    themeMenu.hidden = true;
    themeBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleThemeMenu() {
    if (themeMenu.hidden) {
      openThemeMenu();
    } else {
      closeThemeMenu();
    }
  }

  themeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleThemeMenu();
  });

  themeMenu?.querySelectorAll('[data-theme]').forEach((item) => {
    item.addEventListener('click', async () => {
      const nextTheme = item.dataset.theme;
      preferences = { ...preferences, theme: nextTheme };
      await savePreferences({ theme: nextTheme });
      closeThemeMenu();
      await renderReader(renderedMarkdown);
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (themeDropdown && !themeDropdown.contains(e.target)) {
      closeThemeMenu();
    }
  });

  root.querySelector('[data-action="font-decrease"]')?.addEventListener('click', async () => {
    const next = Math.max(12, (preferences.fontSize || 16) - 1);
    preferences = { ...preferences, fontSize: next };
    await savePreferences({ fontSize: next });
    document.documentElement.style.setProperty('--md-reader-font-size', `${next}px`);
    root.querySelector('.md-reader-font-size__value').textContent = next;
    root.querySelector('.md-reader-font-size').title = `字号 ${next}px`;
  });

  root.querySelector('[data-action="font-increase"]')?.addEventListener('click', async () => {
    const next = Math.min(24, (preferences.fontSize || 16) + 1);
    preferences = { ...preferences, fontSize: next };
    await savePreferences({ fontSize: next });
    document.documentElement.style.setProperty('--md-reader-font-size', `${next}px`);
    root.querySelector('.md-reader-font-size__value').textContent = next;
    root.querySelector('.md-reader-font-size').title = `字号 ${next}px`;
  });

  root.querySelector('[data-action="toggle-raw"]')?.addEventListener('click', async () => {
    rawMode = !rawMode;
    await savePreferences({ rawMode });
    await renderReader(renderedMarkdown);
  });

  root.querySelector('[data-action="refresh"]')?.addEventListener('click', refreshFromSource);

  root.querySelector('[data-action="settings"]')?.addEventListener('click', async () => {
    const runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime;
    try {
      if (runtime?.openOptionsPage) {
        await runtime.openOptionsPage();
        return;
      }
    } catch {
      // fallback below
    }
    try {
      if (runtime?.sendMessage) {
        await runtime.sendMessage({ action: 'openOptionsPage' });
        return;
      }
    } catch {
      // fallback below
    }
    // Final fallback: open options page directly
    try {
      const url = runtime?.getURL?.('options.html') ?? 'options.html';
      window.open(url, '_blank');
    } catch {
      // silently fail
    }
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

    let activeLink = null;
    tocLinks.forEach((link) => {
      const isActive = decodeURIComponent(link.getAttribute('href').slice(1)) === activeId;
      link.classList.toggle('md-reader-toc__item--active', isActive);
      if (isActive) activeLink = link;
    });

    // Scroll TOC panel so the active item stays visible
    activeLink?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDarkTheme(resolveTheme(preferences.theme)) ? 'dark' : 'default'
    });

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

const VALID_THEMES = new Set(['light', 'paper', 'mint', 'vue', 'dark', 'night', 'purple', 'black']);
const DARK_THEMES = new Set(['dark', 'night', 'purple', 'black']);

function resolveTheme(theme) {
  if (VALID_THEMES.has(theme)) {
    return theme;
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function isDarkTheme(theme) {
  return DARK_THEMES.has(theme);
}

function showLoader() {
  const existing = document.getElementById('md-reader-loader');
  if (existing) return existing;

  const el = document.createElement('div');
  el.id = 'md-reader-loader';
  el.innerHTML = `
    <div class="md-reader-loader__spinner" aria-hidden="true"></div>
    <span class="md-reader-loader__text">正在渲染…</span>
  `;
  document.body.append(el);
  return el;
}

function applyLazyLoading() {
  document.querySelectorAll('.md-reader-content img:not([loading])').forEach((img) => {
    img.loading = 'lazy';
  });
}

function addCopyButtons() {
  document.querySelectorAll('.md-reader-content pre').forEach((pre) => {
    if (pre.querySelector('.md-reader-copy-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'md-reader-copy-btn';
    btn.title = '复制代码';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `;

    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        btn.classList.add('md-reader-copy-btn--copied');
        btn.title = '已复制';
        setTimeout(() => {
          btn.classList.remove('md-reader-copy-btn--copied');
          btn.title = '复制代码';
        }, 2000);
      } catch {
        // silently fail
      }
    });

    pre.style.position = 'relative';
    pre.append(btn);
  });
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

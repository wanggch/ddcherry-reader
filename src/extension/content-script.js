import { preparedMarkdownDocument } from './compat-fix.js';
import mermaid from 'mermaid';
import { getRawMarkdownFromDocument, isProbablyRawMarkdownDocument } from './url-detection.js';
import { DEFAULT_PREFERENCES, getPreferences, savePreferences } from './preferences.js';
import { ensureThemeStyles } from './theme-assets.js';
import { enhanceMermaidDiagrams } from './mermaid-viewer.js';
import {
  scanMdTreeFromEntry,
  readFileEntryContent,
  flattenTree
} from './file-explorer.js';

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
let lastContentHash = null;
let isRefreshing = false;
let refreshTimer = null;
let rendererModulePromise = null;
let currentDirEntry = null;
let currentMdTree = [];
let currentMdFiles = [];
let currentFileName = '';
let currentFileEntry = null;
let hasFolderTab = false;
let dropHandlerAbortController = null;

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
  lastContentHash = computeHash(originalMarkdown);
  rawMode = preferences.rawMode;
  currentFileName = decodeURIComponent(window.location.pathname.split('/').pop() || '');

  await renderReader(originalMarkdown);
  setupBackgroundMessageListener();
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
  setFavicon();
  document.body.innerHTML = '';

  const root = document.createElement('div');
  root.id = 'md-reader-root';
  const hasSidebar = !rawMode && preferences.toc;
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
      </nav>
    </header>
    <div class="md-reader-progress" aria-hidden="true"></div>
    <div class="md-reader-shell">
      ${renderSidebar(result.toc)}
      <main class="md-reader-content markdown-body" tabindex="-1">${result.html}</main>
    </div>
    <div class="md-reader-lightbox" hidden>
      <button type="button" aria-label="Close image preview">Close</button>
      <img alt="">
    </div>
  `;

  document.body.append(root);
  bindReaderEvents(root);
  setupDropHandler(root);
  if (currentDirEntry) {
    addFolderTab(root);
    if (preferences.sidebarTab === 'folder') {
      void switchToTab(root, 'folder');
    }
  }
  updateProgress();
}

function renderSidebar(toc) {
  if (!preferences.toc || rawMode) {
    return '<aside class="md-reader-sidebar" hidden></aside>';
  }

  const hasToc = toc && toc.length > 0;
  const tocItems = hasToc
    ? toc.map((item) => `
      <a class="md-reader-toc__item md-reader-toc__item--h${item.level}" href="#${item.id}">
        ${escapeHtml(item.text)}
      </a>
    `).join('')
    : '';

  return `
    <aside class="md-reader-sidebar" aria-label="Sidebar">
      <div class="md-reader-sidebar-tabs" role="tablist">
        <button type="button" class="md-reader-sidebar-tab md-reader-sidebar-tab--active" data-tab="toc" role="tab" aria-selected="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          大纲
        </button>
      </div>
      <div class="md-reader-sidebar-panels">
        <div class="md-reader-sidebar-panel md-reader-sidebar-panel--active" data-panel="toc" role="tabpanel">
          ${hasToc ? `
            <div class="md-reader-sidebar__title">Contents</div>
            <nav class="md-reader-toc">${tocItems}</nav>
          ` : '<div class="md-reader-sidebar__empty">暂无目录</div>'}
        </div>
      </div>
    </aside>
  `;
}

function setupDropHandler(root) {
  dropHandlerAbortController?.abort();
  dropHandlerAbortController = new AbortController();

  const dropOverlay = document.createElement('div');
  dropOverlay.className = 'md-reader-drop-overlay';
  dropOverlay.hidden = true;
  dropOverlay.innerHTML = `
    <div class="md-reader-drop-message">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span>松开以打开文件夹</span>
    </div>
  `;
  root.append(dropOverlay);

  document.addEventListener('dragover', (e) => {
    const hasDirectory = [...(e.dataTransfer?.items ?? [])].some((item) => {
      const entry = item.webkitGetAsEntry?.();
      return entry && entry.isDirectory;
    });
    if (hasDirectory) {
      e.preventDefault();
      dropOverlay.hidden = false;
    }
  }, { signal: dropHandlerAbortController.signal });

  document.addEventListener('dragleave', (e) => {
    if (!root.contains(e.relatedTarget)) {
      dropOverlay.hidden = true;
    }
  }, { signal: dropHandlerAbortController.signal });

  document.addEventListener('drop', async (e) => {
    const items = [...(e.dataTransfer?.items ?? [])];
    const dirItem = items.find((item) => {
      const entry = item.webkitGetAsEntry?.();
      return entry && entry.isDirectory;
    });

    if (!dirItem) {
      dropOverlay.hidden = true;
      return;
    }

    e.preventDefault();
    dropOverlay.hidden = true;

    const dirEntry = dirItem.webkitGetAsEntry();
    currentDirEntry = dirEntry;
    currentFileEntry = null;

    addFolderTab(root);
    await switchToTab(root, 'folder');
  }, { signal: dropHandlerAbortController.signal });
}

function addFolderTab(root) {
  if (root.querySelector('[data-tab="folder"]')) {
    hasFolderTab = true;
    return;
  }

  const tabs = root.querySelector('.md-reader-sidebar-tabs');
  const panels = root.querySelector('.md-reader-sidebar-panels');
  if (!tabs || !panels) return;

  hasFolderTab = true;

  const tabBtn = document.createElement('button');
  tabBtn.type = 'button';
  tabBtn.className = 'md-reader-sidebar-tab';
  tabBtn.dataset.tab = 'folder';
  tabBtn.role = 'tab';
  tabBtn.setAttribute('aria-selected', 'false');
  tabBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    文件夹
  `;
  tabs.append(tabBtn);

  const panel = document.createElement('div');
  panel.className = 'md-reader-sidebar-panel';
  panel.dataset.panel = 'folder';
  panel.role = 'tabpanel';
  panel.innerHTML = '<div class="md-reader-folder-panel"></div>';
  panels.append(panel);

  tabBtn.addEventListener('click', async () => {
    await switchToTab(root, 'folder');
  });
}

async function switchToTab(root, tabName) {
  if (tabName !== preferences.sidebarTab) {
    preferences = { ...preferences, sidebarTab: tabName };
    await savePreferences({ sidebarTab: tabName });
  }

  root.querySelectorAll('.md-reader-sidebar-tab').forEach((t) => {
    const active = t.dataset.tab === tabName;
    t.classList.toggle('md-reader-sidebar-tab--active', active);
    t.setAttribute('aria-selected', String(active));
  });

  root.querySelectorAll('.md-reader-sidebar-panel').forEach((p) => {
    p.classList.toggle('md-reader-sidebar-panel--active', p.dataset.panel === tabName);
  });

  if (tabName === 'folder') {
    await renderFolderPanel(root);
  }
}

async function renderFolderPanel(root) {
  const panel = root.querySelector('[data-panel="folder"] .md-reader-folder-panel');
  if (!panel || !currentDirEntry) return;

  panel.innerHTML = '<div class="md-reader-folder-loading">加载中…</div>';

  try {
    currentMdTree = await scanMdTreeFromEntry(currentDirEntry);
    currentMdFiles = flattenTree(currentMdTree);

    if (currentMdFiles.length === 0) {
      panel.innerHTML = '<div class="md-reader-folder-empty">该文件夹中没有 Markdown 文件</div>';
      return;
    }

    const treeHtml = renderFileTree(currentMdTree, 0);
    panel.innerHTML = `<div class="md-reader-file-tree">${treeHtml}</div>`;
    bindFileTreeEvents(root, panel);
  } catch (err) {
    panel.innerHTML = `<div class="md-reader-folder-error">读取失败：${escapeHtml(err.message)}</div>`;
  }
}

function renderFileTree(tree, depth) {
  return tree.map((entry) => {
    const indent = depth * 12;

    if (entry.type === 'dir') {
      return `
        <div class="md-reader-tree-dir" style="padding-left: ${indent}px">
          <span class="md-reader-tree-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          <span class="md-reader-tree-label">${escapeHtml(entry.name)}</span>
        </div>
        <div class="md-reader-tree-children">
          ${renderFileTree(entry.children, depth + 1)}
        </div>
      `;
    }

    const isActive = entry.name === currentFileName;
    return `
      <button type="button" class="md-reader-file-item${isActive ? ' md-reader-file-item--active' : ''}" data-file-path="${escapeHtml(entry.path)}" style="padding-left: ${indent + 8}px">
        <span class="md-reader-file-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </span>
        <span class="md-reader-file-name">${escapeHtml(entry.name)}</span>
      </button>
    `;
  }).join('');
}

function bindFileTreeEvents(root, panel) {
  panel.querySelectorAll('[data-file-path]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const filePath = btn.dataset.filePath;
      const fileEntry = currentMdFiles.find((f) => f.path === filePath);
      if (!fileEntry) return;

      try {
        const content = await readFileEntryContent(fileEntry.entry);
        originalMarkdown = content;
        lastContentHash = computeHash(content);
        currentFileName = fileEntry.name;
        currentFileEntry = fileEntry.entry;
        await renderReader(content);
      } catch (err) {
        panel.insertAdjacentHTML('afterbegin', `<div class="md-reader-folder-error">无法打开文件：${escapeHtml(err.message)}</div>`);
      }
    });
  });
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

  root.querySelectorAll('.md-reader-sidebar-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      const tabName = tab.dataset.tab;
      if (tabName === preferences.sidebarTab) return;

      preferences = { ...preferences, sidebarTab: tabName };
      await savePreferences({ sidebarTab: tabName });

      root.querySelectorAll('.md-reader-sidebar-tab').forEach((t) => {
        const active = t.dataset.tab === tabName;
        t.classList.toggle('md-reader-sidebar-tab--active', active);
        t.setAttribute('aria-selected', String(active));
      });

      root.querySelectorAll('.md-reader-sidebar-panel').forEach((p) => {
        p.classList.toggle('md-reader-sidebar-panel--active', p.dataset.panel === tabName);
      });

      if (tabName === 'folder') {
        await renderFolderPanel(root);
      }
    });
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

  root.querySelector('[data-action="refresh"]')?.addEventListener('click', () => refreshFromSource());

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

    activeLink?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

  headings.forEach((h) => observer.observe(h));
}

// ── Auto-refresh: hash-based change detection with scroll position preservation ──

function setupBackgroundMessageListener() {
  const runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime;
  if (!runtime?.onMessage) return;

  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'checkFileChange') {
      checkFileChange().then(sendResponse).catch(() => sendResponse({ changed: false }));
      return true; // async response
    }
    return false;
  });
}

async function checkFileChange() {
  if (isRefreshing) return { changed: false };
  if (window.location.protocol !== 'file:') {
    if (!preferences.autoRefresh) return { changed: false };
  }

  try {
    const text = await readMarkdownSource();
    const hash = computeHash(text);

    // First check: just initialize the hash without triggering a re-render.
    if (lastContentHash === null) {
      lastContentHash = hash;
      return { changed: false };
    }

    if (hash !== lastContentHash) {
      await refreshWithMarkdown(text, hash, true);
      return { changed: true };
    }

    return { changed: false };
  } catch {
    return { changed: false };
  }
}

function computeHash(str) {
  let hash = 0;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Always enable auto-refresh for local file:// URLs
  if (window.location.protocol === 'file:') {
    refreshTimer = setInterval(() => checkFileChange().catch(() => {}), REFRESH_INTERVAL_MS);
    return;
  }

  if (!preferences.autoRefresh) {
    return;
  }

  refreshTimer = setInterval(() => checkFileChange().catch(() => {}), REFRESH_INTERVAL_MS);
}

async function refreshFromSource(preserveScroll = false) {
  try {
    const nextMarkdown = await readMarkdownSource();
    await refreshWithMarkdown(nextMarkdown, computeHash(nextMarkdown), preserveScroll);
  } catch {
    if (preserveScroll) {
      window.location.reload();
    }
  }
}

async function readMarkdownSource() {
  if (currentFileEntry) {
    return readFileEntryContent(currentFileEntry);
  }

  if (window.location.protocol === 'file:') {
    // Primary: XHR directly (works on file:// pages, status 0 = success)
    try {
      return await readFileViaXHR(window.location.href);
    } catch {
      // Fallback: ask background service worker
    }
    return readLocalMarkdownSourceFromBackground();
  }

  return fetchMarkdownText(window.location.href);
}

function readFileViaXHR(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
    xhr.onload = () => {
      if (xhr.status === 0 || xhr.status === 200) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`XHR failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.ontimeout = () => reject(new Error('XHR timeout'));
    xhr.timeout = 5000;
    xhr.send();
  });
}

async function readLocalMarkdownSourceFromBackground() {
  const runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime;
  if (!runtime?.sendMessage) {
    throw new Error('Extension runtime messaging is unavailable');
  }

  const response = await sendRuntimeMessage(runtime, {
    action: 'readMarkdownSource',
    url: window.location.href
  });
  if (response?.success && typeof response.markdown === 'string') {
    return response.markdown;
  }

  throw new Error(response?.error || 'Failed to read local Markdown source');
}

async function fetchMarkdownText(url) {
  const response = await fetch(withCacheBust(url), {
    cache: 'no-store',
    credentials: 'same-origin'
  });
  if (!response.ok) {
    throw new Error(`Refresh failed: ${response.status}`);
  }

  return response.text();
}

function withCacheBust(url) {
  const nextUrl = new URL(url, window.location.href);
  nextUrl.hash = '';
  nextUrl.searchParams.set('md_reader_refresh', `${Date.now()}`);
  return nextUrl.href;
}

function sendRuntimeMessage(runtime, message) {
  const browserRuntime = globalThis.browser?.runtime;

  if (runtime === browserRuntime && !globalThis.chrome?.runtime) {
    return runtime.sendMessage(message);
  }

  return new Promise((resolve, reject) => {
    try {
      runtime.sendMessage(message, (response) => {
        const lastError = globalThis.chrome?.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function refreshWithMarkdown(nextMarkdown, newHash, preserveScroll = false) {
  if (isRefreshing) return;
  isRefreshing = true;

  const savedPosition = preserveScroll ? captureScrollPosition() : null;

  try {
    if (newHash === lastContentHash) {
      return;
    }

    lastContentHash = newHash;
    originalMarkdown = nextMarkdown;
    await renderReader(nextMarkdown);

    if (savedPosition) {
      restoreScrollPosition(savedPosition);
    }
  } catch {
    if (preserveScroll) {
      window.location.reload();
    }
  } finally {
    isRefreshing = false;
  }
}

function captureScrollPosition() {
  const scrollY = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = maxScroll > 0 ? scrollY / maxScroll : 0;

  let headingId = null;
  const headings = [...document.querySelectorAll('.md-reader-content [id]')];
  for (let i = headings.length - 1; i >= 0; i--) {
    const rect = headings[i].getBoundingClientRect();
    if (rect.top <= 120) {
      headingId = headings[i].id;
      break;
    }
  }

  return { scrollY, ratio, headingId };
}

function restoreScrollPosition(position) {
  if (position.headingId) {
    const el = document.getElementById(position.headingId);
    if (el) {
      const rect = el.getBoundingClientRect();
      const offset = rect.top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, offset), behavior: 'instant' });
      return;
    }
  }

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 0) {
    window.scrollTo({ top: position.ratio * maxScroll, behavior: 'instant' });
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

async function injectCustomCss(imports) {
  document.querySelectorAll('style[data-md-reader-custom-css]').forEach((node) => node.remove());

  await Promise.all(imports.map(async (importPath) => {
    try {
      const href = new URL(importPath, window.location.href).href;
      let cssText;

      if (window.location.protocol === 'file:') {
        // Use background to fetch file:// CSS to avoid CORS errors in content script
        const response = await sendRuntimeMessage(
          globalThis.chrome?.runtime ?? globalThis.browser?.runtime,
          { action: 'readFileContent', url: href }
        );
        if (!response?.success) return;
        cssText = response.content;
      } else {
        const response = await fetch(href, { cache: 'no-store' });
        if (!response.ok) return;
        cssText = await response.text();
      }

      const style = document.createElement('style');
      style.dataset.mdReaderCustomCss = href;
      style.textContent = cssText;
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
    enhanceMermaidDiagrams(document);
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

function setFavicon() {
  const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect x='15' y='5' width='70' height='90' rx='8' fill='%234a90d9'/%3E%3Crect x='28' y='28' width='44' height='5' rx='2.5' fill='white'/%3E%3Crect x='28' y='42' width='30' height='5' rx='2.5' fill='white' opacity='0.7'/%3E%3Crect x='28' y='56' width='38' height='5' rx='2.5' fill='white' opacity='0.5'/%3E%3Crect x='28' y='70' width='24' height='5' rx='2.5' fill='white' opacity='0.4'/%3E%3C/svg%3E`;

  let link = document.querySelector('link[rel~="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = svg;
}

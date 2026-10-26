import type { FileProvider, FileContent } from './file/provider.js';
import type { StorageAdapter } from './storage/adapter.js';
import type { AssetResolver } from './assets/resolver.js';
import type { FileTreeNode } from './file/tree.js';
import type { LayoutMode, ReaderPreferences, ThemeName } from './config/schema.js';
import { DEFAULT_PREFERENCES, normalizePreferences } from './config/schema.js';
import { PreferencesManager } from './config/preferences.js';
import { renderMarkdown, extractToc, escapeHtml, type TocItem } from './renderer/index.js';
import { enhanceMermaidDiagrams } from './ui/mermaid-viewer.js';
import mermaid from 'mermaid';

type TocNode = { item: TocItem; children: TocNode[] };

/** Featured themes first (product defaults), then extras. */
const THEME_FEATURED: Exclude<ThemeName, 'system'>[] = ['light', 'paper', 'dark', 'black'];
const THEME_EXTRA: Exclude<ThemeName, 'system'>[] = ['mint', 'vue', 'night', 'purple'];
const THEME_CYCLE: Exclude<ThemeName, 'system'>[] = [...THEME_FEATURED, ...THEME_EXTRA];
const THEME_ICONS: Record<Exclude<ThemeName, 'system'>, string> = {
  light: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  dark: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  paper: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  mint: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`,
  vue: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 19h20L12 2z"/><path d="M12 6l-6 10h12L12 6z"/></svg>`,
  night: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19c0-1.7-1.3-3-3-3c-1.1 0-2.1.6-2.6 1.5c-.3.5-.1 1.1.4 1.3c.2.1.3.2.4.4c.2.5.1 1.1-.3 1.4c-.5.4-1.1.4-1.6.1c-.9-.6-1.5-1.6-1.5-2.7c0-2.2 1.8-4 4-4c1.3 0 2.5.6 3.2 1.6c.5.7.8 1.6.8 2.5c0 2.5-2 4.5-4.5 4.5c-.4 0-.8 0-1.2-.1"/><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`,
  purple: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
  black: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`
};
const THEME_LABELS: Record<Exclude<ThemeName, 'system'>, string> = {
  light: 'Light', paper: 'Paper', mint: 'Mint', vue: 'Vue', dark: 'Dark', night: 'Night', purple: 'Purple', black: 'Black'
};

function themeMenuItems(themes: Exclude<ThemeName, 'system'>[], active?: ThemeName): string {
  return themes.map((t) => `
    <button type="button" role="menuitem" data-theme="${t}" class="md-reader-theme-menu__item${t === active ? ' md-reader-theme-menu__item--active' : ''}">
      <span class="md-reader-theme-menu__swatch" aria-hidden="true"></span>
      <span class="md-reader-theme-menu__icon">${THEME_ICONS[t]}</span>
      <span class="md-reader-theme-menu__label">${THEME_LABELS[t]}</span>
    </button>
  `).join('');
}

export interface ReaderCoreOptions {
  container: HTMLElement;
  fileProvider: FileProvider;
  storageAdapter: StorageAdapter;
  assetResolver: AssetResolver;
  onSettingsClick?: () => void;
  onExportPdf?: () => void;
  /** When false, shell omits the embedded toolbar (desktop window chrome). Default true. */
  showToolbar?: boolean;
  /** Fired after theme / layout / source / prefs visual state changes (for external chrome). */
  onUiStateChange?: () => void;
}

export class ReaderCore {
  private readonly options: ReaderCoreOptions;
  private readonly preferences: PreferencesManager;
  private prefs: ReaderPreferences = { ...DEFAULT_PREFERENCES };
  private currentPath?: string;
  private currentMarkdown = '';
  private renderedMarkdown = '';
  private sourceMode = false;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private unwatch?: () => void;
  private folderTree?: FileTreeNode[];
  private lastContentHash = '';
  private root?: HTMLElement;
  private collapsedTocIds = new Set<string>();
  private systemThemeMql?: MediaQueryList;
  private systemThemeHandler?: (event: MediaQueryListEvent) => void;

  constructor(options: ReaderCoreOptions) {
    this.options = options;
    this.preferences = new PreferencesManager(options.storageAdapter);
  }

  async init(): Promise<void> {
    this.prefs = await this.preferences.getAll();
    // "Follow system" was removed: migrate stored value to the concrete theme
    // it currently resolves to, so the app stops reacting to OS theme changes.
    if (this.prefs.theme === 'system') {
      const resolved = this.resolveTheme('system');
      this.prefs = { ...this.prefs, theme: resolved };
      await this.preferences.update({ theme: resolved });
    }
    this.sourceMode = this.prefs.rawMode;
    this.applyThemeAttribute(this.resolveTheme(this.prefs.theme));
    this.bindSystemThemeListener();
  }

  get showToolbar(): boolean {
    return this.options.showToolbar !== false;
  }

  isSourceMode(): boolean {
    return this.sourceMode;
  }

  getLayoutMode(): LayoutMode {
    return this.prefs.layoutMode;
  }

  getThemePreference(): ThemeName {
    return this.prefs.theme;
  }

  getEffectiveTheme(): Exclude<ThemeName, 'system'> {
    return this.resolveTheme(this.prefs.theme);
  }

  getFontSize(): number {
    return this.prefs.fontSize;
  }

  isTocVisible(): boolean {
    return Boolean(this.prefs.toc) && !this.sourceMode;
  }

  toggleToc(): void {
    const root = this.root;
    if (!root) {
      void this.setTocVisible(!this.prefs.toc);
      return;
    }
    const sidebar = root.querySelector('.md-reader-sidebar');
    if (!sidebar) {
      void this.setTocVisible(!this.prefs.toc);
      return;
    }
    sidebar.toggleAttribute('hidden');
    const hidden = sidebar.hasAttribute('hidden');
    root.classList.toggle('md-reader--sidebar-hidden', hidden);
    void this.preferences.update({ toc: !hidden });
    this.prefs = { ...this.prefs, toc: !hidden };
    this.options.onUiStateChange?.();
  }

  triggerExportPdf(): void {
    if (this.options.onExportPdf) this.options.onExportPdf();
    else window.print();
  }

  triggerSettings(): void {
    this.options.onSettingsClick?.();
  }

  async openFile(path: string): Promise<void> {
    const content = await this.options.fileProvider.readFile(path);
    this.currentPath = path;
    this.lastContentHash = computeHash(content.content);
    await this.loadMarkdown(content.content, path);
    this.startWatching(path);
  }

  async openMarkdown(markdown: string, fileId?: string): Promise<void> {
    this.currentMarkdown = markdown;
    this.renderedMarkdown = markdown;
    if (fileId) this.currentPath = fileId;
    await this.render();
  }

  async reload(): Promise<void> {
    if (!this.currentPath) return;
    await this.openFile(this.currentPath);
  }

  async setTheme(theme: ThemeName): Promise<void> {
    this.prefs = { ...this.prefs, theme };
    await this.preferences.update({ theme });
    this.applyThemeAttribute(this.resolveTheme(theme));
    this.bindSystemThemeListener();
    await this.render();
    this.options.onUiStateChange?.();
  }

  async setViewMode(mode: 'source' | 'preview'): Promise<void> {
    this.sourceMode = mode === 'source';
    this.prefs = { ...this.prefs, rawMode: this.sourceMode };
    await this.preferences.update({ rawMode: this.sourceMode });
    await this.render();
    this.options.onUiStateChange?.();
  }

  async setLayoutMode(mode: LayoutMode): Promise<void> {
    this.prefs = { ...this.prefs, layoutMode: mode };
    await this.preferences.update({ layoutMode: mode });
    await this.render();
    this.options.onUiStateChange?.();
  }

  async setFontSize(size: number): Promise<void> {
    const next = Math.max(12, Math.min(24, size));
    this.prefs = { ...this.prefs, fontSize: next };
    await this.preferences.update({ fontSize: next });
    this.applyFontSize(next);
    this.options.onUiStateChange?.();
  }

  async setTocVisible(visible: boolean): Promise<void> {
    this.prefs = { ...this.prefs, toc: visible };
    await this.preferences.update({ toc: visible });
    await this.render();
    this.options.onUiStateChange?.();
  }

  async loadFolder(tree: FileTreeNode[]): Promise<void> {
    this.folderTree = tree;
    this.render();
  }

  async getPreferences(): Promise<ReaderPreferences> {
    return { ...this.prefs };
  }

  getRoot(): HTMLElement | undefined {
    return this.root;
  }

  async updatePreferences(partial: Partial<ReaderPreferences>): Promise<void> {
    this.prefs = { ...this.prefs, ...partial };
    await this.preferences.update(partial);
  }

  exportToHtml(): string {
    return this.renderedMarkdown;
  }

  destroy(): void {
    this.stopWatching();
    this.stopAutoRefresh();
    this.unbindSystemThemeListener();
    this.sidebarObserver?.disconnect();
    this.sidebarObserver = undefined;
    this.options.container.innerHTML = '';
  }

  private async loadMarkdown(markdown: string, path: string): Promise<void> {
    this.currentMarkdown = markdown;
    this.renderedMarkdown = markdown;
    this.currentPath = path;
    await this.render();
  }

  private async render(): Promise<void> {
    const container = this.options.container;
    const effectiveTheme = this.resolveTheme(this.prefs.theme);

    if (this.sourceMode) {
      const source = `<pre class="md-reader-source">${escapeHtml(this.renderedMarkdown)}</pre>`;
      container.innerHTML = this.buildShell({ html: source, toc: [] }, effectiveTheme);
    } else {
      const result = await renderMarkdown(this.renderedMarkdown, { sanitize: true });
      await this.injectCustomCss(result.cssImports);
      container.innerHTML = this.buildShell(result, effectiveTheme);
      await this.postRender(container);
    }

    this.root = container.firstElementChild as HTMLElement | null ?? undefined;
    if (this.root) {
      this.bindEvents(this.root);
      this.applySidebarWidth(this.prefs.tocWidth);
      this.observeSidebarResize();
      this.injectHighlightTheme(effectiveTheme);
      this.applyFontSize(this.prefs.fontSize);
    }
    this.options.onUiStateChange?.();
  }

  private applySidebarWidth(width?: number): void {
    const sidebar = this.root?.querySelector('.md-reader-sidebar') as HTMLElement | null;
    if (!sidebar || !width) return;
    // Clamp to sane bounds to avoid the sidebar becoming unusably narrow/wide.
    const clamped = Math.max(280, Math.min(width, 440));
    sidebar.style.width = `${clamped}px`;
  }

  private sidebarObserver?: ResizeObserver;
  private scrollContainer: HTMLElement | Window = window;

  private detectScrollContainer(element: HTMLElement): HTMLElement | Window {
    let el: HTMLElement | null = element;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (/(auto|scroll|overlay)/.test(style.overflowY + style.overflow)) {
        return el;
      }
      el = el.parentElement;
    }
    return window;
  }

  private getScrollTop(): number {
    return this.scrollContainer === window
      ? window.scrollY
      : (this.scrollContainer as HTMLElement).scrollTop;
  }

  private getScrollHeight(): number {
    if (this.scrollContainer === window) {
      return document.documentElement.scrollHeight - window.innerHeight;
    }
    const container = this.scrollContainer as HTMLElement;
    return container.scrollHeight - container.clientHeight;
  }

  private observeSidebarResize(): void {
    const sidebar = this.root?.querySelector('.md-reader-sidebar') as HTMLElement | null;
    if (!sidebar || typeof ResizeObserver === 'undefined') return;

    this.sidebarObserver?.disconnect();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    this.sidebarObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // Use the full border-box width so applying it later does not shrink by padding/border.
      const width = Math.round(entry.target.getBoundingClientRect().width);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.preferences.update({ tocWidth: width }).catch(() => {});
      }, 200);
    });
    this.sidebarObserver.observe(sidebar);
  }

  private applyThemeAttribute(effectiveTheme: Exclude<ThemeName, 'system'>): void {
    const root = document.documentElement;
    const previous = root.getAttribute('data-md-reader-theme');
    root.setAttribute('data-md-reader-theme', effectiveTheme);
    if (previous && previous !== effectiveTheme) {
      root.classList.add('md-reader-theme-animating');
      window.setTimeout(() => root.classList.remove('md-reader-theme-animating'), 220);
    }
  }

  private resolveTheme(theme: ThemeName): Exclude<ThemeName, 'system'> {
    if (theme !== 'system') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private bindSystemThemeListener(): void {
    this.unbindSystemThemeListener();
    if (this.prefs.theme !== 'system') return;
    this.systemThemeMql = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemThemeHandler = () => {
      if (this.prefs.theme !== 'system') return;
      const effective = this.resolveTheme('system');
      this.applyThemeAttribute(effective);
      this.injectHighlightTheme(effective);
      void this.render();
      this.options.onUiStateChange?.();
    };
    // Safari < 14 / some test mocks only support addListener.
    if (typeof this.systemThemeMql.addEventListener === 'function') {
      this.systemThemeMql.addEventListener('change', this.systemThemeHandler);
    } else if (typeof this.systemThemeMql.addListener === 'function') {
      this.systemThemeMql.addListener(this.systemThemeHandler);
    }
  }

  private unbindSystemThemeListener(): void {
    if (this.systemThemeMql && this.systemThemeHandler) {
      if (typeof this.systemThemeMql.removeEventListener === 'function') {
        this.systemThemeMql.removeEventListener('change', this.systemThemeHandler);
      } else if (typeof this.systemThemeMql.removeListener === 'function') {
        this.systemThemeMql.removeListener(this.systemThemeHandler);
      }
    }
    this.systemThemeMql = undefined;
    this.systemThemeHandler = undefined;
  }

  private applyFontSize(size: number): void {
    document.documentElement.style.setProperty('--md-reader-font-size', `${size}px`);
    document.querySelectorAll('.md-reader-font-size__value').forEach((el) => {
      el.textContent = String(size);
    });
    document.querySelectorAll('.md-reader-font-size').forEach((el) => {
      el.setAttribute('title', `字号 ${size}px`);
    });
  }

  private buildShell(result: { html: string; toc: ReturnType<typeof extractToc> }, effectiveTheme: Exclude<ThemeName, 'system'>): string {
    const hasSidebar = !this.sourceMode && this.prefs.toc;
    const sidebarClass = `md-reader--toc-${this.prefs.tocPosition}${hasSidebar ? '' : ' md-reader--sidebar-hidden'}`;
    const layoutClass = this.prefs.layoutMode === 'full' ? ' md-reader--layout-full' : '';
    const chromeClass = this.showToolbar ? '' : ' md-reader--external-chrome';
    const sourceClass = this.sourceMode ? ' md-reader--source' : '';

    return `
      <div class="md-reader ${sidebarClass}${layoutClass}${chromeClass}${sourceClass}" data-theme="${effectiveTheme}">
        ${this.showToolbar ? this.buildToolbar(effectiveTheme) : ''}
        <div class="md-reader-progress" aria-hidden="true"></div>
        <div class="md-reader-shell">
          ${this.buildSidebar(result.toc)}
          <main class="md-reader-content markdown-body" tabindex="-1">${result.html}</main>
        </div>
        <div class="md-reader-lightbox" hidden>
          <div class="md-reader-lightbox-backdrop"></div>
          <div class="md-reader-lightbox-toolbar">
            <span class="md-reader-lightbox-title"></span>
            <div class="md-reader-lightbox-actions">
              <button type="button" data-action="lightbox-zoom-out" aria-label="缩小" title="缩小">−</button>
              <span class="md-reader-lightbox-zoom">100%</span>
              <button type="button" data-action="lightbox-zoom-in" aria-label="放大" title="放大">+</button>
              <button type="button" data-action="lightbox-copy-url" aria-label="复制图片地址" title="复制图片地址">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button type="button" data-action="lightbox-close" aria-label="关闭" title="关闭">×</button>
            </div>
          </div>
          <div class="md-reader-lightbox-stage">
            <img alt="" />
          </div>
        </div>
      </div>
    `;
  }

  private buildToolbar(effectiveTheme: Exclude<ThemeName, 'system'>): string {
    const layoutFull = this.prefs.layoutMode === 'full';
    return `
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
          <span class="md-reader-toolbar__brand-text">DDCherry Reader</span>
        </div>
        <nav class="md-reader-toolbar__actions" aria-label="Reader actions">
          <button type="button" class="md-reader-toolbar__action-btn md-reader-toolbar__icon-button" data-action="toggle-toc" aria-label="目录" title="目录">
            <span class="md-reader-btn-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </span>
            <span class="md-reader-btn-label">目录</span>
          </button>
          <div class="md-reader-theme-dropdown">
            <button type="button" class="md-reader-toolbar__action-btn md-reader-toolbar__icon-button" data-action="toggle-theme" aria-label="切换主题" title="切换主题" aria-haspopup="true" aria-expanded="false">
              <span class="md-reader-btn-icon">${THEME_ICONS[effectiveTheme]}</span>
              <span class="md-reader-btn-label">主题</span>
            </button>
            <div class="md-reader-theme-menu" role="menu" hidden>
              <div class="md-reader-theme-menu__section">推荐</div>
              ${themeMenuItems(THEME_FEATURED, effectiveTheme)}
              <div class="md-reader-theme-menu__section">更多</div>
              ${themeMenuItems(THEME_EXTRA, effectiveTheme)}
            </div>
          </div>
          <div class="md-reader-more-dropdown">
            <button type="button" class="md-reader-toolbar__action-btn md-reader-toolbar__icon-button" data-action="toggle-more" aria-label="更多" title="更多" aria-haspopup="true" aria-expanded="false">
              <span class="md-reader-btn-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                </svg>
              </span>
              <span class="md-reader-btn-label">更多</span>
            </button>
            <div class="md-reader-more-menu" role="menu" hidden>
              <div class="md-reader-font-size" title="字号 ${this.prefs.fontSize}px">
                <button type="button" data-action="font-decrease" aria-label="减小字号" title="减小字号">
                  <span class="md-reader-btn-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                </button>
                <span class="md-reader-font-size__value">${this.prefs.fontSize}</span>
                <button type="button" data-action="font-increase" aria-label="增大字号" title="增大字号">
                  <span class="md-reader-btn-icon">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </span>
                </button>
              </div>
              <button type="button" role="menuitem" class="md-reader-more-menu__item" data-action="export-pdf" aria-label="导出 PDF" title="导出 PDF">
                <span class="md-reader-btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </span>
                <span>导出 PDF</span>
              </button>
              <button type="button" role="menuitem" class="md-reader-more-menu__item" data-action="toggle-source" aria-label="${this.sourceMode ? '退出 Source Mode' : '进入 Source Mode'}" title="${this.sourceMode ? '预览模式' : 'Source Mode'}" aria-pressed="${this.sourceMode}">
                <span class="md-reader-btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/>
                  </svg>
                </span>
                <span>${this.sourceMode ? '预览模式' : 'Source Mode'}</span>
              </button>
              <button type="button" role="menuitem" class="md-reader-more-menu__item" data-action="toggle-layout" aria-label="${layoutFull ? '切换到正常布局' : '切换到满屏布局'}" title="${layoutFull ? '正常布局' : '满屏布局'}" aria-pressed="${layoutFull}">
                <span class="md-reader-btn-icon">
                  ${layoutFull
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'}
                </span>
                <span>${layoutFull ? '正常布局' : '满屏布局'}</span>
              </button>
              <button type="button" role="menuitem" class="md-reader-more-menu__item" data-action="settings" aria-label="设置" title="设置">
                <span class="md-reader-btn-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </span>
                <span>设置</span>
              </button>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  private buildSidebar(toc: ReturnType<typeof extractToc>): string {
    if (!this.prefs.toc || this.sourceMode) {
      return '<aside class="md-reader-sidebar" hidden></aside>';
    }

    const tocItems = this.renderTocTree(this.buildTocTree(toc));

    const hasFolderTab = this.folderTree && this.folderTree.length > 0;

    const header = hasFolderTab
      ? `
        <div class="md-reader-sidebar__top">
          <div class="md-reader-sidebar-tabs" role="tablist">
            <button type="button" class="md-reader-sidebar-tab md-reader-sidebar-tab--active" data-tab="toc" role="tab" aria-selected="true">目录</button>
            <button type="button" class="md-reader-sidebar-tab" data-tab="folder" role="tab" aria-selected="false">文件夹</button>
          </div>
        </div>
      `
      : `
        <div class="md-reader-sidebar__top">
          <div class="md-reader-sidebar__title">Contents</div>
        </div>
      `;

    return `
      <aside class="md-reader-sidebar" aria-label="Sidebar">
        ${header}
        <div class="md-reader-sidebar-panels">
          <div class="md-reader-sidebar-panel md-reader-sidebar-panel--active" data-panel="toc" role="tabpanel">
            ${toc.length > 0 ? `
              <nav class="md-reader-toc">${tocItems}</nav>
            ` : '<div class="md-reader-sidebar__empty">暂无目录</div>'}
          </div>
          ${hasFolderTab ? `
            <div class="md-reader-sidebar-panel" data-panel="folder" role="tabpanel">
              <div class="md-reader-folder-panel">${this.renderFileTree(this.folderTree ?? [], 0)}</div>
            </div>
          ` : ''}
        </div>
      </aside>
    `;
  }

  private buildTocTree(toc: ReturnType<typeof extractToc>): TocNode[] {
    const roots: TocNode[] = [];
    const stack: TocNode[] = [];
    for (const item of toc) {
      const node: TocNode = { item, children: [] };
      while (stack.length > 0 && stack[stack.length - 1].item.level >= item.level) {
        stack.pop();
      }
      if (stack.length === 0) roots.push(node);
      else stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return roots;
  }

  private renderTocTree(nodes: TocNode[]): string {
    return nodes.map(({ item, children }) => {
      const hasChildren = children.length > 0;
      const isCollapsed = this.collapsedTocIds.has(item.id);
      const toggle = hasChildren
        ? `<button type="button" class="md-reader-toc__toggle" data-toc-toggle="${item.id}" aria-expanded="${!isCollapsed}" aria-label="切换章节" title="折叠/展开章节"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>`
        : '<span class="md-reader-toc__toggle-spacer"></span>';
      return `
        <div class="md-reader-toc__branch${isCollapsed ? ' is-collapsed' : ''}">
          <div class="md-reader-toc__row">
            ${toggle}
            <a class="md-reader-toc__item md-reader-toc__item--h${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>
          </div>
          ${hasChildren ? `<div class="md-reader-toc__children">${this.renderTocTree(children)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  private renderFileTree(tree: FileTreeNode[], depth: number): string {
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
          <div class="md-reader-tree-children">${this.renderFileTree(entry.children ?? [], depth + 1)}</div>
        `;
      }

      return `
        <button type="button" class="md-reader-file-item" data-file-id="${escapeHtml(entry.fileId)}" style="padding-left: ${indent + 8}px">
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

  private async postRender(root: HTMLElement): Promise<void> {
    this.applyLazyLoading(root);
    this.addCopyButtons(root);
    await this.renderMermaid(root);
    enhanceMermaidDiagrams(root);
  }

  private async injectCustomCss(imports: string[]): Promise<void> {
    const existing = new Set([...document.querySelectorAll('link[data-md-reader-css]')].map((el) => el.getAttribute('data-md-reader-css')));

    for (const cssPath of imports) {
      const resolved = this.currentPath
        ? this.options.fileProvider.resolveAssetPath(this.currentPath, cssPath)
        : cssPath;

      if (existing.has(resolved)) continue;

      try {
        const css = await this.options.fileProvider.readAsset(resolved);
        const style = document.createElement('style');
        style.setAttribute('data-md-reader-css', resolved);
        style.textContent = css;
        document.head.appendChild(style);
      } catch {
        // ignore failed custom css imports
      }
    }
  }

  private injectHighlightTheme(effectiveTheme: Exclude<ThemeName, 'system'>): void {
    const isDark = ['dark', 'night', 'purple', 'black'].includes(effectiveTheme);
    // Paths are relative to the package assets root (no "assets/" prefix).
    // Desktop resolves to /assets/<file>; extension maps to chrome-extension://.../assets/<file>.
    const cssPath = isDark ? 'highlight-github-dark.css' : 'highlight-github.css';
    const resolved = this.options.assetResolver.resolve(cssPath);

    const existing = document.querySelector('link[data-md-reader-highlight]') as HTMLLinkElement | null;
    if (existing && existing.getAttribute('data-md-reader-highlight') === resolved) {
      return;
    }

    existing?.remove();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = resolved;
    link.setAttribute('data-md-reader-highlight', resolved);
    document.head.appendChild(link);
  }

  private applyLazyLoading(root: HTMLElement): void {
    root.querySelectorAll('img').forEach((img) => {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
    });
  }

  private addCopyButtons(root: HTMLElement): void {
    root.querySelectorAll('pre code').forEach((code) => {
      const pre = code.closest('pre');
      if (!pre || pre.querySelector('.md-reader-copy-btn')) return;

      const rawText = code.textContent ?? '';
      const lineCount = rawText.split('\n').length;

      this.addLineNumbers(pre, code as HTMLElement, lineCount);

      const langMatch = [...code.classList].find((c) => c.startsWith('language-'));
      const lang = langMatch?.slice('language-'.length);
      if (lang && lang !== 'text' && lang !== 'plain' && !pre.querySelector('.md-reader-code-lang')) {
        const langTag = document.createElement('span');
        langTag.className = 'md-reader-code-lang';
        langTag.textContent = lang;
        pre.appendChild(langTag);
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'md-reader-copy-btn';
      copyBtn.setAttribute('aria-label', '复制代码');
      copyBtn.setAttribute('title', '复制');
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      `;

      const originalIcon = copyBtn.innerHTML;
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(rawText);
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          `;
          copyBtn.classList.add('md-reader-copy-btn--copied');
          setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
            copyBtn.classList.remove('md-reader-copy-btn--copied');
          }, 1500);
        } catch {
          copyBtn.setAttribute('title', '复制失败');
        }
      });

      pre.style.position = 'relative';
      pre.appendChild(copyBtn);
    });
  }

  private addLineNumbers(pre: Element, code: HTMLElement, lineCount: number): void {
    if (pre.classList.contains('md-reader-code--line-numbers')) return;
    pre.classList.add('md-reader-code--line-numbers');

    let wrapper = code.parentElement;
    if (!wrapper?.classList.contains('md-reader-code-wrapper')) {
      wrapper = document.createElement('div');
      wrapper.className = 'md-reader-code-wrapper';
      code.parentNode?.insertBefore(wrapper, code);
      wrapper.appendChild(code);
    }

    if (lineCount <= 1) return;

    const numbers = document.createElement('div');
    numbers.className = 'md-reader-code-line-numbers';
    numbers.setAttribute('aria-hidden', 'true');
    numbers.innerHTML = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join('');

    wrapper.insertBefore(numbers, code);
  }

  private async renderMermaid(root: HTMLElement): Promise<void> {
    const diagrams = root.querySelectorAll('.mermaid');
    if (diagrams.length === 0) return;

    try {
      mermaid.initialize({ startOnLoad: false, theme: this.resolveTheme(this.prefs.theme) === 'dark' ? 'dark' : 'default' });
      await mermaid.run({ querySelector: '.mermaid', nodes: [...diagrams] as HTMLElement[] });
    } catch {
      diagrams.forEach((el) => el.classList.add('mermaid-error'));
    }
  }

  private bindEvents(root: HTMLElement): void {
    this.scrollContainer = this.detectScrollContainer(this.options.container);

    root.querySelector('[data-action="toggle-toc"]')?.addEventListener('click', () => {
      this.toggleToc();
    });

    root.querySelectorAll('.md-reader-sidebar-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        const tabName = tab.getAttribute('data-tab');
        if (!tabName) return;
        await this.switchTab(root, tabName);
      });
    });

    const themeMenu = root.querySelector('.md-reader-theme-menu') as HTMLElement | null;
    const themeBtn = root.querySelector('[data-action="toggle-theme"]') as HTMLElement | null;
    const moreMenu = root.querySelector('.md-reader-more-menu') as HTMLElement | null;
    const moreBtn = root.querySelector('[data-action="toggle-more"]') as HTMLElement | null;

    const closeMenus = () => {
      if (themeMenu) themeMenu.hidden = true;
      themeBtn?.setAttribute('aria-expanded', 'false');
      if (moreMenu) moreMenu.hidden = true;
      moreBtn?.setAttribute('aria-expanded', 'false');
    };

    themeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = themeMenu?.hidden ?? true;
      if (moreMenu) moreMenu.hidden = true;
      moreBtn?.setAttribute('aria-expanded', 'false');
      if (themeMenu) themeMenu.hidden = !open;
      themeBtn.setAttribute('aria-expanded', String(!open));
    });

    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = moreMenu?.hidden ?? true;
      if (themeMenu) themeMenu.hidden = true;
      themeBtn?.setAttribute('aria-expanded', 'false');
      if (moreMenu) moreMenu.hidden = !open;
      moreBtn.setAttribute('aria-expanded', String(!open));
    });

    themeMenu?.querySelectorAll('[data-theme]').forEach((item) => {
      item.addEventListener('click', async () => {
        const theme = item.getAttribute('data-theme') as ThemeName;
        if (theme) await this.setTheme(theme);
      });
    });

    document.addEventListener('click', (e) => {
      const themeDropdown = root.querySelector('.md-reader-theme-dropdown');
      const moreDropdown = root.querySelector('.md-reader-more-dropdown');
      const target = e.target as Node;
      if (themeDropdown && !themeDropdown.contains(target) && moreDropdown && !moreDropdown.contains(target)) {
        closeMenus();
      } else if (themeDropdown && !themeDropdown.contains(target) && themeMenu) {
        themeMenu.hidden = true;
        themeBtn?.setAttribute('aria-expanded', 'false');
      } else if (moreDropdown && !moreDropdown.contains(target) && moreMenu) {
        moreMenu.hidden = true;
        moreBtn?.setAttribute('aria-expanded', 'false');
      }
    });

    root.querySelector('[data-action="font-decrease"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setFontSize(this.prefs.fontSize - 1);
    });
    root.querySelector('[data-action="font-increase"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setFontSize(this.prefs.fontSize + 1);
    });

    root.querySelector('[data-action="export-pdf"]')?.addEventListener('click', () => {
      closeMenus();
      if (this.options.onExportPdf) this.options.onExportPdf();
      else window.print();
    });

    root.querySelector('[data-action="toggle-source"]')?.addEventListener('click', () => this.setViewMode(this.sourceMode ? 'preview' : 'source'));
    root.querySelector('[data-action="toggle-layout"]')?.addEventListener('click', () => this.setLayoutMode(this.prefs.layoutMode === 'full' ? 'normal' : 'full'));
    root.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
      closeMenus();
      this.options.onSettingsClick?.();
    });

    root.querySelectorAll('.md-reader-toc__item').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const href = (link as HTMLAnchorElement).getAttribute('href') ?? '';
        const target = document.getElementById(decodeURIComponent(href.slice(1)));
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', href);
      });
    });

    root.querySelectorAll('[data-toc-toggle]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-toc-toggle');
        if (!id) return;
        const branch = (btn as HTMLElement).closest('.md-reader-toc__branch');
        if (!branch) return;
        const collapsed = !branch.classList.contains('is-collapsed');
        if (collapsed) this.collapsedTocIds.add(id);
        else this.collapsedTocIds.delete(id);
        branch.classList.toggle('is-collapsed', collapsed);
        (btn as HTMLElement).setAttribute('aria-expanded', String(!collapsed));
      });
    });

    root.querySelectorAll('.md-reader-content img').forEach((image) => {
      image.addEventListener('click', () => this.openLightbox(root, image as HTMLImageElement));
    });

    root.querySelector('.md-reader-lightbox button[data-action="lightbox-close"]')?.addEventListener('click', () => {
      this.closeLightbox(root);
    });

    root.querySelector('.md-reader-lightbox-backdrop')?.addEventListener('click', () => {
      this.closeLightbox(root);
    });

    root.querySelector('.md-reader-lightbox button[data-action="lightbox-zoom-in"]')?.addEventListener('click', () => {
      this.setLightboxZoom(root, 0.25);
    });

    root.querySelector('.md-reader-lightbox button[data-action="lightbox-zoom-out"]')?.addEventListener('click', () => {
      this.setLightboxZoom(root, -0.25);
    });

    root.querySelector('.md-reader-lightbox button[data-action="lightbox-copy-url"]')?.addEventListener('click', async () => {
      const img = root.querySelector('.md-reader-lightbox img') as HTMLImageElement | null;
      if (!img?.src) return;
      try {
        await navigator.clipboard.writeText(img.src);
      } catch {
        // ignore
      }
    });

    root.querySelector('.md-reader-lightbox-stage')?.addEventListener('wheel', (e) => {
      const event = e as WheelEvent;
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.25 : 0.25;
      this.setLightboxZoom(root, delta);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      const lightbox = root.querySelector('.md-reader-lightbox') as HTMLElement | null;
      if (!lightbox || lightbox.hidden) return;
      if (e.key === 'Escape') {
        this.closeLightbox(root);
      }
    });

    root.querySelectorAll('[data-file-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const fileId = btn.getAttribute('data-file-id');
        if (!fileId) return;
        await this.openFile(fileId);
      });
    });

    this.scrollContainer.addEventListener(
      'scroll',
      () => {
        this.updateProgress(root);
        this.updateActiveToc(root);
        const toolbar = root.querySelector('.md-reader-toolbar');
        toolbar?.classList.toggle('md-reader-toolbar--scrolled', this.getScrollTop() > 4);
      },
      { passive: true }
    );

    // Initialise state once the DOM has settled
    requestAnimationFrame(() => {
      this.updateProgress(root);
      this.updateActiveToc(root);
    });
  }

  private updateActiveToc(root: HTMLElement): void {
    const headings = [
      ...root.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6')
    ] as HTMLElement[];
    if (headings.length === 0) return;

    const offset = 80;
    let activeId = headings[0].id;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= offset) {
        activeId = heading.id;
      } else {
        break;
      }
    }

    root.querySelectorAll('.md-reader-toc__item').forEach((link) => {
      const href = (link as HTMLAnchorElement).getAttribute('href') ?? '';
      const isActive = Boolean(activeId) && href === `#${activeId}`;
      link.classList.toggle('md-reader-toc__item--active', isActive);
    });
  }

  private async switchTab(root: HTMLElement, tabName: string): Promise<void> {
    this.prefs = { ...this.prefs, sidebarTab: tabName as 'toc' | 'folder' };
    await this.preferences.update({ sidebarTab: this.prefs.sidebarTab });

    root.querySelectorAll('.md-reader-sidebar-tab').forEach((t) => {
      const active = t.getAttribute('data-tab') === tabName;
      t.classList.toggle('md-reader-sidebar-tab--active', active);
      t.setAttribute('aria-selected', String(active));
    });

    root.querySelectorAll('.md-reader-sidebar-panel').forEach((p) => {
      p.classList.toggle('md-reader-sidebar-panel--active', p.getAttribute('data-panel') === tabName);
    });
  }

  private openLightbox(root: HTMLElement, image: HTMLImageElement): void {
    const lightbox = root.querySelector('.md-reader-lightbox') as HTMLElement | null;
    const img = lightbox?.querySelector('img') as HTMLImageElement | null;
    const title = lightbox?.querySelector('.md-reader-lightbox-title');
    const zoomLabel = lightbox?.querySelector('.md-reader-lightbox-zoom');
    if (!lightbox || !img) return;
    img.src = image.src;
    img.alt = image.alt;
    img.style.transform = 'scale(1)';
    img.dataset.scale = '1';
    if (title) title.textContent = image.alt || image.src.split('/').pop() || '';
    if (zoomLabel) zoomLabel.textContent = '100%';
    lightbox.hidden = false;
  }

  private closeLightbox(root: HTMLElement): void {
    const lightbox = root.querySelector('.md-reader-lightbox') as HTMLElement | null;
    if (!lightbox) return;
    lightbox.hidden = true;
  }

  private setLightboxZoom(root: HTMLElement, delta: number): void {
    const lightbox = root.querySelector('.md-reader-lightbox') as HTMLElement | null;
    const img = lightbox?.querySelector('img') as HTMLImageElement | null;
    const zoomLabel = lightbox?.querySelector('.md-reader-lightbox-zoom');
    if (!img) return;
    const current = Number(img.dataset.scale ?? '1');
    const next = Math.max(0.25, Math.min(4, current + delta));
    img.dataset.scale = String(next);
    img.style.transform = `scale(${next})`;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(next * 100)}%`;
  }
  private updateProgress(root: HTMLElement): void {
    const progress = root.querySelector('.md-reader-progress') as HTMLElement | null;
    if (!progress) return;
    const docHeight = this.getScrollHeight();
    const ratio = docHeight > 0 ? this.getScrollTop() / docHeight : 0;
    progress.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  }

  private startWatching(path: string): void {
    this.unwatch?.();
    this.unwatch = this.options.fileProvider.watchFile(path, async () => {
      await this.checkFileChange();
    });
  }

  private stopWatching(): void {
    this.unwatch?.();
    this.unwatch = undefined;
  }

  private async checkFileChange(): Promise<void> {
    if (!this.currentPath || this.isRefreshing()) return;

    try {
      const content = await this.options.fileProvider.readFile(this.currentPath);
      const hash = computeHash(content.content);
      if (hash !== this.lastContentHash) {
        this.lastContentHash = hash;
        this.renderedMarkdown = content.content;
        await this.render();
      }
    } catch {
      // ignore refresh errors
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (!this.prefs.autoRefresh) return;
    const interval = this.prefs.autoRefreshInterval ?? 2000;
    this.refreshTimer = setInterval(() => this.checkFileChange(), interval);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private isRefreshing(): boolean {
    // simple guard to avoid concurrent refreshes
    return false;
  }
}

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return String(hash);
}

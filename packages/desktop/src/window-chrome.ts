import type { ReaderCore, ThemeName } from '@md-reader/core';

const FEATURED: Exclude<ThemeName, 'system'>[] = ['light', 'paper', 'dark', 'black'];
const EXTRA: Exclude<ThemeName, 'system'>[] = ['mint', 'vue', 'night', 'purple'];
const LABELS: Record<Exclude<ThemeName, 'system'>, string> = {
  light: 'Light',
  paper: 'Paper',
  mint: 'Mint',
  vue: 'Vue',
  dark: 'Dark',
  night: 'Night',
  purple: 'Purple',
  black: 'Black'
};

export class WindowChrome {
  private readonly host: HTMLElement;
  private core?: ReaderCore;
  private docClickBound = false;

  constructor(host: HTMLElement) {
    this.host = host;
    this.host.classList.add('md-reader-window-chrome');
    this.host.hidden = true;
  }

  attach(core: ReaderCore | undefined): void {
    this.core = core;
    if (!core) {
      this.host.hidden = true;
      this.host.innerHTML = '';
      return;
    }
    this.host.hidden = false;
    void this.render();
  }

  async refresh(): Promise<void> {
    if (!this.core) return;
    await this.render();
  }

  private async render(): Promise<void> {
    const core = this.core;
    if (!core) return;

    const effective = core.getEffectiveTheme();
    const themePref = core.getThemePreference();
    const sourceMode = core.isSourceMode();
    const layoutFull = core.getLayoutMode() === 'full';
    const fontSize = core.getFontSize();
    const tocVisible = core.isTocVisible();

    this.host.innerHTML = `
      <header class="md-reader-toolbar md-reader-toolbar--window" role="banner">
        <div class="md-reader-toolbar__brand" title="DDCherry Reader">
          <span class="md-reader-toolbar__brand-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </span>
        </div>
        <nav class="md-reader-toolbar__actions" aria-label="Reader actions">
          <button type="button" class="md-reader-toolbar__action-btn" data-action="toggle-toc" aria-label="目录" title="目录" aria-pressed="${tocVisible}">
            <span class="md-reader-btn-icon">${iconToc()}</span>
          </button>

          <div class="md-reader-theme-dropdown">
            <button type="button" class="md-reader-toolbar__action-btn" data-action="toggle-theme" aria-label="切换主题" title="切换主题" aria-haspopup="true" aria-expanded="false">
              <span class="md-reader-btn-icon">${themeIcon(effective)}</span>
            </button>
            <div class="md-reader-theme-menu" role="menu" hidden>
              <div class="md-reader-theme-menu__section">推荐</div>
              ${themeItems(FEATURED, themePref)}
              <div class="md-reader-theme-menu__section">更多</div>
              ${themeItems(EXTRA, themePref)}
            </div>
          </div>

          <div class="md-reader-toolbar__group" role="group" aria-label="字号 ${fontSize}px">
            <button type="button" class="md-reader-toolbar__action-btn" data-action="font-decrease" aria-label="减小字号" title="减小字号（当前 ${fontSize}px）">
              <span class="md-reader-btn-icon">${iconMinus()}</span>
            </button>
            <span class="md-reader-font-size__value" title="当前字号">${fontSize}</span>
            <button type="button" class="md-reader-toolbar__action-btn" data-action="font-increase" aria-label="增大字号" title="增大字号（当前 ${fontSize}px）">
              <span class="md-reader-btn-icon">${iconPlus()}</span>
            </button>
          </div>

          <button type="button" class="md-reader-toolbar__action-btn" data-action="export-pdf" aria-label="导出 PDF" title="导出 PDF">
            <span class="md-reader-btn-icon">${exportIcon()}</span>
          </button>

          <button type="button" class="md-reader-toolbar__action-btn" data-action="toggle-source" aria-label="${sourceMode ? '预览模式' : 'Source Mode'}" title="${sourceMode ? '预览模式' : 'Source Mode'}" aria-pressed="${sourceMode}">
            <span class="md-reader-btn-icon">${sourceIcon()}</span>
          </button>

          <button type="button" class="md-reader-toolbar__action-btn" data-action="toggle-layout" aria-label="${layoutFull ? '正常布局' : '满屏布局'}" title="${layoutFull ? '正常布局' : '满屏布局'}" aria-pressed="${layoutFull}">
            <span class="md-reader-btn-icon">${layoutIcon(layoutFull)}</span>
          </button>

          <button type="button" class="md-reader-toolbar__action-btn" data-action="settings" aria-label="设置" title="设置">
            <span class="md-reader-btn-icon">${settingsIcon()}</span>
          </button>
        </nav>
      </header>
    `;

    this.bind();
  }

  private bind(): void {
    const root = this.host;
    const core = this.core;
    if (!core) return;

    const themeMenu = root.querySelector('.md-reader-theme-menu') as HTMLElement | null;
    const themeBtn = root.querySelector('[data-action="toggle-theme"]') as HTMLElement | null;

    const closeMenus = () => {
      if (themeMenu) themeMenu.hidden = true;
      themeBtn?.setAttribute('aria-expanded', 'false');
    };

    themeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = themeMenu?.hidden ?? true;
      if (themeMenu) themeMenu.hidden = !open;
      themeBtn.setAttribute('aria-expanded', String(!open));
    });

    if (!this.docClickBound) {
      document.addEventListener('click', (e) => {
        if (!this.host.contains(e.target as Node)) closeMenus();
      });
      this.docClickBound = true;
    }

    root.querySelector('[data-action="toggle-toc"]')?.addEventListener('click', () => {
      core.toggleToc();
    });

    root.querySelectorAll('[data-theme]').forEach((item) => {
      item.addEventListener('click', async () => {
        const theme = item.getAttribute('data-theme') as ThemeName | null;
        if (theme) {
          closeMenus();
          await core.setTheme(theme);
        }
      });
    });

    root.querySelector('[data-action="font-decrease"]')?.addEventListener('click', () => {
      void core.setFontSize(core.getFontSize() - 1);
    });
    root.querySelector('[data-action="font-increase"]')?.addEventListener('click', () => {
      void core.setFontSize(core.getFontSize() + 1);
    });
    root.querySelector('[data-action="export-pdf"]')?.addEventListener('click', () => {
      core.triggerExportPdf();
    });
    root.querySelector('[data-action="toggle-source"]')?.addEventListener('click', () => {
      void core.setViewMode(core.isSourceMode() ? 'preview' : 'source');
    });
    root.querySelector('[data-action="toggle-layout"]')?.addEventListener('click', () => {
      void core.setLayoutMode(core.getLayoutMode() === 'full' ? 'normal' : 'full');
    });
    root.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
      core.triggerSettings();
    });
  }
}

function themeItems(themes: Exclude<ThemeName, 'system'>[], active: ThemeName): string {
  return themes
    .map(
      (t) => `
    <button type="button" role="menuitem" data-theme="${t}" class="md-reader-theme-menu__item${t === active ? ' md-reader-theme-menu__item--active' : ''}">
      <span class="md-reader-theme-menu__swatch" data-theme="${t}" aria-hidden="true"></span>
      <span class="md-reader-theme-menu__label">${LABELS[t]}</span>
    </button>
  `
    )
    .join('');
}

function iconToc(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
}

function iconMinus(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function iconPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
}

function themeIcon(theme: Exclude<ThemeName, 'system'>): string {
  if (theme === 'dark' || theme === 'night' || theme === 'purple' || theme === 'black') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
}

function exportIcon(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
}

function sourceIcon(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>`;
}

function layoutIcon(full: boolean): string {
  return full
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
}

function settingsIcon(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
}

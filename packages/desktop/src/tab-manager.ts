import { ReaderCore, type ThemeName } from '@md-reader/core';
import type { FileProvider, StorageAdapter, AssetResolver } from '@md-reader/core';
import { basename } from 'pathe';
import { WindowChrome } from './window-chrome.js';

export interface Tab {
  id: string;
  path: string;
  title: string;
  core: ReaderCore;
  container: HTMLElement;
}

export interface TabManagerOptions {
  panelsContainer: HTMLElement;
  tabBarContainer: HTMLElement;
  toolbarContainer: HTMLElement;
  fileProvider: FileProvider;
  storageAdapter: StorageAdapter;
  assetResolver: AssetResolver;
}

let idCounter = 0;
function generateId(): string {
  return `tab-${++idCounter}`;
}

export class TabManager {
  private readonly tabs: Tab[] = [];
  private activeId?: string;
  private readonly panelsContainer: HTMLElement;
  private readonly tabBarContainer: HTMLElement;
  private readonly options: TabManagerOptions;
  private readonly windowChrome: WindowChrome;
  private readonly onDocumentClick = (e: MouseEvent) => {
    const host = this.tabBarContainer.querySelector('.md-reader-tabs-overflow');
    const menu = this.tabBarContainer.querySelector('.md-reader-tabs-overflow__menu') as HTMLElement | null;
    const btn = this.tabBarContainer.querySelector('[data-action="toggle-tab-overflow"]') as HTMLElement | null;
    if (host && menu && !host.contains(e.target as Node)) {
      menu.hidden = true;
      btn?.setAttribute('aria-expanded', 'false');
    }
  };

  constructor(options: TabManagerOptions) {
    this.options = options;
    this.panelsContainer = options.panelsContainer;
    this.tabBarContainer = options.tabBarContainer;
    this.windowChrome = new WindowChrome(options.toolbarContainer);
    document.addEventListener('click', this.onDocumentClick);
  }

  getTabs(): readonly Tab[] {
    return this.tabs;
  }

  get activeTab(): Tab | undefined {
    return this.tabs.find((t) => t.id === this.activeId);
  }

  async openFile(path: string): Promise<Tab> {
    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      this.activate(existing.id);
      return existing;
    }

    this.clearEmptyState();

    const container = document.createElement('div');
    container.className = 'md-reader-tab-panel';
    this.panelsContainer.appendChild(container);

    const core = this.createCore(container);
    await core.init();
    await core.openFile(path);

    const tab: Tab = {
      id: generateId(),
      path,
      title: basename(path),
      core,
      container
    };
    this.tabs.push(tab);
    this.renderTabBar();
    this.activate(tab.id);
    return tab;
  }

  async openFolder(tree: import('@md-reader/core').FileTreeNode[], folderPath?: string): Promise<Tab | undefined> {
    if (tree.length === 0) return undefined;

    this.clearEmptyState();

    const container = document.createElement('div');
    container.className = 'md-reader-tab-panel';
    this.panelsContainer.appendChild(container);

    const core = this.createCore(container);
    await core.init();
    await core.loadFolder(tree);

    const firstFile = tree.find((n) => n.type === 'file') ?? this.findFirstFile(tree);
    if (firstFile) {
      await core.openFile(firstFile.fileId);
    }

    const tab: Tab = {
      id: generateId(),
      path: folderPath ?? firstFile?.fileId ?? 'folder',
      title: folderPath ? basename(folderPath) : 'Folder',
      core,
      container
    };
    this.tabs.push(tab);
    this.renderTabBar();
    this.activate(tab.id);
    return tab;
  }

  activate(id: string): void {
    this.activeId = id;
    this.tabs.forEach((tab) => {
      tab.container.classList.toggle('md-reader-tab-panel--active', tab.id === id);
    });
    this.renderTabBar();
    this.windowChrome.attach(this.activeTab?.core);
  }

  close(id: string): void {
    const index = this.tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    const [tab] = this.tabs.splice(index, 1);
    tab.core.destroy();
    tab.container.remove();

    if (this.activeId === id) {
      const next = this.tabs[Math.min(index, this.tabs.length - 1)];
      this.activeId = next?.id;
    }

    this.renderTabBar();

    if (this.tabs.length === 0) {
      this.activeId = undefined;
      this.windowChrome.attach(undefined);
      this.showEmptyState();
    } else if (this.activeId) {
      this.activate(this.activeId);
    }
  }

  private createCore(container: HTMLElement): ReaderCore {
    return new ReaderCore({
      container,
      fileProvider: this.options.fileProvider,
      storageAdapter: this.options.storageAdapter,
      assetResolver: this.options.assetResolver,
      showToolbar: false,
      onSettingsClick: () => this.activeTab?.core && this.showSettings(this.activeTab.core),
      onExportPdf: () => this.activeTab && this.exportPdf(this.activeTab.container),
      onUiStateChange: () => {
        void this.windowChrome.refresh();
      }
    });
  }

  private renderTabBar(): void {
    if (this.tabs.length === 0) {
      this.tabBarContainer.innerHTML = '';
      this.tabBarContainer.hidden = true;
      return;
    }

    this.tabBarContainer.hidden = false;
    const overflowThreshold = 8;
    const visibleTabs = this.tabs.length <= overflowThreshold
      ? this.tabs
      : this.tabs.slice(-overflowThreshold);
    const overflowTabs = this.tabs.length <= overflowThreshold
      ? []
      : this.tabs.slice(0, this.tabs.length - overflowThreshold);

    this.tabBarContainer.innerHTML = `
      <div class="md-reader-tabs" data-tauri-drag-region>
        ${overflowTabs.length > 0 ? `
          <div class="md-reader-tabs-overflow">
            <button type="button" class="md-reader-tabs-overflow__btn" data-action="toggle-tab-overflow" aria-haspopup="true" aria-expanded="false" title="已打开文件">
              ▾ ${overflowTabs.length}
            </button>
            <div class="md-reader-tabs-overflow__menu" role="menu" hidden>
              ${overflowTabs.map((tab) => `
                <button type="button" role="menuitem" class="md-reader-tabs-overflow__item${tab.id === this.activeId ? ' is-active' : ''}" data-tab-id="${tab.id}" title="${this.escapeHtml(tab.path)}">
                  <span class="md-reader-tabs-overflow__title">${this.escapeHtml(tab.title)}</span>
                  <span class="md-reader-tabs-overflow__close" data-close-tab="${tab.id}" aria-label="关闭">×</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${visibleTabs
          .map(
            (tab) => `
          <button
            type="button"
            class="md-reader-tab ${tab.id === this.activeId ? 'md-reader-tab--active' : ''}"
            data-tab-id="${tab.id}"
            title="${this.escapeHtml(tab.path)}"
          >
            <span class="md-reader-tab__title">${this.escapeHtml(tab.title)}</span>
            <span class="md-reader-tab__close" data-close-tab="${tab.id}" role="button" aria-label="关闭标签页" tabindex="0">×</span>
          </button>
        `
          )
          .join('')}
      </div>
    `;

    const tabsEl = this.tabBarContainer.querySelector('.md-reader-tabs') as HTMLElement | null;
    tabsEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      const overflowToggle = target.closest('[data-action="toggle-tab-overflow"]') as HTMLElement | null;
      if (overflowToggle) {
        e.stopPropagation();
        const menu = this.tabBarContainer.querySelector('.md-reader-tabs-overflow__menu') as HTMLElement | null;
        if (menu) {
          const open = menu.hidden;
          menu.hidden = !open;
          overflowToggle.setAttribute('aria-expanded', String(open));
        }
        return;
      }

      const closeBtn = target.closest('[data-close-tab]') as HTMLElement | null;
      if (closeBtn) {
        e.stopPropagation();
        const id = closeBtn.dataset.closeTab;
        if (id) this.close(id);
        return;
      }

      const overflowItem = target.closest('.md-reader-tabs-overflow__item') as HTMLElement | null;
      if (overflowItem?.dataset.tabId) {
        this.activate(overflowItem.dataset.tabId);
        return;
      }

      const tabBtn = target.closest('.md-reader-tab') as HTMLElement | null;
      if (tabBtn?.dataset.tabId) {
        this.activate(tabBtn.dataset.tabId);
      }
    });

    tabsEl?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target as HTMLElement;
      const closeBtn = target.closest('[data-close-tab]') as HTMLElement | null;
      if (closeBtn) {
        e.preventDefault();
        const id = closeBtn.dataset.closeTab;
        if (id) this.close(id);
      }
    });

  }

  private clearEmptyState(): void {
    this.panelsContainer.querySelector('.md-reader-empty-state')?.remove();
  }

  showEmptyState(): void {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? '⌘' : 'Ctrl';
    this.panelsContainer.innerHTML = `
      <div class="md-reader-empty-state">
        <div class="md-reader-empty-state__icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <h2>DDCherry Reader</h2>
        <p>打开 Markdown 文件开始阅读，或将文件拖入窗口。</p>
        <div class="md-reader-empty-state__actions">
          <button type="button" class="md-reader-empty-state__btn md-reader-empty-state__btn--primary" data-empty-action="open-file">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            打开文件
          </button>
          <button type="button" class="md-reader-empty-state__btn" data-empty-action="open-folder">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            打开文件夹
          </button>
        </div>
        <div class="md-reader-empty-state__hints">
          <span class="md-reader-empty-state__hint"><kbd>${mod}O</kbd> 打开文件</span>
          <span class="md-reader-empty-state__hint"><kbd>${mod}⇧O</kbd> 打开文件夹</span>
        </div>
      </div>
    `;

    const root = this.panelsContainer.querySelector('.md-reader-empty-state');
    root?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-empty-action]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.emptyAction;
      if (action === 'open-file') {
        document.dispatchEvent(new CustomEvent('md-reader:open-file-dialog'));
      } else if (action === 'open-folder') {
        document.dispatchEvent(new CustomEvent('md-reader:open-folder-dialog'));
      }
    });
  }

  private findFirstFile(tree: import('@md-reader/core').FileTreeNode[]): import('@md-reader/core').FileTreeNode | undefined {
    for (const node of tree) {
      if (node.type === 'file') return node;
      if (node.children) {
        const found = this.findFirstFile(node.children);
        if (found) return found;
      }
    }
    return undefined;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private showSettings(core: ReaderCore): void {
    document.dispatchEvent(new CustomEvent('md-reader:settings-request', { detail: { core } }));
  }

  private async exportPdf(container: HTMLElement): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    const root = container.querySelector('.md-reader') as HTMLElement | null;
    if (!root) return;
    const sidebar = root.querySelector('.md-reader-sidebar') as HTMLElement | null;
    const lightbox = root.querySelector('.md-reader-lightbox') as HTMLElement | null;
    const copyButtons = root.querySelectorAll('.md-reader-copy-btn');
    const windowChrome = document.querySelector('.md-reader-window-chrome') as HTMLElement | null;
    const tabsHost = document.querySelector('.md-reader-tabs-host') as HTMLElement | null;

    sidebar?.classList.add('md-reader-print-hidden');
    lightbox?.classList.add('md-reader-print-hidden');
    windowChrome?.classList.add('md-reader-print-hidden');
    tabsHost?.classList.add('md-reader-print-hidden');
    copyButtons.forEach((btn) => btn.classList.add('md-reader-print-hidden'));

    try {
      await invoke('print_window');
    } catch {
      window.print();
    } finally {
      sidebar?.classList.remove('md-reader-print-hidden');
      lightbox?.classList.remove('md-reader-print-hidden');
      windowChrome?.classList.remove('md-reader-print-hidden');
      tabsHost?.classList.remove('md-reader-print-hidden');
      copyButtons.forEach((btn) => btn.classList.remove('md-reader-print-hidden'));
    }
  }
}

// Keep ThemeName type import used for listeners in app
export type { ThemeName };

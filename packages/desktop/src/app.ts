import type { ReaderCore, ThemeName } from '@md-reader/core';
import { TauriFileProvider } from './adapters/tauri-file-provider.js';
import { TauriStorageAdapter } from './adapters/tauri-storage-adapter.js';
import { TauriAssetResolver } from './adapters/tauri-asset-resolver.js';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { restoreStateCurrent, saveWindowState } from '@tauri-apps/plugin-window-state';
import { open } from '@tauri-apps/plugin-dialog';
import { stat } from '@tauri-apps/plugin-fs';
import { TabManager } from './tab-manager.js';

const FEATURED_THEMES: { id: ThemeName; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'paper', label: 'Paper' },
  { id: 'dark', label: 'Dark' },
  { id: 'black', label: 'Black' }
];

const EXTRA_THEMES: { id: ThemeName; label: string }[] = [
  { id: 'mint', label: 'Mint' },
  { id: 'vue', label: 'Vue' },
  { id: 'night', label: 'Night' },
  { id: 'purple', label: 'Purple' }
];

function themeButtons(themes: { id: ThemeName; label: string }[]): string {
  return themes
    .map(
      (t) => `
      <button type="button" class="md-reader-theme-swatch-btn${t.id === 'system' ? ' md-reader-theme-swatch-btn--system' : ''}" data-theme-pick="${t.id}" data-setting-theme title="${t.label}">
        <span class="md-reader-theme-swatch-btn__dot" aria-hidden="true"></span>
        <span>${t.label}</span>
      </button>
    `
    )
    .join('');
}

function buildSettingsPanel(core: ReaderCore): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'md-reader-settings-panel';
  panel.innerHTML = `
    <div class="md-reader-settings-backdrop"></div>
    <div class="md-reader-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="md-reader-settings-title">
      <div class="md-reader-settings-header">
        <h2 id="md-reader-settings-title">设置</h2>
        <button type="button" class="md-reader-settings-close" aria-label="关闭">×</button>
      </div>
      <div class="md-reader-settings-body">
        <section class="md-reader-settings-section">
          <h3 class="md-reader-settings-section__title">外观</h3>
          <p class="md-reader-settings-caption">推荐主题</p>
          <div class="md-reader-theme-grid" role="listbox" aria-label="推荐主题">
            ${themeButtons(FEATURED_THEMES)}
          </div>
          <p class="md-reader-settings-caption">更多主题</p>
          <div class="md-reader-settings-extras" role="listbox" aria-label="更多主题">
            ${themeButtons(EXTRA_THEMES)}
          </div>
        </section>

        <section class="md-reader-settings-section">
          <h3 class="md-reader-settings-section__title">阅读</h3>
          <label class="md-reader-settings-row md-reader-settings-row--range">
            <span>字号</span>
            <span class="md-reader-settings-field">
              <input type="range" data-setting="fontSize" min="12" max="24" />
              <span class="md-reader-settings-field__value" data-font-size-value>16</span>
            </span>
          </label>
          <label class="md-reader-settings-row">
            <span>显示目录</span>
            <input type="checkbox" data-setting="toc" />
          </label>
        </section>

        <section class="md-reader-settings-section">
          <h3 class="md-reader-settings-section__title">行为</h3>
          <label class="md-reader-settings-row">
            <span>自动刷新</span>
            <input type="checkbox" data-setting="autoRefresh" />
          </label>
          <label class="md-reader-settings-row">
            <span>刷新间隔 (ms)</span>
            <input type="number" data-setting="autoRefreshInterval" min="500" max="30000" step="100" />
          </label>
        </section>
      </div>
    </div>
  `;

  const backdrop = panel.querySelector('.md-reader-settings-backdrop') as HTMLElement;
  const closeBtn = panel.querySelector('.md-reader-settings-close') as HTMLElement;
  const dialog = panel.querySelector('.md-reader-settings-dialog') as HTMLElement;

  const close = () => panel.remove();
  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.isConnected) close();
  }, { once: true });

  const syncThemeButtons = (theme: string) => {
    panel.querySelectorAll<HTMLElement>('[data-theme-pick]').forEach((btn) => {
      btn.classList.toggle('md-reader-theme-swatch-btn--active', btn.dataset.themePick === theme);
    });
  };

  const fontSizeValue = panel.querySelector('[data-font-size-value]') as HTMLElement | null;

  const load = async () => {
    const prefs = await core.getPreferences();
    panel.querySelectorAll('[data-setting]').forEach((el) => {
      const key = el.getAttribute('data-setting') as keyof typeof prefs;
      const value = prefs[key];
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox') el.checked = Boolean(value);
        else el.value = String(value ?? '');
      } else if (el instanceof HTMLSelectElement) {
        el.value = String(value ?? 'light');
      }
    });
    if (fontSizeValue) fontSizeValue.textContent = String(prefs.fontSize ?? 16);
    syncThemeButtons(String(prefs.theme ?? 'light'));
  };

  panel.querySelectorAll('[data-theme-pick]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = (btn as HTMLElement).dataset.themePick as ThemeName;
      if (!theme) return;
      await core.setTheme(theme);
      syncThemeButtons(theme);
    });
  });

  const fontSizeRange = panel.querySelector('[data-setting="fontSize"]') as HTMLInputElement | null;
  fontSizeRange?.addEventListener('input', () => {
    const size = Number(fontSizeRange.value);
    if (fontSizeValue) fontSizeValue.textContent = String(size);
    void core.setFontSize(size);
  });

  panel.querySelectorAll('[data-setting]').forEach((el) => {
    el.addEventListener('change', async () => {
      const key = el.getAttribute('data-setting') as string;
      let value: unknown;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') value = el.checked;
      else if (el instanceof HTMLInputElement && el.type === 'number') value = Number(el.value);
      else if (el instanceof HTMLInputElement && el.type === 'range') value = Number(el.value);
      else value = (el as HTMLInputElement | HTMLSelectElement).value;

      if (key === 'fontSize') {
        if (fontSizeValue) fontSizeValue.textContent = String(value);
        await core.setFontSize(Number(value));
      }
      else if (key === 'toc') await core.setTocVisible(Boolean(value));
      else {
        await core.updatePreferences({ [key]: value });
      }
    });
  });

  load();
  dialog.animate?.([
    { opacity: 0, transform: 'translateY(-12px) scale(0.98)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' }
  ], { duration: 160, easing: 'ease-out' });
  return panel;
}

function openSettings(core: ReaderCore): void {
  if (document.querySelector('.md-reader-settings-panel')) return;
  const panel = buildSettingsPanel(core);
  document.body.appendChild(panel);
  (panel.querySelector('.md-reader-settings-close') as HTMLElement)?.focus();
}

export async function bootstrap(): Promise<TabManager> {
  document.documentElement.dataset.mdReaderDensity = 'desktop';

  const app = document.getElementById('app');
  if (!app) throw new Error('#app container not found');

  app.innerHTML = `
    <div class="md-reader-window-chrome-host"></div>
    <div class="md-reader-tabs-host" data-tauri-drag-region></div>
    <div class="md-reader-panels-host"></div>
  `;

  const tabBar = app.querySelector('.md-reader-tabs-host') as HTMLElement;
  const toolbarHost = app.querySelector('.md-reader-window-chrome-host') as HTMLElement;
  const panels = app.querySelector('.md-reader-panels-host') as HTMLElement;

  const fileProvider = new TauriFileProvider();
  const manager = new TabManager({
    panelsContainer: panels,
    tabBarContainer: tabBar,
    toolbarContainer: toolbarHost,
    fileProvider,
    storageAdapter: new TauriStorageAdapter(),
    assetResolver: new TauriAssetResolver()
  });

  document.addEventListener('md-reader:settings-request', ((event: CustomEvent) => {
    const core = event.detail?.core as ReaderCore | undefined;
    if (core) openSettings(core);
  }) as EventListener);

  await restoreStateCurrent();

  const initialPath = await invoke<string | null>('get_initial_file');
  if (initialPath) await manager.openFile(initialPath);
  else manager.showEmptyState();

  await listen<string>('app:open-file', async (event) => {
    if (event.payload) await manager.openFile(event.payload);
  });

  const openFileDialog = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }]
    });
    if (selected && !Array.isArray(selected)) {
      await manager.openFile(selected);
    }
  };

  const openFolderDialog = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && !Array.isArray(selected)) {
      const tree = await fileProvider.listDirectory(selected);
      await manager.openFolder(tree, selected);
    }
  };

  await listen('app:open-file-dialog', () => {
    void openFileDialog();
  });
  await listen('app:open-folder-dialog', () => {
    void openFolderDialog();
  });

  // Empty-state buttons (web events)
  document.addEventListener('md-reader:open-file-dialog', () => {
    void openFileDialog();
  });
  document.addEventListener('md-reader:open-folder-dialog', () => {
    void openFolderDialog();
  });

  await listen('app:reload-file', () => {
    manager.activeTab?.core.reload();
  });

  await listen<ThemeName>('app:set-theme', async (event) => {
    if (event.payload) {
      manager.getTabs().forEach((tab) => tab.core.setTheme(event.payload));
    }
  });

  const win = getCurrentWebviewWindow();
  await win.onDragDropEvent(async (event) => {
    if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
      const dropped = event.payload.paths[0];
      const metadata = await stat(dropped).catch(() => null);
      if (metadata?.isDirectory) {
        const tree = await fileProvider.listDirectory(dropped);
        await manager.openFolder(tree, dropped);
      } else {
        await manager.openFile(dropped);
      }
    }
  });

  await win.onCloseRequested(async () => {
    await saveWindowState();
  });

  await listen<string>('app:open-file-request', async (event) => {
    if (event.payload) await manager.openFile(event.payload);
  });

  return manager;
}

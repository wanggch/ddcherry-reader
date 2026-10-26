import { ReaderCore } from '@md-reader/core';
import { preparedMarkdownDocument } from '../extension/compat-fix.js';
import { isProbablyRawMarkdownDocument } from '../extension/url-detection.js';
import { ChromeFileProvider } from '../adapters/chrome-file-provider.js';
import { ChromeStorageAdapter } from '../adapters/chrome-storage-adapter.js';
import { ChromeAssetResolver } from '../adapters/chrome-asset-resolver.js';
import { scanMdTreeFromEntry } from '../adapters/chrome-directory-scanner.js';
import { DEFAULT_PREFERENCES, normalizePreferences } from '@md-reader/core';

async function main() {
  const storageAdapter = new ChromeStorageAdapter();
  const stored = await storageAdapter.getAll();
  const preferences = normalizePreferences(stored);

  if (!preferences.enabled) return;

  const isMarkdownDocument =
    preparedMarkdownDocument.isMarkdownDocument ||
    isProbablyRawMarkdownDocument(window.location.href, document);

  if (!isMarkdownDocument) return;

  const markdown = preparedMarkdownDocument.isMarkdownDocument
    ? preparedMarkdownDocument.markdown
    : document.body?.innerText ?? '';

  const container = document.createElement('div');
  container.id = 'md-reader-root';
  document.body.innerHTML = '';
  document.body.appendChild(container);

  const core = new ReaderCore({
    container,
    fileProvider: new ChromeFileProvider(),
    storageAdapter,
    assetResolver: new ChromeAssetResolver(),
    onSettingsClick: async () => {
      const runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime;
      try {
        if (runtime?.openOptionsPage) {
          await runtime.openOptionsPage();
          return;
        }
      } catch {
        // fallback
      }
      try {
        if (runtime?.sendMessage) {
          await runtime.sendMessage({ action: 'openOptionsPage' });
          return;
        }
      } catch {
        // fallback
      }
      try {
        const url = runtime?.getURL?.('options.html') ?? 'options.html';
        window.open(url, '_blank');
      } catch {
        // silently fail
      }
    },
    onExportPdf: () => window.print()
  });

  await core.init();

  if (preparedMarkdownDocument.isMarkdownDocument) {
    const fileName = decodeURIComponent(window.location.pathname.split('/').pop() || 'document.md');
    await core.openMarkdown(markdown, fileName);
  } else {
    await core.openMarkdown(markdown);
  }

  setupDropHandler(core);
  setupBackgroundMessageListener(core);
}

function setupDropHandler(core: ReaderCore) {
  document.addEventListener('dragover', (e) => {
    const hasDirectory = [...(e.dataTransfer?.items ?? [])].some((item) => item.webkitGetAsEntry?.().isDirectory
    );
    if (hasDirectory) e.preventDefault();
  });

  document.addEventListener('drop', async (e) => {
    const dirItem = [...(e.dataTransfer?.items ?? [])].find((item) => item.webkitGetAsEntry?.().isDirectory
    );
    if (!dirItem) return;

    e.preventDefault();
    const dirEntry = dirItem.webkitGetAsEntry() as FileSystemDirectoryEntry;
    const tree = await scanMdTreeFromEntry(dirEntry);
    await core.loadFolder(tree);
  });
}

function setupBackgroundMessageListener(core: ReaderCore) {
  const runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime;
  runtime?.onMessage?.addListener((message: unknown, _sender: unknown, sendResponse: (r: unknown) => void) => {
    const msg = message as { action?: string };
    if (msg.action === 'refresh') {
      core.reload().then(() => sendResponse({ success: true }));
      return true;
    }
    return false;
  });
}

main().catch((error) => {
  console.error('[Markdown Reader Pro] failed to bootstrap', error);
});

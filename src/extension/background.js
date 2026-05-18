import { DEFAULT_PREFERENCES } from './preferences.js';
import { isMarkdownUrl } from './url-detection.js';

const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;
const storage = globalThis.browser?.storage?.sync ?? globalThis.chrome?.storage?.sync;
const alarms = globalThis.browser?.alarms ?? globalThis.chrome?.alarms;
const tabs = globalThis.browser?.tabs ?? globalThis.chrome?.tabs;

const REFRESH_INTERVAL_MINUTES = 2 / 60; // 2 seconds

runtime?.onInstalled?.addListener(async ({ reason }) => {
  if (reason !== 'install' || !storage) {
    return;
  }

  const existing = await storage.get(Object.keys(DEFAULT_PREFERENCES));
  await storage.set({
    ...DEFAULT_PREFERENCES,
    ...existing
  });

  await setupRefreshAlarm();
});

runtime?.onStartup?.addListener?.(() => {
  setupRefreshAlarm().catch(() => {});
});

async function setupRefreshAlarm() {
  if (!alarms) return;

  try {
    const existing = await alarms.getAll?.();
    const hasAlarm = existing?.some?.(a => a.name === 'mdReaderAutoRefresh');
    if (!hasAlarm) {
      await alarms.create('mdReaderAutoRefresh', {
        periodInMinutes: Math.max(REFRESH_INTERVAL_MINUTES, 1 / 60) // Chrome minimum ~1s
      });
    }
  } catch {
    // alarms may not be available in all environments
  }
}

// Alarm fires → query all file:// tabs → ask each content script to check for changes.
// Content script computes hash locally and re-renders if the file changed.
alarms?.onAlarm?.addListener?.((alarm) => {
  if (alarm.name !== 'mdReaderAutoRefresh') return;

  tabs?.query?.({ url: 'file://*' }, (fileTabs) => {
    fileTabs?.forEach?.((tab) => {
      if (!tab.id) return;
      tabs?.sendMessage?.(tab.id, { action: 'checkFileChange' })
        .catch(() => {}); // tab may not have content script or no listener
    });
  });
});

runtime?.onMessage?.addListener?.((message, _sender, sendResponse) => {
  if (message?.action === 'openOptionsPage') {
    runtime?.openOptionsPage?.();
    sendResponse?.({ success: true });
    return true;
  }
  if (message?.action === 'readMarkdownSource') {
    readMarkdownSource(_sender)
      .then(sendResponse)
      .catch((error) => sendResponse?.({ success: false, error: error?.message || String(error) }));
    return true;
  }
  return false;
});

async function readMarkdownSource(sender) {
  const sourceUrl = sender?.tab?.url;

  if (!isRefreshableFileUrl(sourceUrl)) {
    return { success: false, error: 'Unsupported Markdown source URL' };
  }

  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) {
    return { success: false, error: `Read failed: ${response.status}` };
  }

  return {
    success: true,
    markdown: await response.text()
  };
}

function isRefreshableFileUrl(url) {
  try {
    return new URL(url).protocol === 'file:' && isMarkdownUrl(url);
  } catch {
    return false;
  }
}

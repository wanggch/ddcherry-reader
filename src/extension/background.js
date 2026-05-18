import { DEFAULT_PREFERENCES } from './preferences.js';
import { isMarkdownUrl } from './url-detection.js';

const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;
const storage = globalThis.browser?.storage?.sync ?? globalThis.chrome?.storage?.sync;
const alarms = globalThis.browser?.alarms ?? globalThis.chrome?.alarms;
const tabs = globalThis.browser?.tabs ?? globalThis.chrome?.tabs;

// ── Install & Startup ──

runtime?.onInstalled?.addListener(async ({ reason }) => {
  if (reason !== 'install' || !storage) return;

  const existing = await storage.get(Object.keys(DEFAULT_PREFERENCES));
  await storage.set({ ...DEFAULT_PREFERENCES, ...existing });
  setupRefreshAlarm();
});

runtime?.onStartup?.addListener?.(() => {
  setupRefreshAlarm();
});

setupRefreshAlarm();

// ── Alarm: periodic check ──

function setupRefreshAlarm() {
  if (!alarms?.getAll) return;

  try {
    const result = alarms.getAll((existing) => {
      const hasAlarm = existing?.some?.((a) => a.name === 'mdReaderAutoRefresh');
      if (!hasAlarm) {
        alarms.create('mdReaderAutoRefresh', { periodInMinutes: 0.5 });
      }
    });
    // If getAll returns a promise (Firefox / newer Chrome), handle it
    if (result && typeof result.then === 'function') {
      result.then((existing) => {
        const hasAlarm = existing?.some?.((a) => a.name === 'mdReaderAutoRefresh');
        if (!hasAlarm) {
          alarms.create('mdReaderAutoRefresh', { periodInMinutes: 0.5 });
        }
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

// Alarm fires → query all file:// tabs → ask each content script to check for changes.
alarms?.onAlarm?.addListener?.((alarm) => {
  if (alarm.name !== 'mdReaderAutoRefresh') return;
  notifyFileTabs();
});

function notifyFileTabs() {
  if (!tabs?.query) return;

  try {
    const result = tabs.query({ url: 'file://*' }, (fileTabs) => {
      (fileTabs ?? []).forEach((tab) => {
        if (!tab.id) return;
        try {
          tabs.sendMessage(tab.id, { action: 'checkFileChange' }, () => {
            // ignore errors — tab may not have content script
            void chrome?.runtime?.lastError;
          });
        } catch {
          // ignore
        }
      });
    });
    // If query returns a promise (Firefox / newer Chrome)
    if (result && typeof result.then === 'function') {
      result.then((fileTabs) => {
        (fileTabs ?? []).forEach((tab) => {
          if (!tab.id) return;
          tabs.sendMessage(tab.id, { action: 'checkFileChange' }).catch(() => {});
        });
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

// ── Message handling ──

runtime?.onMessage?.addListener?.((message, sender, sendResponse) => {
  if (message?.action === 'openOptionsPage') {
    runtime?.openOptionsPage?.();
    sendResponse?.({ success: true });
    return true;
  }

  if (message?.action === 'readMarkdownSource') {
    const url = sender?.tab?.url;
    if (!url || !isRefreshableFileUrl(url)) {
      sendResponse({ success: false, error: 'Not a refreshable file URL' });
      return true;
    }

    const cleanUrl = url.split('#')[0];
    fetch(cleanUrl, { cache: 'reload' })
      .then(async (response) => {
        if (!response.ok) {
          sendResponse({ success: false, error: `HTTP ${response.status}` });
          return;
        }
        const text = await response.text();
        sendResponse({ success: true, markdown: text });
      })
      .catch((error) => {
        sendResponse({ success: false, error: String(error?.message || error) });
      });

    return true;
  }

  if (message?.action === 'readFileContent') {
    const url = message?.url;
    if (!url || !url.startsWith('file://')) {
      sendResponse({ success: false, error: 'Invalid file URL' });
      return true;
    }

    fetch(url, { cache: 'reload' })
      .then(async (response) => {
        if (!response.ok) {
          sendResponse({ success: false, error: `HTTP ${response.status}` });
          return;
        }
        const text = await response.text();
        sendResponse({ success: true, content: text });
      })
      .catch((error) => {
        sendResponse({ success: false, error: String(error?.message || error) });
      });

    return true;
  }

  return false;
});

function isRefreshableFileUrl(url) {
  try {
    return new URL(url).protocol === 'file:' && isMarkdownUrl(url);
  } catch {
    return false;
  }
}

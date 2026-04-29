import { DEFAULT_PREFERENCES } from './preferences.js';

const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;
const storage = globalThis.browser?.storage?.sync ?? globalThis.chrome?.storage?.sync;

runtime?.onInstalled?.addListener(async ({ reason }) => {
  if (reason !== 'install' || !storage) {
    return;
  }

  const existing = await storage.get(Object.keys(DEFAULT_PREFERENCES));
  await storage.set({
    ...DEFAULT_PREFERENCES,
    ...existing
  });
});

runtime?.onMessage?.addListener?.((message, _sender, sendResponse) => {
  if (message?.action === 'openOptionsPage') {
    runtime?.openOptionsPage?.();
    sendResponse?.({ success: true });
    return true;
  }
  return false;
});

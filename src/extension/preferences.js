export const DEFAULT_PREFERENCES = Object.freeze({
  enabled: true,
  theme: 'system',
  toc: true,
  tocPosition: 'left',
  autoRefresh: false,
  rawMode: false
});

const SUPPORTED_KEYS = new Set(Object.keys(DEFAULT_PREFERENCES));

export async function getPreferences() {
  try {
    const stored = await storageGet(Object.keys(DEFAULT_PREFERENCES));
    return normalizePreferences(stored);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(nextPreferences) {
  const filtered = {};

  for (const [key, value] of Object.entries(nextPreferences ?? {})) {
    if (SUPPORTED_KEYS.has(key)) {
      filtered[key] = value;
    }
  }

  if (Object.keys(filtered).length === 0) {
    return;
  }

  await storageSet(filtered);
}

export function normalizePreferences(stored) {
  return {
    ...DEFAULT_PREFERENCES,
    ...(stored && typeof stored === 'object' ? stored : {})
  };
}

function storageGet(keys) {
  const browserApi = globalThis.browser?.storage?.sync;
  if (browserApi) {
    return browserApi.get(keys);
  }

  const api = globalThis.chrome?.storage?.sync;

  if (!api) {
    return Promise.resolve({});
  }

  try {
    const result = api.get(keys);
    if (result && typeof result.then === 'function') {
      return result;
    }
  } catch {
    // Chrome 88-era callback APIs reject promise-style calls.
  }

  return new Promise((resolve) => {
    api.get(keys, (value) => resolve(value ?? {}));
  });
}

function storageSet(value) {
  const browserApi = globalThis.browser?.storage?.sync;
  if (browserApi) {
    return browserApi.set(value);
  }

  const api = globalThis.chrome?.storage?.sync;

  if (!api) {
    return Promise.resolve();
  }

  try {
    const result = api.set(value);
    if (result && typeof result.then === 'function') {
      return result;
    }
  } catch {
    // Chrome 88-era callback APIs reject promise-style calls.
  }

  return new Promise((resolve) => {
    api.set(value, resolve);
  });
}

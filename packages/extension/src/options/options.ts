import { DEFAULT_PREFERENCES, PreferencesManager } from '@md-reader/core';
import { ChromeStorageAdapter } from '../adapters/chrome-storage-adapter.js';

const form = document.querySelector('#options-form') as HTMLFormElement;
const status = document.querySelector('#status') as HTMLElement;

const preferences = new PreferencesManager(new ChromeStorageAdapter());

initOptions().catch((error: Error) => {
  status.textContent = error.message;
});

async function initOptions() {
  const prefs = await preferences.getAll();
  hydrateForm(prefs);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const next = readForm();
    await preferences.update(next);
    status.textContent = '设置已保存';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });

  form.addEventListener('reset', async () => {
    await preferences.update(DEFAULT_PREFERENCES as Record<string, unknown>);
    hydrateForm(DEFAULT_PREFERENCES);
    status.textContent = '已恢复默认设置';
  });
}

function hydrateForm(prefs: Record<string, unknown>) {
  (form.elements.namedItem('enabled') as HTMLInputElement).checked = Boolean(prefs.enabled);
  (form.elements.namedItem('theme') as HTMLSelectElement).value = String(prefs.theme ?? DEFAULT_PREFERENCES.theme);
  (form.elements.namedItem('toc') as HTMLInputElement).checked = Boolean(prefs.toc);
  (form.elements.namedItem('tocPosition') as HTMLSelectElement).value = String(prefs.tocPosition ?? DEFAULT_PREFERENCES.tocPosition);
  (form.elements.namedItem('autoRefresh') as HTMLInputElement).checked = Boolean(prefs.autoRefresh);
  (form.elements.namedItem('rawMode') as HTMLInputElement).checked = Boolean(prefs.rawMode);
}

function readForm() {
  return {
    enabled: (form.elements.namedItem('enabled') as HTMLInputElement).checked,
    theme: (form.elements.namedItem('theme') as HTMLSelectElement).value,
    toc: (form.elements.namedItem('toc') as HTMLInputElement).checked,
    tocPosition: (form.elements.namedItem('tocPosition') as HTMLSelectElement).value,
    autoRefresh: (form.elements.namedItem('autoRefresh') as HTMLInputElement).checked,
    rawMode: (form.elements.namedItem('rawMode') as HTMLInputElement).checked
  };
}

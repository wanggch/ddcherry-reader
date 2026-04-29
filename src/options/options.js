import { DEFAULT_PREFERENCES, getPreferences, savePreferences } from '../extension/preferences.js';

const form = document.querySelector('#options-form');
const status = document.querySelector('#status');

initOptions().catch((error) => {
  status.textContent = error.message;
});

async function initOptions() {
  const preferences = await getPreferences();
  hydrateForm(preferences);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const next = readForm();
    await savePreferences(next);
    status.textContent = '设置已保存';
    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  });

  form.addEventListener('reset', async () => {
    await savePreferences(DEFAULT_PREFERENCES);
    hydrateForm(DEFAULT_PREFERENCES);
    status.textContent = '已恢复默认设置';
  });
}

function hydrateForm(preferences) {
  form.elements.enabled.checked = preferences.enabled;
  form.elements.theme.value = preferences.theme;
  form.elements.toc.checked = preferences.toc;
  form.elements.tocPosition.value = preferences.tocPosition;
  form.elements.autoRefresh.checked = preferences.autoRefresh;
  form.elements.rawMode.checked = preferences.rawMode;
}

function readForm() {
  return {
    enabled: form.elements.enabled.checked,
    theme: form.elements.theme.value,
    toc: form.elements.toc.checked,
    tocPosition: form.elements.tocPosition.value,
    autoRefresh: form.elements.autoRefresh.checked,
    rawMode: form.elements.rawMode.checked
  };
}

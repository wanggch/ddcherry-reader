import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES, getPreferences, savePreferences } from '../src/extension/preferences.js';

describe('preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns defaults when storage is unavailable', async () => {
    chrome.storage.sync.get.mockRejectedValueOnce(new Error('blocked'));

    await expect(getPreferences()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('merges stored values with defaults', async () => {
    chrome.storage.sync.get.mockResolvedValueOnce({
      theme: 'dark',
      tocPosition: 'right'
    });

    await expect(getPreferences()).resolves.toEqual({
      ...DEFAULT_PREFERENCES,
      theme: 'dark',
      tocPosition: 'right'
    });
  });

  it('saves only supported preference keys', async () => {
    chrome.storage.sync.set.mockResolvedValueOnce();

    await savePreferences({
      theme: 'light',
      autoRefresh: true,
      unsupported: 'ignored'
    });

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      theme: 'light',
      autoRefresh: true
    });
  });
});

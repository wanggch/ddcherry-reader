import type { AssetResolver } from '@md-reader/core';

export class TauriAssetResolver implements AssetResolver {
  resolve(path: string): string {
    // Accept both "highlight-github.css" and legacy "assets/highlight-github.css".
    const normalized = path.replace(/^\/?assets\//, '');
    return `/assets/${normalized}`;
  }
}

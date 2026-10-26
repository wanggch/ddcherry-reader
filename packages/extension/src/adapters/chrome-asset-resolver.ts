import type { AssetResolver } from '@md-reader/core';

const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;

export class ChromeAssetResolver implements AssetResolver {
  resolve(path: string): string {
    // Extension package ships theme assets under the top-level `assets/` folder.
    const normalized = path.replace(/^\/?assets\//, '');
    const extensionPath = `assets/${normalized}`;
    return runtime?.getURL?.(extensionPath) ?? extensionPath;
  }
}

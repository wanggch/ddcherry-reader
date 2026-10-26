import type { FileProvider, FileContent, FileTreeNode } from '@md-reader/core';

const runtime = globalThis.browser?.runtime ?? globalThis.chrome?.runtime;

function sendRuntimeMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    runtime?.sendMessage?.(message, (response: unknown) => {
      const err = globalThis.chrome?.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(response);
    });
  });
}

export class ChromeFileProvider implements FileProvider {
  async readFile(url: string): Promise<FileContent> {
    if (url.startsWith('file:')) {
      const response = (await sendRuntimeMessage({ action: 'readMarkdownSource', url })) as {
        success?: boolean;
        markdown?: string;
        error?: string;
      };
      if (!response?.success) throw new Error(response?.error ?? 'Failed to read file');
      return { content: response.markdown ?? '', encoding: 'utf-8' };
    }

    const res = await fetch(this.withCacheBust(url), { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { content: await res.text(), encoding: 'utf-8' };
  }

  async readAsset(path: string): Promise<string> {
    if (path.startsWith('file:')) {
      const response = (await sendRuntimeMessage({ action: 'readFileContent', url: path })) as {
        success?: boolean;
        content?: string;
        error?: string;
      };
      if (!response?.success) throw new Error(response?.error ?? 'Failed to read asset');
      return response.content ?? '';
    }

    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  watchFile(path: string, callback: () => void): () => void {
    const interval = setInterval(() => callback(), 2000);
    return () => clearInterval(interval);
  }

  resolveAssetPath(filePath: string, assetRelativePath: string): string {
    const base = filePath.substring(0, filePath.lastIndexOf('/') + 1);
    return new URL(assetRelativePath, base).href;
  }

  async canRead(path: string): Promise<boolean> {
    try {
      if (path.startsWith('file:')) {
        await this.readFile(path);
        return true;
      }
      const res = await fetch(path, { method: 'HEAD' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listDirectory(_path: string): Promise<FileTreeNode[]> {
    // Browser extensions cannot enumerate local directories.
    return [];
  }

  private withCacheBust(url: string): string {
    const next = new URL(url, globalThis.location?.href);
    next.searchParams.set('md_reader_refresh', `${Date.now()}`);
    return next.href;
  }
}

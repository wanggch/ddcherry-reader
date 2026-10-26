import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { dirname, resolve } from 'pathe';
import type { FileProvider, FileContent, FileTreeNode } from '@md-reader/core';

export class TauriFileProvider implements FileProvider {
  private unlistenMap = new Map<string, () => void>();

  async readFile(path: string): Promise<FileContent> {
    return invoke<FileContent>('read_file', { path });
  }

  async readAsset(path: string): Promise<string> {
    if (path.startsWith('asset://')) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Asset fetch failed: ${res.status}`);
      return res.text();
    }
    const { content } = await invoke<{ content: string }>('read_file', { path });
    return content;
  }

  watchFile(path: string, callback: () => void): () => void {
    const unlistenPromise = listen<string>('file:changed', (event) => {
      if (event.payload === path) callback();
    });

    invoke('watch_file', { path }).catch(() => {});

    const cleanup = async () => {
      (await unlistenPromise)();
      await invoke('unwatch_file', { path }).catch(() => {});
    };

    this.unlistenMap.set(path, () => {
      cleanup();
    });
    return () => {
      cleanup();
      this.unlistenMap.delete(path);
    };
  }

  resolveAssetPath(filePath: string, relativePath: string): string {
    const absolutePath = resolve(dirname(filePath), decodeURIComponent(relativePath));
    return convertFileSrc(absolutePath);
  }

  async canRead(path: string): Promise<boolean> {
    return invoke<boolean>('file_exists', { path });
  }

  async listDirectory(path: string): Promise<FileTreeNode[]> {
    return invoke<FileTreeNode[]>('list_directory', { path });
  }
}

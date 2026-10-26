import type { FileTreeNode } from './tree.js';

export interface FileContent {
  content: string;
  encoding: 'utf-8';
  lastModified?: number;
}

export interface FileProvider {
  /** 读取 Markdown 源文件 */
  readFile(path: string): Promise<FileContent>;

  /** 读取辅助资源（如自定义 CSS） */
  readAsset(path: string): Promise<string>;

  /** 监听文件变化，返回取消监听函数 */
  watchFile(path: string, callback: () => void): () => void;

  /** 解析相对资源路径 */
  resolveAssetPath(filePath: string, relativePath: string): string;

  /** 判断路径是否可读 */
  canRead(path: string): Promise<boolean>;

  /** 列出目录中的 Markdown 文件树 */
  listDirectory(path: string): Promise<FileTreeNode[]>;
}

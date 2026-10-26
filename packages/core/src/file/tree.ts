export interface FileTreeNode {
  type: 'file' | 'dir';
  name: string;
  path: string;
  /**  opaque identifier，由 FileProvider 解释 */
  fileId: string;
  children?: FileTreeNode[];
}

export function flattenTree(tree: FileTreeNode[]): FileTreeNode[] {
  const files: FileTreeNode[] = [];

  for (const entry of tree) {
    if (entry.type === 'file') {
      files.push(entry);
    } else if (entry.children) {
      files.push(...flattenTree(entry.children));
    }
  }

  return files;
}

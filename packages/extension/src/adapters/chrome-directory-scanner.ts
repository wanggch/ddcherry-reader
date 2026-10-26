import type { FileTreeNode } from '@md-reader/core';

export async function scanMdTreeFromEntry(dirEntry: FileSystemDirectoryEntry, path = ''): Promise<FileTreeNode[]> {
  const entries: FileTreeNode[] = [];

  const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let allEntries: FileSystemEntry[] = [];
  const reader = dirEntry.createReader();
  let batch: FileSystemEntry[];
  do {
    batch = await readEntries(reader);
    allEntries.push(...batch);
  } while (batch.length > 0);

  for (const entry of allEntries) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.isDirectory) {
      const children = await scanMdTreeFromEntry(entry as FileSystemDirectoryEntry, entryPath);
      if (children.length > 0) {
        entries.push({
          type: 'dir',
          name: entry.name,
          path: entryPath,
          fileId: entryPath,
          children
        });
      }
    } else if (entry.isFile && entry.name.endsWith('.md')) {
      entries.push({
        type: 'file',
        name: entry.name,
        path: entryPath,
        fileId: entryPath
      });
    }
  }

  entries.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  return entries;
}

export async function readFileEntryContent(fileEntry: FileSystemFileEntry): Promise<string> {
  const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
  return file.text();
}

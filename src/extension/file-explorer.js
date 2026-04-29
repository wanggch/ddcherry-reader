/**
 * Recursively scan a FileSystemDirectoryEntry (from drag-and-drop) for .md files.
 * Returns a tree of { type, name, path, entry, children } entries.
 * Directories that contain no .md files (directly or in descendants) are omitted.
 */
export async function scanMdTreeFromEntry(dirEntry, path = '') {
  const entries = [];

  const readEntries = (reader) => new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });

  // Chrome returns entries in batches from the same reader; keep reading until empty.
  let allEntries = [];
  const reader = dirEntry.createReader();
  let batch;
  do {
    batch = await readEntries(reader);
    allEntries.push(...batch);
  } while (batch.length > 0);

  for (const entry of allEntries) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.isDirectory) {
      const children = await scanMdTreeFromEntry(entry, entryPath);
      if (children.length > 0) {
        entries.push({
          type: 'dir',
          name: entry.name,
          path: entryPath,
          entry,
          children
        });
      }
    } else if (entry.isFile && entry.name.endsWith('.md')) {
      entries.push({
        type: 'file',
        name: entry.name,
        path: entryPath,
        entry
      });
    }
  }

  // Sort: directories first, then files, each alphabetically
  entries.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  return entries;
}

/**
 * Read text content from a FileSystemFileEntry (drag-and-drop).
 */
export async function readFileEntryContent(fileEntry) {
  const file = await new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
  return file.text();
}

/**
 * Flatten a tree into a list of file entries for handle lookup.
 */
export function flattenTree(tree) {
  const files = [];
  for (const entry of tree) {
    if (entry.type === 'file') {
      files.push(entry);
    } else if (entry.children) {
      files.push(...flattenTree(entry.children));
    }
  }
  return files;
}

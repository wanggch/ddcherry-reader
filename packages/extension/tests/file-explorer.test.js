import { describe, expect, it, vi } from 'vitest';
import { flattenTree, readFileEntryContent, scanMdTreeFromEntry } from '../src/extension/file-explorer.js';

function createFileEntry(name, content = '') {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (resolve) => resolve({ name, text: async () => content })
  };
}

function createDirectoryEntry(name, batches) {
  const createReader = vi.fn(() => {
    if (createReader.mock.calls.length > 1) {
      throw new Error(`Directory reader for ${name} was recreated`);
    }

    let index = 0;

    return {
      readEntries: (resolve) => {
        resolve(batches[index++] ?? []);
      }
    };
  });

  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader
  };
}

describe('file explorer', () => {
  it('reuses one directory reader while collecting all entry batches', async () => {
    const first = createFileEntry('first.md');
    const ignored = createFileEntry('notes.txt');
    const second = createFileEntry('second.md');
    const root = createDirectoryEntry('docs', [
      [first, ignored],
      [second],
      []
    ]);

    const tree = await scanMdTreeFromEntry(root);

    expect(root.createReader).toHaveBeenCalledTimes(1);
    expect(tree.map((entry) => entry.name)).toEqual(['first.md', 'second.md']);
  });

  it('keeps directories that contain markdown descendants', async () => {
    const child = createDirectoryEntry('guide', [
      [createFileEntry('intro.md'), createFileEntry('draft.txt')],
      []
    ]);
    const root = createDirectoryEntry('docs', [
      [child],
      []
    ]);

    await expect(scanMdTreeFromEntry(root)).resolves.toEqual([
      expect.objectContaining({
        type: 'dir',
        name: 'guide',
        path: 'guide',
        children: [
          expect.objectContaining({
            type: 'file',
            name: 'intro.md',
            path: 'guide/intro.md'
          })
        ]
      })
    ]);
  });

  it('flattens a markdown tree and reads file entry text', async () => {
    const file = createFileEntry('intro.md', '# Intro');
    const tree = [
      {
        type: 'dir',
        name: 'guide',
        path: 'guide',
        children: [{ type: 'file', name: 'intro.md', path: 'guide/intro.md', entry: file }]
      }
    ];

    expect(flattenTree(tree)).toEqual([tree[0].children[0]]);
    await expect(readFileEntryContent(file)).resolves.toBe('# Intro');
  });
});

export { ReaderCore } from './reader-core.js';
export type { ReaderCoreOptions } from './reader-core.js';

export type { FileContent, FileProvider } from './file/provider.js';
export type { FileTreeNode } from './file/tree.js';
export { flattenTree } from './file/tree.js';

export type { StorageAdapter } from './storage/adapter.js';

export type { AssetResolver } from './assets/resolver.js';

export type {
  ReaderPreferences,
  ThemeName,
  TocPosition,
  SidebarTab,
  LayoutMode
} from './config/schema.js';
export { DEFAULT_PREFERENCES, normalizePreferences } from './config/schema.js';
export { PreferencesManager } from './config/preferences.js';

export { renderMarkdown, extractToc, parseCustomCssImports } from './renderer/index.js';
export type { RenderResult, TocItem, RenderOptions } from './renderer/index.js';
export { escapeHtml } from './renderer/index.js';

export { enhanceMermaidDiagrams } from './ui/mermaid-viewer.js';

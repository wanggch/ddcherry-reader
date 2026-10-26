export type ThemeName =
  | 'system'
  | 'light'
  | 'paper'
  | 'mint'
  | 'vue'
  | 'dark'
  | 'night'
  | 'purple'
  | 'black';

export type TocPosition = 'left' | 'right';
export type SidebarTab = 'toc' | 'folder';
export type LayoutMode = 'normal' | 'full';

export interface ReaderPreferences {
  enabled: boolean;
  theme: ThemeName;
  toc: boolean;
  tocPosition: TocPosition;
  autoRefresh: boolean;
  rawMode: boolean;
  layoutMode: LayoutMode;
  fontSize: number;
  sidebarTab: SidebarTab;
  /** 以下字段为 future use，默认在 DEFAULT_PREFERENCES 中提供 */
  tocWidth?: number;
  codeTheme?: string;
  autoRefreshInterval?: number;
  customCss?: string;
  enableMermaid?: boolean;
  enableMath?: boolean;
}

export const DEFAULT_PREFERENCES: Readonly<ReaderPreferences> = Object.freeze({
  enabled: true,
  theme: 'light',
  toc: true,
  tocPosition: 'left',
  autoRefresh: true,
  rawMode: false,
  layoutMode: 'normal',
  fontSize: 16,
  sidebarTab: 'toc',
  tocWidth: 340,
  codeTheme: 'github',
  autoRefreshInterval: 2000,
  customCss: '',
  enableMermaid: true,
  enableMath: true
});

const SUPPORTED_KEYS = new Set(Object.keys(DEFAULT_PREFERENCES));

export function normalizePreferences(stored: Record<string, unknown> | null | undefined): ReaderPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...(stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {})
  } as ReaderPreferences;
}

export function filterPreferences(nextPreferences: Partial<ReaderPreferences>): Partial<ReaderPreferences> {
  const filtered: Partial<ReaderPreferences> = {};

  for (const [key, value] of Object.entries(nextPreferences ?? {})) {
    if (SUPPORTED_KEYS.has(key)) {
      (filtered as Record<string, unknown>)[key] = value;
    }
  }

  return filtered;
}

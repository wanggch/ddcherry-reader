const THEME_STYLES = {
  light: {
    github: 'assets/github-markdown-light.css',
    highlight: 'assets/highlight-github.css'
  },
  dark: {
    github: 'assets/github-markdown-dark.css',
    highlight: 'assets/highlight-github-dark.css'
  }
};

const STATIC_STYLES = [
  ['md-reader-katex', 'assets/katex.min.css'],
  ['md-reader-layout', 'assets/reader.css']
];

const LEGACY_THEME_LINK_IDS = [
  'md-reader-github-light',
  'md-reader-github-dark',
  'md-reader-highlight-light',
  'md-reader-highlight-dark'
];

export function ensureThemeStyles(theme, doc = document, runtimeGetURL = getRuntimeUrl) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  const assets = THEME_STYLES[normalizedTheme];

  removeLegacyThemeLinks(doc);
  upsertStylesheet(doc, {
    id: 'md-reader-github-theme',
    href: runtimeGetURL(assets.github),
    dataset: 'mdReaderThemeStyle'
  });
  upsertStylesheet(doc, {
    id: 'md-reader-highlight-theme',
    href: runtimeGetURL(assets.highlight),
    dataset: 'mdReaderThemeStyle'
  });

  for (const [id, path] of STATIC_STYLES) {
    upsertStylesheet(doc, {
      id,
      href: runtimeGetURL(path),
      dataset: 'mdReaderStaticStyle'
    });
  }
}

function upsertStylesheet(doc, { id, href, dataset }) {
  let link = doc.getElementById(id);

  if (!link) {
    link = doc.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    doc.head.append(link);
  }

  link.disabled = false;
  link.href = href;
  link.dataset[dataset] = 'true';
}

function removeLegacyThemeLinks(doc) {
  for (const id of LEGACY_THEME_LINK_IDS) {
    doc.getElementById(id)?.remove();
  }
}

function getRuntimeUrl(path) {
  return globalThis.chrome?.runtime?.getURL?.(path)
    ?? globalThis.browser?.runtime?.getURL?.(path)
    ?? path;
}

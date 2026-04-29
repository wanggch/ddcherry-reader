const SUPPORTED_PROTOCOLS = new Set(['file:']);
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mkd', '.mdx', '.txt']);

export function isMarkdownUrl(url) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  const path = decodeURIComponent(parsed.pathname).toLowerCase();
  return [...MARKDOWN_EXTENSIONS].some((extension) => path.endsWith(extension));
}

export function isProbablyRawMarkdownDocument(url, doc = document) {
  if (isMarkdownUrl(url)) {
    return true;
  }

  if (doc.body?.dataset?.mdReaderRendered === 'true') {
    return false;
  }

  const children = [...(doc.body?.children ?? [])];
  const rawText = getBodyText(doc).trim();

  if (!rawText) {
    return false;
  }

  const isSinglePre = children.length === 1 && children[0].tagName === 'PRE';
  const looksLikeMarkdown = [
    /^#{1,6}\s+\S/m,
    /^[-*+]\s+\S/m,
    /^>\s+\S/m,
    /^```[\s\S]*```/m,
    /\[[^\]]+\]\([^)]+\)/,
    /^\|.+\|\s*$/m
  ].some((pattern) => pattern.test(rawText));

  return isSinglePre && looksLikeMarkdown;
}

export function getRawMarkdownFromDocument(doc = document) {
  const pre = doc.body?.children?.length === 1 && doc.body.children[0].tagName === 'PRE'
    ? doc.body.children[0]
    : null;

  return pre ? pre.textContent : getBodyText(doc);
}

function getBodyText(doc) {
  return doc.body?.innerText ?? doc.body?.textContent ?? '';
}

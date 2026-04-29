import { getRawMarkdownFromDocument, isProbablyRawMarkdownDocument } from './url-detection.js';

const EMPTY_PREPARATION = {
  isMarkdownDocument: false,
  markdown: '',
  didRewriteDocument: false
};

export function prepareMarkdownDocumentForRendering(url, doc = document) {
  if (!isProbablyRawMarkdownDocument(url, doc)) {
    return { ...EMPTY_PREPARATION };
  }

  const markdown = getRawMarkdownFromDocument(doc);
  let didRewriteDocument = false;

  if (doc.compatMode === 'BackCompat') {
    try {
      doc.open();
      doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
      doc.close();
      didRewriteDocument = doc.compatMode === 'CSS1Compat';
    } catch {
      // Some browser/content-script combinations may block document.open.
    }
  }

  return {
    isMarkdownDocument: true,
    markdown,
    didRewriteDocument
  };
}

export const preparedMarkdownDocument = typeof window !== 'undefined' && typeof document !== 'undefined'
  ? prepareMarkdownDocumentForRendering(window.location.href, document)
  : { ...EMPTY_PREPARATION };

// Fallback: suppress KaTeX's import-time warning if a browser refuses document.open.
const _originalWarn = console.warn;
console.warn = function katexCompatFilter(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes("KaTeX doesn't work in quirks mode")) {
    return;
  }
  return _originalWarn.apply(console, args);
};

export const _savedMarkdown = preparedMarkdownDocument.markdown;

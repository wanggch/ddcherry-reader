import MarkdownIt from 'markdown-it';
import type { RenderRule } from 'markdown-it/lib/renderer.mjs';
import type Renderer from 'markdown-it/lib/renderer.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import type { Options } from 'markdown-it/lib/index.mjs';
import anchor from 'markdown-it-anchor';
import admonition from 'markdown-it-admon';
import footnote from 'markdown-it-footnote';
import { full as emoji } from 'markdown-it-emoji';
import katex from 'katex';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import taskLists from 'markdown-it-task-lists';
import tocDoneRight from 'markdown-it-toc-done-right';
import createDOMPurify from 'dompurify';
import hljs from 'highlight.js';

const CUSTOM_CSS_IMPORT_RE = /^\s*<!--\s*@import\s+["']([^"']+)["']\s*-->\s*$/gim;
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

export interface RenderResult {
  html: string;
  toc: TocItem[];
  cssImports: string[];
}

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

export interface RenderOptions {
  sanitize?: boolean;
}

export function parseCustomCssImports(source: string): { imports: string[]; markdown: string } {
  const imports: string[] = [];
  const markdown = String(source ?? '').replace(CUSTOM_CSS_IMPORT_RE, (_match, cssPath: string) => {
    imports.push(cssPath.trim());
    return '';
  });

  return { imports, markdown };
}

export function extractFrontmatter(source: string): { frontmatter: string; markdown: string } {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: '', markdown: source };
  return { frontmatter: match[1], markdown: source.slice(match[0].length) };
}

function renderFrontmatterYaml(yaml: string): string {
  const escaped = yaml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<pre class="md-reader-frontmatter"><code class="language-yaml">${escaped}</code></pre>\n`;
}

export async function renderMarkdown(source: string, options: RenderOptions = {}): Promise<RenderResult> {
  const { imports, markdown } = parseCustomCssImports(source);
  const { frontmatter, markdown: body } = extractFrontmatter(markdown);
  const md = createMarkdownIt();
  const rendered = md.render(body);
  const frontmatterHtml = frontmatter ? renderFrontmatterYaml(frontmatter) : '';
  const html = options.sanitize === false ? frontmatterHtml + rendered : sanitizeHtml(frontmatterHtml + rendered);

  return {
    html,
    toc: extractToc(html),
    cssImports: imports
  };
}

export function extractToc(html: string): TocItem[] {
  const root = document.createElement('template');
  root.innerHTML = html;

  return [...root.content.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter((heading): heading is HTMLElement => Boolean(heading.id))
    .map((heading) => {
      const clone = heading.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('a[href^="#"], .header-anchor').forEach((node) => node.remove());

      return {
        id: heading.id,
        level: Number(heading.tagName.slice(1)),
        text: clone.textContent?.trim().replace(/\s+/g, ' ') ?? ''
      };
    });
}

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code: string, language: string): string {
      const normalized = String(language || '').trim().toLowerCase();

      if (normalized && hljs.getLanguage(normalized)) {
        try {
          return hljs.highlight(code, { language: normalized, ignoreIllegals: true }).value;
        } catch {
          return md.utils.escapeHtml(code);
        }
      }

      return hljs.highlightAuto(code).value;
    }
  });

  const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules);
  md.renderer.rules.fence = (
    tokens: Token[],
    idx: number,
    options: Options,
    env: unknown,
    slf: Renderer
  ) => {
    const token = tokens[idx];
    const language = token.info.trim().split(/\s+/)[0]?.toLowerCase();

    if (language === 'mermaid') {
      return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>\n`;
    }

    return defaultFence ? defaultFence(tokens, idx, options, env, slf) : slf.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = externalLinkRenderer(md.renderer.rules.link_open);

  wrapTables(md);

  md.use(anchor, { slugify, tabIndex: false });
  md.use(tocDoneRight, { level: [1, 2, 3, 4, 5, 6], slugify });
  md.use(emoji);
  md.use(footnote);
  md.use(sub);
  md.use(sup);
  md.use(taskLists, { enabled: false, label: true });
  md.use(katexPlugin, { throwOnError: false, strict: false, output: 'html' });
  md.use(admonition);

  return md;
}

function wrapTables(md: MarkdownIt): void {
  const defaultTableOpen = md.renderer.rules.table_open?.bind(md.renderer.rules) ??
    ((tokens: Token[], idx: number, options: Options, env: unknown, slf: Renderer) =>
      slf.renderToken(tokens, idx, options));
  const defaultTableClose = md.renderer.rules.table_close?.bind(md.renderer.rules) ??
    ((tokens: Token[], idx: number, options: Options, env: unknown, slf: Renderer) =>
      slf.renderToken(tokens, idx, options));

  md.renderer.rules.table_open = (
    tokens: Token[],
    idx: number,
    options: Options,
    env: unknown,
    slf: Renderer
  ) => {
    return `<div class="md-reader-table-wrap">\n${defaultTableOpen(tokens, idx, options, env, slf)}`;
  };

  md.renderer.rules.table_close = (
    tokens: Token[],
    idx: number,
    options: Options,
    env: unknown,
    slf: Renderer
  ) => {
    return `${defaultTableClose(tokens, idx, options, env, slf)}</div>\n`;
  };
}

function sanitizeHtml(html: string): string {
  const purifier = createDOMPurify(window);

  return purifier.sanitize(html, {
    ADD_TAGS: ['details', 'summary', 'input', 'math', 'mi', 'mn', 'mo', 'msup', 'mrow', 'semantics', 'annotation'],
    ADD_ATTR: [
      'aria-hidden',
      'aria-label',
      'checked',
      'class',
      'disabled',
      'for',
      'height',
      'href',
      'id',
      'rel',
      'role',
      'src',
      'target',
      'title',
      'type',
      'value',
      'viewBox',
      'width',
      'xmlns'
    ]
  }) as string;
}

function katexPlugin(md: MarkdownIt, katexOptions: katex.KatexOptions): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  md.block.ruler.after('blockquote', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  });

  md.renderer.rules.math_inline = (tokens: Token[], idx: number) =>
    renderKatex(tokens[idx].content, { ...katexOptions, displayMode: false });

  md.renderer.rules.math_block = (tokens: Token[], idx: number) =>
    `${renderKatex(tokens[idx].content, { ...katexOptions, displayMode: true })}\n`;
}

function mathInline(state: any, silent: boolean): boolean {
  if (state.src[state.pos] !== '$' || state.src[state.pos + 1] === '$') {
    return false;
  }

  const start = state.pos + 1;
  let marker = start;

  while ((marker = state.src.indexOf('$', marker)) !== -1) {
    if (state.src[marker - 1] !== '\\') {
      break;
    }
    marker += 1;
  }

  if (marker === -1) {
    return false;
  }

  const content = state.src.slice(start, marker);
  if (!content.trim()) {
    return false;
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.content = content;
    token.markup = '$';
  }

  state.pos = marker + 1;
  return true;
}

function mathBlock(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];

  if (state.src.slice(start, start + 2) !== '$$') {
    return false;
  }

  if (silent) {
    return true;
  }

  let nextLine = startLine;
  let firstLine = state.src.slice(start + 2, max);
  let lastLine = '';
  let found = firstLine.trim().endsWith('$$');

  if (found) {
    firstLine = firstLine.trim().slice(0, -2);
  }

  while (!found && ++nextLine < endLine) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
    const lineMax = state.eMarks[nextLine];
    const line = state.src.slice(lineStart, lineMax);
    const closing = line.lastIndexOf('$$');

    if (closing >= 0) {
      lastLine = line.slice(0, closing);
      found = true;
      break;
    }
  }

  const content = [firstLine, state.getLines(startLine + 1, nextLine, state.tShift[startLine], true), lastLine]
    .join('\n')
    .trim();

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = content;
  token.map = [startLine, nextLine + 1];
  token.markup = '$$';
  state.line = nextLine + 1;
  return true;
}

function renderKatex(latex: string, options: katex.KatexOptions): string {
  try {
    return katex.renderToString(latex, options);
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }
}

function externalLinkRenderer(defaultRenderer?: RenderRule): RenderRule {
  return (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');
    const href = hrefIndex >= 0 ? token.attrs?.[hrefIndex][1] ?? '' : '';

    if (/^https?:\/\//i.test(href)) {
      setAttr(token, 'target', '_blank');
      setAttr(token, 'rel', 'noopener noreferrer');
    }

    return defaultRenderer ? defaultRenderer(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };
}

function setAttr(token: Token, name: string, value: string): void {
  const index = token.attrIndex(name);
  if (index < 0) {
    token.attrPush([name, value]);
  } else if (token.attrs) {
    token.attrs[index] = [name, value];
  }
}

export function slugify(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

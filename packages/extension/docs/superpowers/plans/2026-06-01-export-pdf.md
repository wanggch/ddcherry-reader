# 导出 PDF 功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Markdown Reader Pro 扩展的工具栏添加"导出 PDF"按钮，点击后调用浏览器打印对话框，打印时显示文档标题页眉并隐藏工具栏/侧边栏。

**Architecture:** 纯前端实现，无需 background 或额外权限。在 content-script 渲染时注入页眉元素，通过 CSS `@media print` 控制打印样式，`window.print()` 触发打印对话框。

**Tech Stack:** Vanilla JS (content-script), CSS (`@media print`, `@page`), Vitest + JSDOM 测试

---

## 文件结构

| 文件 | 责任 |
|------|------|
| `src/styles/reader.css` | 屏幕模式下隐藏页眉，`@media print` 中显示页眉并设置页面边距 |
| `src/extension/content-script.js` | 工具栏添加导出按钮、绑定 `window.print()` 点击事件、`injectPrintHeader()` 注入页眉 DOM |
| `tests/export-pdf.test.js` | 验证页眉渲染内容和导出按钮触发打印行为 |

---

## Task 1: 打印样式

**Files:**
- Modify: `src/styles/reader.css`

- [ ] **Step 1: 添加页眉屏幕隐藏样式**

  在 `reader.css` 中 `@media print` 区块**上方**（任意位置）添加：

  ```css
  .md-reader-print-header {
    display: none;
  }
  ```

  目的：确保页眉元素在正常浏览时不显示。

- [ ] **Step 2: 在 `@media print` 中添加页眉显示样式和页面边距**

  在 `reader.css` 的 `@media print` 区块末尾（`.md-reader-content` 规则之后、`}` 之前）添加：

  ```css
  .md-reader-print-header {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 12px;
    color: var(--md-reader-muted);
    border-bottom: 0.5px solid var(--md-reader-border);
    padding-bottom: 8px;
  }

  @page {
    margin-top: 1.8cm;
    margin-bottom: 1cm;
  }
  ```

  注意：`@page` 放在 `@media print` 内部，现代浏览器均支持。

- [ ] **Step 3: Commit**

  ```bash
  git add src/styles/reader.css
  git commit -m "feat: add print header styles for PDF export"
  ```

---

## Task 2: 导出按钮与页眉注入

**Files:**
- Modify: `src/extension/content-script.js`

- [ ] **Step 1: 在工具栏添加导出按钮 HTML**

  在 `mountReader()` 中，找到字号控件 `</div>`（闭合 `.md-reader-font-size`）和 `</nav>`（闭合 `.md-reader-toolbar__actions`）之间的位置，插入导出按钮：

  ```html
  <button type="button" data-action="export-pdf" aria-label="导出 PDF" title="导出 PDF">
    <span class="md-reader-btn-icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </span>
    <span class="md-reader-btn-label">导出</span>
  </button>
  ```

  按钮使用现有 `.md-reader-toolbar button` 样式，无需新增 CSS。

- [ ] **Step 2: 绑定导出按钮点击事件**

  在 `bindReaderEvents()` 中，字号增大按钮事件监听器之后，添加：

  ```js
  root.querySelector('[data-action="export-pdf"]')?.addEventListener('click', () => {
    window.print();
  });
  ```

- [ ] **Step 3: 实现 `injectPrintHeader()` 函数**

  在 `content-script.js` 中新增函数（放在 `showLoader()` 附近即可）：

  ```js
  function injectPrintHeader() {
    document.querySelectorAll('.md-reader-print-header').forEach((el) => el.remove());

    const header = document.createElement('div');
    header.className = 'md-reader-print-header';
    header.textContent = document.title || 'Markdown Reader Pro';

    document.body.append(header);
  }
  ```

- [ ] **Step 4: 在 `mountReader()` 末尾调用 `injectPrintHeader()`**

  在 `mountReader()` 的 `updateProgress();` 之前插入：

  ```js
  injectPrintHeader();
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/extension/content-script.js
  git commit -m "feat: add PDF export button and print header injection"
  ```

---

## Task 3: 单元测试

**Files:**
- Create: `tests/export-pdf.test.js`

- [ ] **Step 1: 创建测试文件**

  创建 `tests/export-pdf.test.js`，内容如下：

  ```js
  import { JSDOM } from 'jsdom';
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

  describe('export pdf', () => {
    let dom;
    let printSpy;

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      dom = new JSDOM('<!doctype html><body><pre># Hello\n\nworld</pre></body>', {
        url: 'file:///C:/docs/test.md',
        pretendToBeVisual: true
      });

      vi.stubGlobal('window', dom.window);
      vi.stubGlobal('document', dom.window.document);
      vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
      vi.stubGlobal('Element', dom.window.Element);
      vi.stubGlobal('Node', dom.window.Node);
      vi.stubGlobal('DOMParser', dom.window.DOMParser);
      vi.stubGlobal('IntersectionObserver', class {
        observe() {}
        disconnect() {}
      });

      printSpy = vi.fn();
      Object.defineProperty(dom.window, 'print', {
        value: printSpy,
        configurable: true
      });

      vi.stubGlobal('chrome', {
        runtime: {
          getURL: (path) => `chrome-extension://markdown-reader-pro/${path}`,
          onMessage: {
            addListener: vi.fn()
          },
          sendMessage: vi.fn((message, callback) => {
            if (message?.action === 'readMarkdownSource') {
              callback({ success: true, markdown: '# Hello\n\nworld' });
            }
          })
        },
        storage: {
          sync: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn((_value, callback) => {
              callback?.();
            })
          }
        }
      });
    });

    afterEach(() => {
      dom?.window?.close();
      vi.unstubAllGlobals();
    });

    it('renders a print header with the document title', async () => {
      await import('../src/extension/content-script.js');
      await waitUntil(() => document.querySelector('.md-reader-print-header'));

      const header = document.querySelector('.md-reader-print-header');
      expect(header).not.toBeNull();
      expect(header.textContent).toBe('Hello');
    });

    it('triggers window.print when export button is clicked', async () => {
      await import('../src/extension/content-script.js');
      await waitUntil(() => document.querySelector('[data-action="export-pdf"]'));

      const btn = document.querySelector('[data-action="export-pdf"]');
      btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      expect(printSpy).toHaveBeenCalled();
    });
  });

  async function waitUntil(condition) {
    const started = Date.now();
    while (!condition()) {
      if (Date.now() - started > 3000) {
        throw new Error('Timed out waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  ```

  测试模式与 `tests/auto-refresh.test.js` 一致：通过 JSDOM 模拟 DOM 和 Chrome API，动态导入 content-script 触发渲染，然后断言 DOM 状态。

- [ ] **Step 2: 运行测试确认通过**

  ```bash
  npx vitest run tests/export-pdf.test.js
  ```

  Expected: 2 tests passed

- [ ] **Step 3: Commit**

  ```bash
  git add tests/export-pdf.test.js
  git commit -m "test: add export PDF tests"
  ```

---

## Task 4: 回归测试

**Files:**
- Test: 所有现有测试

- [ ] **Step 1: 运行全部测试**

  ```bash
  npx vitest run
  ```

  Expected: 所有测试通过（包括 `tests/auto-refresh.test.js`、`tests/background.test.js` 和新加的 `tests/export-pdf.test.js`）

- [ ] **Step 2: 如有失败，修复后 commit**

  如果 content-script 的修改导致现有测试失败，定位问题并修复。修复后：

  ```bash
  git add <files>
  git commit -m "fix: resolve test regressions from PDF export feature"
  ```

---

## 实现后手动验证清单

在浏览器中加载扩展后，打开一个本地 Markdown 文件：

- [ ] 工具栏最右侧出现"导出"按钮
- [ ] 点击"导出"按钮弹出浏览器打印对话框
- [ ] 打印预览中侧边栏、工具栏、进度条已隐藏
- [ ] 打印预览中每页顶部显示文档标题（页眉）
- [ ] 暗色主题下页眉文字可见（对比度正常）
- [ ] 正常浏览时页眉不可见

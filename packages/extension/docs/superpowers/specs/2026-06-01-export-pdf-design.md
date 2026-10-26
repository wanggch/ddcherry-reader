# Markdown Reader Pro — 导出 PDF 功能设计文档

> 日期：2026-06-01  
> 状态：已确认  
> 版本：v1.2 内容处理增强

---

## 1. 功能概述

在 Markdown Reader Pro 浏览器扩展中增加"导出为 PDF"功能。用户在阅读 Markdown 文档时，点击工具栏上的"导出"按钮，触发浏览器打印对话框，将当前渲染后的页面保存为 PDF。

---

## 2. 需求决策汇总

| 决策项 | 结论 | 原因 |
|--------|------|------|
| 导出方式 | 浏览器打印对话框（`window.print()`） | 简单可靠，无需额外权限 |
| 打印主题 | 保留当前选中的主题 | 用户明确选择 |
| 页眉内容 | 文档标题（`document.title`） | 标识文档来源 |
| 页脚内容 | 无 | 用户明确选择不显示生成日期 |
| 页码 | 不显示 | 用户明确选择 |
| 按钮位置 | 工具栏最右侧（字号控件旁边） | 用户明确选择 |

---

## 3. 架构设计

### 3.1 UI 组件

在 `content-script.js` 的 `mountReader()` 中，工具栏 `nav.md-reader-toolbar__actions` 末尾新增一个导出按钮：

```html
<button type="button" data-action="export-pdf" aria-label="导出 PDF" title="导出 PDF">
  <span class="md-reader-btn-icon">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  </span>
  <span class="md-reader-btn-label">导出</span>
</button>
```

按钮样式复用现有工具栏按钮样式（`.md-reader-toolbar button`），无需新增 CSS。

### 3.2 行为逻辑

在 `bindReaderEvents()` 中为导出按钮绑定点击事件：

```js
root.querySelector('[data-action="export-pdf"]')?.addEventListener('click', () => {
  window.print();
});
```

### 3.3 打印样式

在 `reader.css` 的 `@media print` 区块中：

1. **保持现有隐藏逻辑**：`.md-reader-toolbar`, `.md-reader-sidebar`, `.md-reader-progress`, `.md-reader-lightbox`, `#md-reader-loader`, `.md-reader-copy-btn` 继续隐藏。

2. **调整页面布局**：`.md-reader-shell` 和 `.md-reader-content` 的现有打印样式保持不变。

3. **添加页眉样式**：

```css
.md-reader-print-header {
  display: none;
}

@media print {
  /* ... 现有隐藏逻辑 ... */

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
}
```

### 3.4 页眉内容注入

在 `content-script.js` 中新增 `injectPrintHeader()` 函数，在 `mountReader()` 渲染完成后调用：

```js
function injectPrintHeader() {
  document.querySelectorAll('.md-reader-print-header').forEach((el) => el.remove());

  const header = document.createElement('div');
  header.className = 'md-reader-print-header';
  header.textContent = document.title || 'Markdown Reader Pro';

  document.body.append(header);
}
```

---

## 4. 测试策略

1. **单元测试**（`tests/export-pdf.test.js`）：
   - 验证点击导出按钮会触发 `window.print()`
   - 验证 `mountReader()` 后页面中存在 `.md-reader-print-header` 元素
   - 验证页眉文本内容等于 `document.title`

2. **手动测试**：
   - 在 Light / Dark 主题下分别导出 PDF，确认主题被保留
   - 确认页眉显示正确的文档标题
   - 确认侧边栏、工具栏在 PDF 中不可见

---

## 5. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/extension/content-script.js` | 修改 | 添加导出按钮 HTML、点击事件绑定、`injectPrintHeader()` 函数 |
| `src/styles/reader.css` | 修改 | 在 `@media print` 中添加 `.md-reader-print-header` 样式和 `@page` 边距 |
| `tests/export-pdf.test.js` | 新增 | 导出 PDF 功能的单元测试 |

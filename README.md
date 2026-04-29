# Markdown Reader Pro

Markdown Reader Pro 是一个 Manifest V3 浏览器扩展，用于在 Chrome、Edge 和 Firefox 中直接渲染本地或在线 Markdown 文件。它面向 `.md`、`.markdown`、`.mkd`、`.mdx` 和 `.txt` 文件，提供 GitHub 风格阅读页、目录、明暗主题、数学公式、Mermaid 图表、代码高亮、图片预览、Raw 模式和本地文件刷新。

## 功能

- 自动识别 `file://` 下的 Markdown-like 文件。
- GitHub Flavored Markdown 渲染，支持表格、任务列表、脚注、Emoji、上标、下标、HTML、KaTeX 数学公式、Mermaid 图表和 admonitions。
- 侧边栏 TOC，支持左/右位置、隐藏、平滑滚动和拖拽调整宽度。
- Light、Dark、System 三种主题策略，正文和代码高亮同步切换。
- 本地文件可启用 2 秒轮询自动刷新，也可手动刷新。
- 图片点击放大，Raw/Preview 切换，打印时自动隐藏工具栏和目录。
- Options 页面使用 `chrome.storage.sync` 保存偏好。
- 默认不收集数据，运行时不访问额外网络资源。

## 项目结构

```text
.
├── public/
│   ├── _locales/                 # 中英文 i18n 文案
│   ├── manifest.json             # Manifest V3 配置
│   └── options.html              # 扩展设置页
├── samples/                      # 10 个 Markdown 语法测试文件
├── scripts/
│   ├── build.mjs                 # esbuild 打包扩展资源
│   └── package-extension.mjs     # 生成 release/markdown-reader-pro.zip
├── src/
│   ├── extension/
│   │   ├── background.js
│   │   ├── content-script.js
│   │   ├── preferences.js
│   │   └── url-detection.js
│   ├── markdown/
│   │   └── renderer.js
│   ├── options/
│   │   └── options.js
│   └── styles/
│       ├── options.css
│       └── reader.css
├── tests/                        # Vitest 单元测试
├── package.json
└── 需求.md
```

## 开发

```bash
npm install
npm test
npm run build
```

构建完成后，扩展文件位于 `dist/`。

## 在 Chrome / Edge 中加载

1. 运行 `npm run build`。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择项目下的 `dist/`。
5. 如需读取本地 Markdown 文件，在扩展详情页开启「允许访问文件网址」。
6. 直接在浏览器中打开 `samples/01-basic.md` 或任意本地 `.md` 文件。

## 在 Firefox 中加载

1. 运行 `npm run build`。
2. 打开 `about:debugging#/runtime/this-firefox`。
3. 点击「临时载入附加组件」。
4. 选择 `dist/manifest.json`。

## 打包

```bash
npm run package
```

输出文件：

```text
release/markdown-reader-pro.zip
```

也可以手动压缩 `dist/` 目录内容提交到扩展商店。

## 测试

自动化测试覆盖：

- Markdown 渲染：任务列表、表格、脚注、Emoji、上下标、KaTeX、Mermaid、HTML 清洗、TOC。
- URL 检测：支持与拒绝的协议/扩展名。
- 设置存储：默认值、合并存储值、过滤非法配置键。

样例文件位于 `samples/`，覆盖基础语法、表格、任务列表、脚注、数学公式、Mermaid、admonitions、自定义 CSS、图片、Raw/HTML 等场景。

## 自定义 CSS

Markdown 文件可在顶部声明同目录或相对路径 CSS：

```markdown
<!-- @import "style.css" -->
```

扩展会在渲染后尝试读取并注入该 CSS。读取本地 CSS 需要浏览器允许扩展访问文件网址。

## 发布素材建议

- 名称：Markdown Reader Pro
- 简短描述：在浏览器中直接渲染本地和在线 Markdown 文件。
- 详细描述重点：GFM、TOC、Light/Dark、KaTeX、Mermaid、代码高亮、本地文件刷新、隐私友好。
- 截图建议：
  - GitHub 风格正文 + 侧边栏目录。
  - Dark 主题代码块和表格。
  - Mermaid 图表与 KaTeX 公式。
  - Options 设置页。

## 隐私

扩展不收集、不上传、不分析用户数据。除用户主动打开的在线 Markdown URL 外，扩展运行时不请求外部资源；依赖库和样式都打包在扩展内。

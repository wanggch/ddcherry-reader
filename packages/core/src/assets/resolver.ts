export interface AssetResolver {
  /**
   * 将包内 assets 根目录下的相对路径转成可加载 URL。
   * 传入路径不含 "assets/" 前缀，例如：
   * - `highlight-github.css`
   * - `github-markdown-light.css`
   * - `fonts/KaTeX_Main-Regular.woff2`
   */
  resolve(path: string): string;
}

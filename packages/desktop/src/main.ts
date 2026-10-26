import './styles.css';
import { bootstrap } from './app.js';

bootstrap().catch((error) => {
  console.error('[Markdown Reader Pro Desktop] bootstrap failed', error);
  const app = document.getElementById('app');
  if (app) {
    app.textContent = `启动失败：${error instanceof Error ? error.message : String(error)}`;
  }
});

const MERMAID_ZOOM_ICON = `
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
`;

const MERMAID_CLOSE_ICON = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
`;

export function enhanceMermaidDiagrams(root = document) {
  const doc = root.ownerDocument ?? root;
  const diagrams = [...root.querySelectorAll('.mermaid')];

  diagrams.forEach((diagram) => {
    if (diagram.classList.contains('mermaid-error')) return;
    if (diagram.closest('.md-reader-mermaid-frame')) return;

    const frame = doc.createElement('div');
    frame.className = 'md-reader-mermaid-frame';
    diagram.before(frame);
    frame.append(diagram);

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'md-reader-mermaid-zoom';
    button.setAttribute('aria-label', 'Fullscreen Mermaid diagram');
    button.title = 'Fullscreen diagram';
    button.innerHTML = MERMAID_ZOOM_ICON;
    button.addEventListener('click', () => openMermaidViewer(root, diagram));
    frame.append(button);
  });
}

function openMermaidViewer(root, diagram) {
  const viewer = ensureMermaidViewer(root);
  const canvas = viewer.querySelector('.md-reader-mermaid-viewer__canvas');
  const clone = diagram.cloneNode(true);

  clone.classList.add('md-reader-mermaid-viewer__diagram');
  clone.removeAttribute('id');

  canvas.replaceChildren(clone);
  viewer.hidden = false;
  viewer.setAttribute('aria-hidden', 'false');
  viewer.querySelector('.md-reader-mermaid-viewer__close')?.focus();
}

function ensureMermaidViewer(root) {
  const doc = root.ownerDocument ?? root;
  const host = root.body ?? root;
  let viewer = host.querySelector('.md-reader-mermaid-viewer');

  if (viewer) {
    return viewer;
  }

  viewer = doc.createElement('div');
  viewer.className = 'md-reader-mermaid-viewer';
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `
    <button type="button" class="md-reader-mermaid-viewer__close" aria-label="Close Mermaid fullscreen view" title="Close">
      ${MERMAID_CLOSE_ICON}
    </button>
    <div class="md-reader-mermaid-viewer__canvas"></div>
  `;

  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) {
      closeMermaidViewer(viewer);
    }
  });

  viewer.querySelector('.md-reader-mermaid-viewer__close')?.addEventListener('click', () => {
    closeMermaidViewer(viewer);
  });

  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !viewer.hidden) {
      closeMermaidViewer(viewer);
    }
  });

  host.append(viewer);
  return viewer;
}

function closeMermaidViewer(viewer) {
  viewer.hidden = true;
  viewer.setAttribute('aria-hidden', 'true');
  viewer.querySelector('.md-reader-mermaid-viewer__canvas')?.replaceChildren();
}

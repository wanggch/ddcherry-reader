# Mermaid Diagram

```mermaid
flowchart TD
  A[Open Markdown file] --> B{Supported URL?}
  B -- Yes --> C[Render Markdown]
  B -- No --> D[Leave page unchanged]
  C --> E[Show TOC and toolbar]
```

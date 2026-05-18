// Offscreen document for reading local file:// URLs.
// Service workers cannot fetch file:// URLs, but offscreen documents can
// because they run in a chrome-extension:// context with DOM/XHR access.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action !== 'fetchFileContent') return false;

  const url = message.url;
  if (!url || !url.startsWith('file://')) {
    sendResponse({ success: false, error: 'Invalid file URL' });
    return true;
  }

  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'text';
  xhr.onload = () => {
    if (xhr.status === 0 || xhr.status === 200) {
      sendResponse({ success: true, markdown: xhr.responseText });
    } else {
      sendResponse({ success: false, error: `Read failed: ${xhr.status}` });
    }
  };
  xhr.onerror = () => {
    sendResponse({ success: false, error: 'XHR network error reading file' });
  };
  xhr.ontimeout = () => {
    sendResponse({ success: false, error: 'XHR timeout reading file' });
  };
  xhr.timeout = 5000;
  xhr.send();

  return true; // async response
});

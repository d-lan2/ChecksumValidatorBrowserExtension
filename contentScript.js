document.addEventListener('click', (event) => {
    if (event.target.tagName === 'A' && event.target.hasAttribute('data-file-hash')) {
      event.preventDefault();
      const fileHash = event.target.getAttribute('data-file-hash');
      const url = event.target.href;
      console.log('File hash from the page:', fileHash);
      const port = chrome.runtime.connect({ name: 'fileHash' });
      port.postMessage({ type: 'fileHashFound', fileHash, url });
      port.disconnect();
    }
  });
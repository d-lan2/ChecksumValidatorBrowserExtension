function findAllHashes() {
    const hashPatterns = {
      md5: /\b[A-Fa-f0-9]{32}\b/g,
      sha1: /\b[A-Fa-f0-9]{40}\b/g,
      sha256: /\b[A-Fa-f0-9]{64}\b/g,
      sha512: /\b[A-Fa-f0-9]{128}\b/g
    };
  
    const pageText = document.body.innerText;
    const allHashes = {};
  
    for (const [hashType, pattern] of Object.entries(hashPatterns)) {
      const matches = pageText.match(pattern);
      if (matches) {
        allHashes[hashType] = new Set(matches);
      }
    }
  
    return allHashes;
  }
  
  document.addEventListener('click', (event) => {
    console.log("Click event captured"); // Add this line
    const downloadLink = event.target.closest('a');
    
    if (downloadLink) {
      console.log("Clicked download link");
      event.preventDefault();
      const url = downloadLink.href;
      const allHashes = findAllHashes();
      console.log('All hashes found on the page:', allHashes);
      const port = chrome.runtime.connect({ name: 'fileHash' });
      
      if (port) {
        console.log('Connected to background script'); // Add this line
      } else {
        console.log('Connection to background script failed'); // Add this line
      }
      
      port.postMessage({ type: 'fileHashesFound', allHashes, url });
      port.disconnect();
    }
  });
  
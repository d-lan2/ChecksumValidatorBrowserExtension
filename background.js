async function calculateHash(file, algorithm = 'SHA-256') {
  const fileBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest(algorithm, fileBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getFileContent(downloadUrl) {
  const response = await fetch(downloadUrl);
  return await response.blob();
}

const downloadFileHashes = new Map();

async function onChangedListener(delta) {
  if (delta.state && delta.state.current === 'complete') {
    const fileHash = downloadFileHashes.get(delta.id);

    if (fileHash) {
      chrome.downloads.search({ id: delta.id }, async ([download]) => {
        const fileBlob = await getFileContent(download.url);
        const calculatedHash = await calculateHash(fileBlob);
        let title, message;
        let icon = 'images/valid.png'
        if (calculatedHash.toLowerCase() === fileHash.toLowerCase()) {
          title = 'Valid Hash';
          message = 'The file hash matches the published hash.';
        } else {
          title = 'Invalid Hash';
          message = 'The file hash does not match the published hash.';
          icon = 'images/invalid.png'
        }
        chrome.notifications.create({
          type: 'basic',
          iconUrl: icon,
          title: title,
          message: message
        });

        // Remove the hash from the Map
        downloadFileHashes.delete(delta.id);
      });
    }
  }
}

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const fileHash = downloadFileHashes.get(downloadItem.id);

  if (fileHash) {
    const url = new URL(downloadItem.url);
    const filename = url.pathname.split('/').pop();
    suggest({ filename: filename });
  }
});

chrome.downloads.onChanged.addListener(onChangedListener);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'fileHash') {
    port.onMessage.addListener((message) => {
      if (message.type === 'fileHashFound') {
        const fileHash = message.fileHash;
        chrome.downloads.download({ url: message.url }, (downloadId) => {
          downloadFileHashes.set(downloadId, fileHash);
        });
      }
    });
  }
});

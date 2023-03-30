importScripts('spark-md5.min.js');

function arrayBufferToHexString(buffer) {
  const byteArray = new Uint8Array(buffer);
  const hexCodes = [...byteArray].map((value) => {
    const hexCode = value.toString(16);
    return hexCode.padStart(2, '0');
  });
  return hexCodes.join('');
}

async function getFileContent(url) {
  const response = await fetch(url);
  const data = await response.blob();
  return data;
}

async function calculateMD5(blob) {
  console.log('calculateMD5 started');
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      const arrayBuffer = event.target.result;
      const md5Hash = SparkMD5.ArrayBuffer.hash(arrayBuffer);
      resolve(md5Hash);
    };
    fileReader.readAsArrayBuffer(blob);
  });
}

async function calculateSHA1(blob) {
  console.log('calculateSHA1 started');
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-1', buffer);
  return arrayBufferToHexString(hash);
}

async function calculateSHA256(blob) {
  console.log('calculateSHA256 started');
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return arrayBufferToHexString(hash);
}

async function calculateSHA512(blob) {
  console.log('calculateSHA512 started');
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-512', buffer);
  return arrayBufferToHexString(hash);
}

const dbName = 'fileHashesDB';
const objectStoreName = 'fileHashes';
let db;

function initIndexedDB() {
  const request = indexedDB.open(dbName);

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains(objectStoreName)) {
      db.createObjectStore(objectStoreName, { keyPath: 'id' });
    }
  };

  request.onsuccess = (event) => {
    db = event.target.result;
  };

  request.onerror = (event) => {
    console.error('Error opening indexedDB:', event.target.errorCode);
  };
}

async function getFileHashFromStorage(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([objectStoreName]);
    const objectStore = transaction.objectStore(objectStoreName);
    const request = objectStore.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function removeFileHashFromStorage(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([objectStoreName], 'readwrite');
    const objectStore = transaction.objectStore(objectStoreName);
    const request = objectStore.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

initIndexedDB();

chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state && delta.state.current === 'complete') {
    const storageData = await getFileHashFromStorage(delta.id);
    if (storageData) {
      const allHashes = storageData.allHashes;
      chrome.downloads.search({ id: delta.id }, async ([download]) => {
        const fileBlob = await getFileContent(download.url);
        console.log('File blob:', fileBlob);
        const calculatedHashes = {
          md5: await calculateMD5(fileBlob),
          sha1: await calculateSHA1(fileBlob),
          sha256: await calculateSHA256(fileBlob),
          sha512: await calculateSHA512(fileBlob)
        };
        console.log('Calculated hash:', calculatedHashes);

        let isValidHash = false;
        let hashType = '';

        for (const [type, calculatedHash] of Object.entries(calculatedHashes)) {
          if (allHashes[type] && Array.from(allHashes[type]).some((hash) => hash.toLowerCase() === calculatedHash.toLowerCase())) {
            isValidHash = true;
            hashType = type.toUpperCase();
            console.log('Valid hash:', calculatedHash);
            break;
          }
          console.log('Invalid hash:', calculatedHash);
        }

        let title, message;

        if (isValidHash) {
          title = 'Valid Hash';
          message = `The file hash matches one of the published ${hashType} hashes.`;
        } else {
          title = 'Invalid Hash';
          message = 'The file hash does not match any of the published hashes.';
        }
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: title,
          message: message
        });

        // Remove the hash from the storage
        await removeFileHashFromStorage(delta.id);
      });
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  console.log('Connection established with content script'); // Add this line
  if (port.name === 'fileHash') {
    port.onMessage.addListener((message) => {
      if (message.type === 'fileHashesFound') {
        console.log('Received message from content script:', message); // Add this line
        const allHashes = message.allHashes;
        chrome.downloads.download({ url: message.url }, (downloadId) => {
          console.log('Download triggered with ID:', downloadId); // Add this line
          const transaction = db.transaction([objectStoreName], 'readwrite');
          const objectStore = transaction.objectStore(objectStoreName);
          const request = objectStore.add({ id: downloadId, allHashes: allHashes });

          request.onsuccess = () => {
            console.log('Hashes stored for download ID:', downloadId);
          };

          request.onerror = () => {
            console.error('Error storing hashes for download ID:', downloadId);
          };
        });
      }
    });
  }
});

function injectContentScript() {
  chrome.tabs.executeScript({
    code: `
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
    `,
  });
}

// Inject the content script when the extension is loaded
injectContentScript();
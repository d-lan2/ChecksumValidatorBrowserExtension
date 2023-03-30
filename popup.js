chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'hashStatus') {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message.status;
    }
  });
  
  document.getElementById('inject-content-script').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'injectContentScript' }, (response) => {
        console.log(response);
      });
    });
  });
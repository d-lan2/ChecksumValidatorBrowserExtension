chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'hashStatus') {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message.status;
    }
  });
  
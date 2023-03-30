chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'injectContentScript') {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('contentScript.js');
      document.body.appendChild(script);
      sendResponse({ success: true });
    }
  });
  
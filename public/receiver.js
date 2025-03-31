// Add event listener for the start button
let currentTabId = null;

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "updateTabId") {
    currentTabId = message.tabId;
    console.log("[RECEIVER] Updated tab ID in popup:", currentTabId);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("sendMessage").addEventListener("click", () => {
    console.log("[RECEIVER] Send message button clicked");
    chrome.runtime.sendMessage({ action: "getTabId" }, (response) => {
      console.log("[RECEIVER] Response from service worker:", response);
      if (response.tabId) {
        chrome.runtime.sendMessage(
          { action: "sendMessageToContent", currentTabId: currentTabId },
          (reply) => {
            console.log(
              "[RECEIVER] Response from content script via service worker:",
              reply
            );
          }
        );
      } else {
        console.error("[RECEIVER] No active tab ID found.");
      }
    });
  });
});

// window.addEventListener("beforeunload", shutdownReceiver);

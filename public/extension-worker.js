let activeTabId = null;

// Store tabId when a content script registers itself
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "[SERVICE WORKER] Message received in service worker:",
    message,
    sender
  );
  if (message.action === "registerTab" && sender.tab) {
    console.log(
      "[SERVICE WORKER] Content script registered in tab:",
      sender.tab.id
    );
    activeTabId = sender.tab.id;

    sendResponse({ status: "registered", tabId: activeTabId });
  }

  if (message.action === "getTabId") {
    sendResponse({ tabId: activeTabId });
  }

  if (message.action === "sendMessageToContent") {
    if (activeTabId) {
      chrome.tabs.sendMessage(
        activeTabId,
        { action: "doSomething" },
        (response) => {
          sendResponse(response);
        }
      );
      return true; // Keep the message channel open for async response
    } else {
      sendResponse({ error: "No active tab found" });
    }
  }
});

/////////////////////////
chrome.action.onClicked.addListener(async (tab) => {
  const currentTabId = tab.id;

  // First, try to inject content script into current tab before opening the receiver
  try {
    console.log(
      "[SERVICE WORKER] Injecting content script into tab:",
      currentTabId
    );
    // somehow the manifest.json does not inject it automatically, so we need to do it manually
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ["content-script.js"],
    });
    console.log("Content script successfully injected");
  } catch (error) {
    console.error("Failed to inject content script:", error);
  }

  // Open a new tab with the receiver.html page
  const { tabs } = await chrome.windows.create({
    url: chrome.runtime.getURL("index.html"),
  });

  const receiverTabId = tabs[0].id;

  // Wait for the receiver tab to load
  await new Promise((resolve) => {
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === receiverTabId && info.status === "complete") {
        // Send `tabId` to all extension windows (popup)
        chrome.runtime.sendMessage({
          action: "updateTabId",
          tabId: activeTabId,
        });

        // Move the DOM content retrieval here, after the receiver tab is fully loaded
        try {
          chrome.tabs.sendMessage(receiverTabId, {
            targetTabId: currentTabId,
            consumerTabId: receiverTabId,
            titleOfTab: tab.title,
          });
        } catch (error) {
          console.error("Error sending message to receiver tab:", error);
        }

        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
});

// This function now uses the scripting API to get DOM content from the active tab
async function getActiveTabDOMContent(tabId) {
  try {
    console.log("Getting DOM content from tab:", tabId);

    // First inject the content script to make sure it's available
    console.log("Injecting content script again to ensure it's available");
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content-script.js"],
    });

    // Then we can safely send a message to the content script
    return new Promise((resolve, reject) => {
      console.log("Sending getDOMContent message to tab:", tabId);
      chrome.tabs.sendMessage(
        tabId,
        { action: "getDOMContent" },
        (response) => {
          if (chrome.runtime.lastError) {
            // If there's an error
            console.error("Error in sendMessage:", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else if (response) {
            console.log("Received DOM content response:", response);
            resolve(response.content);
          } else {
            console.error("No response from content script");
            reject(new Error("No response from content script"));
          }
        }
      );
    });
  } catch (error) {
    console.error("Error getting DOM content:", error);
    throw error;
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "doSomething") {
    console.log(
      "[SERVICE WORKER] Received message in content script:",
      message
    );
    // Perform the desired action here
    sendResponse({ status: "success" });
  }
});

// Add message listener to receive messages from receiver.js and content-script.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[SERVICE WORKER] Message received:", message, "from:", sender);

  if (message.request === "getTabId") {
    sendResponse({ tabId: sender.tab.id });
  }

  // Handle message from content script
  if (message.type === "CONTENT_SCRIPT_LOADED") {
    console.log(
      "[SERVICE WORKER] Content script loaded in tab:",
      sender.tab?.id,
      "URL:",
      message.url
    );
  }
  if (message.type === "FORWARD_TO_CONTENT_SCRIPT") {
    // Store the current tab's ID before switching to the receiver
    chrome.tabs.query(
      { active: true, lastFocusedWindow: true },
      async (tabs) => {
        if (tabs.length === 0) {
          sendResponse({
            success: false,
            error: "No active tab found",
          });
          return;
        }

        const originalTabId = tabs[0].id;
        const originalTabUrl = tabs[0].url;

        // Only try to inject the content script if it's not a chrome-extension:// URL
        if (!originalTabUrl.startsWith("chrome-extension://")) {
          try {
            // Make sure the content script is injected
            await chrome.scripting.executeScript({
              target: { tabId: originalTabId },
              files: ["content-script.js"],
            });

            // Forward the message to the content script
            chrome.tabs.sendMessage(
              originalTabId,
              {
                action: "GREETING",
                message: message.message,
                source: "receiver",
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error sending message:",
                    chrome.runtime.lastError
                  );
                  sendResponse({
                    success: false,
                    error: chrome.runtime.lastError.message,
                  });
                } else {
                  console.log("Response from content script:", response);
                  sendResponse({
                    success: true,
                    response: response,
                  });
                }
              }
            );
          } catch (error) {
            console.error("Error forwarding message:", error);
            sendResponse({
              success: false,
              error: error.toString(),
            });
          }
        } else {
          // We're in a chrome-extension:// URL, so we can't inject content script
          console.log("Cannot inject content script into extension page");
          sendResponse({
            success: false,
            error: "Cannot send message to extension page",
            info: "Please click the extension icon when on a regular webpage",
          });
        }
      }
    );

    return true; // Keep the message channel open for async response
  }

  return true; // Return true to indicate async response
});

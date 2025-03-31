import { Component } from '@angular/core';

declare var chrome: any; // Declare the chrome variable to avoid TypeScript errors

@Component({
  standalone: true,
  selector: 'app-root',
  template: `
    <div class="container">
      <h1>{{ title }}</h1>
      <p>Click the button below to send a message to the website you visited</p>
      <button (click)="printContent()">Send message</button>
    </div>
  `,
  styles: [
    `
      .container {
        width: 300px;
        padding: 15px;
        font-family: Arial, sans-serif;
      }

      h1 {
        color: #0a66c2;
        font-size: 18px;
      }

      button {
        background-color: #0a66c2;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        cursor: pointer;
        margin: 10px 0;
      }

      button:hover {
        background-color: #084482;
      }

      .info {
        font-size: 12px;
        color: #666;
        margin-top: 15px;
      }
    `,
  ],
})
export class AppComponent {
  title = 'Chrome Angular Extension';

  printContent() {
    if (chrome && chrome.tabs) {
      this.sendHelloMessage();
    } else {
      console.log(
        'Chrome API not available. Are you running in development mode?'
      );
    }
  }

  sendHelloMessage() {
    console.log('[RECEIVER] Send message button clicked');
    chrome.runtime.sendMessage({ action: 'getTabId' }, (response: any) => {
      console.log('[RECEIVER] Response from service worker:', response);
      if (response.tabId) {
        chrome.runtime.sendMessage(
          { action: 'sendMessageToContent' },
          (reply: any) => {
            console.log(
              '[RECEIVER] Response from content script via service worker:',
              reply
            );
          }
        );
      } else {
        console.error('[RECEIVER] No active tab ID found.');
      }
    });
  }
}

// Background service worker
console.log('College Baseball Headshot Scraper background script loaded');

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed successfully');
});

// Optional: Listen for download completion
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log('Download completed:', downloadDelta.id);
  }
});

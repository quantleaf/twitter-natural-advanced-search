chrome.runtime.onInstalled.addListener(function() {
  chrome.browserAction.onClicked.addListener(function() {
    new chrome.declarativeContent.ShowPageAction()
  });
});
/*
chrome.tabs.onUpdated.addListener(
  function(tabId, changeInfo) {
    if (changeInfo.url) {
      chrome.tabs.sendMessage( tabId, {
        message: '__new_url_ql__',
        url: changeInfo.url
      });
    }
  }
);*/
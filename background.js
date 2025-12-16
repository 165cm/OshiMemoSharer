// background.js の修正
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// タブの更新を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('youtube.com/watch')) {
        const videoId = new URL(tab.url).searchParams.get('v');
        if (videoId) {
            chrome.tabs.sendMessage(tabId, {
                type: 'LOAD_VIDEO_DATA',
                videoId: videoId
            }).catch(error => console.error('Message send error:', error));
        }
    }
});

// メッセージハンドラー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'VIDEO_OPEN') {
        const videoId = message.videoId;
        chrome.storage.local.set({
            'pendingVideoId': videoId,
            'targetTabId': sender.tab.id
        });
        return true;
    }
});
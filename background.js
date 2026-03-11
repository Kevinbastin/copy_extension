// Smart Copy History – Background Service Worker
// Manages clipboard history storage and categorization.

const MAX_HISTORY = 20;

/**
 * Auto-categorize copied text.
 */
function categorize(text) {
    if (text.startsWith('data:image/')) return 'image';

    // URL pattern (more comprehensive)
    if (/^(https?:\/\/)?([a-z0-9]+(-?[a-z0-9]+)*\.)+([a-z]{2,})(:[0-9]+)?(\/[^\s]*)?$/i.test(text.trim())) {
        return 'link';
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) return 'email';

    const codeIndicators = [
        /[{}]/, /=>/, /\b(function|const|let|var|import|export|class|return|if|else|for|while|switch|case)\b/,
        /[;]\s*$/m, /\b(def |print\(|self\.|__init__)/, /<\/?[a-z][\s\S]*>/i, /\{\{.*\}\}/, /^\s*(\/\/|#|\/\*|\*)/m,
    ];
    if (codeIndicators.reduce((s, p) => s + (p.test(text) ? 1 : 0), 0) >= 2) return 'code';
    return 'text';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Handle incoming copy events from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'COPY_EVENT') {
        return false; // not our message, don't hold channel
    }

    const { text, url, timestamp } = message;
    if (!text || text.length === 0) {
        sendResponse({ status: 'empty' });
        return true;
    }

    chrome.storage.local.get({ copyHistory: [] }, (result) => {
        let history = result.copyHistory || [];

        // Consecutive deduplication
        if (history.length > 0 && history[0].text === text) {
            sendResponse({ status: 'duplicate' });
            return;
        }

        const entry = {
            id: generateId(),
            text: text,
            category: categorize(text),
            url: url || '',
            timestamp: timestamp || Date.now(),
            pinned: false
        };

        history.unshift(entry);

        // Enforce limit: keep all pinned + last N unpinned
        const pinned = history.filter((item) => item.pinned);
        const unpinned = history.filter((item) => !item.pinned);
        if (unpinned.length > MAX_HISTORY) {
            history = [...pinned, ...unpinned.slice(0, MAX_HISTORY)].sort((a, b) => b.timestamp - a.timestamp);
        }

        chrome.storage.local.set({ copyHistory: history }, () => {
            if (chrome.runtime.lastError) {
                console.error('[Smart Copy History] Storage error:', chrome.runtime.lastError);
                sendResponse({ status: 'error' });
            } else {
                console.log('[Smart Copy History] Saved entry. Total:', history.length);
                sendResponse({ status: 'saved' });
            }
        });
    });

    return true; // MUST return true for async sendResponse
});

// Update badge count
chrome.storage.onChanged.addListener((changes) => {
    if (changes.copyHistory) {
        const count = changes.copyHistory.newValue?.length || 0;
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#6C5CE7' });
    }
});

// Log when service worker starts
console.log('[Smart Copy History] Background service worker started');

// Context Menus
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "sch-copy-selection",
        title: "Save '%s' to Notebook",
        contexts: ["selection"]
    });
    chrome.contextMenus.create({
        id: "sch-copy-link",
        title: "Save Link to Notebook",
        contexts: ["link"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    let textToSave = info.selectionText || info.linkUrl;

    if (textToSave) {
        // Send it to the same flow
        chrome.storage.local.get({ copyHistory: [] }, (result) => {
            let history = result.copyHistory || [];
            if (history.length > 0 && history[0].text === textToSave) return;

            const entry = {
                id: generateId(),
                text: textToSave,
                category: categorize(textToSave),
                url: tab.url || '',
                timestamp: Date.now(),
                pinned: false
            };

            history.unshift(entry);
            const pinned = history.filter((item) => item.pinned);
            const unpinned = history.filter((item) => !item.pinned);
            if (unpinned.length > MAX_HISTORY) {
                history = [...pinned, ...unpinned.slice(0, MAX_HISTORY)].sort((a, b) => b.timestamp - a.timestamp);
            }
            chrome.storage.local.set({ copyHistory: history }, () => {
                console.log('[Smart Copy History] Saved from context menu');
            });
        });
    }
});

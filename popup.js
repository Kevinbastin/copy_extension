// Smart Copy History – Popup Script
// Handles rendering, search, pin, theme toggle, clear, and paste actions.

(function () {
    'use strict';

    // ---------- DOM References ----------
    const historyList = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const themeToggle = document.getElementById('themeToggle');
    const clearAllBtn = document.getElementById('clearAll');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    let allItems = [];
    let searchQuery = '';

    // ---------- Init ----------
    function init() {
        loadTheme();
        loadHistory();
        bindEvents();
    }

    // ---------- Theme ----------
    function loadTheme() {
        chrome.storage.local.get({ theme: 'light' }, (result) => {
            document.documentElement.setAttribute('data-theme', result.theme);
        });
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        chrome.storage.local.set({ theme: next });
    }

    // ---------- Load History ----------
    function loadHistory() {
        chrome.storage.local.get({ copyHistory: [] }, (result) => {
            allItems = result.copyHistory;
            renderItems();
        });
    }

    // ---------- Render Items ----------
    function renderItems() {
        const filtered = searchQuery
            ? allItems.filter((item) => item.text.toLowerCase().includes(searchQuery.toLowerCase()))
            : allItems;

        // Sort: pinned first, then by timestamp
        const sorted = [...filtered].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return b.timestamp - a.timestamp;
        });

        if (sorted.length === 0) {
            historyList.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }

        historyList.style.display = 'flex';
        emptyState.style.display = 'none';

        historyList.innerHTML = sorted.map((item) => createItemHTML(item)).join('');
    }

    function createItemHTML(item) {
        let textContent = '';
        if (item.category === 'image') {
            textContent = `<img src="${item.text}" style="max-width:100%; max-height:80px; border-radius:4px;" />`;
        } else {
            const preview = truncateText(item.text, 120);
            textContent = escapeHtml(preview);
        }
        const time = relativeTime(item.timestamp);
        const badgeClass = `badge-${item.category}`;
        const isCode = item.category === 'code';
        const pinnedClass = item.pinned ? 'pinned' : '';
        const pinActiveClass = item.pinned ? 'active' : '';

        return `
      <div class="history-item ${pinnedClass}" data-id="${item.id}" title="Click to copy">
        <div class="item-content">
          <div class="item-meta">
            <span class="category-badge ${badgeClass}">${item.category}</span>
            <span class="item-time">${time}</span>
          </div>
          <div class="item-text ${isCode ? 'code-text' : ''}">${textContent}</div>
        </div>
        <div class="item-actions">
          <button class="btn-sm btn-pin ${pinActiveClass}" data-action="pin" data-id="${item.id}" title="${item.pinned ? 'Unpin' : 'Pin'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${item.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
          </button>
          <button class="btn-sm btn-delete" data-action="delete" data-id="${item.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;
    }

    // ---------- Event Bindings ----------
    function bindEvents() {
        // Search
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderItems();
        });

        // Theme toggle
        themeToggle.addEventListener('click', toggleTheme);

        // Clear all
        clearAllBtn.addEventListener('click', showClearConfirm);

        // Delegated events on history list
        historyList.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.stopPropagation();
                const action = actionBtn.dataset.action;
                const id = actionBtn.dataset.id;
                if (action === 'pin') togglePin(id);
                if (action === 'delete') deleteItem(id);
                return;
            }

            const item = e.target.closest('.history-item');
            if (item) {
                const id = item.dataset.id;
                const entry = allItems.find((i) => i.id === id);
                if (entry) copyToClipboard(entry);
            }
        });
    }

    // ---------- Actions ----------
    async function copyToClipboard(entry) {
        try {
            if (entry.category === 'image') {
                const response = await fetch(entry.text);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ [blob.type]: blob })
                ]);
            } else {
                await navigator.clipboard.writeText(entry.text);
            }
            showToast('Copied to clipboard!');

            // Also try to paste into active tab's focused input
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'PASTE_TEXT', text: entry.text }, (response) => {
                        // Silently handle - paste is best-effort
                    });
                }
            });
        } catch (e) {
            showToast('Failed to copy');
        }
    }

    function togglePin(id) {
        const item = allItems.find((i) => i.id === id);
        if (!item) return;

        item.pinned = !item.pinned;
        chrome.storage.local.set({ copyHistory: allItems }, () => {
            renderItems();
            showToast(item.pinned ? 'Item pinned ⭐' : 'Item unpinned');
        });
    }

    function deleteItem(id) {
        allItems = allItems.filter((i) => i.id !== id);
        chrome.storage.local.set({ copyHistory: allItems }, () => {
            renderItems();
            showToast('Item removed');
        });
    }

    function showClearConfirm() {
        if (allItems.length === 0) return;

        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
      <div class="confirm-dialog">
        <h3>Clear History?</h3>
        <p>This will remove all ${allItems.filter(i => !i.pinned).length} unpinned items. Pinned items will be kept.</p>
        <div class="confirm-actions">
          <button class="btn-cancel" id="confirmCancel">Cancel</button>
          <button class="btn-confirm-danger" id="confirmClear">Clear</button>
        </div>
      </div>
    `;

        document.body.appendChild(overlay);

        overlay.querySelector('#confirmCancel').addEventListener('click', () => {
            overlay.remove();
        });

        overlay.querySelector('#confirmClear').addEventListener('click', () => {
            allItems = allItems.filter((i) => i.pinned);
            chrome.storage.local.set({ copyHistory: allItems }, () => {
                renderItems();
                overlay.remove();
                showToast('History cleared');
            });
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // ---------- Helpers ----------
    function truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '…';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function relativeTime(timestamp) {
        const diff = Date.now() - timestamp;
        const seconds = Math.floor(diff / 1000);
        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    function showToast(message) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // ---------- Start ----------
    document.addEventListener('DOMContentLoaded', init);
})();

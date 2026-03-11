// Smart Copy History – Content Script
// Advanced Notepad Sidebar & Copy Detection

(function () {
  'use strict';

  let sidebarHost = null;
  let shadowRoot = null;
  let listContainer = null;
  let toastEl = null;
  let sidebarTimeout = null;
  let isSidebarOpen = false;

  console.log('[Smart Copy History] Advanced content script loaded:', window.location.href);

  // -------------------------
  // 1. Sidebar UI Creation
  // -------------------------
  function createSidebar() {
    if (sidebarHost) return;

    // Create shadow host to isolate styles from the main page
    sidebarHost = document.createElement('div');
    sidebarHost.id = 'smart-copy-host';

    // Attach Shadow DOM
    shadowRoot = sidebarHost.attachShadow({ mode: 'open' });

    // Inject CSS into Shadow DOM
    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = chrome.runtime.getURL('content.css');
    shadowRoot.appendChild(linkEl);

    // Build internal HTML structure
    const root = document.createElement('div');
    root.id = 'smart-copy-root';
    root.innerHTML = `
      <div class="sch-header">
        <h2>📋 Copy Notepad</h2>
        <button class="sch-close" id="sch-close-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="sch-list" id="sch-list"></div>
      <div class="sch-toast" id="sch-toast">Copied to clipboard</div>
    `;

    shadowRoot.appendChild(root);
    document.documentElement.appendChild(sidebarHost);

    listContainer = shadowRoot.getElementById('sch-list');
    toastEl = shadowRoot.getElementById('sch-toast');

    // Bind events inside Shadow DOM
    shadowRoot.getElementById('sch-close-btn').addEventListener('click', closeSidebar);
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('sch-show');
    setTimeout(() => toastEl.classList.remove('sch-show'), 2000);
  }

  function openSidebar() {
    createSidebar();

    // Animate in
    setTimeout(() => {
      sidebarHost.classList.add('sch-open');
      isSidebarOpen = true;
    }, 10);

    // Auto-close after 10 seconds of inactivity
    resetCloseTimer();

    // Fetch and render latest history
    renderHistory();
  }

  function closeSidebar() {
    if (!sidebarHost) return;
    sidebarHost.classList.remove('sch-open');
    isSidebarOpen = false;
    clearTimeout(sidebarTimeout);
  }

  function resetCloseTimer() {
    clearTimeout(sidebarTimeout);
    sidebarTimeout = setTimeout(() => {
      closeSidebar();
    }, 15000); // 15 seconds visibility
  }

  // -------------------------
  // 2. Rendering History
  // -------------------------
  function renderHistory() {
    chrome.storage.local.get({ copyHistory: [] }, (result) => {
      if (!listContainer) return;
      const history = result.copyHistory || [];

      if (history.length === 0) {
        listContainer.innerHTML = '<div style="opacity:0.5;text-align:center;padding:20px;">No copies yet</div>';
        return;
      }

      listContainer.innerHTML = '';
      history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'sch-item';

        let displayUrl = '';
        if (item.url) {
          try { displayUrl = new URL(item.url).hostname; } catch (e) { }
        }

        const isRecent = (Date.now() - item.timestamp) < 5000;

        // Render safely, handle images
        let contentHtml = '';
        if (item.category === 'image') {
          contentHtml = `<img src="${item.text}" style="max-width:100%; max-height:100px; border-radius:6px; margin-bottom:4px;" />`;
        } else {
          const safeDiv = document.createElement('div');
          safeDiv.textContent = item.text;
          contentHtml = safeDiv.innerHTML;
        }

        div.innerHTML = `
          <div class="sch-item-text">${contentHtml}</div>
          <div class="sch-item-meta">
            <span class="sch-pill" style="${isRecent ? 'background:rgba(85,239,196,0.3);color:#00b894;' : ''}">
              ${isRecent ? 'JUST COPIED' : item.category}
            </span>
            <span title="${item.url}">${displayUrl || 'Local'}</span>
          </div>
        `;

        // Handle pasting
        div.addEventListener('click', async () => {
          resetCloseTimer();
          try {
            if (item.category === 'image') {
              // Convert data URL back to Blob and write to clipboard
              const response = await fetch(item.text);
              const blob = await response.blob();
              await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
              ]);
            } else {
              await navigator.clipboard.writeText(item.text);
            }
            showToast('Copied to clipboard!');

            // Try pasting into active input (note: this only works if an input is explicitly focused on the main page)
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
              if (activeEl.isContentEditable) {
                document.execCommand('insertText', false, item.text);
              } else {
                const start = activeEl.selectionStart;
                const end = activeEl.selectionEnd;
                const value = activeEl.value;
                activeEl.value = value.substring(0, start) + item.text + value.substring(end);
                activeEl.selectionStart = activeEl.selectionEnd = start + item.text.length;
                activeEl.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
          } catch (e) {
            showToast('Failed to copy');
          }
        });

        listContainer.appendChild(div);
      });
    });
  }

  // -------------------------
  // 3. Copy Detection
  // -------------------------
  function isPasswordField(element) {
    if (!element) return false;
    if (element.tagName === 'INPUT' && element.type === 'password') return true;
    if (element.getAttribute && element.getAttribute('data-type') === 'password') return true;
    return false;
  }

  function handleCopiedText(text) {
    if (!text || text.trim().length === 0) return;
    const trimmed = text.trim();

    try {
      chrome.runtime.sendMessage({
        type: 'COPY_EVENT',
        text: trimmed,
        url: window.location.href,
        timestamp: Date.now()
      }, (response) => {
        if (!chrome.runtime.lastError && response?.status !== 'duplicate') {
          // It was successfully added to history, open sidebar!
          openSidebar();
        } else if (response?.status === 'duplicate') {
          // Already in history, still show the sidebar
          openSidebar();
        }
      });
    } catch (err) {
      console.warn('[Smart Copy History] Failed:', err);
    }
  }

  function handleSystemCopy(event) {
    if (shadowRoot && shadowRoot.activeElement) return;
    if (isPasswordField(document.activeElement)) return;

    let copiedText = '';
    const activeEl = document.activeElement;

    // Check if user is copying from an input or textarea
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      try {
        if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
          copiedText = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
        }
      } catch (e) { /* Ignore unsupported input types */ }
    }

    // Otherwise, check standard DOM selection
    if (!copiedText) {
      try {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const container = selection.getRangeAt(0).commonAncestorContainer;
          const element = container.nodeType === 3 ? container.parentNode : container;

          // If the user selected exactly a link, we might want its URL if text is empty
          if (element && element.tagName === 'A' && element.href) {
            copiedText = selection.toString() || element.href;
          } else {
            copiedText = selection.toString();
          }
        }
      } catch (e) {
        console.warn('[Smart Copy] error picking selection', e);
      }
    }

    if (copiedText) handleCopiedText(copiedText);
  }

  document.addEventListener('copy', handleSystemCopy, true);
  document.addEventListener('cut', handleSystemCopy, true);

  // Event 2: Keyboard fallback (Ctrl+C / Cmd+C / Ctrl+X)
  document.addEventListener('keydown', (event) => {
    // If pressing ESC and sidebar is open, close it
    if (event.key === 'Escape' && isSidebarOpen) {
      closeSidebar();
      return;
    }

    // Ctrl+Shift+V shortcut to open the sidebar directly on page
    if (event.key.toLowerCase() === 'v' && event.shiftKey && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      isSidebarOpen ? closeSidebar() : openSidebar();
      return;
    }

    // Ctrl+C / Ctrl+X fallback
    const isCopyOrCut = (event.ctrlKey || event.metaKey) &&
      (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'x' || event.key === 'Insert');

    if (!isCopyOrCut) return;

    if (isPasswordField(document.activeElement)) return;

    setTimeout(() => {
      let copiedText = '';
      const activeEl = document.activeElement;

      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        try {
          if (typeof activeEl.selectionStart === 'number' && typeof activeEl.selectionEnd === 'number') {
            copiedText = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
          }
        } catch (e) { }
      }

      if (!copiedText) {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
          copiedText = selection.toString();
        }
      }

      if (copiedText && copiedText.trim()) {
        handleCopiedText(copiedText);
      }
    }, 50);
  }, true);

  // Listen for storage changes to auto-update the sidebar if it's open
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.copyHistory && isSidebarOpen) {
      renderHistory();
    }
  });

})();

# 📋 Smart Copy History (Advanced Notepad Edition)

An advanced, desktop-class Chrome browser extension that supercharges your clipboard. It silently captures all your copied text and links across the web and lets you easily access your clipboard history via a sleek, modern popup or an **instant, sliding in-page notepad sidebar**.

## ✨ Features

- **Instant Notepad Sidebar**: Press `Ctrl+Shift+V` to open a floating glassmorphism notebook overlay on any website to browse your clipboard without losing your place.
- **Copy & Paste Immediately**: Click any copied item in your history sidebar to instantly recopy it and paste it into the active input box!
- **Zero Distraction Copy Detection**: Copies are silently and safely recorded in the background (`Ctrl+C`, `Ctrl+X`, and Right-click Copy).
- **Smart Categorization**: Instantly recognizes and tags your snippets as **Link** 🔗, **Email** 📧, **Code** 💻, or **Text** 📝.
- **Advanced Link Support**: If you copy a hyperlink from the page, it smartly grabs the underlying `href` URL so you don't just get useless plain text. 
- **Privacy First**: Fully ignores all `<input type="password">` fields so your passwords never accidentally get saved into your history. 
- **Seamless History Management**: Scroll through your last 20 copied items, pin (⭐) your favorites, and delete the rest.
- **Dark Mode**: Automatically respects your dark or light theme preferences with a beautiful sleek design.

## 🚀 How to Install

1. Download or clone this repository to your local machine.
2. Open Google Chrome and type `chrome://extensions/` into the URL bar.
3. Toggle the **Developer mode** switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the `copy_extension` folder.
6. The extension is now installed! You should see the purple clipboard icon in your toolbar.

> **Note:** After installing or updating the code, you **must refresh** (`F5`) any already-opened web pages for the sidebar notepad to become active.

## ⌨️ Shortcuts & Usage

| Action | How to do it |
|---|---|
| **Copy Text** | Highlight any text and press `Ctrl+C` (or `Cmd+C`) |
| **Open Sidebar Notepad** | Press `Ctrl+Shift+V` on any webpage |
| **Open Extension Popup** | Click the Extension icon in Chrome's top toolbar |
| **Paste from History** | Open either menu, click on any item, and it auto-pastes into your active text box! |
| **Pin an Item** | Hover over an item and click the ⭐ icon to save it permanently |

## 🛠️ Tech Stack & Architecture

- **Manifest V3** framework compliant
- **Vanilla JavaScript** (No external libraries, React, or jQuery)
- **CSS Custom Properties** & Shadow DOM for isolated styling overlay injection
- **Chrome Storage API** for persistent, synced history management

### Key Files:
- `manifest.json` - Defines Chrome permissions and injection logic.
- `background.js` - Service worker that manages data storage, categorization, deduplication, and limits.
- `content.js` - Injects the Copy Listeners and the Shadow DOM Notepad Sidebar into the webpage.
- `content.css` - Styles for the floating, sliding sidebar interface.
- `popup.html/.js/.css` - The alternative traditional Chrome Extension popup drop-down interface.

## 🔒 Privacy Notice

This extension operates **100% locally** on your machine using `chrome.storage.local`. None of your copied clipboard data is ever transmitted externally to any servers. It explicitly skips fields typed as "password" to protect sensitive data.

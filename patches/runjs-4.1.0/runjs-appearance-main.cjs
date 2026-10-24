/* Appearance only: original application startup and runtime security stay intact. */
'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { app, BrowserWindow } = require('electron');

const pages = new Set(['index.html', 'preview.html'].map((name) => path.join(__dirname, name)));

function styleWindow(contents, url) {
  try {
    if (!url.startsWith('file:') || !pages.has(fileURLToPath(new URL(url)))) return;
    const window = BrowserWindow.fromWebContents(contents);
    if (!window || window.isDestroyed()) return;
    if (process.platform === 'darwin') {
      // Background alpha is supplied by CSS; never fade the text with setOpacity.
      window.setBackgroundColor('#00000000');
      window.setVibrancy('under-window');
    } else {
      // Opaque fallback; only macOS appearance has been validated.
      window.setBackgroundColor('#000000');
    }
  } catch (error) {
    // Appearance must never prevent the editor or an exercise from starting.
    if (process.env.RUNJS_BRIDGE_DIAGNOSTICS === '1') {
      console.warn('[RunJS Bridge] Appearance unavailable:', error.message);
    }
  }
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('did-start-navigation', (_event, url, _inPlace, isMainFrame) => {
    if (isMainFrame) styleWindow(contents, url);
  });
  contents.on('did-finish-load', () => styleWindow(contents, contents.getURL()));
});

// Keep the distributor's bundled entry point byte-for-byte unchanged.
module.exports = {};

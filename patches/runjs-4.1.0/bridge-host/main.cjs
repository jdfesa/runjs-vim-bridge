/* Narrow, version-pinned host actions; no code, filenames or keys cross this IPC. */
'use strict';

const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { requestNativeSave } = require('./native-save.cjs');
const CHANNEL = 'runjs-vim-bridge:host';

function install({ app, ipcMain, BrowserWindow, Menu, dialog }, directory) {
  const pending = new Map();
  const busy = new Set();
  const nativeHandle = ipcMain.handle;
  let captured = false;
  const index = path.join(directory, 'index.html');
  function authorized(event) {
    try {
      const url = new URL(event.sender.getURL());
      return url.protocol === 'file:' && fileURLToPath(url) === index &&
        event.senderFrame === event.sender.mainFrame && !event.sender.isDestroyed();
    } catch { return false; }
  }
  const key = (sender, id) => `${sender.id}:${id}`;
  // Wrap only registration of the pinned native confirmation, then restore handle.
  ipcMain.handle = function (channel, handler) {
    if (channel !== 'CONFIRM_CLOSE_TAB') return nativeHandle.call(this, channel, handler);
    captured = true;
    return nativeHandle.call(this, channel, (event, id) => {
      const ticket = pending.get(key(event.sender, id));
      if (authorized(event) && ticket && !ticket.consumed) {
        ticket.consumed = true;
        return { response: 0 };
      }
      return handler(event, id);
    });
  };
  ipcMain.on('REMOVE_TAB', (event, id) => {
    const ticket = pending.get(key(event.sender, id));
    if (authorized(event) && ticket?.consumed) ticket.finish({ status: 'closed' });
  });
  nativeHandle.call(ipcMain, CHANNEL, async (event, request) => {
    if (!authorized(event)) throw new Error('Host command sender rejected.');
    if (!captured || app.getVersion() !== '4.1.0') throw new Error('Host adapter is unavailable.');
    const { action, tabID, saveAs = false } = request || {};
    if (!['save', 'close', 'quit'].includes(action) ||
        (action !== 'quit' && !/^[\da-f-]{36}$/i.test(tabID || ''))) {
      throw new Error('Invalid host command.');
    }
    const sender = event.sender;
    const window = BrowserWindow.fromWebContents(sender);
    if (!window || window.isDestroyed() || busy.has(sender.id)) throw new Error('Host command is busy.');
    busy.add(sender.id);
    try {
      if (action === 'save') return await requestNativeSave({
        menu: Menu.getApplicationMenu(), dialog, window, tabID, saveAs,
      });
      if (action === 'quit') {
        // Normal lifecycle, never app.exit()/destroy(); RunJS retains its session.
        setImmediate(() => app.quit());
        return { status: 'quitting' };
      }
      return await new Promise((resolve, reject) => {
        const id = key(sender, tabID);
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Native tab close was not confirmed.'));
        }, 5000);
        pending.set(id, { consumed: false, finish(result) {
          clearTimeout(timer); pending.delete(id); resolve(result);
        } });
        try { sender.send('close-tab', tabID); }
        catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
      });
    } finally { busy.delete(sender.id); }
  });
  return { finishStartup() { ipcMain.handle = nativeHandle; } };
}

module.exports = { install, CHANNEL };

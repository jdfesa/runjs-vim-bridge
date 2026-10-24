'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { install, CHANNEL } = require('../patches/runjs-4.1.0/bridge-host/main.cjs');

const tabID = '12345678-1234-1234-1234-123456789abc';
function harness() {
  const directory = path.resolve(__dirname, '../patches/runjs-4.1.0');
  const handlers = new Map(), calls = [];
  const ipcMain = new EventEmitter();
  ipcMain.handle = (name, handler) => handlers.set(name, handler);
  const originalHandle = ipcMain.handle;
  const sender = { id: 9, mainFrame: {}, isDestroyed: () => false,
    getURL: () => pathToFileURL(path.join(directory, 'index.html')).href,
    send(channel, id) {
      calls.push([channel, id]);
      if (channel === 'close-tab') queueMicrotask(async () => {
        const result = await handlers.get('CONFIRM_CLOSE_TAB')(event, id);
        if (result.response === 0) ipcMain.emit('REMOVE_TAB', event, id);
      });
    },
  };
  const event = { sender, senderFrame: sender.mainFrame };
  const app = { getVersion: () => '4.1.0', quit: () => calls.push(['app.quit']) };
  const window = { webContents: sender, isDestroyed: () => false };
  const menu = { items: [{ accelerator: 'CmdOrCtrl+S', click() { sender.send(`EDITOR_SAVE_FILE.${tabID}`, 'synthetic.ts'); } }] };
  const bridge = install({ app, ipcMain, BrowserWindow: { fromWebContents: () => window },
    Menu: { getApplicationMenu: () => menu }, dialog: { showSaveDialog() {} } }, directory);
  ipcMain.handle('CONFIRM_CLOSE_TAB', async () => { calls.push(['native-confirm']); return { response: 1 }; });
  bridge.finishStartup();
  return { handlers, calls, event, sender, app, ipcMain, originalHandle,
    invoke: request => handlers.get(CHANNEL)(event, request) };
}
test('startup restores native handle registration; ordinary confirmation is unchanged', async () => {
  const h = harness(); assert.equal(h.ipcMain.handle, h.originalHandle);
  assert.equal((await h.handlers.get('CONFIRM_CLOSE_TAB')(h.event, tabID)).response, 1);
  assert.deepEqual(h.calls, [['native-confirm']]);
});
test('authorized tab close goes through native reducer/removal and consumes one ticket', async () => {
  const h = harness(); assert.equal((await h.invoke({ action: 'close', tabID })).status, 'closed');
  assert.deepEqual(h.calls, [['close-tab', tabID]]);
  assert.equal((await h.handlers.get('CONFIRM_CLOSE_TAB')(h.event, tabID)).response, 1);
});
test('native Save is dispatched for precisely the target tab', async () => {
  const h = harness(); assert.equal((await h.invoke({ action: 'save', tabID })).status, 'requested');
  assert.deepEqual(h.calls, [[`EDITOR_SAVE_FILE.${tabID}`, 'synthetic.ts']]);
});
test('quit uses normal app lifecycle, not hard process exit', async () => {
  const h = harness(); assert.equal((await h.invoke({ action: 'quit' })).status, 'quitting');
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(h.calls, [['app.quit']]);
});
test('external pages, foreign same-name files, preview and subframes are refused', async () => {
  const h = harness();
  for (const url of ['https://example.invalid/index.html', 'file:///other/index.html',
    h.sender.getURL().replace('index.html', 'preview.html')]) {
    h.sender.getURL = () => url;
    await assert.rejects(h.invoke({ action: 'quit' }), /sender rejected/);
  }
  const sub = harness(); sub.event.senderFrame = {};
  await assert.rejects(sub.invoke({ action: 'quit' }), /sender rejected/);
  assert.deepEqual(h.calls, []);
});
test('invalid requests and other app versions cannot dispatch host actions', async () => {
  const h = harness();
  for (const request of [{}, { action: 'shell' }, { action: 'close', tabID: '../bad' }]) {
    await assert.rejects(h.invoke(request), /Invalid/);
  }
  h.app.getVersion = () => '4.2.0';
  await assert.rejects(h.invoke({ action: 'quit' }), /unavailable/);
  assert.deepEqual(h.calls, []);
});

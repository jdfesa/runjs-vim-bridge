/* Wiring tests with actual bridge policy/tracker and synthetic Electron/DOM. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '../patches/runjs-4.1.0/bridge-host');
const source = fs.readFileSync(path.join(root, 'renderer.cjs'), 'utf8');
const id = '12345678-1234-1234-1234-123456789abc';

function harness() {
  const ipc = new EventEmitter(), bus = new EventEmitter(), editor = new EventEmitter();
  const calls = [], callbacks = [], notices = [], ex = new Map();
  let generation = 0, keyMap = 'vim', active = true, scan, cleared = false;
  const fakeFs = { writeFile(file, data, callback) { callbacks.push(callback); } };
  const wrapper = { CodeMirror: editor, isConnected: true,
    closest: () => ({ id: `tab-body-${id}` }) };
  editor.getWrapperElement = () => wrapper;
  editor.getOption = () => keyMap;
  editor.getValue = () => 'const synthetic = true;';
  editor.historySize = () => ({ undo: 0 });
  editor.changeGeneration = () => generation;
  editor.isClean = saved => saved === generation;
  editor.openNotification = element => notices.push(element.textContent);
  const native = (_, file) => fakeFs.writeFile(file, editor.getValue(), () => {});
  ipc.on(`EDITOR_SAVE_FILE.${id}`, native);
  ipc.send = (...args) => calls.push(['send', ...args]);
  ipc.invoke = async (_, request) => {
    calls.push(['invoke', request.action]);
    if (request.action === 'save') {
      ipc.emit(`EDITOR_SAVE_FILE.${id}`, {}, 'synthetic.ts'); return { status: 'requested' };
    }
    return { status: 'closed' };
  };
  const CodeMirror = { version: '5.65.17', Vim: { defineEx(name, short, handler) { ex.set(short, handler); }, map() {} } };
  const store = { get(key, fallback) {
    if (key === 'tabs.order') return [id];
    if (key === `tabs.${id}`) return { saveFilePath: 'synthetic.ts', unsaved: false };
    return fallback;
  } };
  const module = { exports: {} }, window = {};
  vm.runInNewContext(source, { module, window, setTimeout, Date,
    document: { createElement: () => ({}), querySelector: () => active ? wrapper : null,
      querySelectorAll: () => wrapper.isConnected ? [wrapper] : [] },
    global: { webpackChunkrunjs: { push(chunk) { chunk[2](number => ({ 15237: CodeMirror, 83059: store, 49433: { PD: bus } })[number]); } } },
    setInterval(fn) { scan = fn; return 1; }, clearInterval() { cleared = true; },
    require(name) {
      if (name === 'electron') return { ipcRenderer: ipc };
      if (name === 'node:fs') return fakeFs;
      return require(path.join(root, name));
    },
  });
  module.exports.start();
  return { ipc, native, window, wrapper, editor, callbacks, calls, notices, ex, scan,
    start: module.exports.start, cleared: () => cleared,
    setActive(value) { active = value; }, setKeyMap(value) { keyMap = value; },
    edit() { generation++; editor.emit('change'); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('renderer wires Ex to actual tracker and waits for write before closing', async () => {
  const h = harness(); h.edit(); h.ex.get('wq')(h.editor, {});
  await tick(); assert.deepEqual(h.calls.filter(row => row[0] === 'invoke'), [['invoke', 'save']]);
  h.callbacks[0](null); await tick();
  assert.deepEqual(h.calls.filter(row => row[0] === 'invoke'), [['invoke', 'save'], ['invoke', 'close']]);
  h.window.__runjsExCommands.dispose();
});
test('renderer refuses inactive/Vim-off editors and errors are visible English text', async () => {
  const h = harness(); h.setActive(false); h.ex.get('w')(h.editor, {}); await tick();
  h.setActive(true); h.setKeyMap('sublime'); h.ex.get('q')(h.editor, { argString: '!' }); await tick();
  assert.equal(h.calls.length, 0); assert.equal(h.notices.length, 2);
  assert.ok(h.notices.every(message => message.includes('active RunJS code editor')));
  h.window.__runjsExCommands.dispose();
});
test('renderer is idempotent and cleanup restores listeners while commands become inert', async () => {
  const h = harness(); const api = h.window.__runjsExCommands;
  h.start(); assert.equal(api, h.window.__runjsExCommands);
  h.wrapper.isConnected = false; h.scan();
  assert.deepEqual(h.ipc.listeners(`EDITOR_SAVE_FILE.${id}`), [h.native]);
  api.dispose(); assert.equal(h.cleared(), true);
  h.ex.get('q')(h.editor, { argString: '!' }); await tick();
  assert.equal(h.calls.filter(row => row[0] === 'invoke').length, 0);
});

/* Main-process behavior with simulated Electron; no installed app is touched. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '../patches/runjs-4.1.0');
const source = fs.readFileSync(path.join(root, 'runjs-appearance-main.cjs'), 'utf8');

function harness({ platform = 'darwin', fail = false } = {}) {
  const app = new EventEmitter();
  const contents = new EventEmitter();
  const calls = [];
  const window = {
    isDestroyed: () => false,
    setBackgroundColor(value) { if (fail) throw new Error('Unavailable'); calls.push(['background', value]); },
    setVibrancy(value) { calls.push(['vibrancy', value]); },
  };
  let url = pathToFileURL(path.join(root, 'index.html')).href;
  contents.getURL = () => url;
  const context = vm.createContext({
    __dirname: root, URL, module: { exports: {} },
    process: { platform, env: {} },
    console: { warn: () => assert.fail('Diagnostics must be opt-in') },
    require(name) {
      if (name === 'electron') return { app, BrowserWindow: { fromWebContents: () => window } };
      if (name.startsWith('node:')) return require(name);
      throw new Error('Unexpected appearance dependency: ' + name);
    },
  });
  vm.runInContext(source, context);
  app.emit('web-contents-created', {}, contents);
  return { contents, calls, window, setURL(value) { url = value; } };
}

test('appearance hooks are registered independently from app startup', () => {
  assert.deepEqual(harness().calls, []);
});

test('main and preview receive background-only vibrancy, never whole-window fading', () => {
  for (const name of ['index.html', 'preview.html']) {
    const h = harness();
    h.setURL(pathToFileURL(path.join(root, name)).href);
    h.contents.emit('did-finish-load');
    assert.deepEqual(h.calls, [['background', '#00000000'], ['vibrancy', 'under-window']]);
    assert.equal(typeof h.window.setOpacity, 'undefined');
  }
});

test('external pages, other app windows and same-name foreign files are untouched', () => {
  const h = harness();
  for (const url of ['https://example.com/index.html', 'file:///other/index.html',
    pathToFileURL(path.join(root, 'preferences.html')).href]) {
    h.setURL(url);
    h.contents.emit('did-finish-load');
  }
  assert.deepEqual(h.calls, []);
});

test('subframe navigation cannot style a window', () => {
  const h = harness();
  h.contents.emit('did-start-navigation', {}, pathToFileURL(path.join(root, 'preview.html')).href, false, false);
  assert.deepEqual(h.calls, []);
});

test('non-macOS uses an opaque fallback', () => {
  const h = harness({ platform: 'linux' });
  h.contents.emit('did-finish-load');
  assert.deepEqual(h.calls, [['background', '#000000']]);
});

test('an unavailable appearance feature cannot break original app startup', () => {
  const h = harness({ fail: true });
  assert.doesNotThrow(() => h.contents.emit('did-finish-load'));
  assert.deepEqual(h.calls, []);
});

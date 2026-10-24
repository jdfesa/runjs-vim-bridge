/* Simulated editor/DOM checks only: this is not a Vim engine or layout test. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
  '../patches/runjs-4.1.0/runjs-vim-mode.js'), 'utf8');

function harness({ loading = false, diagnostics = '0' } = {}) {
  const nodes = new Map();
  const editors = [];
  const timers = new Map();
  const documentEvents = new Map();
  const classes = new Set();
  const logs = [];
  let active = null;
  let timerId = 0;

  function element() {
    return {
      dataset: {}, attributes: {}, children: [], isConnected: true,
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...items) {
        this.children.push(...items);
        for (const item of items) if (item.id) nodes.set(item.id, item);
      },
      remove() { this.isConnected = false; nodes.delete(this.id); },
    };
  }

  const document = {
    readyState: loading ? 'loading' : 'complete',
    body: element(),
    documentElement: { classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
    } },
    createElement: element,
    querySelector: () => active?.wrapper || null,
    querySelectorAll: () => editors.filter((e) => e.wrapper.isConnected).map((e) => e.wrapper),
    addEventListener(name, handler) { documentEvents.set(name, handler); },
    removeEventListener(name, handler) {
      if (documentEvents.get(name) === handler) documentEvents.delete(name);
    },
  };
  const context = vm.createContext({
    window: {}, document,
    process: { env: { RUNJS_VIM_MODE_DIAGNOSTICS: diagnostics } },
    console: { info: (message) => logs.push(message) },
    setInterval(callback) { timers.set(++timerId, callback); return timerId; },
    clearInterval(id) { timers.delete(id); },
  });

  function editor({ keyMap = 'vim', state = {}, visible = true, focused = false } = {}) {
    const handlers = new Map();
    const wrapper = { isConnected: true, getClientRects: () => visible ? [{}] : [] };
    const instance = {
      keyMap, state: { vim: state }, focused, wrapper, handlers,
      getOption(name) { assert.equal(name, 'keyMap'); return this.keyMap; },
      getWrapperElement: () => wrapper,
      hasFocus() { return this.focused; },
      on(name, handler) {
        if (!handlers.has(name)) handlers.set(name, new Set());
        handlers.get(name).add(handler);
      },
      off(name, handler) { handlers.get(name)?.delete(handler); },
      emit(name, ...args) {
        for (const handler of handlers.get(name) || []) handler(...args);
      },
    };
    wrapper.CodeMirror = instance;
    editors.push(instance);
    return instance;
  }

  return {
    context, nodes, timers, documentEvents, classes, logs, editor,
    run: () => vm.runInContext(source, context),
    activate(instance) { active = instance; },
    scan() { for (const callback of timers.values()) callback(); },
    load() {
      document.readyState = 'complete';
      const callback = documentEvents.get('DOMContentLoaded');
      documentEvents.delete('DOMContentLoaded');
      callback?.();
    },
    get api() { return context.window.__runjsVimModePatch; },
    get bar() { return nodes.get('runjs-vim-mode-bar'); },
    get label() { return nodes.get('runjs-vim-mode-label')?.textContent; },
    get hint() { return nodes.get('runjs-vim-mode-hint')?.textContent; },
  };
}

test('waiting state and accessible tooltip are in English', () => {
  const h = harness();
  h.run();
  assert.equal(h.label, 'VIM');
  assert.equal(h.hint, 'Waiting for the editor…');
  assert.equal(h.bar.title, 'RunJS Vim keys (CodeMirror), not a full Neovim runtime');
  assert.equal(h.bar.attributes.role, 'status');
  assert.equal(h.bar.attributes['aria-live'], 'polite');
});

const modeCases = [
  ['normal', {}, 'NORMAL', 'Move and edit · i: Insert · v: Visual'],
  ['insert', { state: { insertMode: true } }, 'INSERT', 'Type text · Esc: Normal'],
  ['insert', { keyMap: 'vim-insert' }, 'INSERT', 'Type text · Esc: Normal'],
  ['visual', { state: { visualMode: true } }, 'VISUAL', 'Select text · Esc: Normal'],
  ['visual-line', { state: { visualMode: true, visualLine: true } }, 'VISUAL LINE', 'Select lines · Esc: Normal'],
  ['visual-block', { state: { visualMode: true, visualBlock: true } }, 'VISUAL BLOCK', 'Select a block · Esc: Normal'],
  ['replace', { keyMap: 'vim-replace' }, 'REPLACE', 'Replace text · Esc: Normal'],
  ['off', { keyMap: 'default', state: { insertMode: true } }, 'VIM OFF', 'Enable Vim Keys in Settings → Editor'],
];
for (const [mode, options, label, hint] of modeCases) {
  test(`initial ${mode} mode uses the expected English text (${options.keyMap || 'vim'})`, () => {
    const h = harness();
    h.activate(h.editor(options));
    h.run();
    assert.equal(h.bar.dataset.mode, mode);
    assert.equal(h.label, label);
    assert.equal(h.hint, hint);
  });
}

test('mode events distinguish visual submodes and unknown events use editor state', () => {
  const h = harness();
  const editor = h.editor();
  h.activate(editor);
  h.run();
  editor.emit('vim-mode-change', { mode: 'visual', subMode: 'linewise' });
  assert.equal(h.bar.dataset.mode, 'visual-line');
  editor.emit('vim-mode-change', { mode: 'visual', subMode: 'blockwise' });
  assert.equal(h.bar.dataset.mode, 'visual-block');
  editor.state.vim = { insertMode: true };
  editor.emit('vim-mode-change', { mode: 'unknown-mode' });
  assert.equal(h.label, 'INSERT');
});

test('keymap and focus events refresh mode without changing editor settings', () => {
  const h = harness();
  const editor = h.editor();
  h.activate(editor);
  h.run();
  editor.keyMap = 'default';
  editor.emit('optionChange', editor, 'keyMap');
  assert.equal(h.label, 'VIM OFF');
  editor.keyMap = 'vim';
  editor.emit('optionChange', editor, 'keyMap');
  assert.equal(h.label, 'NORMAL');
  editor.state.vim = { insertMode: true };
  editor.emit('focus');
  assert.equal(h.label, 'INSERT');
  assert.equal(editor.keyMap, 'vim');
});

test('active tab state takes precedence over inactive tab events', () => {
  const h = harness();
  const first = h.editor({ state: { insertMode: true } });
  const second = h.editor({ state: { visualMode: true } });
  h.activate(first);
  h.run();
  second.emit('vim-mode-change', { mode: 'visual' });
  assert.equal(h.label, 'INSERT');
  h.activate(second);
  h.scan();
  assert.equal(h.label, 'VISUAL');
  h.activate(first);
  h.scan();
  assert.equal(h.label, 'INSERT');
});

test('fallback picks a focused visible editor rather than a hidden editor', () => {
  const h = harness();
  h.editor({ visible: false, focused: true });
  h.editor({ state: { insertMode: true }, focused: true });
  h.run();
  assert.equal(h.label, 'INSERT');
});

test('scanning binds new tabs once and releases removed editor listeners', () => {
  const h = harness();
  h.run();
  const editor = h.editor();
  h.activate(editor);
  h.scan();
  h.scan();
  assert.equal(h.label, 'NORMAL');
  assert.equal(editor.handlers.size, 3);
  for (const handlers of editor.handlers.values()) assert.equal(handlers.size, 1);
  editor.wrapper.isConnected = false;
  h.activate(null);
  h.scan();
  for (const handlers of editor.handlers.values()) assert.equal(handlers.size, 0);
  assert.equal(h.label, 'VIM');
});

test('injection is idempotent and reports the source patch version', () => {
  const h = harness();
  h.run();
  const api = h.api;
  h.run();
  assert.equal(h.api, api);
  assert.equal(h.api.version, '1.4.0');
  assert.equal(h.timers.size, 1);
  assert.equal(h.context.document.body.children.length, 1);
});

test('startup diagnostics are opt-in and only report a mode once', () => {
  for (const diagnostics of ['0', '1']) {
    const h = harness({ diagnostics });
    h.editor();
    h.run();
    h.scan();
    assert.deepEqual(h.logs, diagnostics === '1' ? ['[RunJS Vim Mode] ready: NORMAL'] : []);
  }
});

test('dispose releases timers, listeners, UI, and public API', () => {
  const h = harness();
  const editor = h.editor();
  h.run();
  h.api.dispose();
  assert.equal(h.timers.size, 0);
  assert.equal(h.bar, undefined);
  assert.equal(h.api, undefined);
  assert.equal(h.classes.size, 0);
  for (const handlers of editor.handlers.values()) assert.equal(handlers.size, 0);
});

test('dispose before DOM readiness prevents a delayed orphan indicator', () => {
  const h = harness({ loading: true });
  h.run();
  h.api.dispose();
  assert.equal(h.documentEvents.size, 0);
  h.load();
  assert.equal(h.bar, undefined);
  assert.equal(h.timers.size, 0);
  assert.equal(h.classes.size, 0);
});

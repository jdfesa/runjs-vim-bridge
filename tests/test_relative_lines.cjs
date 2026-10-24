/* Relative gutters with simulated CodeMirror. No app, exercise, or keymap access. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname,
  '../patches/runjs-4.1.0/runjs-relative-lines.js'), 'utf8');

function harness({ loading = false } = {}) {
  const editors = [];
  const timers = new Map();
  const events = new Map();
  let timer = 0;
  const document = {
    readyState: loading ? 'loading' : 'complete',
    querySelectorAll: () => editors.filter(e => e.wrapper.isConnected).map(e => e.wrapper),
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name, callback) { if (events.get(name) === callback) events.delete(name); },
  };
  const context = vm.createContext({
    window: {}, document,
    setInterval(callback) { timers.set(++timer, callback); return timer; },
    clearInterval(id) { timers.delete(id); },
  });
  return {
    timers, events,
    run: () => vm.runInContext(source, context),
    get api() { return context.window.__runjsRelativeLinesPatch; },
    scan() { for (const callback of timers.values()) callback(); },
    load() {
      const callback = events.get('DOMContentLoaded');
      events.delete('DOMContentLoaded');
      callback?.();
    },
    editor({ line = 0, first = 1, visible = true, formatter = n => n } = {}) {
      const handlers = new Map();
      const options = { lineNumbers: visible, firstLineNumber: first, lineNumberFormatter: formatter };
      const wrapper = { isConnected: true };
      const editor = {
        handlers, options, wrapper, cursor: { line, ch: 0 }, sets: 0, last: 29,
        lastLine() { return this.last; },
        getOption(name) { assert.ok(name in options); return options[name]; },
        setOption(name, value) {
          assert.ok(name in options);
          options[name] = value;
          this.sets++;
          this.emit('optionChange', this, name);
        },
        getCursor(which) { assert.equal(which, 'head'); return this.cursor; },
        getWrapperElement: () => wrapper,
        on(name, callback) {
          if (!handlers.has(name)) handlers.set(name, new Set());
          handlers.get(name).add(callback);
        },
        off(name, callback) { handlers.get(name)?.delete(callback); },
        emit(name, ...args) { for (const callback of handlers.get(name) || []) callback(...args); },
        numbers(first, last) {
          return Array.from({ length: last - first + 1 }, (_, i) => options.lineNumberFormatter(first + i).trim());
        },
        move(line, ch = 0) { this.cursor = { line, ch }; this.emit('cursorActivity', this); },
        getValue() { assert.fail('Gutter formatting must not read exercise text'); },
        setValue() { assert.fail('Gutter formatting must not modify exercise text'); },
      };
      wrapper.CodeMirror = editor;
      editors.push(editor);
      return editor;
    },
  };
}

test('current line is absolute and other labels are cursor distances', () => {
  const h = harness();
  const e = h.editor({ line: 3 });
  h.run();
  assert.deepEqual(e.numbers(1, 7), ['3', '2', '1', '4', '1', '2', '3']);
  e.move(5);
  assert.deepEqual(e.numbers(1, 7), ['5', '4', '3', '2', '1', '6', '1']);
});

test('first-line, last-line and single-line anchors do not show zero', () => {
  const h = harness();
  const e = h.editor();
  h.run();
  assert.deepEqual(e.numbers(1, 1), ['1']);
  assert.deepEqual(e.numbers(1, 4), ['1', '1', '2', '3']);
  e.move(3);
  assert.deepEqual(e.numbers(1, 4), ['3', '2', '1', '4']);
});

test('horizontal cursor movement does not invalidate the gutter', () => {
  const h = harness();
  const e = h.editor({ line: 4 });
  h.run();
  const writes = e.sets;
  e.move(4, 12);
  e.move(4, 20);
  h.scan();
  assert.equal(e.sets, writes);
});

test('each tab keeps its own cursor anchor', () => {
  const h = harness();
  const a = h.editor({ line: 2 });
  const b = h.editor({ line: 8 });
  h.run();
  assert.equal(a.options.lineNumberFormatter(3).trim(), '3');
  assert.equal(b.options.lineNumberFormatter(3).trim(), '6');
  a.move(0);
  assert.equal(b.options.lineNumberFormatter(9).trim(), '9');
});

test('gutter width stays stable near EOF and grows when the document grows', () => {
  const h = harness();
  const e = h.editor({ line: 998 });
  e.last = 999;
  h.run();
  assert.equal(e.options.lineNumberFormatter(1000).length, 4);
  assert.equal(e.options.lineNumberFormatter(999).trim(), '999');
  e.last = 9999;
  e.emit('changes', e);
  assert.equal(e.options.lineNumberFormatter(10000).length, 5);
  assert.equal(e.options.lineNumberFormatter(999).trim(), '999');
});

test('native line-number visibility remains user-controlled', () => {
  const h = harness();
  const original = n => 'L' + n;
  const e = h.editor({ visible: false, formatter: original });
  h.run();
  assert.equal(e.options.lineNumberFormatter, original);
  assert.equal(e.options.lineNumbers, false);
  e.setOption('lineNumbers', true);
  assert.deepEqual(e.numbers(1, 3), ['1', '1', '2']);
  e.setOption('lineNumbers', false);
  e.move(2);
  e.setOption('lineNumbers', true);
  assert.deepEqual(e.numbers(1, 3), ['2', '1', '3']);
});

test('custom first-line offsets and option updates are supported', () => {
  const h = harness();
  const e = h.editor({ line: 2, first: 10 });
  h.run();
  assert.deepEqual(e.numbers(10, 14), ['2', '1', '12', '1', '2']);
  e.setOption('firstLineNumber', 100);
  assert.deepEqual(e.numbers(100, 104), ['2', '1', '102', '1', '2']);
});

test('swapping a document updates to the new head cursor', () => {
  const h = harness();
  const e = h.editor({ line: 5 });
  h.run();
  e.cursor = { line: 1, ch: 0 };
  e.emit('swapDoc', e);
  assert.deepEqual(e.numbers(1, 4), ['1', '2', '1', '2']);
});

test('new tabs bind once and removed tabs restore their original formatter', () => {
  const h = harness();
  h.run();
  const original = n => 'L' + n;
  const e = h.editor({ formatter: original });
  h.scan();
  h.scan();
  for (const group of e.handlers.values()) assert.equal(group.size, 1);
  e.wrapper.isConnected = false;
  h.scan();
  assert.equal(e.options.lineNumberFormatter, original);
  for (const group of e.handlers.values()) assert.equal(group.size, 0);
});

test('disposal restores formatter, releases listeners and leaves line visibility alone', () => {
  const h = harness();
  const original = n => n;
  const e = h.editor({ formatter: original });
  h.run();
  const api = h.api;
  api.dispose();
  api.dispose();
  assert.equal(e.options.lineNumberFormatter, original);
  assert.equal(e.options.lineNumbers, true);
  assert.equal(h.api, undefined);
  assert.equal(h.timers.size, 0);
  for (const group of e.handlers.values()) assert.equal(group.size, 0);
});

test('later external formatters are remembered for cleanup without recursion', () => {
  const h = harness();
  const e = h.editor();
  h.run();
  const later = n => '[' + n + ']';
  e.setOption('lineNumberFormatter', later);
  assert.deepEqual(e.numbers(1, 3), ['1', '1', '2']);
  h.api.dispose();
  assert.equal(e.options.lineNumberFormatter, later);
});

test('disposal does not replace an unannounced external formatter', () => {
  const h = harness();
  const e = h.editor();
  h.run();
  const later = n => '[' + n + ']';
  e.options.lineNumberFormatter = later;
  h.api.dispose();
  assert.equal(e.options.lineNumberFormatter, later);
});

test('duplicate injection is inert and early disposal cancels pending startup', () => {
  const h = harness({ loading: true });
  h.run();
  const api = h.api;
  h.run();
  assert.equal(h.api, api);
  assert.equal(api.version, '1.3.0');
  assert.equal(h.events.size, 1);
  api.dispose();
  h.load();
  assert.equal(h.timers.size, 0);
  assert.equal(h.events.size, 0);
});

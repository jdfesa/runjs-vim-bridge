/* Optional number + relativenumber display. Editing and Vim keymaps stay untouched. */
(() => {
  'use strict';

  const patchKey = '__runjsRelativeLinesPatch';
  if (window[patchKey]) return;
  const editors = new Map();
  let interval;
  let disposed = false;

  function update(editor, entry) {
    if (entry.updating || !editor.getOption('lineNumbers')) return;
    const first = editor.getOption('firstLineNumber');
    const anchor = editor.getCursor('head').line + first;
    const width = Math.max(3, String(editor.lastLine() + first).length);
    if (anchor === entry.anchor && width === entry.width &&
        editor.getOption('lineNumberFormatter') === entry.formatter) return;
    entry.anchor = anchor;
    entry.width = width;
    // CodeMirror measures only the final label for gutter width. Nonbreaking
    // padding prevents large absolute/current labels from being clipped near EOF.
    entry.formatter = (number) => String(number === anchor ? number : Math.abs(number - anchor))
      .padStart(width, '\u00a0');
    entry.updating = true;
    try {
      // A new formatter invalidates the native gutter without reading exercise text.
      editor.setOption('lineNumberFormatter', entry.formatter);
    } finally {
      entry.updating = false;
    }
  }

  function release(editor, entry) {
    for (const [name, handler] of Object.entries(entry.handlers)) editor.off(name, handler);
    // Do not overwrite a later formatter installed by another extension.
    if (editor.getOption('lineNumberFormatter') === entry.formatter) {
      editor.setOption('lineNumberFormatter', entry.originalFormatter);
    }
  }

  function bind(editor) {
    const entry = {
      originalFormatter: editor.getOption('lineNumberFormatter'),
      formatter: null, anchor: null, updating: false, handlers: {},
    };
    editors.set(editor, entry);
    entry.handlers.cursorActivity = () => update(editor, entry);
    entry.handlers.changes = () => update(editor, entry);
    entry.handlers.swapDoc = () => update(editor, entry);
    entry.handlers.optionChange = (_editor, name) => {
      if (entry.updating) return;
      if (name === 'lineNumberFormatter') {
        entry.originalFormatter = editor.getOption(name);
        entry.anchor = null;
      } else if (name !== 'firstLineNumber' && name !== 'lineNumbers') return;
      update(editor, entry);
    };
    for (const [name, handler] of Object.entries(entry.handlers)) editor.on(name, handler);
    update(editor, entry);
  }

  function scan() {
    for (const [editor, entry] of editors) {
      if (editor.getWrapperElement().isConnected) continue;
      release(editor, entry);
      editors.delete(editor);
    }
    for (const wrapper of document.querySelectorAll('.editor .CodeMirror')) {
      if (wrapper.CodeMirror && !editors.has(wrapper.CodeMirror)) bind(wrapper.CodeMirror);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('DOMContentLoaded', start);
    clearInterval(interval);
    for (const [editor, entry] of editors) release(editor, entry);
    editors.clear();
    delete window[patchKey];
  }

  function start() {
    if (disposed) return;
    scan();
    interval = setInterval(scan, 250);
  }

  window[patchKey] = { version: '1.3.0', dispose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

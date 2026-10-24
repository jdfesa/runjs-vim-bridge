/* Mode indicator only: preserves the Vim key bindings provided by RunJS. */
(() => {
  'use strict';

  const patchKey = '__runjsVimModePatch';
  if (window[patchKey]) return;

  const editors = new Map();
  let interval;
  let bar;
  let badge;
  let hint;
  let readyReported = false;
  let disposed = false;

  const modes = {
    normal: ['NORMAL', 'Move and edit · i: Insert · v: Visual'],
    insert: ['INSERT', 'Type text · Esc: Normal'],
    visual: ['VISUAL', 'Select text · Esc: Normal'],
    'visual-line': ['VISUAL LINE', 'Select lines · Esc: Normal'],
    'visual-block': ['VISUAL BLOCK', 'Select a block · Esc: Normal'],
    replace: ['REPLACE', 'Replace text · Esc: Normal'],
    off: ['VIM OFF', 'Enable Vim Keys in Settings → Editor'],
    loading: ['VIM', 'Waiting for the editor…'],
  };

  function getMode(editor) {
    const keyMap = editor.getOption('keyMap') || '';
    if (!/^vim(?:-|$)/.test(keyMap)) return 'off';
    const state = editor.state.vim || {};
    if (keyMap === 'vim-replace') return 'replace';
    if (state.insertMode || keyMap === 'vim-insert') return 'insert';
    if (state.visualMode) {
      if (state.visualBlock) return 'visual-block';
      if (state.visualLine) return 'visual-line';
      return 'visual';
    }
    return 'normal';
  }

  function eventMode(event) {
    if (event.mode === 'visual') {
      if (event.subMode === 'linewise') return 'visual-line';
      if (event.subMode === 'blockwise') return 'visual-block';
    }
    return Object.hasOwn(modes, event.mode) ? event.mode : null;
  }

  function activeEditor() {
    const activeWrapper = document.querySelector('.tab-body.active .editor .CodeMirror');
    if (activeWrapper && editors.has(activeWrapper.CodeMirror)) return activeWrapper.CodeMirror;
    for (const editor of editors.keys()) {
      if (editor.hasFocus() && editor.getWrapperElement().getClientRects().length) return editor;
    }
    for (const editor of editors.keys()) {
      if (editor.getWrapperElement().getClientRects().length) return editor;
    }
    return null;
  }

  function render() {
    const editor = activeEditor();
    const mode = editor ? editors.get(editor).mode : 'loading';
    const [label, description] = modes[mode] || modes.loading;
    if (bar.dataset.mode !== mode) {
      bar.dataset.mode = mode;
      badge.textContent = label;
      hint.textContent = description;
    }
    if (editor && !readyReported) {
      readyReported = true;
      // Opt-in startup diagnostics only; never logs keystrokes or exercise text.
      if (typeof process !== 'undefined' && process.env.RUNJS_VIM_MODE_DIAGNOSTICS === '1') {
        console.info(`[RunJS Vim Mode] ready: ${label}`);
      }
    }
  }

  function bind(editor) {
    const entry = { mode: getMode(editor), handlers: {} };
    editors.set(editor, entry);
    entry.handlers['vim-mode-change'] = (event) => {
      entry.mode = eventMode(event) || getMode(editor);
      render();
    };
    entry.handlers.focus = () => {
      entry.mode = getMode(editor);
      render();
    };
    entry.handlers.optionChange = (_editor, name) => {
      if (name !== 'keyMap') return;
      entry.mode = getMode(editor);
      render();
    };
    for (const [name, handler] of Object.entries(entry.handlers)) editor.on(name, handler);
  }

  function scan() {
    for (const [editor, entry] of editors) {
      if (editor.getWrapperElement().isConnected) continue;
      for (const [name, handler] of Object.entries(entry.handlers)) editor.off(name, handler);
      editors.delete(editor);
    }
    for (const wrapper of document.querySelectorAll('.editor .CodeMirror')) {
      const editor = wrapper.CodeMirror;
      if (editor && !editors.has(editor)) bind(editor);
    }
    render();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('DOMContentLoaded', start);
    clearInterval(interval);
    for (const [editor, entry] of editors) {
      for (const [name, handler] of Object.entries(entry.handlers)) editor.off(name, handler);
    }
    editors.clear();
    bar?.remove();
    document.documentElement.classList.remove('runjs-vim-mode-enabled');
    delete window[patchKey];
  }

  function start() {
    if (disposed) return;
    bar = document.createElement('div');
    bar.id = 'runjs-vim-mode-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.setAttribute('aria-atomic', 'true');
    bar.title = 'RunJS Vim keys (CodeMirror), not a full Neovim runtime';
    badge = document.createElement('span');
    badge.id = 'runjs-vim-mode-label';
    hint = document.createElement('span');
    hint.id = 'runjs-vim-mode-hint';
    bar.append(badge, hint);
    document.body.append(bar);
    document.documentElement.classList.add('runjs-vim-mode-enabled');
    scan();
    // Discover new tabs without reading or storing exercise content.
    interval = setInterval(scan, 250);
  }

  window[patchKey] = { version: '1.4.0', dispose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

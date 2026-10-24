/* Discover only code editors and connect default Ex commands to native host actions. */
'use strict';

const { ipcRenderer: ipc } = require('electron');
const fs = require('node:fs');
const { createController, register } = require('./commands.cjs');
const { attach } = require('./save-tracker.cjs');
const CHANNEL = 'runjs-vim-bridge:host';

function runtime() {
  let result;
  const chunks = global.webpackChunkrunjs;
  if (!chunks) throw new Error('RunJS renderer runtime unavailable.');
  chunks.push([['runjs-vim-bridge-host-1.4.0'], {}, require => { result = require; }]);
  if (!result) throw new Error('RunJS renderer runtime not initialized.');
  return result;
}

function start() {
  if (window.__runjsExCommands) return;
  const load = runtime();
  const CodeMirror = load(15237);
  const store = load(83059);
  const bus = load(49433).PD;
  if (CodeMirror.version !== '5.65.17' || !CodeMirror.Vim || !store.get || !bus.emit) {
    throw new Error('Unsupported RunJS editor runtime.');
  }
  const editors = new Map();
  let disposed = false;
  function notify(editor, message) {
    const element = document.createElement('span');
    element.textContent = message;
    if (editor?.openNotification) editor.openNotification(element, { bottom: true, duration: 6000 });
  }
  function tabState(id) { return store.get(`tabs.${id}`, {}); }
  function active(editor) {
    const wrapper = document.querySelector('.tab-body.active .editor .CodeMirror');
    return wrapper?.CodeMirror === editor && editors.has(editor) &&
      /^vim(?:-|$)/.test(editor.getOption('keyMap') || '');
  }
  const host = {
    active,
    dirty: editor => editors.get(editor).tracker.dirty(),
    saving: editor => editors.get(editor).tracker.saving(),
    assertIdle() {
      if ([...editors.values()].some(entry => entry.tracker.saving())) {
        throw new Error('Wait for the pending native save before quitting.');
      }
    },
    all() {
      const order = store.get('tabs.order', []);
      const found = order.map(id => [...editors.keys()].find(editor => editors.get(editor).id === id));
      if (!order.length || found.some(editor => !editor)) {
        throw new Error('Visit every tab before using an all-tabs command; some tab states are unverified.');
      }
      return found;
    },
    async activate(editor) {
      const id = editors.get(editor).id;
      ipc.emit('SET_ACTIVE_TAB', {}, id);
      const deadline = Date.now() + 1000;
      while (!active(editor) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (!active(editor)) throw new Error('Could not activate the target tab.');
    },
    save(editor, saveAs) {
      if (!active(editor)) throw new Error('Save target is not the active code editor.');
      const entry = editors.get(editor);
      return entry.tracker.save(() => ipc.invoke(CHANNEL, { action: 'save', tabID: entry.id, saveAs }));
    },
    close(editor) {
      const entry = editors.get(editor);
      return ipc.invoke(CHANNEL, { action: 'close', tabID: entry.id });
    },
    quit: () => ipc.invoke(CHANNEL, { action: 'quit' }),
  };
  const controller = createController(host);
  register(CodeMirror.Vim, controller, notify);

  function scan() {
    for (const [editor, entry] of editors) {
      if (editor.getWrapperElement().isConnected) continue;
      entry.tracker.dispose(); editors.delete(editor);
    }
    for (const wrapper of document.querySelectorAll('.editor .CodeMirror')) {
      const editor = wrapper.CodeMirror;
      if (!editor || editors.has(editor)) continue;
      const id = wrapper.closest('.tab-body')?.id?.replace(/^tab-body-/, '');
      if (!/^[\da-f-]{36}$/i.test(id || '')) continue;
      const metadata = tabState(id);
      try {
        const tracker = attach({ editor, tabID: id, ipc, fs,
          initialDirty: Boolean(metadata.unsaved || editor.historySize().undo ||
            (!metadata.saveFilePath && editor.getValue().length)),
          setDirty(unsaved) {
            // Native writer clears this early; restore accurate status after completion.
            ipc.send('STORE_TAB', id, { unsaved });
            bus.emit(`editor.tabEvent.${id}`, { type: 'changed', payload: { unsaved } });
          },
        });
        editors.set(editor, { id, tracker });
      } catch (error) { notify(editor, error.message); }
    }
  }
  scan();
  const interval = setInterval(scan, 250);
  window.__runjsExCommands = { version: '1.4.0', dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(interval);
    for (const entry of editors.values()) entry.tracker.dispose();
    editors.clear();
    // Ex callbacks remain registered but active() refuses every detached editor.
  } };
}

module.exports = { start, runtime };

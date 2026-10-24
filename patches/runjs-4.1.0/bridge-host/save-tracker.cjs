/* Track actual native write completion and buffer generations, not native flags. */
'use strict';

const { observeWrite } = require('./native-save.cjs');

function attach({ editor, tabID, ipc, fs, initialDirty, setDirty }) {
  const channel = `EDITOR_SAVE_FILE.${tabID}`;
  const saved = { generation: initialDirty ? null : editor.changeGeneration(), pending: null };
  let lastDirty = initialDirty;
  function report(value) { lastDirty = value; setDirty(value); }
  const originals = ipc.listeners(channel);
  // The pinned writer and tab-title listener share a channel; preserve their order.
  if (!originals.some(listener => listener.toString().includes('.writeFile('))) {
    throw new Error('Native save listener not found.');
  }
  let sequence = 0;
  let inFlight = 0;
  let overlapping = false;
  const wrappers = originals.map(listener => function (...args) {
    const generation = editor.changeGeneration();
    let serial;
    let pending;
    try {
      return observeWrite(fs, listener, this, args, args[1], () => {
        serial = ++sequence;
        if (inFlight) overlapping = true;
        inFlight++;
        pending = saved.pending;
      }, error => {
        inFlight--;
        const uncertain = overlapping;
        if (serial === sequence || uncertain) {
          saved.generation = error || uncertain ? null : generation;
          report(dirty());
        }
        if (!inFlight) overlapping = false;
        pending?.finish(error || (uncertain ? new Error('Overlapping native saves need another isolated save.') : null));
      });
    } catch (error) {
      if (serial !== undefined) inFlight--;
      saved.generation = null;
      report(true);
      pending?.finish(error);
      // Native Save events are asynchronous; never throw out of Electron dispatch.
    }
  });
  originals.forEach(listener => ipc.removeListener(channel, listener));
  wrappers.forEach(listener => ipc.on(channel, listener));

  function dirty() { return saved.generation === null || !editor.isClean(saved.generation); }
  function onChange() {
    const value = dirty();
    if (lastDirty !== value) report(value);
  }
  function onSwap() { saved.generation = null; report(true); }
  editor.on('change', onChange);
  editor.on('swapDoc', onSwap);

  async function save(request) {
    if (saved.pending || inFlight) throw new Error('A native save is already pending.');
    let resolveWrite;
    const written = new Promise(resolve => { resolveWrite = resolve; });
    const pending = { finish(error) { resolveWrite({ error }); } };
    saved.pending = pending;
    let timer;
    try {
      const result = await request();
      if (result.status === 'canceled') return result;
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve({ error: new Error('Write completion was not confirmed; the tab remains open.') }), 30000);
      });
      const { error } = await Promise.race([written, timeout]);
      if (error) throw new Error('Save failed; the tab remains open.');
      return { status: 'saved' };
    } finally {
      clearTimeout(timer);
      if (saved.pending === pending) saved.pending = null;
    }
  }
  function dispose() {
    saved.pending?.finish(new Error('Editor closed before save completed.'));
    editor.off('change', onChange);
    editor.off('swapDoc', onSwap);
    // Native tab disposal may already have removed its listeners. Do not revive them.
    wrappers.forEach((listener, index) => {
      if (!ipc.listeners(channel).includes(listener)) return;
      ipc.removeListener(channel, listener);
      ipc.on(channel, originals[index]);
    });
  }
  return { dirty, save, dispose, saving: () => Boolean(inFlight || saved.pending) };
}

module.exports = { attach };

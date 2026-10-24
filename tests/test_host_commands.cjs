/* Host policy tests use synthetic buffers; no installed app or user files. */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { createController, parseArguments, register, definitions } = require('../patches/runjs-4.1.0/bridge-host/commands.cjs');
const { requestNativeSave, observeWrite } = require('../patches/runjs-4.1.0/bridge-host/native-save.cjs');
const { attach } = require('../patches/runjs-4.1.0/bridge-host/save-tracker.cjs');

function policy() {
  const first = { dirty: false }, second = { dirty: false };
  let active = first;
  const calls = [];
  const host = {
    active: editor => editor === active,
    all: () => [first, second], dirty: editor => editor.dirty,
    async activate(editor) { active = editor; calls.push('activate'); },
    async save(editor, saveAs) { calls.push(saveAs ? 'saveas' : 'save'); editor.dirty = false; return { status: 'saved' }; },
    async close(editor) { calls.push('close'); return { status: 'closed' }; },
    async quit() { calls.push('quit'); return { status: 'quitting' }; },
  };
  return { first, second, host, calls, controller: createController(host) };
}

for (const command of ['write', 'wq', 'xit', 'saveas']) {
  test(`${command} uses save completion, not a key simulation`, async () => {
    const h = policy(); h.first.dirty = true;
    await h.controller.execute(command, h.first);
    assert.deepEqual(h.calls, [command === 'saveas' ? 'saveas' : 'save', ...(['wq', 'xit'].includes(command) ? ['close'] : [])]);
  });
}
test('q refuses dirty buffers; q! closes only the requested tab', async () => {
  const h = policy(); h.first.dirty = true; h.second.dirty = true;
  await assert.rejects(h.controller.execute('quit', h.first), /E37/);
  await h.controller.execute('quit', h.first, { argString: '!' });
  assert.deepEqual(h.calls, ['close']); assert.equal(h.second.dirty, true);
});
test('clean x skips a redundant write while clean wq still writes', async () => {
  const h = policy(); await h.controller.execute('xit', h.first);
  await h.controller.execute('wq', h.first);
  assert.deepEqual(h.calls, ['close', 'save', 'close']);
});
for (const status of ['canceled', 'failure', 'changed']) {
  test(`wq does not close after ${status}`, async () => {
    const h = policy(); h.first.dirty = true;
    h.host.save = async () => {
      if (status === 'failure') throw new Error('write error');
      return { status: status === 'canceled' ? 'canceled' : 'saved' };
    };
    if (status === 'canceled') assert.equal((await h.controller.execute('wq', h.first)).status, 'canceled');
    else await assert.rejects(h.controller.execute('wq', h.first, { argString: '!' }));
    assert.deepEqual(h.calls, []);
  });
}
test('qa refuses other dirty tabs and qa! does not save them', async () => {
  const h = policy(); h.second.dirty = true;
  await assert.rejects(h.controller.execute('qall', h.first), /E37/);
  h.host.all = () => { throw new Error('unverified'); };
  await h.controller.execute('qall', h.first, { argString: '!' });
  assert.deepEqual(h.calls, ['quit']);
});
test('wqall saves dirty tabs sequentially before quitting', async () => {
  const h = policy(); h.first.dirty = h.second.dirty = true;
  await h.controller.execute('wqall', h.first);
  assert.deepEqual(h.calls, ['save', 'activate', 'save', 'quit']);
});
test('all-tab save cancellation stops the sequence without quitting', async () => {
  const h = policy(); h.first.dirty = h.second.dirty = true;
  h.host.save = async () => ({ status: 'canceled' });
  await h.controller.execute('wqall', h.first);
  assert.equal(h.second.dirty, true); assert.deepEqual(h.calls, []);
});
test('wall restores the original active tab and rechecks newly dirty tabs before app quit', async () => {
  const h = policy(); h.second.dirty = true;
  await h.controller.execute('wall', h.first);
  assert.deepEqual(h.calls, ['activate', 'save', 'activate']);
  h.calls.length = 0; h.first.dirty = true;
  h.host.save = async editor => { editor.dirty = false; h.second.dirty = true; return { status: 'saved' }; };
  await assert.rejects(h.controller.execute('wqall', h.first), /E37/);
  assert.equal(h.calls.includes('quit'), false);
});
test('quit operations stay locked until native close completes', async () => {
  const h = policy(); let finish;
  h.host.close = () => new Promise(resolve => { finish = resolve; });
  const close = h.controller.execute('quit', h.first);
  await assert.rejects(h.controller.execute('write', h.first), /already running/);
  finish({ status: 'closed' }); await close;
});
test('forced quit still refuses a known pending native write', async () => {
  const h = policy(); h.host.saving = () => true;
  h.host.assertIdle = () => { throw new Error('pending native save'); };
  await assert.rejects(h.controller.execute('quit', h.first, { argString: '!' }), /pending native save/);
  await assert.rejects(h.controller.execute('qall', h.first, { argString: '!' }), /pending native save/);
  assert.deepEqual(h.calls, []);
});
test('inactive editors, concurrent commands, ranges and extra arguments fail closed', async () => {
  const h = policy();
  await assert.rejects(h.controller.execute('quit', h.second), /active/);
  for (const params of [{ line: 0 }, { lineEnd: 1 }, { argString: 'synthetic.ts' }, { argString: '! shell' }, { argString: '| q!' }]) {
    assert.throws(() => parseArguments(params), /E481|E488/);
  }
  let finish;
  h.host.save = () => new Promise(resolve => { finish = resolve; });
  const pending = h.controller.execute('write', h.first);
  await assert.rejects(h.controller.execute('quit', h.first, { argString: '!' }), /already running/);
  finish({ status: 'saved' }); await pending;
});
test('registers canonical abbreviations and default ZZ/ZQ through Vim API only', () => {
  const ex = [], maps = [];
  register({ defineEx: (...args) => ex.push(args), map: (...args) => maps.push(args) }, {}, () => {});
  assert.deepEqual(ex.map(row => row.slice(0, 2)), definitions.map(row => row.slice(0, 2)));
  assert.deepEqual(maps, [['ZZ', ':x', 'normal'], ['ZQ', ':q!', 'normal']]);
});

function menuHarness(mode = 'existing') {
  const calls = [];
  const contents = { send: (...args) => calls.push(args) };
  const dialog = { showSaveDialog: async () => ({ canceled: mode === 'cancel', filePath: mode === 'cancel' ? undefined : 'synthetic.ts' }) };
  const menu = { items: [{ accelerator: 'CmdOrCtrl+S', click() {
    if (mode === 'license') return;
    if (mode === 'throw') throw new Error('native error');
    if (mode === 'existing' || mode === 'wrong-target') contents.send(`EDITOR_SAVE_FILE.${mode === 'existing' ? 'tab' : 'other'}`, 'synthetic.ts');
    else dialog.showSaveDialog({});
  } }] };
  return { calls, contents, dialog, menu, window: { webContents: contents }, tabID: 'tab' };
}
for (const mode of ['existing', 'new', 'cancel', 'license', 'throw', 'wrong-target']) {
  test(`native ${mode} save preserves and restores host methods`, async () => {
    const h = menuHarness(mode), send = h.contents.send, show = h.dialog.showSaveDialog;
    if (['license', 'throw', 'wrong-target'].includes(mode)) await assert.rejects(requestNativeSave(h));
    else assert.equal((await requestNativeSave(h)).status, mode === 'cancel' ? 'canceled' : 'requested');
    assert.equal(h.contents.send, send); assert.equal(h.dialog.showSaveDialog, show);
    if (mode === 'wrong-target') assert.equal(h.calls.length, 0);
  });
}
test('write observer restores fs immediately and preserves callback receiver/errors', () => {
  let complete, nativeError, result;
  const fs = { writeFile(target, text, callback) { complete = callback; } }, original = fs.writeFile;
  const receiver = {};
  observeWrite(fs, function (_, target) { assert.equal(this, receiver); fs.writeFile(target, 'synthetic', error => { nativeError = error; }); }, receiver, [{}, 'synthetic.ts'], 'synthetic.ts', () => {}, error => { result = error; });
  assert.equal(fs.writeFile, original);
  const error = new Error('disk full'); complete(error);
  assert.equal(nativeError, error); assert.equal(result, error);
});
test('write observer does not claim other paths or leave patches after a throw', () => {
  const fs = { writeFile() {} }, write = fs.writeFile;
  observeWrite(fs, () => fs.writeFile('other', 'text', () => {}), {}, [], 'target', () => assert.fail(), () => assert.fail());
  assert.throws(() => observeWrite(fs, () => { throw new Error('native'); }, {}, [], 'target', () => {}, () => {}));
  assert.equal(fs.writeFile, write);
});

function trackerHarness(initialDirty = false) {
  const ipc = new EventEmitter(), editor = new EventEmitter(), writes = [], changes = [];
  let generation = 0;
  editor.changeGeneration = () => generation;
  editor.isClean = value => value === generation;
  const fs = { writeFile(file, text, callback) { writes.push(callback); } };
  const native = (_, file) => fs.writeFile(file, 'synthetic', () => {});
  ipc.on('EDITOR_SAVE_FILE.tab', native);
  const tracker = attach({ editor, tabID: 'tab', ipc, fs, initialDirty, setDirty: value => changes.push(value) });
  return { ipc, editor, writes, changes, native, tracker, edit() { generation++; editor.emit('change'); },
    request: async () => { ipc.emit('EDITOR_SAVE_FILE.tab', {}, 'synthetic.ts'); return { status: 'requested' }; } };
}
test('save tracker waits for callback and keeps edits made during the write dirty', async () => {
  const h = trackerHarness(true); let finished = false;
  const save = h.tracker.save(h.request).then(() => { finished = true; });
  await Promise.resolve(); assert.equal(finished, false);
  h.edit(); h.writes[0](null); await save;
  assert.equal(h.tracker.dirty(), true); assert.equal(h.changes.at(-1), true); h.tracker.dispose();
});
test('successful write becomes clean; subsequent edit becomes dirty', async () => {
  const h = trackerHarness(true); const save = h.tracker.save(h.request);
  h.writes[0](null); await save; assert.equal(h.tracker.dirty(), false);
  h.edit(); assert.equal(h.tracker.dirty(), true); assert.equal(h.changes.at(-1), true); h.tracker.dispose();
});
test('disk failure and cancellation do not claim a successful save', async () => {
  const h = trackerHarness(true); const save = h.tracker.save(h.request);
  h.writes[0](new Error('disk full')); await assert.rejects(save, /Save failed/);
  assert.equal(h.tracker.dirty(), true);
  assert.equal((await h.tracker.save(async () => ({ status: 'canceled' }))).status, 'canceled');
  assert.equal(h.tracker.dirty(), true); h.tracker.dispose();
});
test('a prior native save cannot complete a later Ex save', async () => {
  const h = trackerHarness(true); h.ipc.emit('EDITOR_SAVE_FILE.tab', {}, 'synthetic.ts');
  await assert.rejects(h.tracker.save(h.request), /already pending/);
  h.writes[0](null); h.tracker.dispose();
});
test('overlapping native writes remain uncertain until a fresh isolated save', async () => {
  const h = trackerHarness(true);
  h.ipc.emit('EDITOR_SAVE_FILE.tab', {}, 'synthetic.ts'); h.edit();
  h.ipc.emit('EDITOR_SAVE_FILE.tab', {}, 'synthetic.ts');
  h.writes[1](null); h.writes[0](null);
  assert.equal(h.tracker.dirty(), true);
  const save = h.tracker.save(h.request); h.writes[2](null); await save;
  assert.equal(h.tracker.dirty(), false); h.tracker.dispose();
});
test('a swapped document is never assumed clean from an old generation', () => {
  const h = trackerHarness(); h.editor.emit('swapDoc');
  assert.equal(h.tracker.dirty(), true); h.tracker.dispose();
});
test('synchronous writer errors do not escape event dispatch or leave a pending lock', async () => {
  const ipc = new EventEmitter(), editor = new EventEmitter();
  editor.changeGeneration = () => 0; editor.isClean = () => false;
  const fs = { writeFile() { throw new Error('synthetic denied'); } };
  ipc.on('EDITOR_SAVE_FILE.tab', (_, file) => fs.writeFile(file, 'synthetic', () => {}));
  const tracker = attach({ editor, tabID: 'tab', ipc, fs, initialDirty: true, setDirty() {} });
  await assert.rejects(tracker.save(async () => {
    assert.doesNotThrow(() => ipc.emit('EDITOR_SAVE_FILE.tab', {}, 'synthetic.ts'));
    return { status: 'requested' };
  }), /Save failed/);
  assert.equal(tracker.saving(), false); tracker.dispose();
});
test('tracker cleanup restores native listeners without reviving closed tabs', () => {
  const h = trackerHarness(); h.tracker.dispose();
  assert.deepEqual(h.ipc.listeners('EDITOR_SAVE_FILE.tab'), [h.native]);
  const closed = trackerHarness(); closed.ipc.removeAllListeners('EDITOR_SAVE_FILE.tab'); closed.tracker.dispose();
  assert.equal(closed.ipc.listenerCount('EDITOR_SAVE_FILE.tab'), 0);
});

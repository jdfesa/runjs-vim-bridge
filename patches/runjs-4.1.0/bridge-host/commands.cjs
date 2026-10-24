/* Ex policy is independent of Electron and editor discovery. */
'use strict';

const definitions = [
  ['write', 'w', 'write'], ['quit', 'q', 'quit'], ['wq', 'wq', 'wq'],
  ['xit', 'x', 'xit'], ['exit', 'exi', 'xit'], ['qall', 'qa', 'qall'],
  ['wall', 'wa', 'wall'], ['wqall', 'wqa', 'wqall'], ['xall', 'xa', 'xall'],
  ['saveas', 'sav', 'saveas'],
];

function parseArguments(params = {}) {
  if (params.line !== undefined || params.lineEnd !== undefined) {
    throw new Error('E481: Ranges are not supported by host commands.');
  }
  const argument = (params.argString || '').trim();
  if (argument && argument !== '!') {
    throw new Error('E488: Filenames, shell commands and extra arguments are not supported; use native Save As.');
  }
  return argument === '!';
}

function createController(host) {
  let busy = false;
  async function execute(command, editor, params) {
    const force = parseArguments(params);
    if (!host.active(editor)) throw new Error('Host commands require the active RunJS code editor.');
    if (busy) throw new Error('A save or quit command is already running.');
    busy = true;
    let restore = false;
    let quitting = false;
    try {
      const all = ['wall', 'qall', 'wqall', 'xall'].includes(command);
      restore = all;
      if (command === 'qall' && force) {
        host.assertIdle?.(); quitting = true; return await host.quit();
      }
      const editors = all ? host.all() : [editor];
      const quit = ['quit', 'wq', 'xit', 'qall', 'wqall', 'xall'].includes(command);
      for (const current of editors) {
        if (['write', 'wq', 'saveas'].includes(command) ||
            (['xit', 'wall', 'wqall', 'xall'].includes(command) && host.dirty(current))) {
          // Do not save a different tab by accidentally targeting the native active tab.
          if (!host.active(current)) await host.activate(current);
          const result = await host.save(current, command === 'saveas');
          if (result.status === 'canceled') return result;
        }
      }
      if (quit) {
        // Even ! after a write must not discard edits made while the write was pending.
        const mustBeClean = !force || ['wq', 'xit', 'wqall', 'xall'].includes(command);
        const latest = all ? host.all() : editors;
        if (latest.some(current => host.saving?.(current))) {
          throw new Error('Wait for the pending native save before quitting.');
        }
        if (mustBeClean && latest.some(current => host.dirty(current))) {
          throw new Error('E37: No write since last change (add ! to discard).');
        }
        quitting = true;
        return await (all ? host.quit() : host.close(editor));
      }
      return { status: 'saved' };
    } finally {
      try {
        if (restore && !quitting && !host.active(editor)) await host.activate(editor);
      } finally { busy = false; }
    }
  }
  return { execute };
}

function register(Vim, controller, notify) {
  for (const [name, short, command] of definitions) {
    Vim.defineEx(name, short, (editor, params) => {
      void controller.execute(command, editor, params).then(result => {
        if (result?.status === 'saved') notify(editor, 'File save completed.');
        else if (result?.status === 'canceled') notify(editor, 'Save canceled; nothing was closed.');
      }).catch(error => notify(editor, error.message));
    });
  }
  // CodeMirror key-to-Ex maps execute directly; <CR> would become an argument.
  Vim.map('ZZ', ':x', 'normal');
  Vim.map('ZQ', ':q!', 'normal');
}

module.exports = { definitions, parseArguments, createController, register };

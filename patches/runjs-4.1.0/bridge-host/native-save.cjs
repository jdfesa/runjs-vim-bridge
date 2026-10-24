/* Observe native Save without retaining a filesystem or dialog monkey patch. */
'use strict';

function findSave(menu, saveAs = false) {
  for (const item of menu?.items || []) {
    const accelerator = String(item.accelerator || '').toLowerCase();
    if (accelerator === (saveAs ? 'shift+cmdorctrl+s' : 'cmdorctrl+s')) return item;
    const child = findSave(item.submenu, saveAs);
    if (child) return child;
  }
  return null;
}

async function requestNativeSave({ menu, dialog, window, tabID, saveAs = false }) {
  const item = findSave(menu, saveAs);
  if (!item || item.enabled === false || typeof item.click !== 'function') {
    throw new Error('Native Save is unavailable.');
  }
  const contents = window.webContents;
  const send = contents.send;
  const show = dialog.showSaveDialog;
  let sent = false;
  let selection;
  // The pinned native action calls these synchronously; promises are not patched.
  contents.send = function (channel, ...args) {
    if (channel.startsWith('EDITOR_SAVE_FILE.') && channel !== `EDITOR_SAVE_FILE.${tabID}`) {
      throw new Error('Native Save target changed; save was refused.');
    }
    if (channel === `EDITOR_SAVE_FILE.${tabID}`) sent = true;
    return send.call(this, channel, ...args);
  };
  dialog.showSaveDialog = function (...args) {
    const result = show.apply(this, args);
    selection = Promise.resolve(result);
    return result;
  };
  try {
    item.click(item, window, {});
  } finally {
    contents.send = send;
    dialog.showSaveDialog = show;
  }
  if (selection) {
    const result = await selection;
    return { status: result.canceled || !result.filePath ? 'canceled' : 'requested' };
  }
  // No dispatch/dialog also covers a native license restriction; never bypass it.
  if (!sent) throw new Error('Native Save did not start. Check RunJS availability and license.');
  return { status: 'requested' };
}

function observeWrite(fs, nativeListener, receiver, args, expectedPath, onStart, onComplete) {
  const write = fs.writeFile;
  let observed = false;
  fs.writeFile = function (target, data, ...rest) {
    const callback = rest.at(-1);
    if (target === expectedPath && typeof data === 'string' && typeof callback === 'function') {
      if (observed) throw new Error('Unexpected duplicate native write.');
      observed = true;
      onStart();
      rest[rest.length - 1] = function (error, ...values) {
        try { callback.call(this, error, ...values); }
        finally { onComplete(error || null); }
      };
    }
    return write.call(this, target, data, ...rest);
  };
  try {
    return nativeListener.apply(receiver, args);
  } finally {
    fs.writeFile = write;
  }
}

module.exports = { findSave, requestNativeSave, observeWrite };

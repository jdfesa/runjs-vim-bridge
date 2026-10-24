/* Synthetic editor audit only. Never load user exercises or invoke native file actions. */
'use strict';

const button = document.querySelector('#run');
button.addEventListener('click', async () => {
  button.disabled = true;
  const [cases, reference, metadata] = await Promise.all(
    ['cases.json', 'reference.json', 'metadata.json'].map(name => fetch(name).then(r => r.json()))
  );
  const expected = new Map(reference.cases.map(value => [value.id, value]));
  const results = [];
  const host = document.querySelector('#editor-host');
  const cm = CodeMirror(host, { value: '', keyMap: 'vim', lineNumbers: true,
    mode: null, indentUnit: 2, tabSize: 2, indentWithTabs: false, smartIndent: false });
  const initialSaveHook = typeof CodeMirror.commands.save;
  let notifications = [];
  cm.openNotification = template => {
    const node = typeof template === 'string' ? document.createElement('div') : template;
    if (typeof template === 'string') node.innerHTML = template;
    notifications.push(node.textContent || String(template));
    return () => {};
  };

  for (const fixture of cases) {
    notifications = [];
    CodeMirror.Vim.resetVimGlobalState_(); // Pinned engine's test reset; never an app customization.
    cm.setOption('keyMap', 'default');
    cm.setValue(fixture.text);
    cm.setOption('keyMap', 'vim');
    cm.setCursor(...fixture.cursor);
    cm.clearHistory();
    let error = null;
    try {
      for (const action of fixture.actions) {
        if (action.keys) {
          for (const key of action.keys) CodeMirror.Vim.handleKey(cm, key);
        } else if (action.insert !== undefined) {
          if (cm.state.overwrite && !cm.somethingSelected()) {
            // Model CodeMirror's text-input overwrite path, not plain insertion.
            const head = cm.getCursor('head');
            const end = { line: head.line, ch: Math.min(cm.getLine(head.line).length, head.ch + action.insert.length) };
            cm.replaceRange(action.insert, head, end, '+input');
            cm.setCursor(head.line, head.ch + action.insert.length);
          } else cm.replaceSelection(action.insert, 'end', '+input');
        } else if (action.ex !== undefined) {
          CodeMirror.Vim.handleEx(cm, action.ex);
        }
      }
    } catch (problem) { error = String(problem.message || problem); }
    const cursor = cm.getCursor('head');
    const vim = cm.state.vim || {};
    const mode = vim.insertMode ? 'i' : vim.visualMode ? (vim.visualBlock ? '\x16' : vim.visualLine ? 'V' : 'v') : 'n';
    const actual = { text: cm.getValue(), cursor: [cursor.line, cursor.ch], mode, error };
    const wanted = expected.get(fixture.id);
    const matches = wanted && ['text', 'cursor', 'mode', 'error'].every(key =>
      JSON.stringify(actual[key]) === JSON.stringify(wanted[key]));
    const status = fixture.kind === 'host-boundary' ? 'host-boundary' : matches ? 'pass' : 'difference';
    results.push({ id: fixture.id, label: fixture.label, source: fixture.source, status,
      actual, notifications, expected: wanted || null });
    const row = document.createElement('tr');
    for (const value of [fixture.label, fixture.id, status]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    row.className = status === 'pass' ? 'pass' : status === 'difference' ? 'difference' : 'boundary';
    document.querySelector('#rows').append(row);
  }
  const summary = Object.fromEntries(['pass', 'difference', 'host-boundary'].map(status =>
    [status, results.filter(result => result.status === status).length]));
  const report = { metadata: { ...metadata, codemirror: CodeMirror.version, neovim: reference.neovim,
    reference_options: reference.options,
    save_hook_in_engine: initialSaveHook, editor_save_method: typeof cm.save }, summary, cases: results };
  document.querySelector('#json').textContent = JSON.stringify(report, null, 2);
  document.querySelector('#summary').textContent = `${summary.pass} match · ${summary.difference} differences · ${summary['host-boundary']} host boundaries`;
});

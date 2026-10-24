/* Exercise the exact bundled parser and mappings, never real host actions. */
'use strict';
document.querySelector('#run').addEventListener('click', async () => {
  const results = [];
  const cm = CodeMirror(document.querySelector('#editor'), { value: 'const answer = 42;', keyMap: 'vim' });
  let dirty = true, calls = [], notices = [], cancel = false;
  const host = {
    active: editor => editor === cm, all: () => [cm], dirty: () => dirty,
    activate: async () => {},
    async save(_, saveAs) { calls.push(saveAs ? 'saveas' : 'save'); if (!cancel) dirty = false; return { status: cancel ? 'canceled' : 'saved' }; },
    async close() { calls.push('close'); }, async quit() { calls.push('quit'); },
  };
  const controller = HostCommands.createController(host);
  HostCommands.register(CodeMirror.Vim, controller, (_, message) => notices.push(message));
  const cases = [
    ['w', ['save']], ['write', ['save']], ['w!', ['save']], ['wq', ['save', 'close']],
    ['wq!', ['save', 'close']], ['q', [], 'E37'], ['quit', [], 'E37'],
    ['q!', ['close']], ['quit!', ['close']], ['x', ['save', 'close']],
    ['xit', ['save', 'close']], ['exit', ['save', 'close']],
    ['qa', [], 'E37'], ['qall!', ['quit']], ['qa!', ['quit']],
    ['wa', ['save']], ['wall', ['save']], ['wqa', ['save', 'quit']],
    ['wqall', ['save', 'quit']], ['xa', ['save', 'quit']], ['xall', ['save', 'quit']],
    ['sav', ['saveas']], ['saveas', ['saveas']],
    ['w filename.ts', [], 'E488'], ['w !shell', [], 'E488'],
    ['1,2w', [], 'E481'], ['%w', [], 'E481'], ['q | quit!', [], 'E488'],
    ['ZZ', ['save', 'close']], ['ZQ', ['close']],
    ['wq-cancel', ['save']], ['x-clean', ['close']],
  ];
  for (const [input, expected, error] of cases) {
    calls = []; notices = []; dirty = input !== 'x-clean'; cancel = input === 'wq-cancel';
    try {
      if (input === 'ZZ' || input === 'ZQ') {
        for (const key of input) CodeMirror.Vim.handleKey(cm, key);
      } else CodeMirror.Vim.handleEx(cm, input === 'wq-cancel' ? 'wq' : input === 'x-clean' ? 'x' : input);
      await new Promise(resolve => setTimeout(resolve, 0));
      const pass = JSON.stringify(calls) === JSON.stringify(expected) &&
        (error ? notices.some(message => message.startsWith(error)) : notices.every(message =>
          ['File save completed.', 'Save canceled; nothing was closed.'].includes(message)));
      results.push({ input, expected, actual: [...calls], notices: [...notices], pass });
    } catch (exception) { results.push({ input, pass: false, error: exception.message }); }
  }
  const report = { date: '2026-10-24', engine: CodeMirror.version, bridge: '1.4.0',
    scope: 'Real bundled parser and mappings, synthetic host only; native persistence, dialog and routing unverified',
    cases: results.length, passed: results.filter(result => result.pass).length, results };
  document.querySelector('#status').textContent = `${report.passed}/${report.cases} passed`;
  document.querySelector('#json').textContent = JSON.stringify(report, null, 2);
  cm.getWrapperElement().remove();
});

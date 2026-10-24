/* Test only command construction and synthetic subprocess outcomes. */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, commands, run } = require('../scripts/checks/run.cjs');
const { javascriptFiles, nodeTestFiles } = require('../scripts/checks/files.cjs');

test('all checks use the same Python, explicit Node tests and complete syntax plan', () => {
  const plan = commands('all');
  assert.deepEqual(plan[0][1], ['-m', 'unittest', 'discover', '-s', 'tests', '-v']);
  assert.deepEqual(plan[1], [process.execPath, ['--test', ...nodeTestFiles(ROOT)]]);
  assert.ok(plan[1][1].includes(path.join('tests', 'test_checks.cjs')));
  assert.deepEqual(plan.slice(2), javascriptFiles(ROOT).map(file => [process.execPath, ['--check', file]]));
  for (const file of ['scripts/check.cjs', 'scripts/checks/run.cjs', 'tests/host-audit/runner.js',
    'patches/runjs-4.1.0/bridge-host/renderer.cjs']) {
    assert.ok(javascriptFiles(ROOT).includes(file.split('/').join(path.sep)));
  }
});

test('Python selection supports explicit executables and platform defaults', () => {
  assert.equal(commands('python', { env: {}, platform: 'linux' })[0][0], 'python3');
  assert.equal(commands('python', { env: {}, platform: 'win32' })[0][0], 'python');
  assert.equal(commands('python', { env: { PYTHON: 'custom python' } })[0][0], 'custom python');
});

test('runner derives checkout root and passes arguments without a shell', () => {
  const seen = [];
  const env = { PYTHON: 'custom python' };
  assert.equal(run('python', { env, execute(...args) { seen.push(args); return { status: 0 }; } }), 0);
  assert.equal(seen[0][0], 'custom python');
  assert.deepEqual(seen[0][2], { cwd: ROOT, env, stdio: 'inherit', shell: false });
});

test('failure stops all later checks and preserves the nonzero exit code', () => {
  let count = 0;
  assert.equal(run('all', { execute() { count++; return { status: 7 }; } }), 7);
  assert.equal(count, 1);
});

test('missing executables, termination and unknown task names fail clearly', () => {
  const messages = [];
  assert.equal(run('python', { execute: () => ({ error: new Error('not found') }), report: value => messages.push(value) }), 1);
  assert.ok(messages.some(message => message.includes('Set PYTHON')));
  assert.equal(run('python', { execute: () => ({ status: null, signal: 'SIGTERM' }) }), 1);
  assert.equal(run('unknown', { execute: () => assert.fail(), report: value => messages.push(value) }), 1);
  assert.ok(messages.at(-1).includes('Unknown check'));
});

test('source discovery ignores generated folders and refuses an empty test suite', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-checks-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const folder of ['scripts', 'tests', 'scripts/node_modules', 'scripts/__pycache__']) {
    fs.mkdirSync(path.join(directory, folder), { recursive: true });
  }
  for (const file of ['scripts/a.cjs', 'scripts/z.mjs', 'scripts/node_modules/ignored.js', 'scripts/__pycache__/ignored.js']) {
    fs.writeFileSync(path.join(directory, file), '');
  }
  assert.deepEqual(javascriptFiles(directory, ['scripts']), [path.join('scripts', 'a.cjs'), path.join('scripts', 'z.mjs')]);
  assert.throws(() => nodeTestFiles(directory), /No Node test files/);
});

test('package is a private, dependency-free developer command surface', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.deepEqual(pkg.scripts, {
    test: 'node scripts/check.cjs all', 'test:python': 'node scripts/check.cjs python',
    'test:node': 'node scripts/check.cjs node', 'check:syntax': 'node scripts/check.cjs syntax',
  });
});

/* Orchestrate checks with inherited output and fail-fast exit codes. */
'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { javascriptFiles, nodeTestFiles } = require('./files.cjs');
const ROOT = path.resolve(__dirname, '../..');

function commands(task, { root = ROOT, env = process.env, platform = process.platform } = {}) {
  const python = env.PYTHON || (platform === 'win32' ? 'python' : 'python3');
  if (task === 'python') return [[python, ['-m', 'unittest', 'discover', '-s', 'tests', '-v']]];
  if (task === 'node') return [[process.execPath, ['--test', ...nodeTestFiles(root)]]];
  if (task === 'syntax') return javascriptFiles(root).map(file => [process.execPath, ['--check', file]]);
  if (task === 'all') return ['python', 'node', 'syntax'].flatMap(name => commands(name, { root, env, platform }));
  throw new Error('Unknown check. Choose all, python, node or syntax.');
}

function run(task, { root = ROOT, env = process.env, platform = process.platform,
  execute = spawnSync, report = message => console.error(message) } = {}) {
  try {
    for (const [command, args] of commands(task, { root, env, platform })) {
      const result = execute(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
      if (result.error) {
        report(`Unable to run ${command}: ${result.error.message}`);
        report('Checks require Node.js 22+ and Python 3.10+. Set PYTHON to select another Python executable.');
        return 1;
      }
      if (result.status !== 0) return result.status || 1;
    }
    return 0;
  } catch (error) {
    report(error.message);
    return 1;
  }
}

module.exports = { ROOT, commands, run };

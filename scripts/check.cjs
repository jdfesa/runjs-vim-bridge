/* Standard local/CI entry point; no app installation or external dependencies. */
'use strict';

const { run } = require('./checks/run.cjs');

if (process.argv.length > 3) {
  console.error('Usage: node scripts/check.cjs [all|python|node|syntax]');
  process.exitCode = 2;
} else {
  process.exitCode = run(process.argv[2] || 'all');
}

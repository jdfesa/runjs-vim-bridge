'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../patches/runjs-4.1.0/runjs-bridge-main.cjs'), 'utf8');

for (const appearance of ['native', 'kitty']) {
  for (const hostCommands of [false, true]) {
    test(`bootstrap delegates original startup: ${appearance}, host=${hostCommands}`, () => {
      const calls = [];
      vm.runInNewContext(source, { __dirname: 'synthetic-app', require(name) {
        if (name === './package.json') return { runjsVimBridge: { appearance, hostCommands } };
        if (name === './bridge-host/main.cjs') return { install() { calls.push('host'); return { finishStartup() { calls.push('restore'); } }; } };
        if (name === 'electron') return {};
        calls.push(name);
      } });
      assert.deepEqual(calls, [...(appearance === 'kitty' ? ['./runjs-appearance-main.cjs'] : []),
        ...(hostCommands ? ['host'] : []), './entry-bundle.js', ...(hostCommands ? ['restore'] : [])]);
    });
  }
}
test('startup interception is restored even when original startup throws', () => {
  let restored = false;
  assert.throws(() => vm.runInNewContext(source, { __dirname: '.', require(name) {
    if (name === './package.json') return { runjsVimBridge: { hostCommands: true } };
    if (name === 'electron') return {};
    if (name === './bridge-host/main.cjs') return { install: () => ({ finishStartup() { restored = true; } }) };
    throw new Error('synthetic startup failure');
  } }), /startup failure/);
  assert.equal(restored, true);
});

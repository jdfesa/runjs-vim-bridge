/* Validate our showcase exercise without launching RunJS or accessing app data. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../examples/readme-demo.js'), 'utf8');

function runDemo(extra = '') {
  const output = [];
  const context = {
    console: {
      table: value => output.push(['table', value]),
      log: (...values) => output.push(['log', ...values]),
      assert: (condition, message) => assert.ok(condition, message),
    },
  };
  const result = vm.runInNewContext(`${source}\n${extra}`, context, { timeout: 1000 });
  return { output, result: JSON.parse(JSON.stringify(result)) };
}

test('README exercise produces the documented summary and console calls', () => {
  const { output, result } = runDemo('({ lessons, summary })');
  assert.equal(result.lessons.length, 3);
  assert.deepEqual(result.summary, { completed: 1, remaining: 2, minutes: 35 });
  assert.equal(output[0][0], 'table');
  assert.equal(output[1][1], 'Practice summary');
  assert.equal(output[2][1], 'Ready to practice: motions, text objects, repeat and undo.');
});

test('demo summary handles an empty exercise and leaves its input unchanged', () => {
  const { result } = runDemo(`
    const before = JSON.stringify(lessons);
    summarizeLessons(lessons);
    ({ empty: summarizeLessons([]), unchanged: before === JSON.stringify(lessons) });
  `);
  assert.deepEqual(result, { empty: { completed: 0, remaining: 0, minutes: 0 }, unchanged: true });
});

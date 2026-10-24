/* Explicit, sorted source discovery without shell globs or generated app files. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function javascriptFiles(root, folders = ['patches', 'scripts', 'tests']) {
  const files = [];
  function visit(relative) {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory() && !['node_modules', '__pycache__'].includes(entry.name)) visit(name);
      else if (entry.isFile() && /\.(?:js|cjs|mjs)$/.test(entry.name)) files.push(name);
    }
  }
  folders.forEach(visit);
  return files.sort();
}

function nodeTestFiles(root) {
  const files = fs.readdirSync(path.join(root, 'tests'))
    .filter(name => /^test_.*\.cjs$/.test(name))
    .sort().map(name => path.join('tests', name));
  if (!files.length) throw new Error('No Node test files were found.');
  return files;
}

module.exports = { javascriptFiles, nodeTestFiles };

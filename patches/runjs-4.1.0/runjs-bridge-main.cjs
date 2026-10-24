/* Additive bootstrap: optional appearance and native host adapters, then RunJS. */
'use strict';

const config = require('./package.json').runjsVimBridge || {};
if (config.appearance === 'kitty') require('./runjs-appearance-main.cjs');
const bridge = config.hostCommands
  ? require('./bridge-host/main.cjs').install(require('electron'), __dirname)
  : null;
try { require('./entry-bundle.js'); }
finally { bridge?.finishStartup(); }

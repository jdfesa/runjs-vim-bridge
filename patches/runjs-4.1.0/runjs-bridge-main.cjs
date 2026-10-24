/* Additive bootstrap: optional appearance and native host adapters, then RunJS. */
'use strict';

const config = require('./package.json').runjsVimBridge || {};
// Accept the legacy profile ID when reading an earlier bridge configuration.
if (['mint', 'kitty'].includes(config.appearance)) require('./runjs-appearance-main.cjs');
const bridge = config.hostCommands
  ? require('./bridge-host/main.cjs').install(require('electron'), __dirname)
  : null;
try { require('./entry-bundle.js'); }
finally { bridge?.finishStartup(); }

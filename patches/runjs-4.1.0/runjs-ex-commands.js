/* Version-specific bridge entry, separate from the mode indicator. */
(() => {
  'use strict';
  function start() {
    try {
      require(require('node:path').join(__dirname, 'bridge-host/renderer.cjs')).start();
    } catch {
      const status = document.createElement('div');
      status.setAttribute('role', 'alert');
      status.textContent = 'Vim save/quit adapter unavailable. Use native RunJS Save and Close.';
      document.body.append(status);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

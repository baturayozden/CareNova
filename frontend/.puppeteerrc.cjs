const { join } = require('path');

/**
 * Keep Chromium inside node_modules so Vercel's dependency cache preserves it
 * between builds. The default (~/.cache/puppeteer) is not cached, which would
 * mean re-downloading ~170MB on every deploy.
 */
module.exports = { cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer') };

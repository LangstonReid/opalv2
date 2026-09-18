#!/usr/bin/env node
/* Renders the five quarry rocks to transparent PNG sprites for the no-WebGL fallback.
   It drives the real page in headless Chrome, so sprites share the exact tint, lights and framing of the live stones.
   Setup:  npm i puppeteer-core      Run:  node scripts/render-sprites.js
   Set CHROME_PATH if Chrome is not in the default macOS location. */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'assets', 'sprites');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=default'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() => window.__opalCore && window.__opalCore.stones && window.__opalCore.stones.ready(), { timeout: 60000 });
    fs.mkdirSync(OUT, { recursive: true });
    for (let i = 1; i <= 5; i++) {
      const url = await page.evaluate(n => window.__opalCore.stones.sprite(n, 512), i);
      if (!url) throw new Error('rock ' + i + ' did not render');
      const file = path.join(OUT, `rock_0${i}.png`); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', path.relative(ROOT, file), fs.statSync(file).size, 'bytes');
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });

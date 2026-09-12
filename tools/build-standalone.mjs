/* Bundles the whole game into one self-contained HTML file.
 *
 *   node tools/build-standalone.mjs
 *   -> dist/stickman-tower.html
 *
 * The output has no external requests at all: CSS, every script and the icon
 * are inlined, so you can download that single file and double-click it. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(root, p), 'utf8');

const html = read('index.html');
const css = read('styles.css');

const scripts = html.match(/<script src="(src\/[^"]+)"><\/script>/g) || [];
const order = scripts.map((tag) => tag.match(/src="([^"]+)"/)[1]);
if (!order.length) throw new Error('no source scripts found in index.html');

const icon = readFileSync(join(root, 'icons/icon-192.png')).toString('base64');
const iconUri = 'data:image/png;base64,' + icon;

let out = html;

// Inline the stylesheet.
out = out.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');

// Drop the manifest + icon links, inline the icon instead.
out = out.replace('<link rel="manifest" href="manifest.webmanifest">', '');
out = out.replace('<link rel="apple-touch-icon" href="icons/icon-180.png">', '<link rel="apple-touch-icon" href="' + iconUri + '">');
out = out.replace('<link rel="icon" href="icons/icon-192.png">', '<link rel="icon" href="' + iconUri + '">');

// Inline every module, in the same order index.html loads them.
const bundle = order.map((p) => '/* ===== ' + p + ' ===== */\n' + read(p)).join('\n');
out = out.replace(scripts.join('\n'), '<script>\n' + bundle + '\n</script>');
out = out.replace(/\n<script src="src\/[^"]+"><\/script>/g, '');

// No service worker in the single-file build (file:// can't register one).
out = out.replace(/\s*if \('serviceWorker' in navigator[\s\S]*?\n    }\n/, '\n');

mkdirSync(join(root, 'dist'), { recursive: true });
const dest = join(root, 'dist/stickman-tower.html');
writeFileSync(dest, out);

const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log('built dist/stickman-tower.html  (' + kb + ' KB, ' + order.length + ' modules inlined)');

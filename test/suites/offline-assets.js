/* Fresh installs need every technique illustration before going offline. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const imageDir = path.join(root, 'img');
const installed = [];
let onInstall;
let activations = 0;
const self = {
  addEventListener(name, handler) { if (name === 'install') onInstall = handler; },
  skipWaiting() { activations++; return Promise.resolve(); }
};
const caches = { open: async () => ({ addAll: async files => installed.push(...files) }) };

(async () => {
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), { self, caches });
  let installation;
  onInstall({ waitUntil(promise) { installation = promise; } });
  await installation;
  const expected = fs.readdirSync(imageDir).filter(name => name.endsWith('.jpg')).map(name => './img/' + name);
  const missing = expected.filter(name => !installed.includes(name));
  const repeated = installed.filter((name, i) => installed.indexOf(name) !== i);
  const absent = installed.filter(name => name !== './' && !fs.existsSync(path.join(root, name)));
  if (missing.length || repeated.length || absent.length) {
    console.log('  ✗ офлайн-кэш: пропущено ' + missing.length + ', повторено ' + repeated.length +
      ', отсутствует ' + absent.length + '; примеры: ' + [...missing, ...repeated, ...absent].slice(0, 5).join(', '));
    process.exit(1);
  }
  console.log('  ✓ все ' + expected.length + ' изображений доступны после установки офлайн-кэша');

  caches.open = async () => ({ addAll: async () => { throw new Error('network failure'); } });
  let failedInstallation;
  onInstall({ waitUntil(promise) { failedInstallation = promise; } });
  let rejected = false;
  try { await failedInstallation; } catch (_) { rejected = true; }
  if (!rejected || activations !== 1) {
    console.log('  ✗ неполный кэш активируется после ошибки загрузки');
    process.exit(1);
  }
  console.log('  ✓ ошибка загрузки не активирует неполный офлайн-кэш');
})().catch(err => { console.error('FATAL', err); process.exit(1); });

/* Общая обвязка для проверок: где лежит приложение и чем его открывать.
   Раньше и то и другое было прибито гвоздями к одной машине. */
const fs = require('fs');
const path = require('path');

// Приложение — index.html рядом с этой папкой. Открываем файлом, без сервера:
// всё приложение в одном файле, сеть ему не нужна.
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

/* Chromium ищем по порядку:
   1. переменная CHROME — если браузер лежит где-то своём;
   2. папка PLAYWRIGHT_BROWSERS_PATH или /opt/pw-browsers (так устроены
      контейнеры Claude Code: браузер уже скачан, ставить нечего);
   3. то, что скачал себе сам playwright-core в ~/.cache/ms-playwright;
   4. системный chromium или chrome. */
function findChrome() {
  const tries = [];
  if (process.env.CHROME) tries.push(process.env.CHROME);

  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers',
    path.join(process.env.HOME || '', '.cache', 'ms-playwright')].filter(Boolean);
  roots.forEach(root => {
    let names = [];
    try { names = fs.readdirSync(root); } catch (e) { return; }
    // полный chromium предпочтительнее headless_shell: проверки меряют вёрстку
    const rank = n => (n.startsWith('chromium-') ? 0 : 1);
    names.filter(n => n.startsWith('chromium'))
      .sort((a, b) => rank(a) - rank(b) || b.localeCompare(a)).forEach(n => {
      tries.push(path.join(root, n, 'chrome-linux', 'chrome'));
      tries.push(path.join(root, n, 'chrome-linux', 'headless_shell'));
      tries.push(path.join(root, n, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
    });
  });

  tries.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

  for (const p of tries) { try { if (fs.statSync(p).isFile()) return p; } catch (e) { /* ищем дальше */ } }
  return null;
}

const EXEC = findChrome();
if (!EXEC) {
  console.error('Не нашёл Chromium. Укажи путь: CHROME=/путь/к/chrome node test/run.js');
  process.exit(2);
}

// как запускать: без песочницы — в контейнерах иначе не стартует
const LAUNCH = { executablePath: EXEC, args: ['--no-sandbox'] };

module.exports = { APP, EXEC, LAUNCH };

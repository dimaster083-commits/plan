#!/usr/bin/env node
/* Прогон всех проверок. Каждый набор — отдельный процесс: один упавший
   браузер не уносит с собой остальные.

   node test/run.js              — всё, кроме самопроверок
   node test/run.js --self       — ещё и самопроверки
   node test/run.js setka ves    — только названные наборы
   node test/run.js -j 1         — по одному (по умолчанию 3 разом)
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('./env');                       // проверяет браузер и падает с понятным текстом

const DIR = path.join(__dirname, 'suites');
const OUT = path.join(__dirname, 'out');

// Наборы, зависящие от времени и от снятых с экрана пикселей, идут в конце
// и по одному: под нагрузкой таймеры врут, а снимок успевает опередить
// перерисовку — проверки начинают мигать без вины приложения.
const SERIAL = ['tmr', 'tmr2'];
// Самопроверки ломают уже исправленное и убеждаются, что сторож это видит.
// По умолчанию не гоняем: они намеренно воспроизводят старые ошибки.
const SELF = ['selftest', 'selftest3', 'selftest4'];

const argv = process.argv.slice(2);
let jobs = 3, withSelf = false;
const only = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--self') withSelf = true;
  else if (a === '-j' || a === '--jobs') jobs = Math.max(1, +argv[++i] || 1);
  else only.push(a.replace(/\.js$/, ''));
}

const all = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
let list = only.length ? only : all.filter(t => !SELF.includes(t) || withSelf);
const missing = list.filter(t => !all.includes(t));
if (missing.length) { console.error('нет таких наборов: ' + missing.join(', ')); process.exit(2); }

const par = list.filter(t => !SERIAL.includes(t));
const ser = list.filter(t => SERIAL.includes(t));

fs.mkdirSync(OUT, { recursive: true });

const results = [];
function one(name) {
  return new Promise(res => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join(DIR, name + '.js')], { cwd: DIR });
    let buf = '';
    p.stdout.on('data', d => { buf += d; });
    p.stderr.on('data', d => { buf += d; });
    p.on('close', code => {
      const bad = (buf.match(/✗/g) || []).length;
      const good = (buf.match(/✓/g) || []).length;
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      results.push({ name, code, bad, good, secs, out: buf });
      const mark = (code === 0 && bad === 0) ? '✓' : '✗';
      // старые наборы печатают свой текст и сигналят только кодом выхода
      const cnt = good ? String(good).padStart(3) + ' проверок' : '  —        ';
      console.log(`${mark} ${name.padEnd(12)} ${cnt}  ${secs}с` +
        (bad ? `  ПРОБЛЕМ: ${bad}` : '') + (code !== 0 && !bad ? `  код выхода ${code}` : ''));
      if (bad || code !== 0) buf.split('\n').filter(l => /✗|Error|error|FATAL|^\s{4,}\S/.test(l)).slice(0, 18)
        .forEach(l => console.log('      ' + l.trim()));
      res();
    });
  });
}

(async () => {
  const t0 = Date.now();
  const queue = par.slice();
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) await one(queue.shift());
  }));
  for (const t of ser) await one(t);

  const failed = results.filter(r => r.code !== 0 || r.bad > 0);
  const checks = results.reduce((a, r) => a + r.good, 0);
  console.log('\n' + '-'.repeat(46));
  console.log(`наборов: ${results.length}, проверок: ${checks}, ` +
    `за ${((Date.now() - t0) / 1000).toFixed(0)}с`);
  if (failed.length) {
    console.log('С ПРОБЛЕМАМИ: ' + failed.map(r => r.name).join(', '));
    process.exit(1);
  }
  console.log('всё зелёное');
})();

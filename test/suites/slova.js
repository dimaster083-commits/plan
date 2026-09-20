/* Словарь тем не должен протекать: в «Клейме» не место «охотнику»,
   «квесту» и «рангу», а в «Системе» — «походу» и «ступени».
   Проверяется весь видимый текст всех экранов и всех шторок. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
const SHEETS = [
  ['разбор', '()=>openAnalysis()'],
  ['прогрессия', '()=>openProgression()'],
  ['история дня', "()=>{const ds=Object.keys(S.rec).filter(d=>S.rec[d].wo).sort().reverse()[0];openDayReport(ds);}"],
  ['история упражнения', '()=>openHistory(dayOf(today()).ex[0].n)'],
  ['техника', '()=>openHow(Object.keys(EXDB)[0])'],
  ['итоги месяца', "()=>monthReport(today().slice(0,7))"],
  ['итоги тренировки', "()=>{const ds=Object.keys(S.rec).filter(d=>S.rec[d].wo).sort().reverse()[0];workoutSummary(ds);}"],
  ['рацион', '()=>openRation()'],
  ['выбор упражнения', '()=>openExPicker()'],
];
// слова, которые принадлежат только одной теме
const ONLY = {
  sl:  [/поход/i, /ступен/i, /клейм/i, /летопис/i, /припас/i, /круг\b/i, /новобранец/i, /наёмник/i, /чёрный мечник/i],
  ber: [/охотник/i, /квест/i, /\bранг/i, /\bXP\b/, /снаряжени/i, /цикл/i, /игрок/i, /подземель/i]
};
let fails = 0;
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(SEED);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on'); });
  for (const skin of ['sl','ber']) {
    await p.evaluate(s => applyTheme(s), skin);
    const bad = ONLY[skin];
    const hits = [];
    const look = (where, txt) => bad.forEach(rx => { const m = txt.match(rx);
      if (m) { const i = txt.search(rx);
        hits.push(where + ': «' + txt.slice(Math.max(0,i-30), i+40).replace(/\s+/g,' ').trim() + '»'); } });
    // первый экран и заставка повышения — их тоже видят, а проверял их никто
    const st = await p.evaluate(() => { openSetup();
      const t = document.getElementById('setup').innerText;
      document.getElementById('setup').classList.remove('on'); S.setup=1; return t; });
    look(skin + '/первичная настройка', st);
    const lv = await p.evaluate(() => { levelUp(7);
      const t = document.getElementById('lvup').innerText;
      document.getElementById('lvup').classList.remove('on'); return t; });
    look(skin + '/повышение уровня', lv);
    for (const t of ['wo','prog','food','photo']) {
      const txt = await p.evaluate(tt => { tab=tt; exOpen=null; sel=today(); render(); return document.body.innerText; }, t);
      look(skin + '/' + t, txt);
    }
    for (const sec of ['log','load','goal','prog']) {
      const txt = await p.evaluate(x => { tab='prog'; pSec=x; render(); return document.body.innerText; }, sec);
      look(skin + '/прогресс·' + sec, txt);
    }
    for (const [name, fn] of SHEETS) {
      const txt = await p.evaluate(f => { try{sheetClose()}catch(e){}
        tab='wo'; sel=today(); exOpen=null; render(); (0,eval)('('+f+')()');
        return document.getElementById('sh').innerText; }, fn);
      await p.waitForTimeout(120);
      look(skin + '/' + name, txt);   // настройки исключены: там нарочно перечислены обе темы
    }
    const uniq = [...new Set(hits)];
    if (uniq.length) { fails += uniq.length; console.log('  ✗ ' + skin + ': чужие слова'); uniq.forEach(h=>console.log('      '+h)); }
    else console.log('  ✓ ' + skin + ': чужих слов нет');
  }
  await b.close();
  console.log(fails ? 'находок: ' + fails : 'словари тем не протекают');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });

/* Прогон по пунктам: каждый пункт — то, что просил хозяин приложения.
   Проверяется в обеих темах, на настоящем DOM, а не по коду. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const CH = LAUNCH.executablePath;
let fails = 0;
const ok  = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);

const SEED = () => {
  const iso = d => { const z=new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
  const back = n => { const d=new Date(); d.setDate(d.getDate()-n); return iso(d); };
  S.setup=1; S.bw='72'; S.bw0='70'; S.goal='95'; S.height=177; S.age=30;
  const d0 = dayOf(iso(new Date()));
  if (d0.t==='rest') { const s2=S.days.find(x=>(x.ex||[]).length); d0.t=s2.t; d0.s=s2.s; d0.ex=s2.ex.map(e=>({...e})); }
  [2,4,6,9,11,13,16,18,20,23,26,30,40].forEach(n => {
    const ds=back(n), d=dayOf(ds), r=recRW(ds);
    if (d.t!=='rest') { r.wo=1; r.t0=Date.now()-4.2e6; r.t1=Date.now()-3.6e6;
      (d.ex||[]).forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],vol:24*(+e.w||0),xp:12}; }); }
    r.bw = String(70+n*0.06);
    r.ml = [{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];
  });
  save(); recomputeStats(1); render();
};
const txt = async (p, t) => p.evaluate(tt => { tab=tt; exOpen=null; render(); return document.body.innerText; }, t);

(async () => {
  const b = await chromium.launch({ executablePath: CH, args:['--no-sandbox'] });
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  const errs=[]; p.on('pageerror', e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(SEED);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on'); });

  for (const skin of ['sl','ber']) {
    console.log('\n===== ' + (skin==='sl'?'СИСТЕМА':'КЛЕЙМО') + ' =====');
    await p.evaluate(s => applyTheme(s), skin);

    // 1. четыре вкладки
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.tabbar .tab')].map(t=>t.innerText.trim()));
    chk(tabs.length===4, '1. внизу ровно четыре вкладки', tabs.join(' · '));

    // 2. выпиленное не вернулось
    let all='';
    for (const t of ['wo','prog','food','photo']) all += '\n' + await txt(p, t);
    const junk = ['ПРАВИЛА','ЦЕЛЬ И ТЕМП','СКОПИРОВАТЬ ДЕНЬ','СБОРКА ШТАНГИ','ЛЁГКАЯ','РАЗМИНКА','ТЕХНИКА','НАКОПЛЕНИЕ','ЗАМЕТКА К ДНЮ']
      .filter(w => all.toUpperCase().includes(w));
    chk(!junk.length, '2. убранные разделы не вернулись', junk.length?junk.join(', '):'ни одного');

    // 3. «ЦИКЛ» вместо «НАКОПЛЕНИЕ»
    chk(all.toUpperCase().includes(skin==='sl'?'ЦИКЛ':'КРУГ'), '3. счётчик недель назван по-своему в каждой теме');

    // 4. плечи — своя группа, дельты разведены
    const del = await p.evaluate(() => {
      const names = Object.keys(EXDB).filter(n => EXDB[n][1] === 'Плечи');
      const chest = Object.keys(EXDB).filter(n => EXDB[n][1] === 'Грудь');
      return { n: names.length,
               mahi: (EXDB['Махи в стороны']||[])[1] || 'нет такого',
               jim:  (EXDB['Жим гантелей сидя']||[])[1] || 'нет такого',
               vchest: names.filter(x => chest.includes(x)).length };
    });
    chk(del.n >= 3 && del.mahi === 'Плечи' && del.vchest === 0,
        '4. плечи — отдельная группа, махи не в груди',
        'упражнений на плечи: ' + del.n + ' · махи → ' + del.mahi + ' · жим сидя → ' + del.jim);

    // 5. прошедший день открывается разбором
    const rep = await p.evaluate(() => {
      const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
      const ds=Object.keys(S.rec).filter(d=>S.rec[d].wo).sort().reverse()[0];
      calView='year'; tab='prog'; render();
      openDayReport(ds);
      const t=document.getElementById('sh').innerText;
      sheetClose();
      return { ds, has: /ПОДХОД|повтор|тонн|кг/i.test(t), len: t.length };
    });
    chk(rep.has, '5. любой прошедший день открывается разбором', rep.ds + ', ' + rep.len + ' знаков');

    // 6. объём, вес и тоннаж — в одном месте
    const prog = await txt(p,'prog');
    chk(/тонн/i.test(prog) && /вес/i.test(prog), '6. в «Прогрессе» и тоннаж, и вес');

    // 7. рабочие веса внутри «Прогресса»
    const sec = await p.evaluate(() => [...document.querySelectorAll('[data-sec]')].map(x=>x.dataset.sec));
    chk(sec.includes('prog'), '7. рабочие веса — раздел «Прогресса»', sec.join(' · '));

    // 8. автоподъём рабочего веса
    const bump = await p.evaluate(() => {
      const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
      const ds=iso(new Date()), d=dayOf(ds), e=d.ex[0];
      const was=+e.w; const log=[];
      bumpWorking(e.n, was+5, log);
      const after=(S.days.flatMap(x=>x.ex||[]).filter(x=>x.n===e.n).map(x=>+x.w));
      unbumpWorking(log);
      const back=(S.days.flatMap(x=>x.ex||[]).filter(x=>x.n===e.n).map(x=>+x.w));
      return { was, after, back };
    });
    chk(bump.after.every(w=>w>=bump.was+5) && bump.back.every(w=>w===bump.was),
        '8. поднятый вес расходится по всем дням и откатывается', JSON.stringify(bump));

    // 9. в «Фото» есть история
    const ph = await txt(p,'photo');
    chk(/ИСТОРИ/i.test(ph), '9. в «Фото» есть история снимков');

    // 10. добавки — в «Еде», не в «Зале»
    const food = await txt(p,'food'), gym = await txt(p,'wo');
    const suppWord = skin==='sl' ? 'СНАРЯЖЕНИЕ' : 'ПРИПАСЫ';
    chk(food.toUpperCase().includes(suppWord) && !gym.toUpperCase().includes(suppWord),
        '10. добавки стоят в «Еде», в «Зале» их нет');

    // 11. журнал: год → месяц
    const cal2 = await p.evaluate(() => {
      tab='prog'; calView='year'; cal(); render();
      const months=document.querySelectorAll('#cyear [data-mo]').length;
      document.querySelector('#cyear [data-mo]').click();
      const days=document.querySelectorAll('#cgrid [data-cd]').length;
      const v=calView; document.getElementById('calBack').click();
      return { months, days, v, back: calView };
    });
    chk(cal2.months===12 && cal2.days>=28 && cal2.v==='month' && cal2.back==='year',
        '11. журнал открывается годом и проваливается в месяц', JSON.stringify(cal2));

    // 12. еда живёт на дате, а не на дне недели
    const meal = await p.evaluate(() => {
      const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
      const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
      const a=back(7), bd=back(14);
      const ma=mealsRW(a); ma[0].items.push({p:'Проверочный продукт',g:'100'}); save();
      return { a: JSON.stringify(mealsOf(a)).includes('Проверочный'),
               b: JSON.stringify(mealsOf(bd)).includes('Проверочный') };
    });
    chk(meal.a && !meal.b, '12. еда принадлежит дате, а не дню недели', JSON.stringify(meal));

    // 13. ничего не выходит за экран
    const wide = await p.evaluate(async () => {
      const out=[];
      for (const t of ['wo','prog','food','photo']) {
        tab=t; render(); await new Promise(r=>setTimeout(r,120));
        if (document.documentElement.scrollWidth > window.innerWidth+1)
          out.push(t+': '+document.documentElement.scrollWidth);
      }
      return out;
    });
    chk(!wide.length, '13. по горизонтали ничего не вылезает', wide.join(', ')||'390 из 390');

    // 14. уровень и ступень не расходятся
    // номер уровня нигде не должен «плавать»: в «Системе» он приколочен
    // к центру знака, в «Клейме» стоит в одной строке со ступенью
    const head = await p.evaluate(() => {
      // шапка статуса живёт на «Зале» и «Прогрессе» и прячется в раскрытом упражнении
      tab='wo'; sel=today(); exOpen=null; render();
      const vis = e => !!(e && e.getClientRects().length);
      const lv = document.querySelector('.st8lv b'), lv2 = document.getElementById('st8n2'),
            rk = document.getElementById('st8rank'), hex = document.querySelector('.st8lv');
      const mid = e => { const r = e.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/2]; };
      if (!vis(rk)) return { err:'ступень не видна' };
      if (vis(lv2)) {
        if (vis(lv)) return { err:'номер показан в двух местах сразу' };
        const a = mid(lv2), b2 = mid(rk);
        return { mode:'строка', dy: Math.abs(a[1]-b2[1]),
                 row: lv2.parentElement.parentElement === rk.parentElement,
                 num: lv2.textContent, rank: rk.textContent };
      }
      if (!vis(lv)) return { err:'номера нет вовсе' };
      const a = mid(lv), c = mid(hex);
      return { mode:'знак', dx: Math.abs(a[0]-c[0]), dy: Math.abs(a[1]-c[1]),
               num: lv.textContent, rank: rk.textContent };
    });
    chk(!head.err && (head.mode==='знак' ? (head.dx<2 && head.dy<2) : (head.dy<6 && head.row)),
        '14. номер уровня прибит намертво, не плавает',
        head.err || (head.mode + ' · сдвиг ' + (head.dx!==undefined?head.dx.toFixed(1)+'/':'') + head.dy.toFixed(1) + ' px · ' + head.num + ' / ' + head.rank.trim()));

    // 15. кнопка «закрыть подход» не белая с неоном
    const finc = await p.evaluate(() => {
      const d=dayOf(today()); exOpen=0; tab='wo'; sel=today(); render();
      const f=document.querySelector('.fin'); if(!f) return null;
      const c=getComputedStyle(f); return { bg:c.backgroundColor, color:c.color, r:c.borderRadius, clip:c.clipPath };
    });
    chk(finc && finc.bg!=='rgb(255, 255, 255)' && finc.clip==='none',
        '15. главная кнопка не белая и без среза угла', JSON.stringify(finc));
  }

    // 19. у каждого упражнения есть чем заменить
    const alt = await p.evaluate(() => {
      const none = Object.keys(EXDB).filter(n => altsOf(n).length === 0);
      return { total: Object.keys(EXDB).length, none: none.length };
    });
    chk(alt.none === 0, '19. у каждого упражнения есть аналоги',
        'упражнений ' + alt.total + ', без аналогов ' + alt.none);

    // 20. вес сейчас — одна рамка с крупным числом, и его можно менять
    const wb = await p.evaluate(() => {
      tab = 'prog'; pSec = 'goal'; render();
      const box = document.querySelector('.wbox'), inp = document.getElementById('bw');
      if (!box || !inp) return { err: 'блока веса нет' };
      const fs = parseFloat(getComputedStyle(inp).fontSize);
      const inside = box.contains(inp) && box.contains(document.querySelector('.wdir'));
      inp.value = '77,5'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.blur();
      return { fs, inside, saved: String(S.bw), ro: inp.readOnly || inp.disabled };
    });
    chk(!wb.err && wb.inside && wb.fs >= 30 && !wb.ro && wb.saved.replace('.', ',') === '77,5',
        '20. вес сейчас в одной рамке, крупный и правится',
        wb.err || (Math.round(wb.fs) + 'px, записалось ' + wb.saved));

    // 21. выбор набор/похудение есть и в настройке, и в цели
    const dirs = await p.evaluate(() => {
      const a1 = document.querySelectorAll('#wdir [data-dir]').length;
      openSetup();
      const a2 = document.querySelectorAll('#anDir [data-dir]').length;
      document.getElementById('setup').classList.remove('on');
      return { goal: a1, setup: a2 };
    });
    chk(dirs.goal === 2 && dirs.setup === 2, '21. набор и похудение выбираются в обоих местах',
        JSON.stringify(dirs));

    // 22. диаграмма по пяти группам с числами
    const rad = await p.evaluate(() => {
      tab = 'prog'; pSec = 'load'; render();
      return { axes: document.querySelectorAll('#rad .rlab').length,
               nums: document.querySelectorAll('#rad .rnum').length,
               groups: GROUPS.length,
               names: [...document.querySelectorAll('#rad .rlab')].map(t => t.textContent).join(' ') };
    });
    chk(rad.axes === rad.groups && rad.nums === rad.groups,
        '22. диаграмма нагрузки по всем группам, включая пресс',
        rad.names + ' (групп: ' + rad.groups + ')');

    // 23. килограммы пишутся одним знаком после запятой
    chk(await p.evaluate(() => [12.125, 35.625, 70.04, 2.449]
      .every(v => (kg(v).split(',')[1] || '').length <= 1 && kg(v).indexOf('.') < 0)),
      '23. вес пишется одним знаком через запятую');

  // 16. переключение темы посреди работы
  console.log('\n===== ПЕРЕКЛЮЧЕНИЕ ТЕМЫ =====');
  await p.evaluate(() => { applyTheme('sl'); tab='wo'; sel=today(); exOpen=0; render(); });
  await p.waitForTimeout(250);
  const mid = await p.evaluate(() => {
    const inp = document.querySelector('.ex [data-rs="0"]');
    inp.focus(); inp.value='7'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    const before = { v: inp.value, open: exOpen, tab, sel, json: JSON.stringify(S) };
    applyTheme('ber');
    const inp2 = document.querySelector('.ex [data-rs="0"]');
    return { before, after: { v: inp2 ? inp2.value : null, open: exOpen, tab, sel, json: JSON.stringify(S) },
             focus: document.activeElement === inp2, skin: document.documentElement.dataset.skin };
  });
  chk(mid.after.v===mid.before.v && mid.after.json===mid.before.json && mid.after.open===mid.before.open && mid.skin==='ber',
      '16. смена темы посреди ввода ничего не сбрасывает', JSON.stringify({v:mid.after.v, open:mid.after.open, skin:mid.skin, focus:mid.focus}));

  // 17. тема выбирается из шестерёнки и держится после перезагрузки
  // раскрытое упражнение намеренно убирает шапку дня вместе с шестерёнкой
  await p.evaluate(() => { sheetClose(); tab='wo'; exOpen=null; render(); });
  await p.waitForTimeout(200);
  await p.click('#gear'); await p.waitForTimeout(300);
  const picks = await p.$$('[data-skin-set]');
  chk(picks.length===2, '17. в настройках два оформления', picks.length+' шт');
  await p.click('[data-skin-set="sl"]'); await p.waitForTimeout(250);
  const cur = await p.evaluate(() => document.documentElement.dataset.skin);
  await p.reload(); await p.waitForTimeout(1300);
  const after = await p.evaluate(() => document.documentElement.dataset.skin);
  chk(cur==='sl' && after==='sl', '18. выбранная тема переживает перезагрузку', cur+' → '+after);

  console.log('\nошибки JS: ' + (errs.length ? errs.join(' | ') : 'нет'));
  console.log('провалено пунктов: ' + fails);
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });

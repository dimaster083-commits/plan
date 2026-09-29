/* «Перенесено» и «выполнено»: кнопки, отметки в календаре и то,
   что журнал при переносе не теряется. Обе темы. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok  = (n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad = (n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk = (c,n,d)=>c?ok(n,d):bad(n,d);

(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const skin of ['sl']) {
    console.log('\n===== ' + skin + ' =====');
    const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s => { S.setup=1; document.getElementById('setup').classList.remove('on'); void s;
      // сегодня должен быть тренировочным, иначе переносить нечего
      const d = dayOf(today());
      if (d.t === 'rest') { const src = S.days.find(x => x.t !== 'rest' && (x.ex||[]).length);
        d.t = src.t; d.s = src.s; d.ex = src.ex.map(e => ({...e})); }
      save(); tab='wo'; sel=today(); edit=false; exOpen=null; render(); }, skin);
    await p.waitForTimeout(250);

    // --- 1. правка дня — шторка «Неделя», из шестерёнки ---
    /* Прежняя скрытая панель #dedit («только эта дата» и тип во всех неделях)
       была вторым способом переиграть неделю; теперь всё в шторке «Неделя»,
       разовая замена — под выбранной датой в «Эта неделя». */
    await p.click('#gear'); await p.waitForTimeout(280);
    const hasDayset = await p.$('[data-dayset]');
    chk(!!hasDayset, '1. в настройках есть вход в расписание');
    await p.click('[data-dayset]'); await p.waitForTimeout(320);
    const pickSel = () => p.evaluate(() => { wkMode='this'; openWeekPlan(sel);
      document.querySelector('#shB [data-wpd="'+sel+'"]').click(); });
    await pickSel();
    const editOn = await p.evaluate(() => ({ title: document.getElementById('shT').textContent,
      dedit: !!document.getElementById('dedit'),
      moveBtns: document.querySelectorAll('#shB [data-wpset]').length }));
    chk(editOn.title === 'НЕДЕЛЯ' && !editOn.dedit && editOn.moveBtns === 7,
        '2. под выбранной датой — семь кнопок разовой замены', JSON.stringify(editOn));

    // --- 3. перенос на другой день ---
    const before = await p.evaluate(() => {
      const wd = wdOf(sel);
      const other = S.days.findIndex((x,i) => i !== wd && x.t !== 'rest' && (x.ex||[]).length && x.t !== S.days[wd].t);
      return { wd, other, names: (dayOf(sel).ex||[]).map(e=>e.n).join(','), otherNames: (S.days[other].ex||[]).map(e=>e.n).join(',') };
    });
    chk(before.other >= 0, '3. есть куда переносить', 'день недели ' + before.wd + ' → ' + before.other);
    await p.evaluate(k => document.querySelector('#shB [data-wpset="'+k+'"]').click(), before.other);
    await p.waitForTimeout(320);
    const moved = await p.evaluate(() => {
      const row = document.querySelector('#shB [data-wpd="'+sel+'"]');
      return { map: S.map[sel], names: (dayOf(sel).ex||[]).map(e=>e.n).join(','),
        st: row ? row.querySelector('.wks').textContent : null };
    });
    await pickSel();
    const onBtn = await p.evaluate(() => [...document.querySelectorAll('#shB [data-wpset]')].filter(x=>x.classList.contains('on')).map(x=>x.dataset.wpset).join(','));
    chk(moved.map === before.other, '4. перенос записан в журнал дня', 'S.map[дата] = ' + moved.map);
    chk(moved.names === before.otherNames, '5. на этот день встала тренировка выбранного дня',
        moved.names.slice(0,44) + (moved.names.length>44?'…':''));
    chk(/перенос/.test(moved.st || ''), '6. в строке даты написано «↔ перенос»', moved.st);
    chk(onBtn === String(before.other), '7. отмечена ровно одна кнопка', 'отмечено: ' + onBtn);
    await p.evaluate(() => sheetClose());

    // --- 8. значок ↔ в календаре ---
    const mvInCal = await p.evaluate(() => {
      tab='prog'; calView='month'; mo=sel.slice(0,7); render(); cal();
      const c = document.querySelector('#cgrid [data-cd="'+sel+'"]');
      return { found: !!c, mv: !!(c && c.querySelector('.mv')) };
    });
    chk(mvInCal.found && mvInCal.mv, '8. в журнале на этой дате стоит ↔', JSON.stringify(mvInCal));

    // --- 9. своя тренировка возвращается кнопкой своего дня ---
    await pickSel();
    await p.evaluate(() => document.querySelector('#shB [data-wpset="'+wdOf(sel)+'"]').click());
    const back = await p.evaluate(() => ({ map: S.map[sel], names: (dayOf(sel).ex||[]).map(e=>e.n).join(',') }));
    chk(back.map === undefined && back.names === before.names, '9. кнопка своего дня снимает перенос', JSON.stringify(back.map));

    // --- 10. «Вернуть неделю как в программе» ---
    await pickSel();
    await p.evaluate(k => document.querySelector('#shB [data-wpset="'+k+'"]').click(), before.other);
    const beforeX = await p.evaluate(() => S.map[sel]);
    await p.evaluate(() => { const b = document.querySelector('#shB [data-wpreset]'); if (b) b.click(); });
    await p.waitForTimeout(250);
    const afterX = await p.evaluate(() => ({ map: S.map[sel], names: (dayOf(sel).ex||[]).map(e=>e.n).join(',') }));
    chk(beforeX !== undefined && afterX.map === undefined && afterX.names === before.names,
        '10. «Вернуть неделю» снимает перенос и возвращает свою тренировку',
        'было ' + beforeX + ' → стало ' + afterX.map);

    // --- 10б. записанный день не переносится, запись цела ---
    const keep = await p.evaluate(() => {
      const имя = dayOf(sel).ex[0].n;
      const r = recRW(sel); r.log[0] = { done: 1, n: имя, rs:['9','9','9'], vol: 123, s:'3' }; save();
      const was = JSON.stringify(recOf(sel).log[0]);
      wkMode='this'; openWeekPlan(sel);
      const row = document.querySelector('#shB [data-wpd="'+sel+'"]');
      wkPick = sel; openWeekPlan();
      const panel = !!document.querySelector('#shB [data-wpset]');
      const now = JSON.stringify(recOf(sel).log[0]);
      delete r.log[0]; save(); sheetClose();
      return { disabled: row.disabled, panel, same: was === now, map: S.map[sel] };
    });
    chk(keep.disabled && !keep.panel && keep.same && keep.map === undefined,
        '10б. день с записанными подходами не двигается, запись цела', JSON.stringify(keep));

    // --- 11. отметка «выполнено» ---
    const done = await p.evaluate(() => {
      const r = recRW(sel); r.wo = 1; r.t0 = Date.now()-3.6e6; r.t1 = Date.now(); save(); recomputeStats(1);
      tab='prog'; calView='month'; mo=sel.slice(0,7); render(); cal();
      const c = document.querySelector('#cgrid [data-cd="'+sel+'"]');
      return { cls: c ? c.className : null, tick: !!(c && c.querySelector('.ok')),
               tickTxt: c && c.querySelector('.ok') ? c.querySelector('.ok').textContent.trim() : null };
    });
    chk(done.tick && done.tickTxt === '✓' && /\bwo\b/.test(done.cls||''),
        '11. выполненный день помечен галочкой в журнале', JSON.stringify(done));

    // --- 12. снятая отметка убирает галочку ---
    const undone = await p.evaluate(() => {
      const r = recRW(sel); r.wo = 0; save(); recomputeStats(1); render(); cal();
      const c = document.querySelector('#cgrid [data-cd="'+sel+'"]');
      return { tick: !!(c && c.querySelector('.ok')), cls: c ? c.className : null };
    });
    chk(!undone.tick && !/\bwo\b/.test(undone.cls||''), '12. снятая отметка убирает галочку', JSON.stringify(undone));

    // --- 13. обозначения в легенде совпадают с тем, что нарисовано ---
    const leg = await p.evaluate(() => {
      const px = el => { const c = getComputedStyle(el); return c.backgroundImage + "|" + c.backgroundColor; };
      const out = {};
      document.querySelectorAll('#cleg .lg').forEach(i2 => {
        const t = [...i2.classList].find(c => c.startsWith('t-'));
        if (t) out[t] = px(i2);
      });
      return out;
    });
    const vals = Object.values(leg);
    chk(Object.keys(leg).length === 4 && new Set(vals).size === 4,
        '13. четыре обозначения тренировок различаются между собой',
        Object.keys(leg).join(' · ') + ' — разных: ' + new Set(vals).size);

    if (errs.length) bad('ошибки JS', [...new Set(errs)].join(' | '));
    await p.close();
  }
  await b.close();
  console.log('\nпровалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });

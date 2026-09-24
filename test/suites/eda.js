/* Еда целиком: приём пищи, продукт из базы, граммы, удаление,
   свой продукт, копирование рациона. Плюс чистый первый запуск. */
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

    // --- 1. чистый первый запуск: экран настройки на месте ---
    const first = await p.evaluate(() => ({
      setupOn: document.getElementById('setup').classList.contains('on'),
      rows: document.querySelectorAll('#setupRows *').length
    }));
    chk(first.setupOn && first.rows > 0, '1. на чистом устройстве открывается настройка', JSON.stringify(first));

    await p.evaluate(s => { S.setup=1; document.getElementById('setup').classList.remove('on'); void s;
      tab='food'; sel=today(); render(); }, skin);
    await p.waitForTimeout(250);

    // --- 2. пустая «Еда» не показывает мусора ---
    const empty = await p.evaluate(() => document.getElementById('scr-food').innerText);
    const junk = ['NaN','undefined','null','Infinity'].filter(w => empty.includes(w));
    chk(!junk.length, '2. в пустой «Еде» нет NaN и undefined', junk.join(', ') || 'чисто');

    // --- 3. приём пищи добавляется ---
    const n0 = await p.evaluate(() => mealsOf(sel).length);
    await p.click('#addMl'); await p.waitForTimeout(250);
    const n1 = await p.evaluate(() => ({ n: mealsOf(sel).length, cards: document.querySelectorAll('#mll [data-ml]').length }));
    chk(n1.n === n0 + 1 && n1.cards === n1.n, '3. приём пищи добавляется', n0 + ' → ' + n1.n);

    // --- 4. продукт из базы попадает в приём ---
    await p.evaluate(() => document.querySelector('#mll [data-pick]').click());
    await p.waitForTimeout(400);
    const pickOpen = await p.evaluate(() => document.getElementById('fp').classList.contains('on'));
    chk(pickOpen, '4. выбор продукта открывается');
    const added = await p.evaluate(async () => {
      const btn = document.querySelector('#fp [data-add]');
      const name = btn.dataset.add;
      btn.click();
      await new Promise(r=>setTimeout(r,120));
      const barOn = document.getElementById('fpbar').classList.contains('on');
      document.getElementById('fpAdd').click();
      await new Promise(r=>setTimeout(r,200));
      const m = mealsOf(sel);
      return { name, barOn, items: m.map(x=>(x.items||[]).map(i=>i.p)).flat(),
               closed: !document.getElementById('fp').classList.contains('on') };
    });
    chk(added.barOn && added.closed && added.items.includes(added.name),
        '5. выбранный продукт добавлен в приём пищи', added.name + ' · всего продуктов ' + added.items.length);

    // --- 6. калории посчитаны ---
    await p.waitForTimeout(250);
    const sum1 = await p.evaluate(() => ({ k: daySum(sel).k, shown: document.getElementById('tKc').innerText }));
    chk(sum1.k > 0 && !/NaN/.test(sum1.shown), '6. калории посчитаны и показаны', sum1.shown.replace(/\n/g,' '));

    // --- 7. граммы меняют счёт ---
    const g = await p.evaluate(() => {
      const inp = document.querySelector('#mll [data-g]');
      const was = daySum(sel).k;
      inp.value = '300'; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.blur();
      return { was, now: daySum(sel).k, val: inp.value };
    });
    chk(g.now !== g.was && isFinite(g.now), '7. правка граммов пересчитывает калории', g.was.toFixed(0) + ' → ' + g.now.toFixed(0));

    // --- 8. пустые граммы не ломают счёт ---
    const g0 = await p.evaluate(() => {
      const inp = document.querySelector('#mll [data-g]');
      inp.value = ''; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.blur();
      const s2 = daySum(sel);
      return { k: s2.k, txt: document.getElementById('tKc').innerText, ok: isFinite(s2.k) };
    });
    chk(g0.ok && !/NaN/.test(g0.txt), '8. пустое поле граммов не даёт NaN', g0.txt.replace(/\n/g,' '));

    // --- 9. свой продукт сохраняется в базу ---
    const own = await p.evaluate(async () => {
      document.querySelector('#mll [data-pick]').click();
      await new Promise(r=>setTimeout(r,250));
      const q = document.querySelector('#fp input[type="search"], #fp #fq, #fp input');
      q.value = 'Тестовая каша'; q.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,250));
      if (!document.getElementById('nfSave')) return { err:'формы своего продукта нет' };
      document.getElementById('nfK').value='120';
      document.getElementById('nfP').value='5';
      document.getElementById('nfF').value='3';
      document.getElementById('nfC').value='18';
      document.getElementById('nfSave').click();
      await new Promise(r=>setTimeout(r,300));
      const inDb = (S.myFood||[]).some(f => f.n === 'Тестовая каша');
      const inList = !!document.querySelector('#fp [data-add="Тестовая каша"]');
      document.getElementById('fp').classList.remove('on'); document.body.style.overflow='';
      return { inDb, inList, n: (S.myFood||[]).length };
    });
    chk(own.inDb && own.inList, '9. свой продукт попадает в базу и сразу виден в списке',
        own.err || ('своих продуктов: ' + own.n + ', в списке: ' + own.inList));

    // --- 10. продукт удаляется ---
    const rm = await p.evaluate(() => {
      const was = mealsOf(sel).map(m=>(m.items||[]).length).reduce((a,c)=>a+c,0);
      document.querySelector('#mll [data-rm]').click();
      const now = mealsOf(sel).map(m=>(m.items||[]).length).reduce((a,c)=>a+c,0);
      return { was, now };
    });
    chk(rm.now === rm.was - 1, '10. продукт удаляется крестиком', rm.was + ' → ' + rm.now);

    // --- 11. приём пищи удаляется ---
    const rmm = await p.evaluate(async () => {
      const was = mealsOf(sel).length;
      document.querySelector('#mll [data-mld]').click();
      await new Promise(r=>setTimeout(r,150));
      const a = document.getElementById('ask');
      if (a && a.classList.contains('on')) { try { askClose(true); } catch(e) {} }
      await new Promise(r=>setTimeout(r,200));
      return { was, now: mealsOf(sel).length };
    });
    chk(rmm.now === rmm.was - 1, '11. приём пищи удаляется', rmm.was + ' → ' + rmm.now);

    // --- 12. еда не уехала в другой день ---
    const other = await p.evaluate(() => {
      const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
      const d=new Date(); d.setDate(d.getDate()-7);
      return { today: JSON.stringify(mealsOf(sel)).length, week: JSON.stringify(mealsOf(iso(d))) };
    });
    chk(!/Тестовая каша/.test(other.week), '12. сегодняшняя еда не появилась неделю назад');

    // --- 13. «Скопировать рацион» открывается ---
    await p.evaluate(() => { tab='food'; render(); });
    await p.waitForTimeout(200);
    await p.click('#cpBtn'); await p.waitForTimeout(350);
    const ration = await p.evaluate(() => {
      const on = document.getElementById('sh').classList.contains('on');
      const t = document.getElementById('sh').innerText;
      try { sheetClose(); } catch(e) {}
      return { on, len: t.length, junk: /NaN|undefined/.test(t) };
    });
    chk(ration.on && !ration.junk, '13. «Скопировать рацион» открывает список без мусора', ration.len + ' знаков');

    // --- 14. всё пережило перезагрузку ---
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.reload(); await p.waitForTimeout(1300);
    const after = await p.evaluate(() => JSON.stringify(S));
    chk(before === after, '14. после всей возни журнал не изменился при перезагрузке',
        before.length + ' vs ' + after.length + ' знаков');

    if (errs.length) bad('ошибки JS', [...new Set(errs)].slice(0,3).join(' | '));
    await p.close();
  }
  await b.close();
  console.log('\nпровалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });

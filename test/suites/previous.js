const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const assert = require('assert/strict');
(async () => {
  const b = await chromium.launch(LAUNCH);
  try {
    const p = await (await b.newContext({viewport:{width:320,height:700}})).newPage();
    if (process.env.PREVIOUS_BASELINE) {
      const source=require('child_process').execFileSync('git',['show','870addd:index.html'],{encoding:'utf8'});
      await p.route('**/index.html',route=>route.fulfill({contentType:'text/html',body:source}));
    }
    await p.goto(APP); await p.waitForTimeout(1000);
    await p.evaluate(() => {
      S.setup=1; S.sound=0; $('setup').classList.remove('on'); S.rec={};
      sel=today(); const e={n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'};
      dayOf(sel).ex=[e]; dayOf(sel).t='lo1';
      S.rec['2026-01-01']={log:{0:{...e,done:1,rs:[8,7,6],ws:[90,100,110]}}};
      S.rec['2026-02-01']={log:{0:{...e,rs:[99,99,99],ws:[999,999,999]}}};
      S.rec['2099-01-01']={log:{0:{...e,done:1,rs:[99,99,99],ws:[999,999,999]}}};
      S.rec[sel]={log:{0:{rs:[5,4,3],ws:[80,81,82]}}};
      entCache=null; save(); tab='wo'; exOpen=0; render();
    });
    assert.equal(await p.locator('[data-copy-prev]').count(),3);
    assert.match(await p.locator('.setprev').nth(1).innerText(),/100.*7/);
    assert.match(await p.locator('.setprev').first().innerText(),/2026/);
    console.log('  ✓ dated previous completed session, variable weights, drafts and future excluded');
    const before=await p.evaluate(()=>JSON.stringify({past:S.rec['2026-01-01'],days:S.days,xp:S.xp,pr:S.pr}));
    assert.equal(await p.locator('[data-rs="1"]').inputValue(),'4');
    await p.locator('[data-copy-prev="1"]').click();
    assert.equal(await p.locator('[data-ws="1"]').inputValue(),'100');
    assert.equal(await p.locator('[data-rs="1"]').inputValue(),'7');
    assert.equal(await p.locator('[data-rs="0"]').inputValue(),'5');
    assert.equal(await p.locator('[data-ws="2"]').inputValue(),'82');
    assert.equal(await p.evaluate(()=>JSON.stringify({past:S.rec['2026-01-01'],days:S.days,xp:S.xp,pr:S.pr})),before);
    assert.equal(await p.evaluate(()=>!!recOf(sel).log[0].done || !!recOf(sel).log[0].ck),false);
    console.log('  ✓ explicit copy affects one set only, no completion, history/program/XP unchanged');
    await p.reload(); await p.waitForTimeout(800);
    await p.evaluate(()=>{tab='wo';sel=today();exOpen=0;render();});
    assert.equal(await p.locator('[data-rs="1"]').inputValue(),'7');
    assert.equal(await p.locator('[data-ws="1"]').inputValue(),'100');
    console.log('  ✓ copied draft survives reload');
    assert.equal(await p.evaluate(()=>[...document.querySelectorAll('[data-copy-prev]')].every(x=>{const r=x.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=320;})&&document.documentElement.scrollWidth<=320),true);
    console.log('  ✓ 320px layout and 44px copy targets');
    await p.evaluate(()=>{const l=S.rec['2026-01-01'].log[0];delete l.ws;delete l.rs;l.r='8-10';render();});
    assert.match(await p.locator('.setprev').first().innerText(),/100.*8/);
    console.log('  ✓ legacy session uses logged common weight and repetition range floor');
    await p.evaluate(()=>{const l=S.rec['2026-01-01'].log[0];l.rs=[8,6,7];l.ws=[90,110,100];l.fl=[1];recOf(sel).log[0].kinds=['f','',''];render();});
    assert.match(await p.locator('.setprev').first().innerText(),/110.*6/);
    assert.match(await p.locator('.setprev').nth(1).innerText(),/90.*8/);
    console.log('  ✓ references match kind and ordinal within kind');
    await p.locator('[data-kindmode]').click();
    await p.locator('.rbx').first().click(); // отказ → дроп: его вес старый журнал не хранил
    assert.equal(await p.locator('[data-copy-prev="0"]').count(),0);
    assert.match(await p.locator('.setprev').first().innerText(),/Нет записанного/);
    await p.locator('[data-kindmode]').click();
    console.log('  ✓ changing kind refreshes reference; unknown drop weight cannot be copied');
    await p.evaluate(()=>{S.rec['2026-01-01'].log[0].rs=[0,0,0];render();});
    assert.equal(await p.locator('[data-copy-prev]').count(),0);
    console.log('  ✓ explicitly unrecorded repetitions are never invented from target');
    await p.evaluate(()=>{S.rec={};render();});
    assert.equal(await p.locator('[data-copy-prev]').count(),0);
    assert.match(await p.locator('.setprev').first().innerText(),/Нет/);
    console.log('  ✓ no previous session has clear empty state');
  } finally { await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

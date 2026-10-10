/* Audit only. Isolated synthetic contexts; no owner profile, no production mutation.
   Exit 0 means the observations were captured, NOT that user contracts pass.
   Set AUDIT_STRICT=1 to make confirmed contract failures exit 1. */
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
const result = [], failures = [];
const pause = p => p.waitForTimeout(310);
async function click(p, s) { await p.locator(s).click(); await pause(p); }
async function fixture(p) {
  await p.evaluate(() => {
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.bw = 80; S.start = '2026-12-10';
    S.age = 30; S.height = 180; S.sex = 'm'; S.act = 'sit'; S.goal = '80';
    const d = S.days[wdOf('2026-10-10')]; d.t = 'up1'; d.s = 'Аудит';
    d.ex = [{ n: 'Жим лёжа', s: 3, r: '6-8', w: 60, g: 'Грудь' },
      { n: 'Тяга штанги в наклоне', s: 2, r: '8-10', w: 50, g: 'Спина' }];
    S.rec['2026-10-03'] = { wo: 1, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь',
      w: '60', s: '3', r: '6-8', rs: [8,8,8], ws: [60,60,60], vol: 1440, sd: 1 } }, sp: {} };
    S.rec['2026-10-10'] = { log: {}, sp: {}, ml: [{ n: 'Аудит-еда', items: [{ n: 'Аудит', g: 123 }] }] };
    entCache = null; recomputeStats(1); S.pr['Жим лёжа']=60; save(); flush();
    document.getElementById('setup').classList.remove('on'); sheetClose();
    if (typeof undoOff === 'function') undoOff();
    tab = 'wo'; sel = '2026-10-10'; mo = '2026-10'; exOpen = null; edit = false; editPast = false;
    render(); window.scrollTo(0,0);
  });
  await pause(p);
}
async function open(p, j = 0) { await click(p, `.exrow[data-open="${j}"]`); }
async function state(p) {
  return p.evaluate(() => ({ log: JSON.parse(JSON.stringify(recOf(sel).log)), wo: recOf(sel).wo || 0,
    t0: !!recOf(sel).t0, ton: dayTon(sel), sets: daySets(sel), xp: S.xp, pr: S.pr,
    working: dayOf(sel).ex.map(e => e.w), food: JSON.stringify(recOf(sel).ml),
    sessions: exSessions('Жим лёжа'), vol: S.vol, head: [$('woBig').textContent,$('woSets').textContent],
    open: exOpen, sel, tab, now:Date.now(), note:$('noteT').textContent, norm: { t: normDay(sel).t, kc: normDay(sel).kc } }));
}
function checked(name, actual, predicate, id) {
  const pass = !!predicate(actual); const r = { name, contract: pass ? 'PASS' : 'FAIL', ...(id ? { id } : {}), actual };
  result.push(r); if (!pass) failures.push(r); console.log(JSON.stringify(r));
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const viewport of [{width:320,height:568},{width:390,height:844}]) {
      const context = await browser.newContext({ viewport, timezoneId: 'Asia/Vladivostok', locale: 'ru-RU' });
      try {
        await context.route('https://**/*', r => r.abort());
        await context.addInitScript(() => {
          const RealDate = Date, base = new RealDate('2026-10-10T02:00:00Z').getTime(), mark = performance.now();
          class AuditDate extends RealDate { constructor(...a) { super(...(a.length ? a : [base + performance.now()-mark])); }
            static now() { return base + performance.now()-mark; } }
          window.Date = AuditDate;
        });
        const p = await context.newPage(), errors = []; p.setDefaultTimeout(8000); p.on('pageerror', e => {errors.push(e.message);console.log(JSON.stringify({runtimeError:e.message}));});
        await p.goto(APP); await p.waitForFunction(() => typeof S !== 'undefined' && !!S); await p.waitForTimeout(1200);
        const label = `${viewport.width}x${viewport.height}`;
        await fixture(p);
        const inventory = await p.locator('button:visible,input:visible,textarea:visible').evaluateAll(xs => xs.map(x => ({
          tag:x.tagName, text:x.textContent.trim(), aria:x.getAttribute('aria-label'), id:x.id,
          data:{...x.dataset}, width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height })));
        console.log(JSON.stringify({inventory:label,controls:inventory}));
        await p.evaluate(()=>{window.auditClicks=[]; document.addEventListener('click',e=>auditClicks.push({id:e.target.id,text:e.target.textContent.slice(0,40),trusted:e.isTrusted}),true);});
        await p.locator('#fin').dblclick({delay:40}); await pause(p); console.log(JSON.stringify({clickTrace:await p.evaluate(()=>auditClicks)}));
        checked(label+' start double tap', await state(p), s => s.t0 && !s.wo && s.ton===0,'WO-02');
        if(await p.locator('#woCx').isVisible()) await click(p,'#woCx'); checked(label+' cancel empty start',await state(p),s=>!s.t0&&!s.wo);
        await open(p); console.log(JSON.stringify({cardInventory:label,controls:await p.locator('#exl button,#exl input,#exl textarea').evaluateAll(xs=>xs.map(x=>({tag:x.tagName,text:x.textContent.trim(),aria:x.getAttribute('aria-label'),data:{...x.dataset},disabled:x.disabled,readonly:x.readOnly,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})))}));
        for (const [field,value] of [['[data-f="s"]','2.5'],['[data-f="s"]','13'],['[data-f="r"]','8-6'],['[data-f="w"]','-1'],['[data-rs="0"]','0'],['[data-ws="0"]','abc']]) {
          await fixture(p); await open(p); await p.locator(field).fill(value); await click(p,'[data-complete="0"]');
          checked(label+' reject '+field+'='+value,await state(p),s=>!s.log[0]?.done&&s.ton===0);
        }
        await fixture(p); await open(p); await p.locator('[data-ws="0"]').fill('0');
        await p.locator('[data-rs="0"]').fill('8'); await p.locator('[data-rs="1"]').fill('8'); await p.locator('[data-rs="2"]').fill('8');
        const food0 = (await state(p)).food; await click(p,'[data-complete="0"]');
        checked(label+' LIMIT-002 explicit zero means common weight',await state(p),s=>s.ton===1440);
        await p.reload(); await p.waitForFunction(()=>!!S&&S.setup); await open(p);
        checked(label+' LIMIT-002 zero row after reload',await state(p),s=>s.ton===1440&&s.food===food0);
        await click(p,'[data-complete="0"]'); checked(label+' uncomplete zero row',await state(p),s=>s.ton===0&&s.working[0]===60);
        await fixture(p); await open(p); await p.locator('[data-ws="0"]').fill(''); await click(p,'[data-complete="0"]');
        checked(label+' blank row fallback',await state(p),s=>s.ton===1440);
        await click(p,'[data-rpe="10"]'); checked(label+' RPE10 retracts progression',await state(p),s=>s.working[0]===60&&s.ton===1440);
        await click(p,'[data-rpe="10"]'); checked(label+' clear RPE10 restores progression',await state(p),s=>s.working[0]>60&&s.ton===1440);
        await click(p,'[data-complete="0"]'); checked(label+' uncomplete restores program',await state(p),s=>s.working[0]===60&&s.ton===0);
        await fixture(p); await open(p); await click(p,'[data-ss="0"]'); await click(p,'[data-complete="0"]');
        checked(label+' superset auto next',await state(p),s=>s.open===1&&s.ton===1440&&s.sets===3);
        await click(p,'#undoB'); checked(label+' superset completion undo',await state(p),s=>s.open===1&&s.ton===0&&s.working[0]===60);
        await fixture(p); await open(p);
        for (let i=0;i<3;i++) await click(p,`[data-kindcyc="${i}"]`);
        await click(p,'[data-complete="0"]'); checked(label+' all warmup',await state(p),s=>s.ton===0&&s.sets===0&&s.working[0]===60);
        await fixture(p); await open(p);
        await p.locator('[data-tick="0"]').dblclick({delay:40}); await pause(p);
        checked(label+' partial tick double tap stays marked',await state(p),s=>s.log[0]?.ck?.join()==='0');
        await p.reload(); await p.waitForFunction(()=>!!S&&S.setup); await open(p);
        checked(label+' partial tick reload',await state(p),s=>s.log[0]?.ck?.join()==='0'&&s.ton===0);
        await click(p,'[data-tick="1"]'); await click(p,'[data-tick="2"]');
        checked(label+' ticks complete',await state(p),s=>s.log[0]?.done&&s.ton===1440);
        await click(p,'#fin'); checked(label+' finish workout',await state(p),s=>s.wo===1&&s.ton===1440);
        await click(p,'#undoB'); checked(label+' finish undo',await state(p),s=>!s.wo&&s.ton===1440);
        await fixture(p);
        await click(p,'#chips [data-d="2026-10-11"]'); await open(p);
        checked(label+' future completion disabled',await p.locator('[data-complete]').isDisabled(),s=>s);
        await click(p,'[data-tick="0"]'); checked(label+' future tick blocked',await state(p),s=>s.ton===0&&!s.t0);
        await click(p,'[data-close]'); await click(p,'#chips [data-d="2026-10-09"]');
        checked(label+' rest view',await p.locator('#restW').isVisible(),s=>s);
        await fixture(p); await p.evaluate(()=>{sel='2026-10-03';render();});
        checked(label+' past read-only journal',await p.locator('.jrow').count(),s=>s===1);
        await click(p,'#editPast'); await open(p); await click(p,'[data-complete="0"]');
        checked(label+' past edit uncomplete',await state(p),s=>s.ton===0&&!s.wo);
        await fixture(p); await open(p); await p.locator('[data-ws="0"]').fill('55');
        await click(p,'[data-close]'); await open(p); checked(label+' draft survives close/open',await p.locator('[data-ws="0"]').inputValue(),s=>s==='55');
        await click(p,'[data-del="0"]'); await click(p,'#askY');
        if(await p.locator('#ask').evaluate(x=>x.classList.contains('on'))) await click(p,'#askN');
        checked(label+' delete maintains second exercise',await p.evaluate(()=>dayOf(sel).ex.map(e=>e.n)),s=>s.join()==='Тяга штанги в наклоне');
        await click(p,'#undoB'); checked(label+' delete undo restores program draft',await state(p),s=>s.working.length===2&&s.log[0]?.ws?.[0]===55);
        await fixture(p); await open(p); await p.locator('[data-ws="0"]').fill('abc');
        await click(p,'[data-close]'); await open(p);
        console.log(JSON.stringify({invalidWeightAfterReopen:label,value:await p.locator('[data-ws="0"]').inputValue()}));
        await click(p,'[data-complete="0"]');
        checked(label+' invalid draft stays blocked after reopening',await state(p),s=>!s.log[0]?.done&&s.ton===0,'WO-03');
        await fixture(p); await open(p); await p.locator('[data-ws="0"]').fill('55'); await click(p,'[data-swap="0"]');
        await p.locator('[data-swpick]:enabled').first().click(); await pause(p);
        await click(p,'[data-swgo]');
        checked(label+' date-only swap discards old draft',await state(p),s=>!s.log[0]&&s.ton===0);
        await click(p,'#undoB'); checked(label+' swap undo restores old draft',await state(p),s=>s.log[0]?.ws?.[0]===55&&s.working[0]===60);
        checked(label+' runtime errors',errors,s=>s.length===0);
        checked(label+' horizontal overflow',await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth})),s=>s.scroll<=s.width);
      } finally { await context.close(); }
    }
    console.log(JSON.stringify({summary:'AUDIT OBSERVATIONS; not a release-health claim',checks:result.length,contractFailures:failures.length,failures:failures.map(x=>({name:x.name,id:x.id||'UNCLASSIFIED'}))}));
    if(process.env.AUDIT_STRICT==='1'&&failures.length) process.exitCode=1;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=2;});

/* Presentation priority cannot award a quest before working-weight fallback
   finishes recalculating a supported legacy log. Real complete/Undo/reload. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
function check(name,a,e){checks++;try{assert.deepEqual(a,e);console.log('  ✓ '+name);}catch{failures++;console.log('  ✗ '+name+' expected='+JSON.stringify(e)+' actual='+JSON.stringify(a));}}
(async()=>{const b=await chromium.launch(LAUNCH);try{for(const width of[320,390]){
  const c=await b.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',serviceWorkers:'block',reducedMotion:'reduce'});
  try{const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-14T12:00:00+10:00')});await p.clock.resume();await p.goto(APP);await p.click('#setSkip');
    await p.evaluate(()=>{S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.start='2026-10-21';S.bw='80';S.bkAsk=Date.now();S.days.forEach(d=>{d.ex=[];d.t='rest';});S.days[2].t='up1';S.days[2].ex=[{n:'Жим лёжа',g:'Грудь',w:50,s:3,r:'6-8'}];
      S.rec={'2026-09-30':{log:{0:{done:1,n:'Жим лёжа',g:'Грудь',s:3,r:'6-8',rs:[8,7,7],xp:12}},sp:{},wo:1},'2026-10-14':{log:{},sp:{},wo:0}};
      S.quest={};S.map={};S.pause={};S.pr={'Жим лёжа':50};S.vol=zeroVol();S.xp=0;scrubKeys();recomputeStats(1);sel=today();tab='wo';exOpen=0;closeSetup();undoDrop();wkCache=null;entCache=null;save();render();flush();});
    check(width+' independent accepted legacy fixture',await p.evaluate(()=>[dayTon('2026-09-30'),questsOf('2026-10').find(q=>q.id==='ton').need,S.xp]),[1100,1200,72]);
    const old=await p.evaluate(()=>JSON.stringify(S.rec['2026-09-30'].log[0]));
    await p.evaluate(()=>{const c=document.querySelector('.ex[data-j="0"]');c.querySelector('[data-f="w"]').value='50';c.querySelector('[data-f="r"]').value='6-8';c.querySelector('[data-f="s"]').value='3';[...c.querySelectorAll('[data-rs]')].forEach(x=>{x.value='8';x.closest('.srow').querySelector('[data-ws]').value='50';});});
    const before=await p.evaluate(()=>snapS());await p.click('[data-complete="0"]');await p.waitForFunction(()=>!$('undo').hidden);
    const state=await p.evaluate(()=>{const q=questsOf('2026-10').find(q=>q.id==='ton');return {v:q.v,need:q.need,w:dayOf(today()).ex[0].w,past:dayTon('2026-09-30'),xp:S.xp,got:questDone('2026-10')};});
    check(width+' progression and derived target keep previous calculation order',[state.v,state.need,state.w,state.past],[1200,1300,52.5,1155]);
    check(width+' no premature quest XP before final target',[state.xp,state.got],[102,[]]);
    check(width+' previous raw log is not invented or rewritten',await p.evaluate(()=>JSON.stringify(S.rec['2026-09-30'].log[0])),old);
    check(width+' actual Undo banner retains working-weight reason',await p.locator('#undoT').innerText().then(t=>/поднят/.test(t)),true);
    await p.waitForTimeout(300);await p.click('#undoB');check(width+' full Undo preserves exact original state',await p.evaluate(()=>snapS()),before);
    await p.click('[data-complete="0"]');await p.waitForFunction(()=>!$('undo').hidden);await p.evaluate(()=>flush());await p.reload();
    check(width+' legacy quest correctness survives reload',await p.evaluate(()=>[S.xp,questDone('2026-10'),questsOf('2026-10').find(q=>q.id==='ton').need,dayOf(today()).ex[0].w]),[102,[],1300,52.5]);
    check(width+' no browser errors',errors,[]);
  }finally{await c.close();}
}}finally{await b.close();}console.log('Quest order: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;})().catch(e=>{console.error('FATAL',e.stack);process.exitCode=1;});

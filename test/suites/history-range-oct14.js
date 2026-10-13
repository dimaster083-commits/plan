/* A sparse old import cannot exhaust schedule capture before recent weeks.
   Real date-qualified history, trusted type edit, full Undo and reload. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
function check(name,a,e){checks++;try{assert.deepEqual(a,e);console.log('  ✓ '+name);}catch{failures++;console.log('  ✗ '+name+' expected='+JSON.stringify(e)+' actual='+JSON.stringify(a));}}
const tap=async(p,s)=>{await p.locator(s).click();await p.waitForTimeout(290);};
const qualification=()=>[weekNeed('2026-10-05'),planWeek('2026-10-13'),streak()];
async function change(p){await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpt="lo1"]');await tap(p,'#askY');await tap(p,'#shX');}
(async()=>{const browser=await chromium.launch(LAUNCH);try{for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',serviceWorkers:'block'});
  try{const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-13T12:00:00+10:00')});await p.clock.resume();await p.goto(APP);await p.click('#setSkip');
    await p.evaluate(()=>{S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.start='2026-09-28';S.bkAsk=Date.now();S.rec={'2010-01-01':{bw:'70'}};S.quest={};S.map={};S.pause={};
      S.days.forEach(d=>{if(d.t!=='rest')d.ex=d.ex.slice(0,1);});S.days[1].ex=[];
      for(const ds of ['2026-10-08','2026-10-10']){const d=dayOf(ds),e=d.ex[0];S.rec[ds]={wo:1,log:{0:{done:1,n:e.n,g:e.g,w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{},dt:d.t};}
      sel=today();tab='wo';entCache=null;wkCache=null;closeSetup();undoDrop();save();flush();render();});
    const original=await p.evaluate(()=>JSON.stringify(S));
    check(width+' sparse old record fixture qualifies recent week',await p.evaluate(qualification),[2,2,1]);
    await change(p);
    check(width+' old weight cannot prevent recent historical capture',await p.evaluate(qualification),[2,2,1]);
    check(width+' captures recent empty slot as false',await p.evaluate(()=>S.rec['2026-10-06']?.pe),false);
    check(width+' still preserves old weight value',await p.evaluate(()=>S.rec['2010-01-01'].bw),'70');
    check(width+' old record week also retains its prior empty Tuesday',await p.evaluate(()=>S.rec['2009-12-29']?.pe),false);
    check(width+' no fictitious journal through unrelated decade gap',await p.evaluate(()=>Object.hasOwn(S.rec,'2011-01-04')),false);
    await tap(p,'#undoB');check(width+' full Undo restores sparse imported state',await p.evaluate(()=>JSON.stringify(S)),original);
    await change(p);await p.evaluate(()=>flush());await p.reload();
    check(width+' sparse old-record qualification survives reload',await p.evaluate(qualification),[2,2,1]);
    check(width+' no browser errors',errors,[]);
  }finally{await context.close();}
}}finally{await browser.close();}console.log('History range: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;})().catch(e=>{console.error('FATAL',e);process.exitCode=1;});

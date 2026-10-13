/* Published-release verification. Fresh synthetic context, never owner storage.
   Local git blobs may use CRLF; compare canonical LF for delivery fidelity. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright-core');
const {LAUNCH}=require('../../env');
const root=path.resolve(__dirname,'../../..');
const url=process.env.GYM_APP_URL||'https://dimaster083-commits.github.io/plan/';
const norm=s=>s.replace(/\r\n/g,'\n');
const digest=s=>crypto.createHash('sha256').update(norm(s)).digest('hex');
const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE = "([^"]+)"/)[1];
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const tap=async(p,s)=>{await p.locator(s).first().click();await p.waitForTimeout(290);};
(async()=>{
  for(const name of ['index.html','system.css','sw.js']){
    const remote=new URL(name,url);remote.searchParams.set('release-check',Date.now());
    const response=await fetch(remote,{cache:'no-store',signal:AbortSignal.timeout(45000)});
    assert.equal(response.status,200,name+' HTTP');const body=await response.text();
    assert.equal(digest(body),digest(fs.readFileSync(path.join(root,name),'utf8')),name+' published bytes');
    console.log('✓ delivered '+name+' sha256='+digest(body));
  }
  const browser=await chromium.launch(LAUNCH);
  const context=await browser.newContext({viewport:{width:320,height:568},timezoneId:'Asia/Vladivostok',reducedMotion:'reduce'});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.clock.install({time:new Date('2026-10-13T12:00:00+10:00')});await p.clock.resume();
    await p.goto(url);await tap(p,'#setSkip');
    await p.waitForFunction(async cache=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&!!navigator.serviceWorker.controller&&(await caches.keys()).includes(cache);},cache,{timeout:45000});
    await p.evaluate(()=>{S.bw='80';S.sound=0;S.hints=0;S.bkAsk=Date.now();save();flush();undoDrop();render();});
    for(const t of ['wo','ex','prog','food','photo']){
      await tap(p,'[data-tab="'+t+'"]');await p.waitForFunction(()=>!document.body.classList.contains('rd-enter'));
      const state=await p.evaluate(()=>[tab,sel,snapS()]);const gear=p.locator('button[aria-label="Настройки"]:visible');
      assert.equal(await gear.count(),1);await gear.click();assert.equal(await p.locator('#shT').innerText(),'НАСТРОЙКИ');await p.keyboard.press('Escape');
      assert.deepEqual(await p.evaluate(()=>[tab,sel,snapS()]),state);assert.equal(await gear.evaluate(e=>e===document.activeElement),true);
      console.log('✓ served settings '+t+' preserve tab/date/journal/focus');
    }
    await p.evaluate(()=>{S=build();migrate();S.setup=1;S.bw='80';S.sound=0;S.hints=0;S.start='2026-09-30';S.bkAsk=Date.now();S.rec={};S.map={};S.pause={};
      S.days.forEach(d=>{if(d.t!=='rest')d.ex=d.ex.slice(0,1);});
      for(const ds of ['2026-10-01','2026-10-03']){const d=dayOf(ds),e=d.ex[0];S.rec[ds]={wo:1,log:{0:{done:1,n:e.n,g:e.g,w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{},dt:d.t};}
      sel=today();tab='wo';entCache=null;wkCache=null;undoDrop();save();flush();render();});
    const before=await p.evaluate(()=>snapS());assert.deepEqual(await p.evaluate(()=>[weekNeed('2026-09-28'),planWeek(today())]),[3,1]);
    await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpt="rest"]');await tap(p,'#askY');await tap(p,'#shX');
    assert.deepEqual(await p.evaluate(()=>[weekNeed('2026-09-28'),planWeek(today())]),[3,1]);await tap(p,'#undoB');assert.equal(await p.evaluate(()=>snapS()),before);
    console.log('✓ served midweek history/type edit/Undo');
    await p.clock.setFixedTime(new Date('2026-10-13T23:59:00+10:00'));
    await p.evaluate(()=>{S.myFood=[{n:'Delivery food',k:100,p:10,f:2,c:15}];invalidateFood();
      for(const[ds,g]of[['2026-10-12','300'],['2026-10-13','125'],['2026-10-14','250']])recRW(ds).ml=[{n:'Meal '+ds,items:[{p:'Delivery food',g}]}];
      sel=today();lastDay=today();tab='food';undoDrop();save();flush();render();});
    await tap(p,'#cpBtn');await tap(p,'[data-from="2026-10-12"]');await p.waitForSelector('#ask.on');
    await p.clock.setFixedTime(new Date('2026-10-14T00:01:00+10:00'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await p.evaluate(()=>sel),'2026-10-14');
    await tap(p,'#askY');assert.deepEqual(await p.evaluate(()=>['2026-10-12','2026-10-13','2026-10-14'].map(ds=>daySum(ds).k)),[300,300,250]);
    await tap(p,'#undoB');assert.deepEqual(await p.evaluate(()=>['2026-10-12','2026-10-13','2026-10-14'].map(ds=>daySum(ds).k)),[300,125,250]);
    console.log('✓ served midnight ration targets original date and Undo');
    const saved=await p.evaluate(async photo=>{await phPut(today(),photo);await phSync();flush();return {s:JSON.stringify(S.rec),ton:dayTon('2026-10-01'),k:daySum('2026-10-13').k};},photo);
    assert.equal(saved.ton,960);assert.equal(saved.k,125);
    await context.setOffline(true);await p.reload();await p.waitForFunction(()=>PH.includes('2026-10-14'));
    assert.deepEqual(await p.evaluate(async()=>({s:JSON.stringify(S.rec),ton:dayTon('2026-10-01'),k:daySum('2026-10-13').k,photo:await phGet('2026-10-14')})),{...saved,photo});
    assert.deepEqual(errors,[]);console.log('✓ activated '+cache+' offline reload preserves exact journal/photo/food; no JS errors');
  }finally{await context.close();await browser.close();}
})().catch(e=>{console.error('FATAL',e.stack);process.exitCode=1;});

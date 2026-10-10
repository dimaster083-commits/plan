/* Root fallback after independent Progress worker hit account limit.
   Actual UI on synthetic contexts. DEFECT != green health check. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../../env');
let positive=0;
function check(name,actual,expected){assert.deepEqual(actual,expected,name);positive++;console.log('PASS '+name);}
async function tap(p,s){await p.locator(s).first().click();await p.waitForTimeout(290);}
(async()=>{
  const browser=await chromium.launch(LAUNCH);
  try{for(const width of [320,390]){
    const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',acceptDownloads:true,reducedMotion:'reduce'});
    try{
      const p=await ctx.newPage();p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.clock.install({time:new Date('2026-10-10T12:00:00+10:00')});await p.goto(APP);await p.waitForSelector('#setup.on');await tap(p,'#setSkip');
      await p.evaluate(()=>{
        S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.goal='90';S.start='2026-10-05';S.bkAsk=Date.now();
        S.meas={'2026-10-08':{waist:80,chest:100},'2026-10-09':{waist:81,chest:101},'2026-10-10':{waist:82,chest:102}};
        S.rec['2026-10-10']={wo:1,bw:'80',log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{}};
        closeSetup();applyNutri();save();flush();render();
      });
      await tap(p,'[data-tab="prog"]');
      check(width+' total sessions',await p.locator('#sumWo').innerText(),'1');
      const rawBefore=await p.evaluate(()=>JSON.stringify({rec:S.rec,vol:S.vol,xp:S.xp,weights:S.days.map(d=>d.ex.map(e=>e.w))}));
      for(const sec of ['load','goal','prog','log']){await tap(p,'#pseg [data-sec="'+sec+'"]');check(width+' section target '+sec,await p.locator('#scr-prog .psec[data-s="'+sec+'"]').first().isVisible(),true);}
      await p.locator('#mmBrightness').fill('40');
      check(width+' brightness state/label',await p.evaluate(()=>[S.mapBrightness,$('mmBrightnessValue').textContent]),[40,'40 %']);
      await p.locator('#mmBrightness').fill('100');
      check(width+' display-only brightness',await p.evaluate(()=>JSON.stringify({rec:S.rec,vol:S.vol,xp:S.xp,weights:S.days.map(d=>d.ex.map(e=>e.w))})),rawBefore);
      for(const muscle of await p.evaluate(()=>MUSCLES)){
        await tap(p,'#mlist [data-mus="'+muscle+'"]');check(width+' muscle detail '+muscle,await p.locator('#shT').innerText(),muscle.toUpperCase());await tap(p,'#shX');
      }
      await p.locator('#bw').fill('85');await p.locator('#bw').blur();
      check(width+' mass shared',await p.evaluate(()=>[S.bw,$('anBw').value]),['85','85']);
      await p.locator('#goalIn').fill('75');await p.locator('#goalIn').blur();
      check(width+' goal shared',await p.evaluate(()=>[S.goal,$('anGoal').value]),['75','75']);
      await p.locator('#bw').fill('abc');await p.locator('#bw').blur();check(width+' bad mass rejected',await p.evaluate(()=>[S.bw,$('bw').value]),['85','85']);
      await tap(p,'[data-meas]');await p.locator('[data-mk="waist"]').fill('85');await tap(p,'#shX');
      check(width+' close dirty asks',await p.locator('#ask.on').count(),1);await tap(p,'#askN');check(width+' keep draft after cancel close',await p.locator('[data-mk="waist"]').inputValue(),'85');
      await tap(p,'[data-measch="chest"]');const lost=await p.locator('[data-mk="waist"]').inputValue();assert.equal(lost,'82');
      console.log('DEFECT PROG-01 '+width+' measurement chart choice loses unsaved waist85→'+lost+' without confirmation');
      await p.locator('[data-mk="waist"]').fill('abc');await p.locator('[data-mk="chest"]').fill('110');await tap(p,'[data-measave]');
      const partial=await p.evaluate(()=>S.meas[today()]);assert.equal(partial.chest,110);assert.equal(partial.waist,undefined);
      console.log('DEFECT PROG-02 '+width+' invalid one measurement silently drops prior valid field '+JSON.stringify(partial));
      await tap(p,'#undoB');check(width+' undo measurement preserves former row',await p.evaluate(()=>S.meas[today()]),{waist:82,chest:102});
      await tap(p,'[data-meas]');await p.locator('[data-mk="waist"]').fill('85.5');await tap(p,'[data-measave]');check(width+' decimal measurement save',await p.evaluate(()=>S.meas[today()].waist),85.5);
      await tap(p,'#wkBtn');check(width+' week totals from log',await p.locator('#shT').innerText(),'ИТОГИ НЕДЕЛИ');
      // Native file-share UI is outside headless control. Exercise documented
      // download fallback by modelling unsupported files, not patching the handler.
      await p.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false}));
      const dl=p.waitForEvent('download',{timeout:8000}).catch(()=>null);await tap(p,'[data-wkshare]');const file=await dl;
      if(file){const png=fs.readFileSync(await file.path());check(width+' actual PNG dimensions',[png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1350]);}
      else {console.log('PNG DOWNLOAD NOT OBSERVED '+width+' '+JSON.stringify(await p.evaluate(()=>({message:$('noteT').textContent,canShare:typeof navigator.canShare,share:typeof navigator.share})))+' errors='+JSON.stringify(errors));}
      await tap(p,'[data-wk="2026-09-28"]');check(width+' previous week actual navigation',await p.locator('#shT').innerText(),'ИТОГИ НЕДЕЛИ');await tap(p,'#shX');
      await tap(p,'#moBtn');check(width+' month opens',await p.locator('#shT').innerText(),'ИТОГИ');await tap(p,'#moP');await tap(p,'#moN');await tap(p,'#shX');
      await tap(p,'#cyear [data-mo="10"]');await tap(p,'[data-cd="2026-10-10"]');check(width+' calendar chooses workout date',await p.evaluate(()=>[sel,tab]),['2026-10-10','wo']);
      await tap(p,'[data-tab="prog"]');await tap(p,'#calBack');
      for(const id of ['anBtn','rankBtn','progBtn']){await tap(p,'#'+id);check(width+' report '+id,await p.locator('#sh.on').count(),1);await tap(p,'#shX');}
      await p.reload();await p.waitForFunction(()=>S&&S.setup);await tap(p,'[data-tab="prog"]');check(width+' brightness reload',await p.evaluate(()=>S.mapBrightness),100);check(width+' measurements reload',await p.evaluate(()=>S.meas[today()].waist),85.5);
      check(width+' no runtime errors',errors,[]);check(width+' no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }finally{await ctx.close();}
  }console.log('AUDIT COMPLETE '+positive+' positive observations; PROG-01/02 reproduced at both widths; root fallback NOT independent worker coverage');}
  finally{await browser.close();}
})().catch(e=>{console.error('AUDIT HARNESS FAILURE',e);process.exitCode=1;});

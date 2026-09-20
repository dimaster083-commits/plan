/* Кривое состояние. У человека в хранилище лежит то, что записали
   прежние версии приложения, иногда испорченное. Приложение обязано
   подняться, починить что может и не упасть ни на одной вкладке. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const KEY='sys-gym-v3';
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};

const CASES = {
  'пустая строка': '',
  'не json': '{это не json',
  'json, но не объект': '"строка"',
  'пустой объект': '{}',
  'null вместо дней': '{"days":null,"rec":null}',
  'дни не массив': '{"days":{"0":{"t":"up1"}}}',
  'день без упражнений': '{"days":[{"t":"up1","k":"Пн"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"}]}',
  'упражнение без имени': '{"days":[{"t":"up1","k":"Пн","ex":[{"s":"3","r":"8","w":"20"}]},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"}]}',
  'журнал с мусорным ключом': '{"rec":{"не дата":{"wo":1},"2026-13-45":{"wo":1}}}',
  'мусор появился уже в работе': '{"rec":{}}',
  'журнал с чужими типами': '{"rec":{"2026-01-05":{"wo":"да","log":{"0":{"done":1,"w":"много","rs":["а","б"]}}}}}',
  'вес строкой с запятой': '{"bw":"72,5","goal":"95,5","height":"177"}',
  'отрицательные числа': '{"bw":"-5","goal":"-80","xp":-500,"height":"-10"}',
  'огромные числа': '{"bw":"999999","goal":"1e9","xp":1e12}',
  'еда не массив': '{"rec":{"2026-01-05":{"ml":"обед"}}}',
  'добавки не массив': '{"sp":42}',
  'перенос на несуществующий день': '{"map":{"2026-01-05":99}}',
  'цели питания null': '{"days":[{"t":"up1","k":"Пн","ex":[],"kc":null,"pr":null},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"},{"t":"rest"}]}',
  'своя еда кривая': '{"myFood":[{"n":null,"k":"x"},null,5]}',
  'опорные веса строками': '{"anchors":{"b":"сто","s":null,"d":"60"}}'
};

(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const [name,raw] of Object.entries(CASES)){
    const ctx=await b.newContext({viewport:{width:390,height:844}});
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.addInitScript(([k,v])=>{ try{ localStorage.setItem(k,v); }catch(e){} }, [KEY,raw]);
    await p.goto(APP).catch(()=>{});
    await p.goto(APP);
    await p.waitForTimeout(1200);
    let res;
    try{
      res=await p.evaluate(async (nm)=>{
        S.setup=1; document.getElementById('setup').classList.remove('on');
        // случай «мусор появился уже в работе»: чистка на входе его не
        // видела, значит всё остальное обязано его пережить само
        if (nm === 'мусор появился уже в работе') {
          S.rec['абв'] = { wo:1, log:{ 0:{ done:1, w:'x' } } };
          S.rec['2026-99-99'] = { wo:1 };
          S.map['тоже мусор'] = 2;
          save();
        }
        const out={tabs:[],err:null};
        for(const t of ['wo','prog','food','photo']){
          try{ tab=t; exOpen=null; sel=today(); render(); await new Promise(r=>setTimeout(r,60));
            out.tabs.push(t+':'+document.body.innerText.length); }
          catch(e){ out.err=(out.err||'')+t+': '+e.message+'; '; }
        }
        for(const sec of ['log','load','goal','prog']){
          try{ tab='prog'; pSec=sec; render(); }catch(e){ out.err=(out.err||'')+sec+': '+e.message+'; '; }
        }
        try{ openAnalysis(); sheetClose(); }catch(e){ out.err=(out.err||'')+'разбор: '+e.message+'; '; }
        try{ monthReport(today().slice(0,7)); sheetClose(); }catch(e){ out.err=(out.err||'')+'месяц: '+e.message+'; '; }
        out.days=Array.isArray(S.days)?S.days.length:('не массив: '+typeof S.days);
        out.json=(()=>{ try{ return JSON.stringify(S).length; }catch(e){ return 'не сериализуется'; } })();
        out.nan=/NaN|Infinity/.test(JSON.stringify(S));
        out.wide=document.documentElement.scrollWidth;
        return out;
      }, name);
    }catch(e){ res={fatal:e.message}; }
    const problems=[];
    if(res.fatal) problems.push('упало: '+res.fatal);
    if(res.err) problems.push(res.err);
    if(errs.length) problems.push('ошибки JS: '+[...new Set(errs)].slice(0,2).join(' | '));
    if(res.days!==7) problems.push('дней '+res.days);
    if(res.nan) problems.push('в состоянии NaN');
    if(res.wide>391) problems.push('шире экрана: '+res.wide);
    problems.length ? bad(name, problems.join(' · ')) : ok(name, res.tabs.join(' '));
    await ctx.close();
  }
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});

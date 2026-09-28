/* Ранги силы E…S (стандарты силы из Lyfta в духе Системы).
   ≈1ПМ / вес тела против порогов опорного движения, у женщин — свои пороги,
   без веса тела ранга нет. Повышение ранга при закрытии — сообщение. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(()=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    window._notes=[]; const o=note; note=t=>{_notes.push(String(t)); return o(t);}; });
  const has=typeof (await p.evaluate(()=>typeof strRank))==='string' && await p.evaluate(()=>typeof strRank==='function');
  const R=(n,e1,sex,bw)=>p.evaluate(([n,e1,sex,bw])=>{ if(typeof strRank!=='function') return null; S.sex=sex; S.bw=bw; const k=strRank(n,e1); return k&&{l:k.l,next:k.next}; },[n,e1,sex,bw]);
  const a=await R('Жим лёжа',80*(1+10/30),'m','80');
  chk(a&&a.l==='B'&&a.next===120,'1. жим 80×10 при весе 80: ≈1ПМ 1,33× — ранг B, до A — 120 кг',JSON.stringify(a));
  const c=await R('Жим гантелей лёжа',40,'m','80');
  chk(c&&c.l==='B','2. гантели приводятся к жиму через долю из справочника',JSON.stringify(c));
  const f=await R('Жим лёжа',80*(1+10/30),'f','80');
  chk(f&&f.l==='A','3. у женщин свои пороги: тот же жим — ранг A',JSON.stringify(f));
  const n=await R('Жим лёжа',100,'m','');
  chk(has&&n===null,'4. без веса тела ранга нет — цифры не выдумываем',JSON.stringify(n));
  const nx=await R('Жим лёжа',69.6,'m','71');
  chk(nx&&nx.l==='C'&&nx.next>69.6,'5б. порог следующего ранга не ниже нынешнего ≈1ПМ',JSON.stringify(nx));
  const iso=await R('Махи в наклоне',13,'m','71');
  chk(iso===null&&has,'5а. изоляции ранга нет: махи 13 кг — не S',JSON.stringify(iso));
  const s=await R('Становая тяга',300,'m','80');
  chk(s&&s.l==='S'&&s.next===0,'5. выше элиты — S, дальше расти некуда',JSON.stringify(s));

  // повышение ранга при закрытии и ранг в карточке
  const up=await p.evaluate(()=>{ S.sex='m'; S.bw='80'; S.rec={}; S.pr={'Жим лёжа':60}; _notes.length=0;
    const z=new Date(); z.setDate(z.getDate()-5);
    S.rec[iso(z)]={log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'60',s:'3',r:'8',rs:[8,8,8],vol:1440,sd:1}}};
    const d=dayOf(today()); d.t='up1'; d.ex=[{n:'Жим лёжа',s:3,r:'8-10',w:80,g:'Грудь'}];
    entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render();
    const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-f="w"]').value='80';
    [...c.querySelectorAll('[data-rs]')].forEach(x=>{ x.value='10'; });
    toggleSet(0); exOpen=0; render();
    const k=document.querySelector('.ex[data-j="0"] .srank');
    return {notes:_notes.join(' | '), card:k?k.textContent.replace(/\s+/g,' '):'', h:k?Math.round(k.querySelector('.rkl').getBoundingClientRect().height):0}; });
  chk(/РАНГ СИЛЫ ПОВЫШЕН: Жим лёжа → B/.test(up.notes),'6. C → B при закрытии — сообщение Системы',up.notes);
  chk(/B/.test(up.card)&&/до A/.test(up.card)&&up.h>=44,'7. в карточке — ранг и сколько до следующего',up.card);
  const sh=await p.evaluate(()=>{ const bt=document.getElementById('rankBtn'); if(!bt) return ''; bt.click(); const t=document.getElementById('sh').textContent.replace(/\s+/g,' '); sheetClose(); return t; });
  chk(/Общий ранг силы/.test(sh)&&/Жим лёжа/.test(sh),'8. «Ранги силы» во вкладке «Прогресс»',sh.slice(0,120));
  chk(errs.length===0,'9. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});

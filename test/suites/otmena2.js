/* Отмена любого случайного касания (решение владельца, сентябрь 2026:
   «каждое случайное нажатие должно отменяться»). В первой версии отмены
   (otmena.js) полоска была у крупных действий, а закрытие упражнения
   галочкой, RPE, тип подхода, «Повторить», суперсет, избранное, добавка,
   пол, вес тела, заметка менялись насовсем. Двойной тап по «Начать
   тренировку» закрывал её, короткий мазок по карточке листал упражнение,
   × в замерах и в подборе еды молча терял набранное. Здесь — каждое из
   этого, и общий обход: любая кнопка, поменявшая данные, даёт «Отменить». */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const IMG1='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700},hasTouch:true})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const E=async(fn,arg)=>{ try{ return await p.evaluate(fn,arg); }catch(e){ return {err:String(e.message).slice(0,160)}; } };
  const J=x=>JSON.stringify(x);
  const yes=async()=>{ await p.waitForTimeout(120); await E(()=>{ const a=document.getElementById('ask'); if(a.classList.contains('on')) document.getElementById('askY').click(); }); await p.waitForTimeout(250); };
  const polo=()=>E(()=>{ const u=document.getElementById('undo');
    return {on:!!u&&!u.hidden, t:u?document.getElementById('undoT').textContent:''}; });
  const remember=()=>E(()=>{ window.__b=JSON.stringify(S); return S.xp; });
  const undo=async()=>{ await E(()=>{ const u=document.getElementById('undoB'); if(u&&!document.getElementById('undo').hidden) u.click(); }); await p.waitForTimeout(350);
    return E(()=>({same:JSON.stringify(S)===window.__b, polo:!document.getElementById('undo').hidden})); };

  const prep=(open)=>E(open=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.pr={}; S.map={}; delete S.pause; S.days=build().days; S.xp=500; S.meas={}; S.tpl=[]; S.fav=[]; S.exNote={};
    S.bw=80; S.goal=75; S.height=180; S.age=30; S.sex='m'; S.act='feet';
    const d=dayOf(today()); d.t='lo1'; d.s='тест';
    d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'},{n:'Сгибания ног',s:3,r:'10-12',w:40,g:'Ноги'},{n:'Разгибания ног',s:3,r:'10-12',w:30,g:'Ноги'}];
    d.sp=[{n:'Креатин',h:'',w:''},{n:'Омега',h:'',w:''}];
    const past=addDays(today(),-7);
    S.rec[past]={wo:1,log:{0:{done:1,n:'Жим ногами',g:'Ноги',w:'90',s:'3',r:'8-10',rs:[9,9,9]}},sp:{}};
    entCache=null; tab='wo'; sel=today(); exOpen=open===undefined?null:open; editPast=false;
    document.querySelectorAll('.sheet.on,#sh.on,.fp.on,#ask.on').forEach(e=>e.classList.remove('on'));
    save(); flush(); render();
    if(typeof undoDrop==='function') undoDrop();
  },open);

  // 1. закрытие упражнения последней галочкой: полоска, отмена байт в байт — опыт, рекорд, прибавка веса
  await prep(0); await p.waitForTimeout(300);
  await p.fill('.ex[data-j="0"] [data-f="w"]','100');
  for(const k of [0,1,2]) await p.fill('.ex[data-j="0"] [data-rs="'+k+'"]','10');     // верх во всех подходах — будет прибавка
  await p.click('.ex[data-j="0"] [data-tick="0"]'); await p.waitForTimeout(300);
  await p.click('.ex[data-j="0"] [data-tick="1"]'); await p.waitForTimeout(300);
  const q1=await polo();                                   // промежуточная галочка — без полоски
  const xp1=await remember();
  await p.click('.ex[data-j="0"] [data-tick="2"]'); await p.waitForTimeout(300);
  const t1=await E(()=>({done:!!(recOf(today()).log[0]||{}).done, xp:S.xp, w:dayOf(today()).ex[0].w, pr:S.pr['Жим ногами']}));
  const p1=await polo();
  const pos1=await E(()=>{ const u=document.getElementById('undo').getBoundingClientRect(),
    tb=document.querySelector('.tabbar').getBoundingClientRect(), bt=document.getElementById('undoB').getBoundingClientRect();
    const cross=(a,c)=>a.bottom>c.top+1&&a.top<c.bottom-1&&a.right>c.left+1&&a.left<c.right-1;
    return {наВкладках:cross(u,tb), l:u.left, r:u.right, h:Math.round(bt.height), w:Math.round(bt.width), экран:document.documentElement.scrollWidth}; });
  const u1=await undo();
  const t1b=await E(()=>({done:!!(recOf(today()).log[0]||{}).done, xp:S.xp, w:dayOf(today()).ex[0].w}));
  chk(!q1.on&&t1.done&&t1.xp>xp1&&t1.w>100&&p1.on&&/Жим ногами|Закреплено|РЕКОРД|КВЕСТ/.test(p1.t)&&u1.same&&!t1b.done&&t1b.xp===xp1&&t1b.w===100,
    '1. последняя галочка закрыла упражнение — «Отменить» возвращает опыт, рекорд и прибавку веса', J([q1,t1,p1,u1,t1b]));
  chk(p1.on&&!pos1.наВкладках&&pos1.l>=0&&pos1.r<=320&&pos1.h>=44&&pos1.w>=44&&pos1.экран<=320,
    '1б. полоска над вкладками, 44 px, в 320', J(pos1));

  // 2. промежуточная галочка — второе касание её же ровно отменяет первое (и цифру, поставленную галочкой)
  await prep(1); await p.waitForTimeout(200);
  const t2a=await E(()=>{ const c=[...document.querySelectorAll('.ex[data-j="1"] [data-rs]')]; c.forEach(x=>{ x.value=''; delete x.dataset.auto; }); window.__b=JSON.stringify(S); return c.map(x=>x.value); });
  await p.click('.ex[data-j="1"] [data-tick="0"]'); await p.waitForTimeout(300);
  const t2b=await E(()=>document.querySelector('.ex[data-j="1"] [data-rs]').value);
  await p.click('.ex[data-j="1"] [data-tick="0"]'); await p.waitForTimeout(300);
  const t2c=await E(()=>({v:document.querySelector('.ex[data-j="1"] [data-rs]').value, on:document.querySelector('.ex[data-j="1"] .srow').classList.contains('on'), same:JSON.stringify(S)===window.__b}));
  const p2=await polo();
  chk(t2b==='12'&&t2c.v===''&&!t2c.on&&t2c.same&&!p2.on,
    '2. галочка строки снимается вторым касанием ровно: клетка снова пустая, данные как были, полоска не мешает', J([t2a,t2b,t2c,p2]));

  // 3. RPE: полоска, отмена; набранные руками повторы на экране остаются
  await prep(0); await p.waitForTimeout(200);
  await p.fill('.ex[data-j="0"] [data-rs="0"]','7'); await p.waitForTimeout(100);
  await remember();
  await E(()=>document.querySelector('.ex[data-j="0"] [data-rpe="8"]').click()); await p.waitForTimeout(150);
  const p3=await polo(); const u3=await undo();
  const t3=await E(()=>({rpe:(recOf(today()).log[0]||{}).rpe, cell:document.querySelector('.ex[data-j="0"] [data-rs="0"]').value}));
  chk(p3.on&&/RPE 8/.test(p3.t)&&u3.same&&t3.rpe===undefined&&t3.cell==='7',
    '3. RPE отменяется, набранная руками клетка на месте', J([p3,u3,t3]));

  // 4. тип подхода (касание номера): полоска, отмена
  await prep(0); await p.waitForTimeout(200); await remember();
  const t4=await E(()=>{ const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-kindcyc="0"]').click(); return (recOf(today()).log[0]||{}).kinds; });
  await p.waitForTimeout(100);
  const p4=await polo(); const u4=await undo();
  chk(J(t4)==='["w","",""]'&&p4.on&&/разминка/.test(p4.t)&&u4.same, '4. смена типа подхода отменяется', J([t4,p4,u4]));

  // 5. «Повторить» прошлый подход: полоска, отмена возвращает и данные, и клетку
  await prep(0); await p.waitForTimeout(200);
  const was5=await E(()=>{ window.__b=JSON.stringify(S); const b2=document.querySelector('.ex[data-j="0"] [data-copy-prev="0"]');
    const v=document.querySelector('.ex[data-j="0"] [data-rs="0"]').value; if(b2) b2.click(); return {есть:!!b2, v}; });
  await p.waitForTimeout(100);
  const p5=await polo(); const u5=await undo();
  const t5=await E(()=>document.querySelector('.ex[data-j="0"] [data-rs="0"]').value);
  chk(was5.есть&&p5.on&&/повтор/.test(p5.t)&&u5.same&&t5===was5.v, '5. «Повторить» отменяется: строка как была', J([was5,p5,u5,t5]));

  // 6. суперсет: полоска и отмена; двойной тап не включает и сразу выключает
  await prep(0); await p.waitForTimeout(300); await remember();
  await E(()=>document.querySelector('[data-ss="0"]').click()); await p.waitForTimeout(100);
  const p6=await polo(); const u6=await undo();
  await prep(0); await p.waitForTimeout(300);
  await p.dblclick('[data-ss="0"]'); await p.waitForTimeout(200);
  const t6=await E(()=>!!dayOf(today()).ex[0].ss);
  chk(p6.on&&/Суперсет/.test(p6.t)&&u6.same&&t6, '6. суперсет отменяется, двойной тап его не выключает', J([p6,u6,t6]));

  // 7. двойной тап по «Начать тренировку» — тренировка идёт, а не закрыта; и с паузой 0,4 с тоже
  await prep(); await p.waitForTimeout(300);
  await p.dblclick('#fin'); await p.waitForTimeout(250);
  const t7a=await E(()=>({t0:!!recOf(today()).t0, wo:!!recOf(today()).wo, sheet:document.getElementById('sh').classList.contains('on')}));
  await prep(); await p.waitForTimeout(300);
  await p.click('#fin'); await p.waitForTimeout(400); await p.click('#fin'); await p.waitForTimeout(250);
  const t7b=await E(()=>({t0:!!recOf(today()).t0, wo:!!recOf(today()).wo}));
  chk(t7a.t0&&!t7a.wo&&!t7a.sheet&&t7b.t0&&!t7b.wo, '7. двойной тап по «Начать» не закрывает пустую тренировку', J([t7a,t7b]));

  // 8. два действия подряд: вторая полоска заменяет первую, отмена снимает только второе
  await prep(); await p.waitForTimeout(250);
  // закрытие — галочками карточки (как в Lyfta): касание проходит через страховку отмены
  const ticks=j=>E(j=>{ exOpen=j; render(); document.querySelectorAll('.ex[data-j="'+j+'"] [data-tick]').forEach(x=>x.click()); }, j);
  await ticks(0); await p.waitForTimeout(300);
  const a8=await E(()=>({xp:S.xp, s:JSON.stringify(S)}));
  await E(()=>{ window.__b=JSON.stringify(S); }); await ticks(1); await p.waitForTimeout(300);
  const p8=await polo(); const u8=await undo();
  const t8=await E(()=>({a:!!(recOf(today()).log[0]||{}).done, b:!!(recOf(today()).log[1]||{}).done, xp:S.xp}));
  chk(p8.on&&/Сгибания ног|КВЕСТ/.test(p8.t)&&u8.same&&t8.a&&!t8.b&&t8.xp===a8.xp, '8. быстрые два закрытия: отмена снимает только второе, первое с опытом на месте', J([p8,u8,t8,a8.xp]));

  // 9. избранное в каталоге
  await prep(); await p.waitForTimeout(200);
  const t9=await E(async()=>{ await loadLib(); tab='ex'; render(); await new Promise(r=>setTimeout(r,200));
    window.__b=JSON.stringify(S); const f=document.querySelector('[data-lfav]'); f.click(); return {id:f.dataset.lfav, fav:[...S.fav]}; });
  await p.waitForTimeout(100);
  const p9=await polo(); const u9=await undo();
  const t9b=await E(id=>({fav:[...(S.fav||[])], btn:document.querySelector('[data-lfav="'+CSS.escape(id)+'"]').classList.contains('on')}), t9.id);
  chk(t9.fav&&t9.fav.length===1&&p9.on&&/избранн/.test(p9.t)&&u9.same&&t9b.fav.length===0&&!t9b.btn, '9. избранное отменяется, звезда гаснет', J([t9,p9,u9,t9b]));

  // 10. еда и добавки: отметка добавки (опыт), «+ Приём пищи», «+ Добавка»
  await prep(); await E(()=>{ tab='food'; render(); }); await p.waitForTimeout(150);
  const R10={};
  for(const [k,sel] of [['добавка','#spl [data-tog="0"]'],['приём','#addMl'],['новая добавка','#addSp']]){
    await remember();
    await E(s=>document.querySelector(s).click(), sel); await p.waitForTimeout(120);
    const pp=await polo(); const uu=await undo(); R10[k]={on:pp.on, t:pp.t, same:uu.same};
  }
  chk(Object.values(R10).every(x=>x.on&&x.same), '10. отметка добавки, новый приём пищи и новая добавка отменяются', J(R10));

  // 11. пол и активность пересчитывают нормы — отмена возвращает и их
  await prep(); await remember();
  await E(()=>document.querySelector('#anAct [data-act="hard"]').click()); await p.waitForTimeout(120);
  const p11=await polo(); const u11=await undo();
  await remember();
  await E(()=>document.querySelector('#anSex [data-sex="f"]').click()); await p.waitForTimeout(120);
  const p11b=await polo(); const u11b=await undo();
  chk(p11.on&&u11.same&&p11b.on&&u11b.same, '11. активность и пол отменяются вместе с нормами еды', J([p11,u11,p11b,u11b]));

  // 12. вес тела, вписанный руками: при уходе с поля — полоска, отмена возвращает вес, запись дня и нормы
  await prep(); await E(()=>{ tab='prog'; render(); }); await p.waitForTimeout(200); await remember();
  await p.click('#bw'); await p.keyboard.press('Control+A'); await p.keyboard.type('86'); await p.waitForTimeout(100);
  const mid12=await polo();
  await E(()=>document.getElementById('bw').blur()); await p.waitForTimeout(150);
  const t12=await E(()=>({bw:S.bw, rec:(S.rec[today()]||{}).bw}));
  const p12=await polo(); const u12=await undo();
  const t12b=await E(()=>({bw:S.bw, field:document.getElementById('bw').value}));
  chk(!mid12.on&&t12.bw==='86'&&p12.on&&u12.same&&t12b.bw===80&&/80/.test(t12b.field), '12. вес тела отменяется при уходе с поля, пока пишешь — полоски нет', J([mid12,t12,p12,u12,t12b]));

  // 13. заметка к упражнению: стёр — вернул
  await prep(0); await E(()=>{ S.exNote={'Жим ногами':'Сиденье 4'}; save(); render(); }); await p.waitForTimeout(200); await remember();
  await p.click('[data-exnote]'); await p.keyboard.press('Control+A'); await p.keyboard.press('Delete');
  await E(()=>document.querySelector('[data-exnote]').blur()); await p.waitForTimeout(150);
  const t13=await E(()=>(S.exNote||{})['Жим ногами']);
  const p13=await polo(); const u13=await undo();
  chk(t13===undefined&&p13.on&&u13.same, '13. стёртая заметка возвращается отменой', J([t13,p13,u13]));

  // 14. упражнение из подбора
  await prep(); await remember();
  await E(()=>{ openExPicker(); document.querySelector('#shB [data-addex]').click(); }); await p.waitForTimeout(150);
  const p14=await polo(); const u14=await undo();
  chk(p14.on&&u14.same, '14. упражнение, добавленное из подбора, убирается отменой', J([p14,u14]));

  // 15. листание вбок: короткий мазок и мазок по строке подходов не листают, уверенный жест — листает
  await prep(0); await p.waitForTimeout(200);
  const sw=(sel,dx,ms)=>E(([sel,dx,ms])=>new Promise(res=>{ const el=document.querySelector(sel); const r=el.getBoundingClientRect();
    const x=r.left+r.width/2, y=r.top+Math.min(20,r.height/2);
    const T=(cx)=>new Touch({identifier:1,target:el,clientX:cx,clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[T(x)],changedTouches:[T(x)]}));
    setTimeout(()=>{ el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[T(x+dx)]})); res(exOpen); },ms); }),[sel,dx,ms]);
  const s15a=await sw('.ex[data-j="0"]',-60,120);
  const s15b=await sw('.ex[data-j="0"] .srow',-150,120);
  const s15c=await sw('.ex[data-j="0"]',-150,120);
  chk(s15a===0&&s15b===0&&s15c===1, '15. короткий мазок и мазок по подходам упражнение не меняют, уверенный жест — меняет', J([s15a,s15b,s15c]));

  // 16. × в замерах с набранными цифрами спрашивает; «нет» — цифры на месте
  await prep(); await E(()=>{ tab='prog'; render(); openMeas(); }); await p.waitForTimeout(150);
  await E(()=>{ const i=document.querySelector('#shB [data-mk="waist"]'); i.value='77'; i.dispatchEvent(new Event('input',{bubbles:true})); document.getElementById('shX').click(); });
  await p.waitForTimeout(150);
  const t16=await E(()=>({ask:document.getElementById('ask').classList.contains('on')}));
  await E(()=>document.getElementById('askN').click()); await p.waitForTimeout(150);
  const t16b=await E(()=>({sheet:document.getElementById('sh').classList.contains('on'), v:(document.querySelector('#shB [data-mk="waist"]')||{}).value}));
  await E(()=>{ document.querySelector('#shB [data-mk="waist"]').value=''; document.getElementById('shX').click(); }); await p.waitForTimeout(150);
  const t16c=await E(()=>({sheet:document.getElementById('sh').classList.contains('on'), ask:document.getElementById('ask').classList.contains('on')}));
  chk(t16.ask&&t16b.sheet&&t16b.v==='77'&&!t16c.sheet&&!t16c.ask, '16. × в замерах не теряет набранное молча; пустая шторка закрывается сразу', J([t16,t16b,t16c]));

  // 17. вопрос с полем: касание мимо окна не стирает набранное название
  await prep();
  const t17=await E(()=>new Promise(res=>{ let got='нет ответа'; askText('Название шаблона','Мой').then(v=>{ got=v; });
    setTimeout(()=>{ document.getElementById('askI').value='Сушка'; document.getElementById('ask').click();
      setTimeout(()=>{ const on=document.getElementById('ask').classList.contains('on'); document.getElementById('askY').click();
        setTimeout(()=>res({открыт:on, got}),50); },80); },150); }));
  chk(t17.открыт&&t17.got==='Сушка', '17. касание мимо окна с полем не закрывает его', J(t17));

  // 18. × в подборе еды с выбранными продуктами спрашивает
  await prep(); await E(()=>{ tab='food'; recRW(today()).ml=[{n:'Завтрак',note:'',items:[]}]; save(); render(); openPick(0); picked=[{p:'Овсянка',g:80}]; paintPickBar(); });
  await E(()=>document.getElementById('fpX').click()); await p.waitForTimeout(150);
  const t18=await E(()=>({ask:document.getElementById('ask').classList.contains('on'), fp:document.getElementById('fp').classList.contains('on')}));
  await E(()=>document.getElementById('askN').click()); await p.waitForTimeout(100);
  const t18b=await E(()=>({fp:document.getElementById('fp').classList.contains('on'), n:picked.length}));
  await E(()=>{ closePick(); });
  chk(t18.ask&&t18.fp&&t18b.fp&&t18b.n===1, '18. × в подборе еды с выбранным спрашивает, «нет» — выбор на месте', J([t18,t18b]));

  // 19. новый снимок поверх старого: отмена возвращает прежнее фото
  await prep();
  await E(async img=>{ await phPut(today(), img); PHCACHE.clear(); await phSync(); tab='photo'; sel=today(); render(); }, IMG1);
  await p.waitForTimeout(300);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR42mP8z8DAwMDAxMDAwMDAAAAhAQMBjVaGigAAAABJRU5ErkJggg==','base64');
  await p.setInputFiles('#phFile',{name:'b.png',mimeType:'image/png',buffer:png}); await p.waitForTimeout(900);
  const t19=await E(async img=>({заменён:(await phGet(today()))!==img}), IMG1);
  const p19=await polo();
  await E(()=>{ const u=document.getElementById('undoB'); if(!document.getElementById('undo').hidden) u.click(); }); await p.waitForTimeout(600);
  const t19b=await E(async img=>({back:(await phGet(today()))===img}), IMG1);
  await E(async()=>{ await phDelete(today()); PHCACHE.clear(); await phSync(); });
  chk(t19.заменён&&p19.on&&/заменён/.test(p19.t)&&t19b.back, '19. заменённый снимок дня возвращается отменой', J([t19,p19,t19b]));

  // 20. переходы полоску не зовут: вкладки, день, раскрытие упражнения
  await prep(); await p.waitForTimeout(250);
  await p.click('[data-tab="prog"]'); await p.waitForTimeout(250); await p.click('[data-tab="wo"]'); await p.waitForTimeout(250);
  await p.click('.exrow[data-open="1"]'); await p.waitForTimeout(250);
  const p20=await polo();
  chk(!p20.on&&p20.t!==undefined&&(await E(()=>typeof undoSeq))==='number', '20. переходы по экранам полоску «Отменить» не показывают', J(p20));

  // 21. общий обход: любая кнопка, поменявшая данные, даёт «Отменить» (или спрашивает, и тогда даёт)
  const screens={
    'тренировка':'tab="wo";exOpen=null;render();',
    'карточка':'tab="wo";exOpen=0;render();',
    'еда':'tab="food";render();',
    'прогресс':'tab="prog";render();',
    'настройки':'tab="wo";render();openSettings();',
    'неделя':'tab="wo";render();wkMode="this";openWeekPlan(today());',
    'рацион':'tab="food";render();openRation();',
    'замеры':'tab="prog";render();openMeas();',
  };
  const SKIP='#wipe,#undoB,[data-bk],[data-recalc],#impB,#exp,#expCsv,#bkB,[data-tab],#shX,#fpX,#setSkip,#setOk,[data-t]';
  const miss=[]; let tried=0, changed=0;
  for(const [sn,code] of Object.entries(screens)){
    await prep();
    await E(()=>{ S.meas={}; S.meas[today()]={waist:80}; recRW(today()).ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка',g:80}]}]; save(); flush(); window.__base=JSON.stringify(S); });
    const pickEls=`(()=>{ const box=document.getElementById('sh').classList.contains('on')?document.getElementById('shB'):document.getElementById('scr-'+tab);
      window.__els=[...box.querySelectorAll('button')].filter(e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&!e.disabled&&!e.matches(${J(SKIP)}); }).slice(0,30); return window.__els.length; })()`;
    const n=await E(`(()=>{ ${code} return ${pickEls}; })()`);
    for(let i=0;i<n;i++){
      const info=await E(`(()=>{ document.querySelectorAll('.sheet.on,#sh.on,.fp.on,#ask.on').forEach(e=>e.classList.remove('on'));
        if(typeof undoDrop==='function') undoDrop(); S=JSON.parse(window.__base); entCache=null; wkCache=null; sel=today(); save(); flush();
        if(typeof undoDrop==='function') undoDrop(); ${code} ${pickEls};
        const el=window.__els[${i}]; if(!el) return null; window.__b=JSON.stringify(S);
        const lab=(el.id?'#'+el.id+' ':'')+[...el.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join(' ')+' «'+el.textContent.trim().slice(0,24)+'»';
        const quiet=el.matches('[data-tick]')&&!(recOf(sel).log[+el.closest('.ex').dataset.j]||{}).done;
        el.click(); return {lab, quiet}; })()`);
      if(!info||info.err) continue;
      tried++;
      await p.waitForTimeout(90);
      await yes();
      const r=await E(()=>{ const A=JSON.parse(window.__b), B=JSON.parse(JSON.stringify(S)); ['bkAt','bkAsk','mig15note'].forEach(k=>{ delete A[k]; delete B[k]; });
        return {ch:JSON.stringify(A)!==JSON.stringify(B), on:!document.getElementById('undo').hidden}; });
      if(r.ch&&!info.quiet){ changed++; if(!r.on) miss.push(sn+': '+info.lab); }
    }
  }
  chk(changed>=15&&miss.length===0, '21. каждая кнопка, поменявшая данные, даёт «Отменить» (нажато '+tried+', меняли данные '+changed+')', miss.join(' | ')||'все с отменой');

  chk(errs.length===0,'22. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();

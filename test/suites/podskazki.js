/* Подсказки: значок «i» у неочевидных граф, советы экранов при первом
   открытии, пустые места, которые учат. До этой правки ни одного «i» в
   приложении не было: что значат ПОВТ, RPE, Р/О/Д, лесенка, коридор темпа
   или белок на кг — человек мог узнать только из CLAUDE.md. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:568}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  // упавший расчёт на старом коде — провал пункта, а не обрыв всего набора
  const ev=(f,a)=>p.evaluate(f,a).catch(e=>({ошибка:String(e.message).slice(0,90)}));
  await p.goto(APP); await p.waitForTimeout(1300);

  // чистое состояние: настройка пройдена, советы не закрыты, подсказки включены
  const сброс=()=>ev(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    delete S.tips; delete S.hints; S.bw='80';
    // сегодня или ближайший прошедший день тренировки: на нём есть кнопка «Начать тренировку»
    let d=today(); for(let k=0;k<7;k++){ const x=addDays(today(),-k); if(dayOf(x).t!=='rest'&&!dayEntries(x).length){ d=x; break; } }
    sel=d; tab='wo'; exOpen=null; save(); render(); window.scrollTo(0,0);
    return d;
  });
  await сброс();

  // общий замер видимых «i»: 44×44, не шире экрана, палец попадает в сам значок
  const замер=()=>ev(()=>{
    const vis=[...document.querySelectorAll('button.hib')].filter(x=>x.offsetParent!==null&&x.getClientRects().length);
    const small=vis.filter(x=>{const r=x.getBoundingClientRect(); return Math.round(r.width)<44||Math.round(r.height)<44;}).map(x=>x.dataset.hint);
    const y0=scrollY;
    // каждый значок — в середину экрана: липкие полосы сверху и снизу его не закрывают
    const cover=vis.filter(x=>{x.scrollIntoView({block:'center'}); const r=x.getBoundingClientRect(); const cx=r.left+r.width/2, cy=r.top+r.height/2;
      if(cy<0||cy>innerHeight||cx<0||cx>innerWidth) return true;
      const el=document.elementFromPoint(cx,cy); return !(el&&x.contains(el));}).map(x=>x.dataset.hint);
    const unknown=[...document.querySelectorAll('[data-hint]')].map(x=>x.dataset.hint).filter(k=>k&&!HINTS[k]);
    window.scrollTo(0,y0);
    return {n:vis.length, keys:vis.map(x=>x.dataset.hint), small, cover, unknown, w:document.documentElement.scrollWidth};
  });

  // 1. «Зал»: совет экрана, «i» у тренировки дня и у серии, всё в 320 и 44 px
  const зал=await замер();
  const совет=await ev(()=>{ const t=document.getElementById('tip-wo'); return t&&!t.hidden&&t.offsetHeight>0 ? t.textContent : null; });
  chk(зал.keys?.includes('day')&&зал.keys?.includes('streak')&&зал.keys?.includes('xp')&&!зал.small?.length&&!зал.cover?.length&&!зал.unknown?.length&&зал.w<=320&&совет&&/Понятно/.test(совет),
    '1. «Зал»: совет экрана и «i» у тренировки дня, серии, уровня — 44 px, в 320', JSON.stringify({зал,совет}));

  // 2. главное действие не уезжает за край, пока совет на экране
  const кнопка=await ev(()=>{ const f=$('fin'); if(!f||f.hidden) return null; const r=f.getBoundingClientRect();
    return {top:Math.round(r.top), bottom:Math.round(r.bottom), h:innerHeight}; });
  chk(кнопка&&кнопка.top>=0&&кнопка.bottom<=кнопка.h,
    '2. «Начать тренировку» видна на 320×568 вместе с советом', JSON.stringify(кнопка));

  // 3. «i» открывает подсказку: заголовок, текст, источник; закрывается ×, фоном и Esc
  const откр=async sel=>{ try {
    // Повторное открытие после закрытия фоном — второй trusted tap той же
    // кнопки. Фон не сбрасывает lastTap; не путать защиту от двойного тапа
    // с неработающей подсказкой и не полагаться на скорость CI/прокрутки.
    await p.waitForFunction(selector=>{
      const el=document.querySelector(selector);
      return !el||tapKey(el)!==lastTap.k||performance.now()-lastTap.t>=UNDO_TAP_MS;
    },sel,{timeout:3000});
    await p.click(sel,{timeout:3000});
  } catch(e){ return {нет:sel}; } await p.waitForTimeout(120);
    return ev(()=>{ const h=$('hsh'); const r=h.querySelector('.hshin');
      return {on:!h.hidden, t:$('hshT').textContent, n:$('hshB').querySelectorAll('p').length, src:$('hshS').textContent,
        влезает:r.scrollWidth<=r.clientWidth&&document.documentElement.scrollWidth<=320,
        x:(()=>{const q=$('hshX').getBoundingClientRect(); return Math.round(Math.min(q.width,q.height));})()}; }); };
  const день=await откр('.qhead [data-hint="day"]');
  await p.click('#hshX',{timeout:3000}).catch(()=>{}); await p.waitForTimeout(80);
  const закрХ=await ev(()=>$('hsh').hidden);
  await откр('.qpen [data-hint="streak"]');
  await p.mouse.click(160,40); await p.waitForTimeout(80);
  const закрФон=await ev(()=>$('hsh').hidden);
  const серия=await откр('.qpen [data-hint="streak"]');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  const закрEsc=await ev(()=>$('hsh').hidden);
  chk(день.on&&день.t==='ТРЕНИРОВКА ДНЯ'&&день.n>=2&&/Фитнес для умных/.test(день.src)&&день.влезает&&день.x>=44&&закрХ&&закрФон&&закрEsc&&/3/.test(серия.t+серия.n)&&серия.on,
    '3. подсказка открывается, влезает в 320 и закрывается ×, фоном и Esc', JSON.stringify({день,серия,закрХ,закрФон,закрEsc}));

  // 4. карточка упражнения: вес/ПОВТ, подходы, RPE; «i» не раскрывает и не закрывает ничего своего
  const карт=await ev(()=>{
    const d=dayOf(sel); if(!d.ex.length) return null;
    exOpen=0; render();
    const keys=[...document.querySelectorAll('#exl [data-hint]')].map(x=>x.dataset.hint);
    const g=(recOf(sel).log||{})[0]||{};
    document.querySelector('#exl [data-hint="sets"]').click();
    const открыта=!$('hsh').hidden&&$('hshT').textContent==='ПОДХОДЫ'&&/Р — разминка/.test($('hshB').textContent);
    hintClose();
    const тот=exOpen===0&&!((recOf(sel).log||{})[0]||{}).done;
    return {keys, открыта, тот, g:!!g.done};
  });
  const картМ=await замер();
  chk(карт&&['wtoday','sets','rpe'].every(k=>карт.keys?.includes(k))&&карт.открыта&&карт.тот&&!картМ.small?.length&&!картМ.cover?.length&&!картМ.unknown?.length&&картМ.w<=320,
    '4. карточка: «i» у веса/ПОВТ, подходов (Р/О/Д) и RPE; нажатие не трогает подход', JSON.stringify({карт,картМ}));

  // 5. разминка: «i» в сводке открывает подсказку и не разворачивает разминку
  const разм=await ev(()=>{
    const s=document.querySelector('#exl details.wu summary [data-hint="warmup"], #exl .wus [data-hint="warmup"], #exl .wup [data-hint="warmup"]');
    if(!s) return {нет:1};
    const det=s.closest('details'); const было=det?det.open:null;
    s.click();
    const r={t:$('hshT').textContent, было, стало:det?det.open:null, про90:/90 %/.test($('hshB').textContent)};
    hintClose(); return r;
  });
  chk(разм.t==='РАЗМИНКА // БЛИНЫ'&&разм.было===разм.стало&&разм.про90,
    '5. разминка: подсказка по книге, сводка не разворачивается от «i»', JSON.stringify(разм));

  // 6. «Неделя»: «i» в шапке шторки, подсказка поверх, шторка под ней остаётся
  const нед=await ev(()=>{
    exOpen=null; render(); wkMode='this'; openWeekPlan(sel);
    const i=$('shI'); const vis=!i.hidden&&i.offsetParent!==null, r=i.getBoundingClientRect();
    i.click();
    const r1={vis, hint:i.dataset.hint, w:Math.round(r.width), h:Math.round(r.height), t:$('hshT').textContent, поверх:!$('hsh').hidden};
    hintClose(); r1.шторка=$('sh').classList.contains('on'); r1.дни=document.querySelectorAll('#shB [data-wpd]').length;
    sheetClose(); return r1;
  });
  chk(нед.vis&&нед.hint==='week'&&нед.w>=44&&нед.h>=44&&нед.t==='НЕДЕЛЯ'&&нед.поверх&&нед.шторка&&нед.дни===7,
    '6. «Неделя»: «i» в шапке, подсказка поверх, шторка остаётся', JSON.stringify(нед));

  // 7. шторка без подсказки не показывает пустой «i»
  const пустой=await ev(()=>{ sheet('ПРОБА','<p>х</p>'); const v=!$('shI').hidden; sheetClose(); return v; });
  chk(!пустой, '7. у шторки без ключа подсказки «i» нет', String(пустой));

  // 8. «Каталог»: совет, «i» у поиска, фильтры с типами движения по книге
  await ev(()=>{ tab='ex'; render(); });
  await p.waitForTimeout(600);
  const кат=await замер();
  const фил=await ev(()=>{ openLibFilter(); const h=$('shI').dataset.hint; $('shI').click();
    const r={h, t:$('hshT').textContent, гж:/ГЖ — горизонтальный жим/.test($('hshB').textContent)&&/КД = ТД/.test($('hshB').textContent)};
    hintClose(); sheetClose(); r.совет=$('tip-ex').offsetHeight>0; return r; });
  chk(кат.keys?.includes('lib')&&!кат.small?.length&&кат.w<=320&&фил.h==='planes'&&фил.гж&&фил.совет,
    '8. «Каталог»: совет, «i» у поиска, типы движения ГЖ…ТД в фильтрах', JSON.stringify({кат,фил}));

  // 9. «Прогресс»: итоги, рекорды, карта мышц, подходы, цель, расчёт, цикл, квесты, копия
  const прог=await ev(()=>{ // с раскрытого упражнения — прямо на вкладку: body.exopen остаётся, совет не должен пропасть
    tab='wo'; exOpen=0; render(); document.querySelector('.tab[data-tab="prog"]').click();
    const all=[...document.querySelectorAll('#scr-prog [data-hint]')].map(x=>x.dataset.hint);
    return {all, совет:$('tip-prog').offsetHeight>0}; });
  const нужно=['recap','recs','musmap','balance','bwchart','goal','pace','cycle','quests','meas','cal','an','backup','work'];
  chk(нужно.every(k=>прог.all?.includes(k))&&прог.совет,
    '9. «Прогресс»: «i» у итогов, рекордов, карты, баланса, веса, цели, расчёта, цикла, квестов, замеров, истории, разбора, копии', JSON.stringify(прог));
  const цикл=await ev(()=>{ openHint('cycle'); const t=$('hshB').textContent; hintClose();
    openHint('pace'); const t2=$('hshB').textContent; hintClose(); return {лёгк:/80 %/.test(t)&&/60 %/.test(t)&&/2–4 недели/.test(t), темп:/0,25–0,5 %/.test(t2)&&/1,45/.test(t2)&&/200 ккал/.test(t2)}; });
  chk(цикл.лёгк&&цикл.темп, '10. цикл объясняет лёгкие недели и разгрузку, расчёт — коридор и коэффициенты', JSON.stringify(цикл));

  // 11. «Еда»: калории, белок по нутрициологии, добавки; пустые добавки учат
  const еда=await ev(()=>{ tab='food'; dayOf(sel).sp=[]; render();
    const keys=[...document.querySelectorAll('#scr-food [data-hint]')].map(x=>x.dataset.hint);
    openHint('protein'); const pr=$('hshB').textContent, src=$('hshS').textContent; hintClose();
    openHint('supp'); const sp=$('hshB').textContent; hintClose();
    return {keys, белок:/1,6–2,2/.test(pr)&&/0,4 г\/кг/.test(pr)&&/нутрициология/i.test(src),
      добавки:/3–5 г/.test(sp)&&/3–6 мг\/кг/.test(sp), пусто:/креатин/.test($('spl').textContent), совет:$('tip-food').offsetHeight>0}; });
  const едаМ=await замер();
  chk(['kcal','protein','meals','supp'].every(k=>еда.keys?.includes(k))&&еда.белок&&еда.добавки&&еда.пусто&&еда.совет&&!едаМ.small?.length&&!едаМ.cover?.length&&едаМ.w<=320,
    '11. «Еда»: «i» у калорий, белка (1,6–2,2 г/кг), рациона, добавок; пустые добавки учат', JSON.stringify({еда,едаМ}));

  // 12. «Фото» и день отдыха
  const фото=await ev(()=>{ tab='photo'; render(); return [...document.querySelectorAll('#scr-photo [data-hint]')].map(x=>x.dataset.hint); });
  const отдых=await ev(()=>{ let d=null; for(let k=0;k<14;k++){ const x=addDays(today(),k); if(dayOf(x).t==='rest'&&!dayEntries(x).length){ d=x; break; } }
    if(!d) return null; sel=d; tab='wo'; render(); const w=$('restW');
    return {vis:!w.hidden&&w.offsetHeight>0, hint:!!w.querySelector('[data-hint="rest"]'), txt:/Неделя/.test(w.textContent)}; });
  chk(фото?.includes('photo')&&отдых&&отдых.vis&&отдых.hint&&отдых.txt,
    '12. «Фото» с «i»; день отдыха — не пустой экран, а подсказка', JSON.stringify({фото,отдых}));

  // 13. «Понятно» закрывает совет навсегда: переживает перезагрузку
  await сброс();
  await p.click('#tip-wo [data-tipok]',{timeout:3000}).catch(()=>{}); await p.waitForTimeout(100);
  const закрыт=await ev(()=>({скрыт:$('tip-wo').hidden, tips:JSON.stringify(S.tips)}));
  await ev(()=>flush()); await p.reload(); await p.waitForTimeout(1300);
  const послеП=await ev(()=>({скрыт:$('tip-wo').hidden, еда:(tab='food',render(),$('tip-food').offsetHeight>0), tips:JSON.stringify(S.tips)}));
  chk(закрыт.скрыт&&закрыт.tips==='{"wo":1}'&&послеП.скрыт&&послеП.еда,
    '13. «Понятно» убирает совет экрана и помнит это после перезагрузки', JSON.stringify({закрыт,послеП}));

  // 14. выключатель в шестерёнке: всё «i» и советы пропадают и не возвращаются после перезагрузки
  await ev(()=>{ tab='wo'; render(); });
  await p.click('#gear',{timeout:3000}).catch(()=>{}); await p.waitForTimeout(100);
  const вык=await ev(()=>{ const bt=document.querySelector('#shB [data-hints]'); if(!bt) return null;
    const r=bt.getBoundingClientRect(); bt.click(); sheetClose(); render();
    const vis=[...document.querySelectorAll('button.hib')].filter(x=>x.offsetParent!==null).length;
    return {h:Math.round(r.height), hints:S.hints, vis, tip:[...document.querySelectorAll('.tip')].filter(x=>x.offsetParent!==null).length}; });
  await ev(()=>flush()); await p.reload(); await p.waitForTimeout(1300);
  const вык2=await ev(()=>({hints:S.hints, nohints:document.body.classList.contains('nohints'),
    vis:[...document.querySelectorAll('button.hib')].filter(x=>x.offsetParent!==null).length}));
  const вкл=await ev(()=>{ openSettings(); const bt=document.querySelector('#shB [data-hints]'); bt.click(); const t=document.querySelector('#shB [data-hints]').textContent; sheetClose(); render();
    return {hints:S.hints, t, vis:[...document.querySelectorAll('button.hib')].filter(x=>x.offsetParent!==null).length}; });
  chk(вык&&вык.h>=44&&вык.hints===0&&вык.vis===0&&вык.tip===0&&вык2.hints===0&&вык2.nohints&&вык2.vis===0&&вкл.hints===undefined&&/вкл/.test(вкл.t)&&вкл.vis>0,
    '14. «Подсказки: выкл» прячет все «i» и советы, переживает перезагрузку, включается обратно', JSON.stringify({вык,вык2,вкл}));

  // 15. мусор в S.tips и S.hints из правленой копии чинится
  await ev(()=>{ S.tips={wo:'да', ex:1, food:true, zzz:1, prog:[1]}; S.hints='нет'; flush(); });
  await p.reload(); await p.waitForTimeout(1300);
  const мусор=await ev(()=>({tips:JSON.stringify(S.tips), hints:S.hints===undefined, совет:!$('tip-wo').hidden}));
  await ev(()=>{ S.tips='строка'; flush(); });
  await p.reload(); await p.waitForTimeout(1300);
  const мусор2=await ev(()=>JSON.stringify(S.tips));
  await ev(()=>{ S.tips=[1,2]; flush(); });
  await p.reload(); await p.waitForTimeout(1300);
  const мусор3=await ev(()=>JSON.stringify(S.tips));
  chk(мусор.tips==='{"ex":1,"food":1}'&&мусор.hints&&мусор.совет&&мусор2==='{}'&&мусор3==='{}',
    '15. мусор в S.tips и S.hints вычищается при загрузке', JSON.stringify({мусор,мусор2,мусор3}));

  // 16. каждая подсказка — заголовок, текст с цифрами или правилом и источник; книги названы
  const все=await ev(()=>{
    const bad=Object.entries(HINTS).filter(([k,h])=>!h[0]||!Array.isArray(h[1])||!h[1].length||!h[2]||h[1].some(x=>!x||x.length>400)).map(([k])=>k);
    const книги=Object.values(HINTS).filter(h=>/f/.test(h[2])).length, нутр=Object.values(HINTS).filter(h=>/n/.test(h[2])).length;
    return {n:Object.keys(HINTS).length, bad, книги, нутр};
  });
  chk(все.n>=30&&!все.bad?.length&&все.книги>=10&&все.нутр>=3,
    '16. подсказок 30+, у каждой заголовок, короткий текст и источник', JSON.stringify(все));

  chk(!errs.length, '17. без ошибок на странице', errs.join(' | '));
  await b.close();
  console.log(fails?'\n✗ провалов: '+fails:'\n✓ всё зелёное');
  process.exit(fails?1:0);
})();

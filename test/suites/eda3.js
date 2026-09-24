/* Своя база продуктов: добавить, поправить, убрать. До правки продукт можно
   было только добавить — ошибся в калориях, и он оставался навсегда. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s;S.sound=0;
      tab='food'; sel=today(); save(); render();},skin);
    await p.waitForTimeout(300);

    // 1. добавляем свой продукт
    await p.evaluate(()=>{ openPick(0); });
    await p.waitForTimeout(200);
    await p.evaluate(()=>{ document.getElementById('fq').value='Шаурма у дома';
      document.getElementById('fq').dispatchEvent(new Event('input',{bubbles:true})); });
    await p.waitForTimeout(200);
    const form=await p.evaluate(()=>!!document.getElementById('nfSave'));
    chk(form,'1. на незнакомое имя предлагают завести свой продукт', form?'форма есть':'формы нет');
    await p.evaluate(()=>{
      document.getElementById('nfK').value='250';
      document.getElementById('nfP').value='12';
      document.getElementById('nfF').value='10';
      document.getElementById('nfC').value='25';
      document.getElementById('nfSave').click();
    });
    await p.waitForTimeout(300);
    const added=await p.evaluate(()=>S.myFood.map(f=>f.n+':'+f.k).join(','));
    chk(added==='Шаурма у дома:250','2. продукт записан в свою базу',added);

    // 3. точное имя открывает ту же строку на правку, а не второй дубль
    const upd=await p.evaluate(()=>({
      btn: (document.getElementById('nfSave')||{}).textContent,
      k: (document.getElementById('nfK')||{}).value }));
    chk(upd.btn==='ОБНОВИТЬ ПРОДУКТ','3. форма переключилась на правку',upd.btn||'формы нет');
    chk(upd.k==='250','4. значения подставлены в форму',upd.k);
    await p.evaluate(()=>{ document.getElementById('nfK').value='300'; document.getElementById('nfSave').click(); });
    await p.waitForTimeout(300);
    const after=await p.evaluate(()=>S.myFood.map(f=>f.n+':'+f.k).join(','));
    chk(after==='Шаурма у дома:300','5. правка не плодит дубль',after);
    const seen=await p.evaluate(()=>findFood('Шаурма у дома').slice(0,2).join(':'));
    chk(seen==='Шаурма у дома:300','6. указатель базы обновился (кэш сброшен)',seen);

    // 7. продукт добавляется в приём и считается
    await p.evaluate(()=>{
      const el=[...document.querySelectorAll('#fpl [data-add]')].find(x=>x.dataset.add==='Шаурма у дома');
      el.click(); document.getElementById('fpAdd').click(); });
    await p.waitForTimeout(400);
    const tot=await p.evaluate(()=>rnd(daySum(sel).k));
    chk(tot===300,'7. 100 г нового продукта дают 300 ккал',String(tot));

    // 8-9. удаление: спрашивает и предупреждает про записи
    await p.evaluate(()=>{ openPick(0);
      document.getElementById('fq').value='Шаурма у дома';
      document.getElementById('fq').dispatchEvent(new Event('input',{bubbles:true})); });
    await p.waitForTimeout(250);
    const hasDel=await p.evaluate(()=>!!document.querySelector('#fpl [data-my]'));
    chk(hasDel,'8. у своего продукта есть крестик', hasDel?'есть':'нет');
    const askTxt=await p.evaluate(async()=>{
      document.querySelector('#fpl [data-my]').click();
      await new Promise(r=>setTimeout(r,200));
      return document.getElementById('askT').textContent;
    });
    chk(/записан в дни/.test(askTxt),'9. предупреждает, что продукт уже записан',askTxt);
    await p.evaluate(()=>{ [...document.querySelectorAll('#askW button, .askw button')]
      .find(x=>/УБРАТЬ/.test(x.textContent)).click(); });
    await p.waitForTimeout(400);
    const left=await p.evaluate(()=>S.myFood.length);
    chk(left===0,'10. продукт убран из своей базы','осталось '+left);
    const gone=await p.evaluate(()=>findFood('Шаурма у дома'));
    chk(gone===null,'11. указатель базы больше его не знает',String(gone));
    const line=await p.evaluate(()=>{ closePick(); paintFood();
      return document.querySelector('#mll .it .kk').textContent; });
    chk(line==='нет в базе','12. строка в дне честно говорит, что продукта нет',line);

    chk(errs.length===0,'13. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();

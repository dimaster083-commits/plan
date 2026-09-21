#!/usr/bin/env node
/* Собирает index.html с фишками: вставляет feat/<имя>.css и feat/<имя>.js
   между метками ==ФИШКИ:СТИЛИ== и ==ФИШКИ:КОД==.

   node feat/sborka.js out.html plity maks        — собрать с двумя фишками
   node feat/sborka.js --in                       — вписать ВСЕ фишки в сам index.html
*/
const fs=require('fs'), path=require('path');
const корень=path.join(__dirname,'..');
const читать=f=>{ try { return fs.readFileSync(path.join(__dirname,f),'utf8').trim(); } catch(e){ return ''; } };

const арг=process.argv.slice(2);
const вСебя=арг[0]==='--in';
const выход=вСебя?path.join(корень,'index.html'):path.resolve(арг[0]||'/tmp/sborka.html');
let имена=вСебя?арг.slice(1):арг.slice(1);
if(!имена.length){
  имена=[...new Set(fs.readdirSync(__dirname)
    .filter(f=>/\.(css|js)$/.test(f)&&f!=='sborka.js').map(f=>f.replace(/\.(css|js)$/,'')))].sort();
}

let h=fs.readFileSync(path.join(корень,'index.html'),'utf8');
const вставить=(метка,куски)=>{
  const a=h.indexOf('/* ==ФИШКИ:'+метка+'== */');
  const b=h.indexOf('/* ==/ФИШКИ:'+метка+'== */');
  if(a<0||b<0) throw new Error('нет меток '+метка);
  const голова=h.slice(0,a+('/* ==ФИШКИ:'+метка+'== */').length);
  const хвост=h.slice(b);
  h=голова+'\n'+куски.filter(Boolean).join('\n\n')+'\n'+хвост;
};
вставить('СТИЛИ', имена.map(n=>читать(n+'.css')));
вставить('КОД', имена.map(n=>читать(n+'.js')));
fs.writeFileSync(выход,h);
console.log('собрано:', выход, '· фишек:', имена.join(', ')||'ни одной');

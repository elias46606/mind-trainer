/* Mind Trainer – App-Logik */
(function(){
const $=s=>document.querySelector(s);
const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=rnd(0,i);[a[i],a[j]]=[a[j],a[i]]}return a};
const dkey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Firebase ---------- */
const CFG=window.FIREBASE_CONFIG||{};
const HAS_FB=!!(CFG.apiKey&&window.firebase);
let auth=null,fdb=null,TS=null;
if(HAS_FB){
  try{firebase.initializeApp(CFG);auth=firebase.auth();fdb=firebase.firestore();TS=()=>firebase.firestore.FieldValue.serverTimestamp();}
  catch(e){console.error(e)}
}

/* ---------- Fragen ---------- */
const Q=window.QUESTIONS||{};
const BYID={};
Object.entries(Q).forEach(([cat,list])=>list.forEach(([id,q,o,f])=>BYID[id]={id,cat,q,o,f}));
const ALL_IDS=Object.keys(BYID);
const KNOW_CATS=Object.keys(Q).filter(c=>c!=='Life-Skills');
const catIds=c=>c==='Mix'?KNOW_CATS.flatMap(k=>Q[k].map(x=>x[0])):(Q[c]||[]).map(x=>x[0]);

/* ---------- Zustand ---------- */
const FIELDS=['username','rounds','best','quizBest','seen','wrong','habits','days'];
const EMPTY=()=>({username:'',rounds:0,best:{math:0,digits:0,stroop:0},quizBest:{},seen:[],wrong:[],habits:{},days:[]});
let S=EMPTY(),USER=null,MODE=null,IS_ADMIN=false,ADMIN_ERR='',pendingName='',pendingCarry=null;
const GKEY='mindtrainer-guest-v2',GFLAG='mindtrainer-guestmode';
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
function clean(d){const o=EMPTY();FIELDS.forEach(f=>{if(d&&d[f]!=null)o[f]=d[f]});o.best=Object.assign(EMPTY().best,o.best||{});
  o.seen=(o.seen||[]).filter(id=>BYID[id]);o.wrong=(o.wrong||[]).filter(id=>BYID[id]);return o}
function loadGuest(){const r=ls.get(GKEY);if(r){try{return clean(JSON.parse(r))}catch(e){}}
  const old=ls.get('mindtrainer-v1');if(old){try{const o=JSON.parse(old);return clean({best:o.best,habits:o.habits,rounds:o.played||0})}catch(e){}}
  return EMPTY()}
function prune(){
  const cut=new Date();cut.setDate(cut.getDate()-60);const ck=dkey(cut);
  Object.keys(S.habits).forEach(k=>{if(k<ck)delete S.habits[k]});
  S.days=S.days.filter(k=>k>=ck);
}
let saveT=null,chain=Promise.resolve();
function save(now){clearTimeout(saveT);if(now)return flush();saveT=setTimeout(flush,700)}
function flush(){
  prune();
  if(MODE==='guest'){ls.set(GKEY,JSON.stringify(S));return Promise.resolve()}
  if(MODE==='cloud'&&USER){
    const uid=USER.uid,data=JSON.parse(JSON.stringify(S));data.lastActive=TS();
    chain=chain.then(()=>fdb.collection('users').doc(uid).update(data)).catch(e=>{console.error(e);toast('Speichern fehlgeschlagen. Prüfe deine Internetverbindung.')});
    return chain;
  }
  return Promise.resolve();
}
window.addEventListener('pagehide',()=>{if(saveT){clearTimeout(saveT);flush()}});

let toastT=null;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200)}

/* ---------- Navigation ---------- */
const VIEWS=['auth','home','math','digits','stroop','quizmenu','quiz','life','stats','admin','privacy','contact'];
let CUR='auth',PREV='auth';
let timers=[];
function clearTimers(){timers.forEach(t=>{clearInterval(t);clearTimeout(t)});timers=[]}
function go(v){
  if(v==='admin'&&!IS_ADMIN)v='home';
  clearTimers();
  if(v!=='privacy'&&v!=='contact')PREV=v;CUR=v;
  VIEWS.forEach(x=>$('#v-'+x).hidden=x!==v);
  window.scrollTo(0,0);
  ({auth:renderAuth,home:renderHome,math:startMath,digits:startDigits,stroop:startStroop,quizmenu:renderCats,life:renderLife,stats:renderStats,admin:renderAdmin}[v]||(()=>{}))();
}
document.addEventListener('click',e=>{if(e.target.closest('[data-back]')){e.preventDefault();go(MODE||PREV==='auth'?PREV:'auth');return}const b=e.target.closest('[data-go]');if(b){e.preventDefault();go(b.dataset.go)}});

function markDay(){const k=dkey();if(!S.days.includes(k))S.days.push(k)}
function finish(game,score,wrap,extra){
  S.rounds++;markDay();
  const isNew=score>(S.best[game]||0);if(isNew)S.best[game]=score;save();
  wrap.hidden=false;
  wrap.innerHTML=`<div class="result"><p class="label">Ergebnis</p><div class="big">${score}</div>${extra||''}${isNew&&score>0?'<p class="new">Neuer Rekord!</p>':`<p class="muted">Rekord: ${S.best[game]}</p>`}</div><div class="row" style="width:100%"><button class="btn" data-go="${game}">Nochmal</button><button class="btn ghost" data-go="home">Start</button></div>`;
}

/* ---------- Anmeldung ---------- */
let authTab='reg';
function setTab(t){
  authTab=t;$('#tab-reg').classList.toggle('on',t==='reg');$('#tab-login').classList.toggle('on',t==='login');
  $('#fld-name').hidden=t!=='reg';$('#auth-forgot').hidden=t!=='login';
  $('#auth-go').textContent=t==='reg'?'Konto erstellen':'Anmelden';
  $('#in-pass').autocomplete=t==='reg'?'new-password':'current-password';
  $('#auth-err').textContent='';$('#auth-err').className='err';
}
$('#tab-reg').onclick=()=>setTab('reg');$('#tab-login').onclick=()=>setTab('login');
function renderAuth(){
  $('#fb-missing').hidden=HAS_FB;$('#auth-box').hidden=!HAS_FB;
  $('#guest-go').textContent=MODE==='guest'?'Weiter als Gast':'Ohne Konto testen';
}
const AUTH_ERR={
  'auth/email-already-in-use':'Diese E-Mail ist schon registriert. Melde dich stattdessen an.',
  'auth/invalid-email':'Die E-Mail-Adresse ist ungültig.',
  'auth/weak-password':'Das Passwort braucht mindestens 6 Zeichen.',
  'auth/invalid-credential':'E-Mail oder Passwort stimmt nicht.',
  'auth/wrong-password':'E-Mail oder Passwort stimmt nicht.',
  'auth/user-not-found':'Zu dieser E-Mail gibt es kein Konto.',
  'auth/too-many-requests':'Zu viele Versuche. Warte kurz und versuch es dann nochmal.',
  'auth/network-request-failed':'Keine Verbindung. Prüfe dein Internet.',
  'auth/missing-password':'Bitte gib ein Passwort ein.'
};
$('#f-auth').onsubmit=async e=>{
  e.preventDefault();if(!HAS_FB)return;
  const name=$('#in-name').value.trim(),mail=$('#in-mail').value.trim(),pass=$('#in-pass').value;
  const err=$('#auth-err');err.className='err';err.textContent='';
  if(authTab==='reg'&&!/^[\wäöüÄÖÜß.\-]{3,20}$/.test(name)){err.textContent='Benutzername: 3–20 Zeichen, nur Buchstaben, Zahlen, _ . -';return}
  const btn=$('#auth-go');btn.disabled=true;
  try{
    if(authTab==='reg'){
      pendingName=name;pendingCarry=MODE==='guest'?JSON.parse(JSON.stringify(S)):null;
      const cred=await auth.createUserWithEmailAndPassword(mail,pass);
      try{await cred.user.updateProfile({displayName:name})}catch(_){}
    }else{
      await auth.signInWithEmailAndPassword(mail,pass);
    }
  }catch(ex){err.textContent=AUTH_ERR[ex.code]||'Das hat nicht geklappt ('+(ex.code||'unbekannt')+').'}
  btn.disabled=false;
};
$('#auth-forgot').onclick=async()=>{
  const mail=$('#in-mail').value.trim(),err=$('#auth-err');
  if(!mail){err.className='err';err.textContent='Gib oben deine E-Mail ein, dann schicken wir dir einen Link.';return}
  try{await auth.sendPasswordResetEmail(mail);err.className='ok-msg';err.textContent='Link zum Zurücksetzen wurde gesendet. Schau auch im Spam-Ordner.'}
  catch(ex){err.className='err';err.textContent=AUTH_ERR[ex.code]||'Konnte keine E-Mail senden.'}
};
$('#guest-go').onclick=()=>{MODE='guest';ls.set(GFLAG,'1');S=loadGuest();enter()};

async function loadCloud(){
  const ref=fdb.collection('users').doc(USER.uid);
  try{
    const snap=await ref.get();
    if(snap.exists){S=clean(snap.data());if(!S.username)S.username=USER.displayName||USER.email.split('@')[0];await ref.set({lastActive:TS()},{merge:true})}
    else{
      S=pendingCarry?clean(pendingCarry):EMPTY();
      S.username=pendingName||USER.displayName||(USER.email||'').split('@')[0];
      await ref.set(Object.assign(JSON.parse(JSON.stringify(S)),{createdAt:TS(),lastActive:TS()}));
      if(pendingCarry){ls.del(GKEY)}
      toast('Willkommen, '+S.username+'!');
    }
  }catch(e){console.error(e);toast('Konnte deine Daten nicht laden. Prüfe deine Verbindung.')}
  pendingName='';pendingCarry=null;
  ADMIN_ERR='';try{IS_ADMIN=(await fdb.collection('admins').doc(USER.uid).get()).exists}catch(e){IS_ADMIN=false;ADMIN_ERR=e.code||String(e)}
}
function enter(){go('home')}

function boot(){
  if(HAS_FB&&auth){
    auth.onAuthStateChanged(async u=>{
      if(u){USER=u;MODE='cloud';ls.del(GFLAG);await loadCloud();enter()}
      else{USER=null;IS_ADMIN=false;
        if(ls.get(GFLAG)==='1'){MODE='guest';S=loadGuest();enter()}
        else{MODE=null;S=EMPTY();go('auth')}}
    });
  }else{
    if(ls.get(GFLAG)==='1'){MODE='guest';S=loadGuest();enter()}else go('auth');
  }
}

/* ---------- Start ---------- */
function renderHome(){
  const h=new Date().getHours();
  $('#greet').textContent=(h<11?'Guten Morgen':h<18?'Guten Tag':'Guten Abend')+(S.username?', '+S.username:'');
  $('#guest-banner').hidden=MODE!=='guest'||!HAS_FB;
  $('#admin-tile').hidden=!IS_ADMIN;
  $('#b-math').textContent='Rekord: '+(S.best.math||'–');
  $('#b-digits').textContent='Rekord: '+(S.best.digits?S.best.digits+' Ziffern':'–');
  $('#b-stroop').textContent='Rekord: '+(S.best.stroop||'–');
  const seen=new Set(S.seen),left=ALL_IDS.filter(i=>!seen.has(i)).length;
  $('#b-quiz-sub').textContent=left+' neue Fragen';
  $('#b-quiz').textContent=S.wrong.length?S.wrong.length+' im Fehler-Stapel':'Fehler-Stapel leer';
  $('#b-life').textContent=todayDone()+' von '+HABITS.length+' heute';
  $('#b-total').textContent=S.rounds+' Runden · '+S.days.length+' Trainingstage';
  $('#h-streak').textContent=streak();
}

/* ---------- Ziffernblock ---------- */
function buildPad(el,onKey,goLabel){
  const keys=['1','2','3','4','5','6','7','8','9',goLabel?'⌫':'',  '0',goLabel||'⌫'];
  el.innerHTML=keys.map(k=>k?`<button class="${k==='⌫'?'act':k===goLabel?'go':''}" data-k="${k}" aria-label="${k==='⌫'?'Löschen':k}">${k}</button>`:'<span></span>').join('');
  el.onclick=e=>{const b=e.target.closest('button');if(b)onKey(b.dataset.k)};
}

/* ---------- Kopfrechnen ---------- */
let M={};
function mathTask(l){
  const ops=l<3?['+','−']:l<5?['+','−','×']:['+','−','×','÷'];
  const op=ops[rnd(0,ops.length-1)];let a,b,r;
  const big=l<2?10:l<4?30:l<6?60:100;
  if(op==='+'){a=rnd(2,big);b=rnd(2,big);r=a+b}
  else if(op==='−'){a=rnd(5,big+10);b=rnd(1,a);r=a-b}
  else if(op==='×'){const m=l<5?10:l<7?13:20;a=rnd(2,m);b=rnd(2,12);r=a*b}
  else{b=rnd(2,l<7?10:15);r=rnd(2,12);a=b*r}
  return{t:`${a} ${op} ${b}`,r:String(r)};
}
function startMath(){
  M={score:0,lvl:1,input:'',time:60,cur:null};
  $('#m-end').hidden=true;$('#m-stage').hidden=false;$('#m-pad').hidden=false;
  buildPad($('#m-pad'),mathKey);nextMath();
  $('#m-timer').style.width='100%';$('#m-score').textContent='0';
  timers.push(setInterval(()=>{M.time-=.25;$('#m-timer').style.width=(M.time/60*100)+'%';
    if(M.time<=0){clearTimers();$('#m-stage').hidden=true;$('#m-pad').hidden=true;finish('math',M.score,$('#m-end'),`<p class="muted">Level ${M.lvl} erreicht</p>`)}},250));
}
function nextMath(){M.lvl=1+Math.floor(M.score/4);M.cur=mathTask(M.lvl);M.input='';$('#m-task').textContent=M.cur.t;$('#m-lvl').textContent='Level '+M.lvl;drawMath()}
function drawMath(cls){const a=$('#m-ans');a.textContent=M.input||' ';a.className='answer'+(cls?' '+cls:'')}
function mathKey(k){
  if(M.time<=0)return;
  if(k==='⌫'){M.input=M.input.slice(0,-1);return drawMath()}
  if(M.input.length>=5)return;
  M.input+=k;
  if(M.input===M.cur.r){M.score++;$('#m-score').textContent=M.score;drawMath('ok');timers.push(setTimeout(nextMath,180))}
  else if(M.input.length>=M.cur.r.length)drawMath('no');
  else drawMath();
}

/* ---------- Zahlen merken ---------- */
let D={};
function startDigits(){D={len:3,input:'',seq:'',phase:'show'};$('#d-end').hidden=true;$('#d-stage').hidden=false;$('#d-pad').hidden=false;buildPad($('#d-pad'),digitKey,'OK');roundDigits()}
function roundDigits(){
  D.seq='';for(let i=0;i<D.len;i++)D.seq+=rnd(i===0?1:0,9);
  D.input='';D.phase='show';
  $('#d-len').textContent=D.len+' Ziffern';$('#d-hint').textContent='Merk dir die Zahl';
  $('#d-show').textContent=D.seq.replace(/(\d{3})(?=\d)/g,'$1 ');$('#d-ans').textContent=' ';$('#d-ans').className='answer';
  timers.push(setTimeout(()=>{D.phase='input';$('#d-show').textContent='•'.repeat(Math.min(D.len,12));$('#d-hint').textContent='Jetzt eingeben'},700+D.len*550));
}
function digitKey(k){
  if(D.phase!=='input')return;
  if(k==='⌫')D.input=D.input.slice(0,-1);
  else if(k==='OK'){
    const ok=D.input===D.seq;$('#d-ans').className='answer '+(ok?'ok':'no');$('#d-show').textContent=D.seq;D.phase='wait';
    if(ok){$('#d-hint').textContent='Richtig!';D.len++;timers.push(setTimeout(roundDigits,900))}
    else{$('#d-hint').textContent='Leider falsch';timers.push(setTimeout(()=>{$('#d-stage').hidden=true;$('#d-pad').hidden=true;finish('digits',D.len-1,$('#d-end'),'<p class="muted">Ziffern sicher gemerkt</p>')},1200))}
    return;
  }else if(D.input.length<D.len+2)D.input+=k;
  $('#d-ans').textContent=D.input||' ';
}

/* ---------- Farben-Test ---------- */
const COLS=[{n:'ROT',v:'--c-rot'},{n:'BLAU',v:'--c-blau'},{n:'GRÜN',v:'--c-gruen'},{n:'GELB',v:'--c-gelb',dark:1}];
let C={};
function startStroop(){
  C={score:0,wrong:0,time:30,ink:0};
  $('#s-end').hidden=true;$('#s-stage').hidden=false;$('#s-btns').hidden=false;
  $('#s-btns').innerHTML=COLS.map((c,i)=>`<button data-i="${i}" style="background:var(${c.v})${c.dark?';color:#1B1B1B':''}">${c.n}</button>`).join('');
  $('#s-btns').onclick=e=>{const b=e.target.closest('button');if(!b||C.time<=0)return;
    if(+b.dataset.i===C.ink){C.score++;$('#s-score').textContent=C.score}else{C.wrong++;$('#s-wrong').textContent='Fehler: '+C.wrong}nextStroop()};
  $('#s-score').textContent='0';$('#s-wrong').textContent='Fehler: 0';$('#s-timer').style.width='100%';nextStroop();
  timers.push(setInterval(()=>{C.time-=.25;$('#s-timer').style.width=(C.time/30*100)+'%';
    if(C.time<=0){clearTimers();$('#s-stage').hidden=true;$('#s-btns').hidden=true;
      finish('stroop',Math.max(0,C.score-C.wrong),$('#s-end'),`<p class="muted">${C.score} richtig · ${C.wrong} Fehler (Punkte = richtig − Fehler)</p>`)}},250));
}
function nextStroop(){
  const w=rnd(0,3);let ink=w;if(Math.random()<.75){while(ink===w)ink=rnd(0,3)}
  C.ink=ink;const el=$('#s-word');el.textContent=COLS[w].n;el.style.color=`var(${COLS[ink].v})`;
}

/* ---------- Quiz ---------- */
let qSel='Mix',QZ=null;
function unseenIn(cat){const s=new Set(S.seen);return catIds(cat).filter(i=>!s.has(i))}
function renderCats(){
  const cats=['Mix',...KNOW_CATS,'Life-Skills'];
  const seen=new Set(S.seen);
  $('#q-total').textContent=seen.size+'/'+ALL_IDS.length+' gesehen';
  let html=cats.map(c=>{const n=unseenIn(c).length;return `<button class="chip ${c===qSel?'on':''}" data-c="${c}">${c}<small>${n} neu</small></button>`}).join('');
  html+=`<button class="chip redo ${qSel==='Fehler'?'on':''}" data-c="Fehler" ${S.wrong.length?'':'disabled'}>Fehler wiederholen<small>${S.wrong.length}</small></button>`;
  $('#q-cats').innerHTML=html;
  $('#q-cats').onclick=e=>{const b=e.target.closest('[data-c]');if(b&&!b.disabled){qSel=b.dataset.c;renderCats()}};
  if(qSel==='Fehler'&&!S.wrong.length)qSel='Mix';
  const left=qSel==='Fehler'?S.wrong.length:unseenIn(qSel).length;
  const empty=$('#q-empty');
  if(left===0){
    empty.hidden=false;$('#q-start').hidden=true;
    empty.innerHTML=`<h3>Alle Fragen in „${esc(qSel)}“ geschafft</h3><p class="muted small">Neue Fragen kommen mit Updates dazu. Du kannst die Kategorie auch zurücksetzen und von vorn beginnen – dein Fehler-Stapel bleibt erhalten.</p><button class="btn ghost" id="q-resetcat">„${esc(qSel)}“ zurücksetzen</button>`;
    $('#q-resetcat').onclick=()=>{const ids=new Set(catIds(qSel));S.seen=S.seen.filter(i=>!ids.has(i));save();renderCats()};
  }else{
    empty.hidden=true;$('#q-start').hidden=false;
    $('#q-start').textContent=qSel==='Fehler'?`${Math.min(10,left)} Fehler wiederholen`:`Runde starten · ${Math.min(10,left)} Fragen`;
  }
}
$('#q-start').onclick=()=>startQuiz(qSel);
function startQuiz(cat){
  qSel=cat;
  const ids=cat==='Fehler'?shuffle(S.wrong).slice(0,10):shuffle(unseenIn(cat)).slice(0,10);
  if(!ids.length){go('quizmenu');return}
  QZ={cat,review:cat==='Fehler',list:ids.map(i=>BYID[i]),i:0,score:0,locked:false};
  VIEWS.forEach(x=>$('#v-'+x).hidden=x!=='quiz');window.scrollTo(0,0);
  $('#q-stage').hidden=false;$('#q-end').hidden=true;showQ();
}
function showQ(){
  if(QZ.i>=QZ.list.length)return endQuiz();
  const it=QZ.list[QZ.i],n=QZ.list.length;
  QZ.order=shuffle(it.o.map((o,i)=>({o,ok:i===0})));QZ.locked=false;
  $('#q-prog').textContent=(QZ.i+1)+'/'+n;$('#q-bar').style.width=(QZ.i/n*100)+'%';
  $('#q-cat').textContent=QZ.review?'Fehler-Stapel · '+it.cat:it.cat;$('#q-text').textContent=it.q;
  $('#q-fact').hidden=true;$('#q-next').hidden=true;
  $('#q-opts').innerHTML=QZ.order.map((x,i)=>`<button class="opt" data-i="${i}">${esc(x.o)}</button>`).join('');
}
$('#q-opts').onclick=e=>{
  const b=e.target.closest('.opt');if(!b||QZ.locked)return;QZ.locked=true;
  const it=QZ.list[QZ.i],ok=QZ.order[+b.dataset.i].ok;
  if(ok)QZ.score++;else b.classList.add('wrong');
  $('#q-opts').querySelectorAll('.opt').forEach((el,i)=>{if(QZ.order[i].ok)el.classList.add('right')});
  if(!S.seen.includes(it.id))S.seen.push(it.id);
  if(ok&&QZ.review)S.wrong=S.wrong.filter(x=>x!==it.id);
  if(!ok&&!S.wrong.includes(it.id))S.wrong.push(it.id);
  save();
  $('#q-fact').textContent=it.f;$('#q-fact').hidden=false;$('#q-next').hidden=false;
  $('#q-next').textContent=QZ.i+1<QZ.list.length?'Weiter':'Ergebnis';$('#q-next').focus();
};
$('#q-next').onclick=()=>{QZ.i++;showQ()};
function endQuiz(){
  const n=QZ.list.length;S.rounds++;markDay();
  let isNew=false;
  if(!QZ.review&&n===10){isNew=QZ.score>(S.quizBest[QZ.cat]??-1);if(isNew)S.quizBest[QZ.cat]=QZ.score}
  save();
  $('#q-bar').style.width='100%';$('#q-stage').hidden=true;
  const end=$('#q-end');end.hidden=false;
  const wrongNow=n-QZ.score;
  const msg=QZ.review?(wrongNow?`${QZ.score} aus dem Stapel geschafft. ${S.wrong.length} Fragen bleiben drin.`:'Alles richtig – diese Fragen sind raus aus dem Stapel.')
    :(QZ.score>=9?'Stark!':QZ.score>=6?'Solide – da geht noch was.':'Weiter üben, das sitzt bald.')+(wrongNow?` ${wrongNow} ${wrongNow===1?'Frage liegt':'Fragen liegen'} jetzt im Fehler-Stapel.`:'');
  end.innerHTML=`<div class="result"><p class="label">${esc(QZ.review?'Fehler-Stapel':QZ.cat)}</p><div class="big">${QZ.score}/${n}</div>${isNew?'<p class="new">Bestes Ergebnis in dieser Kategorie</p>':''}<p class="muted">${msg}</p></div><div class="row" style="width:100%"><button class="btn" id="q-again">Nächste Runde</button><button class="btn ghost" data-go="home">Start</button></div>`;
  $('#q-again').onclick=()=>{const c=QZ.review&&!S.wrong.length?'Mix':QZ.cat;const left=c==='Fehler'?S.wrong.length:unseenIn(c).length;qSel=c;left?startQuiz(c):go('quizmenu')};
}

/* ---------- Lifemaxing ---------- */
const HABITS=[
{id:'water',t:'2 Liter Wasser',s:'Über den Tag verteilt'},
{id:'move',t:'30 Min Bewegung',s:'Sport, Spaziergang, Rad'},
{id:'read',t:'15 Min lesen',s:'Buch, keine Social-Media-Posts'},
{id:'learn',t:'Etwas Neues gelernt',s:'Vokabeln, Quiz, Doku'},
{id:'focus',t:'1 Fokusblock ohne Handy',s:'z. B. 2 Pomodoros am Stück'},
{id:'sleep',t:'Bildschirm aus vor dem Schlafen',s:'30 Min vorher'}];
const TIPS=[
'Mach die schwierigste Aufgabe des Tages zuerst – solange die Konzentration frisch ist.',
'Erklär dir ein Thema laut selbst. Wo du stockst, liegt deine Lücke.',
'Leg das Handy beim Lernen in einen anderen Raum. Schon die Sichtbarkeit lenkt ab.',
'Schreib abends drei Dinge für morgen auf. Dann startet der Tag ohne Grübeln.',
'Kurze Wiederholung nach 1 Tag, 3 Tagen und 1 Woche bringt mehr als stundenlanges Pauken am Stück.',
'Ein 10-Minuten-Spaziergang zwischen Lernblöcken frischt die Aufmerksamkeit auf.',
'Bezahl dich zuerst selbst: Spar einen festen Betrag direkt, wenn Geld reinkommt.',
'Gleiche Aufstehzeit auch am Wochenende stabilisiert deinen Schlafrhythmus.',
'Sag öfter „Ich mache 5 Minuten“. Anfangen ist meist der schwerste Teil.',
'Lern mit Fragen statt mit Markieren: Abfragen festigt Wissen deutlich besser.',
'Plane Pausen bewusst ein – wer sie nicht plant, nimmt sie am Handy.',
'Eine Sache zur Zeit: Multitasking kostet mehr Zeit, als es spart.',
'Räum deinen Schreibtisch am Abend auf. Morgen startest du ohne Ablenkung.',
'Schreib Ziele so auf, dass du am Ende eindeutig sagen kannst: geschafft oder nicht.'];
const todayDone=()=>(S.habits[dkey()]||[]).length;
function dayLevel(k){const n=(S.habits[k]||[]).length;return n===0?0:n<4?1:n<6?2:3}
function streak(){let n=0;const d=new Date();if((S.habits[dkey(d)]||[]).length<4)d.setDate(d.getDate()-1);
  while((S.habits[dkey(d)]||[]).length>=4){n++;d.setDate(d.getDate()-1)}return n}
function renderLife(){
  const done=S.habits[dkey()]||[];
  $('#l-count').textContent=done.length+'/'+HABITS.length;$('#l-streak').textContent='Streak: '+streak()+' Tage';
  const names=['So','Mo','Di','Mi','Do','Fr','Sa'];let w='';
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);w+=`<div class="day ${i===0?'today':''}"><i class="l${dayLevel(dkey(d))}"></i>${names[d.getDay()]}</div>`}
  $('#l-week').innerHTML=w;
  $('#l-habits').innerHTML=HABITS.map(h=>{const on=done.includes(h.id);return `<button class="habit ${on?'done':''}" data-h="${h.id}" aria-pressed="${on}"><span class="box">${on?'✓':''}</span><span><b>${h.t}</b><small>${h.s}</small></span></button>`}).join('');
  $('#l-tip').textContent=TIPS[Math.floor(Date.now()/864e5)%TIPS.length];
  $('#l-quiz').textContent='Life-Skills-Quiz · '+unseenIn('Life-Skills').length+' neue Fragen';
}
$('#l-habits').onclick=e=>{const b=e.target.closest('[data-h]');if(!b)return;const k=dkey();const arr=(S.habits[k]||[]).slice();
  const i=arr.indexOf(b.dataset.h);if(i>-1)arr.splice(i,1);else arr.push(b.dataset.h);S.habits[k]=arr;save();renderLife()};
$('#l-quiz').onclick=()=>{qSel='Life-Skills';unseenIn('Life-Skills').length?startQuiz('Life-Skills'):go('quizmenu')};

/* ---------- Profil & Statistik ---------- */
function renderStats(){
  $('#st-name').textContent=S.username||'Gast';
  $('#st-mode').textContent=MODE==='cloud'?'Konto':'Gastmodus';
  $('#st-grid').innerHTML=[
    ['Kopfrechnen',S.best.math||'–','Rekord'],['Zahlen merken',S.best.digits?S.best.digits+' Z.':'–','Rekord'],
    ['Farben-Test',S.best.stroop||'–','Rekord'],['Runden',S.rounds,S.days.length+' Trainingstage (60 T.)'],
    ['Fragen gesehen',S.seen.length+'/'+ALL_IDS.length,S.wrong.length+' im Fehler-Stapel'],['Lifemaxing',streak(),'Tage Streak']
  ].map(([a,b,c])=>`<div class="stat"><span class="label">${a}</span><b>${b}</b><span class="muted small">${c}</span></div>`).join('');
  $('#st-quiz').innerHTML='<p class="label">Quiz – beste 10er-Runde je Kategorie</p>'+['Mix',...KNOW_CATS,'Life-Skills'].map(c=>{const v=S.quizBest[c];
    return `<div class="bar"><span>${c}</span><span class="num" style="color:${v==null?'var(--muted)':v>=8?'var(--good)':v>=5?'var(--warn)':'var(--bad)'}">${v==null?'–':v+'/10'}</span></div>`}).join('');
  const acc=$('#st-account');
  if(MODE==='cloud'){
    acc.innerHTML=`<p class="label">Konto</p><p>${esc(USER.email||'')}</p><p class="muted small">Dein Fortschritt wird in deinem Konto gespeichert und ist auf jedem Gerät verfügbar.</p><p class="label" style="margin-top:6px">Nutzer-UID</p><p class="num small" style="word-break:break-all;user-select:all">${esc(USER.uid)}</p><p class="small">Admin: ${IS_ADMIN?'<b style="color:var(--good)">ja</b>':'nein'}${ADMIN_ERR?' · Fehler: '+esc(ADMIN_ERR):''}</p><button class="btn ghost" id="st-recheck">Admin-Status neu prüfen</button><button class="btn ghost" id="st-logout">Abmelden</button>`;
    $('#st-recheck').onclick=async()=>{await loadCloud();renderStats();toast(IS_ADMIN?'Du bist Admin':'Kein Admin-Eintrag gefunden')};
    $('#st-logout').onclick=async()=>{await save(true);ls.del(GFLAG);await auth.signOut()};
  }else{
    acc.innerHTML=`<p class="label">Gastmodus</p><p class="muted small">${HAS_FB?'Erstelle ein Konto, um deinen Fortschritt zu sichern. Dein bisheriger Gast-Fortschritt wird übernommen.':'Accounts sind noch nicht eingerichtet. Dein Fortschritt bleibt auf diesem Gerät.'}</p>${HAS_FB?'<button class="btn" data-go="auth">Konto erstellen</button>':''}`;
  }
  $('#st-reset').hidden=false;$('#st-confirm').hidden=true;
  $('#st-del').hidden=MODE!=='cloud';$('#st-delbox').hidden=true;
}
$('#copy-mail').onclick=async()=>{const m='derreiche40@gmail.com';try{await navigator.clipboard.writeText(m);toast('E-Mail-Adresse kopiert')}catch(e){const r=document.createRange();r.selectNodeContents(document.querySelector('#v-contact .mail'));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);toast('Markiert – jetzt kopieren')}};
$('#st-del').onclick=()=>{$('#st-del').hidden=true;$('#st-delbox').hidden=false;$('#del-err').textContent='';$('#del-pass').value=''};
$('#del-no').onclick=()=>{$('#st-del').hidden=false;$('#st-delbox').hidden=true};
$('#del-yes').onclick=async()=>{
  const pw=$('#del-pass').value,err=$('#del-err');err.textContent='';
  if(!pw){err.textContent='Bitte gib dein Passwort ein.';return}
  const b=$('#del-yes');b.disabled=true;
  try{
    const u=auth.currentUser;
    await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email,pw));
    clearTimeout(saveT);const uid=u.uid;MODE=null;
    await fdb.collection('users').doc(uid).delete();
    await u.delete();
    ls.del(GFLAG);toast('Dein Konto wurde gelöscht');
  }catch(ex){MODE='cloud';err.textContent=AUTH_ERR[ex.code]||'Löschen fehlgeschlagen ('+(ex.code||'unbekannt')+').'}
  b.disabled=false;
};
$('#st-reset').onclick=()=>{$('#st-reset').hidden=true;$('#st-confirm').hidden=false};
$('#st-no').onclick=renderStats;
$('#st-yes').onclick=()=>{const n=S.username;S=EMPTY();S.username=n;save(true);toast('Fortschritt zurückgesetzt');renderStats()};

/* ---------- Admin ---------- */
const tsDate=t=>t&&t.toDate?t.toDate():null;
const fmt=d=>d?d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'}):'–';
function ago(d){if(!d)return'–';const m=Math.round((Date.now()-d)/6e4);if(m<2)return'gerade eben';if(m<60)return'vor '+m+' Min';const h=Math.round(m/60);if(h<24)return'vor '+h+' Std';const t=Math.round(h/24);return'vor '+t+(t===1?' Tag':' Tagen')}
async function renderAdmin(){
  const body=$('#a-body');body.innerHTML='<p class="muted">Lade Nutzerdaten …</p>';
  let users;
  try{const snap=await fdb.collection('users').get();users=snap.docs.map(d=>({id:d.id,...d.data()}))}
  catch(e){console.error(e);body.innerHTML='<div class="stage left"><h3>Kein Zugriff</h3><p class="muted small">Die Nutzerdaten konnten nicht geladen werden. Prüfe, ob die Firestore-Regeln aus der Anleitung veröffentlicht sind und deine UID in der Sammlung „admins“ steht.</p></div>';return}
  const now=Date.now(),D=864e5;
  users.forEach(u=>{u.c=tsDate(u.createdAt);u.l=tsDate(u.lastActive)});
  const total=users.length;
  const act1=users.filter(u=>u.l&&now-u.l<D).length;
  const act7=users.filter(u=>u.l&&now-u.l<7*D).length;
  const new7=users.filter(u=>u.c&&now-u.c<7*D).length;
  const rounds=users.reduce((a,u)=>a+(u.rounds||0),0);
  const qs=users.reduce((a,u)=>a+((u.seen||[]).length),0);
  // Anmeldungen der letzten 14 Tage
  const days=[];for(let i=13;i>=0;i--){const d=new Date(now-i*D);days.push({k:dkey(d),lab:d.getDate()+'.',n:0})}
  users.forEach(u=>{if(u.c){const k=dkey(u.c);const x=days.find(d=>d.k===k);if(x)x.n++}});
  const max=Math.max(1,...days.map(d=>d.n));
  const W=560,H=150,pl=24,pb=22,pt=12,bw=(W-pl)/14;
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Neue Nutzer pro Tag, letzte 14 Tage">`;
  [0,.5,1].forEach(f=>{const y=pt+(H-pt-pb)*(1-f);svg+=`<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${pl-6}" y="${y+3}" text-anchor="end">${Math.round(max*f)}</text>`});
  days.forEach((d,i)=>{const h=(H-pt-pb)*d.n/max,x=pl+i*bw+bw*.18,y=H-pb-h;
    svg+=`<rect x="${x}" y="${y}" width="${bw*.64}" height="${Math.max(h,0)}" rx="3" fill="var(--accent)"/>`;
    if(i%2===1||i===13)svg+=`<text x="${x+bw*.32}" y="${H-6}" text-anchor="middle">${d.lab}</text>`});
  svg+='</svg>';
  users.sort((a,b)=>(b.l||0)-(a.l||0));
  const rows=users.map(u=>{const live=u.l&&now-u.l<D;return `<tr><td><span class="dot ${live?'live':''}"></span>${esc(u.username||'(ohne Namen)')}</td><td>${fmt(u.c)}</td><td>${ago(u.l)}</td><td class="r">${u.rounds||0}</td><td class="r">${(u.seen||[]).length}</td></tr>`}).join('');
  body.innerHTML=`
  <div class="stats">
    <div class="stat"><span class="label">Nutzer gesamt</span><b>${total}</b><span class="muted small">+${new7} in 7 Tagen</span></div>
    <div class="stat"><span class="label">Aktiv heute</span><b>${act1}</b><span class="muted small">letzte 24 Std</span></div>
    <div class="stat"><span class="label">Aktiv 7 Tage</span><b>${act7}</b><span class="muted small">${total?Math.round(act7/total*100):0} % aller Nutzer</span></div>
    <div class="stat"><span class="label">Runden gesamt</span><b>${rounds}</b><span class="muted small">Ø ${total?(rounds/total).toFixed(1):0} pro Nutzer</span></div>
  </div>
  <div class="stage left chart"><div class="bar"><p class="label">Neue Nutzer · 14 Tage</p><p class="muted small num">${qs} Fragen beantwortet</p></div>${svg}</div>
  <div><p class="label" style="margin-bottom:8px">Alle Nutzer (${total})</p>
  <div class="tablewrap"><table><thead><tr><th>Name</th><th>Dabei seit</th><th>Zuletzt aktiv</th><th class="r">Runden</th><th class="r">Fragen</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">Noch keine Nutzer</td></tr>'}</tbody></table></div></div>
  <p class="muted small">E-Mail-Adressen siehst du in der Firebase-Konsole unter Authentication.</p>`;
}
$('#a-reload').onclick=renderAdmin;

/* ---------- Service Worker ---------- */
if('serviceWorker' in navigator&&location.protocol==='https:'&&!/claude\.ai|claudeusercontent/.test(location.host)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

boot();
})();

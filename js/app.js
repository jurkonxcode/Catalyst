/* ============================================================
   INIT SUPABASE CLIENT
   ============================================================ */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   STATE
   ============================================================ */
let user = null, profile = null;
let buildings = {}, inventory = {};
let currentTab = 'buildings';
let progressRaf = null;

/* ============================================================
   HELPERS
   ============================================================ */
const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('en-US');
const money = n => '$' + nf.format(Math.floor(n));

function showScreen(n){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-'+n).classList.add('active');
  window.scrollTo(0,0);
}
function toast(m,t='info'){
  const e=$('toast');e.textContent=m;e.className='show '+t;
  clearTimeout(e._t);e._t=setTimeout(()=>e.className='',2200);
}
function showMsg(id,m,t){
  const e=$(id);e.textContent=m;e.className='msg show '+t;
  clearTimeout(e._t);e._t=setTimeout(()=>e.className='msg',5000);
}
function hideMsg(id){$(id).className='msg';}
function showLoading(t='Memuat...'){$('loadingText').textContent=t;$('loading').classList.remove('hidden');}
function hideLoading(){$('loading').classList.add('hidden');}

/* ============================================================
   AUTH
   ============================================================ */
function switchTab(tab){
  $('tabLogin').classList.toggle('active',tab==='login');
  $('tabRegister').classList.toggle('active',tab==='register');
  $('loginForm').style.display=tab==='login'?'block':'none';
  $('registerForm').style.display=tab==='register'?'block':'none';
  hideMsg('authMsg');
}

async function doLogin(e){
  e.preventDefault();hideMsg('authMsg');
  const email=$('loginEmail').value.trim(),password=$('loginPassword').value;
  $('loginBtn').disabled=true;$('loginBtn').textContent='⏳ Masuk...';
  showLoading('Masuk...');
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){
    hideLoading();
    $('loginBtn').disabled=false;$('loginBtn').textContent='🔐 Masuk';
    return showMsg('authMsg','❌ '+error.message,'error');
  }
  user=data.user;await enterGame();
}

async function doRegister(e){
  e.preventDefault();hideMsg('authMsg');
  const email=$('regEmail').value.trim();
  const password=$('regPassword').value;
  const username=$('regUsername').value.trim();
  if(password.length<6)return showMsg('authMsg','Password minimal 6 karakter','error');
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))return showMsg('authMsg','Username: 3-20 huruf/angka/underscore','error');
  $('registerBtn').disabled=true;$('registerBtn').textContent='⏳ Mendaftar...';
  showLoading('Membuat akun...');
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});
  if(error){
    hideLoading();
    $('registerBtn').disabled=false;$('registerBtn').textContent='📝 Buat Akun';
    return showMsg('authMsg','❌ '+error.message,'error');
  }
  user=data.user;await enterGame();
}

async function doLogout(){
  if(!confirm('Keluar dari akun?'))return;
  if(progressRaf)cancelAnimationFrame(progressRaf);
  Object.values(buildings).forEach(b=>clearTimeout(b._timer));
  await sb.auth.signOut();
  user=null;profile=null;buildings={};inventory={};
  $('loginForm').reset();$('registerForm').reset();
  showScreen('auth');switchTab('login');
  toast('👋 Sampai jumpa!','info');
}

/* ============================================================
   ENTER GAME
   ============================================================ */
async function enterGame(){
  showLoading('Memuat profil...');
  const {data:prof,error:pErr}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(pErr){hideLoading();return showMsg('authMsg','❌ '+pErr.message,'error');}
  profile=prof;
  if(!profile.company_name||profile.company_name==='PT Baru'){
    hideLoading();showScreen('onboarding');return;
  }
  await loadGameData();
  hideLoading();showScreen('game');render();resumeAllProduction();
}

async function loadGameData(){
  const {data:bData}=await sb.from('buildings').select('*').eq('user_id',user.id);
  buildings={};
  for(const bId of Object.keys(BUILDINGS))buildings[bId]={level:0,producing:false,endsAt:0,auto:false};
  if(bData){
    for(const row of bData){
      if(buildings[row.building_id]){
        buildings[row.building_id]={
          level:row.level,producing:row.producing,
          endsAt:row.ends_at?new Date(row.ends_at).getTime():0,auto:row.auto
        };
      }
    }
  }
  const {data:iData}=await sb.from('inventory').select('*').eq('user_id',user.id);
  inventory={};
  for(const iId of Object.keys(ITEMS))inventory[iId]={qty:0,price:ITEMS[iId].basePrice};
  if(iData){
    for(const row of iData){
      if(inventory[row.item_id])inventory[row.item_id].qty=row.qty;
    }
  }
}

/* ============================================================
   ONBOARDING
   ============================================================ */
document.querySelectorAll('.avatar-opt').forEach(opt=>{
  opt.addEventListener('click',()=>{
    document.querySelectorAll('.avatar-opt').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
  });
});

async function submitOnboarding(){
  hideMsg('onboardMsg');
  const company=$('onboardCompany').value.trim();
  const avatar=document.querySelector('.avatar-opt.selected')?.dataset.emoji||'🏭';
  if(company.length<3)return showMsg('onboardMsg','Minimal 3 karakter','error');
  if(company.length>30)return showMsg('onboardMsg','Maksimal 30 karakter','error');
  $('onboardBtn').disabled=true;$('onboardBtn').textContent='⏳ Menyimpan...';
  showLoading('Membuat perusahaan...');
  const {error}=await sb.from('profiles').update({company_name:company,avatar}).eq('id',user.id);
  if(error){
    hideLoading();
    $('onboardBtn').disabled=false;$('onboardBtn').textContent='🚀 Mulai Bermain';
    return showMsg('onboardMsg','❌ '+error.message,'error');
  }
  profile.company_name=company;profile.avatar=avatar;
  await loadGameData();
  hideLoading();showScreen('game');render();
  toast('🎉 Selamat datang, '+company+'!','good');
}

/* ============================================================
   SYNC CLOUD
   ============================================================ */
async function syncProfile(){
  await sb.from('profiles').update({
    cash:profile.cash,xp:profile.xp,level:profile.level
  }).eq('id',user.id);
}
async function syncBuilding(bId){
  const b=buildings[bId];
  await sb.from('buildings').upsert({
    user_id:user.id,building_id:bId,level:b.level,auto:b.auto,producing:b.producing,
    ends_at:b.endsAt?new Date(b.endsAt).toISOString():null,
  },{onConflict:'user_id,building_id'});
}
async function syncInventory(itemId){
  await sb.from('inventory').upsert({
    user_id:user.id,item_id:itemId,qty:inventory[itemId].qty,
  },{onConflict:'user_id,item_id'});
}

/* ============================================================
   GAME LOGIC
   ============================================================ */
function buildCost(bId){return BUILDINGS[bId].baseCost;}
function upgradeCost(bId){return Math.floor(BUILDINGS[bId].baseCost*Math.pow(1.5,buildings[bId].level));}
function getOutputQty(bId){
  const l=buildings[bId].level;
  return l?Math.floor(BUILDINGS[bId].output.qty*(1+(l-1)*0.5)):0;
}
function getInputQty(bId,itemId){
  const l=buildings[bId].level;
  return l?Math.ceil(BUILDINGS[bId].inputs[itemId]*(1+(l-1)*0.3)):0;
}
function hasInputs(bId){
  for(const it of Object.keys(BUILDINGS[bId].inputs)){
    if(inventory[it].qty<getInputQty(bId,it))return false;
  }
  return true;
}
function addXP(n){
  profile.xp+=n;
  const nl=1+Math.floor(profile.xp/1500);
  if(nl>profile.level){profile.level=nl;toast('🎉 Level '+nl+'!','good');}
}

async function build(bId){
  if(buildings[bId].level>0)return;
  const c=buildCost(bId);
  if(profile.cash<c)return toast('Uang tidak cukup','bad');
  profile.cash-=c;buildings[bId].level=1;
  await syncProfile();await syncBuilding(bId);
  render();toast('🏭 '+BUILDINGS[bId].name+' dibangun!','good');
}

async function upgrade(bId){
  const st=buildings[bId];
  if(!st.level)return build(bId);
  if(st.level>=CONFIG.MAX_LEVEL)return toast('Max level','info');
  const c=upgradeCost(bId);
  if(profile.cash<c)return toast('Uang tidak cukup','bad');
  profile.cash-=c;st.level++;
  await syncProfile();await syncBuilding(bId);
  render();toast('⬆️ '+BUILDINGS[bId].name+' → Lv '+st.level,'good');
}

async function toggleAuto(bId){
  const st=buildings[bId];
  st.auto=!st.auto;
  await syncBuilding(bId);
  render();
  if(st.auto&&!st.producing&&hasInputs(bId))startProduction(bId);
}

async function startProduction(bId){
  const st=buildings[bId];
  if(!st.level||st.producing)return;
  if(!hasInputs(bId)){
    if(!st.auto)toast('Bahan kurang','bad');
    return;
  }
  const b=BUILDINGS[bId];
  for(const it of Object.keys(b.inputs))inventory[it].qty-=getInputQty(bId,it);
  st.producing=true;st.endsAt=Date.now()+b.duration;
  const promises=[syncBuilding(bId)];
  for(const it of Object.keys(b.inputs))promises.push(syncInventory(it));
  await Promise.all(promises);
  render();
  scheduleFinish(bId);
}

function scheduleFinish(bId){
  const st=buildings[bId];
  const remain=st.endsAt-Date.now();
  if(remain<=0){finishProduction(bId);return;}
  clearTimeout(st._timer);
  st._timer=setTimeout(()=>finishProduction(bId),remain);
}

async function finishProduction(bId){
  const st=buildings[bId];
  if(!st.producing)return;
  const b=BUILDINGS[bId];
  const qty=getOutputQty(bId);
  st.producing=false;st.endsAt=0;
  inventory[b.output.item].qty+=qty;
  addXP(qty);
  await Promise.all([syncBuilding(bId),syncInventory(b.output.item),syncProfile()]);
  if(st.auto&&hasInputs(bId)){
    setTimeout(()=>startProduction(bId),50);
  } else {
    render();
  }
}

async function sellItem(itemId){
  const it=inventory[itemId];
  if(it.qty<=0)return;
  const revenue=Math.floor(it.qty*it.price);
  it.qty=0;profile.cash+=revenue;addXP(Math.floor(revenue/10));
  await Promise.all([syncInventory(itemId),syncProfile()]);
  render();toast('💰 +'+money(revenue),'good');
}

function recoverPrices(){
  let changed=false;
  for(const[id,it]of Object.entries(inventory)){
    const base=ITEMS[id].basePrice;
    if(it.price<base){it.price=Math.min(base,it.price*CONFIG.PRICE_RECOVER);changed=true;}
  }
  if(changed&&currentTab==='market')render();
}

function resumeAllProduction(){
  for(const bId of Object.keys(BUILDINGS)){
    const st=buildings[bId];
    if(st.producing&&st.endsAt){
      if(Date.now()>=st.endsAt)finishProduction(bId);
      else scheduleFinish(bId);
    } else if(st.auto&&st.level>0&&hasInputs(bId)){
      startProduction(bId);
    }
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){
  if(!profile)return;
  $('hdrLogo').textContent=profile.avatar||'🏭';
  $('hdrCompany').textContent=profile.company_name;
  $('hdrCash').textContent=money(profile.cash);
  $('hdrLevel').textContent=profile.level;

  const c=$('gameContent');
  if(currentTab==='buildings')c.innerHTML=renderBuildings();
  else if(currentTab==='storage')c.innerHTML=renderStorage();
  else if(currentTab==='market')c.innerHTML=renderMarket();
  else if(currentTab==='profile')c.innerHTML=renderProfile();

  cancelAnimationFrame(progressRaf);
  if(currentTab==='buildings')tickProgress();

  requestAnimationFrame(()=>{
    c.querySelectorAll('.card,.item-card,.market-row').forEach((el,i)=>{
      el.style.animationDelay=Math.min(i*25,300)+'ms';
    });
  });
}

function renderBuildings(){
  const cats={};
  for(const[bId,b]of Object.entries(BUILDINGS)){
    if(!cats[b.category])cats[b.category]=[];
    cats[b.category].push([bId,b]);
  }
  let html='';
  for(const[catName,arr]of Object.entries(cats)){
    html+='<div class="cat-header">'+catName+'</div>';
    for(const[bId,b]of arr)html+=renderOneBuilding(bId,b);
  }
  return html;
}

function renderOneBuilding(bId,b){
  const st=buildings[bId];
  const built=st.level>0,maxed=st.level>=CONFIG.MAX_LEVEL;
  const bCost=buildCost(bId),uCost=upgradeCost(bId);
  const outQty=built?getOutputQty(bId):b.output.qty;

  const inputsText=Object.entries(b.inputs).map(([itId])=>{
    const need=built?getInputQty(bId,itId):b.inputs[itId];
    const have=inventory[itId].qty,ok=have>=need;
    return '<span style="color:'+(ok?'#a7f3c4':'#fca5a5')+'">'+need+'× '+ITEMS[itId].emoji+'</span>';
  }).join(' + ')||'<span style="color:#a7f3c4">Gratis</span>';

  let statusHtml='';
  if(!built)statusHtml='<span class="status locked">Belum</span>';
  else if(st.producing)statusHtml='<span class="status busy">Produksi</span>';
  else if(st.auto&&!hasInputs(bId))statusHtml='<span class="status busy">Kurang</span>';
  else if(st.auto)statusHtml='<span class="status auto">Auto</span>';
  else statusHtml='<span class="status idle">Siap</span>';

  let btnHtml='';
  if(!built){
    const dis=profile.cash<bCost?'disabled':'';
    btnHtml='<button class="btn btn-primary" '+dis+' onclick="build(\''+bId+'\')">Bangun · '+money(bCost)+'</button>';
  } else {
    const canUp=!maxed&&profile.cash>=uCost;
    const canProd=hasInputs(bId)&&!st.producing;
    const btnUp=!maxed
      ?'<button class="btn btn-purple btn-sm" '+(canUp?'':'disabled')+' onclick="upgrade(\''+bId+'\')">⬆️ Lv '+st.level+'→'+(st.level+1)+' · '+money(uCost)+'</button>'
      :'<button class="btn btn-outline btn-sm" disabled>✓ Max</button>';
    const btnProd='<button class="btn btn-green btn-sm" '+(canProd?'':'disabled')+' onclick="startProduction(\''+bId+'\')">'+(st.producing?'⏳...':'⚡ Produksi')+'</button>';
    btnHtml='<div class="btn-row">'+btnUp+btnProd+'</div>'+
      '<div style="margin-top:8px;display:flex;justify-content:flex-end;">'+
      '<button class="toggle '+(st.auto?'on':'')+'" onclick="toggleAuto(\''+bId+'\')"><div class="toggle-dot"></div>Auto</button>'+
      '</div>';
  }

  const progHtml=st.producing
    ?'<div class="prog-wrap"><div class="prog-track"><div class="prog-bar" data-bar="'+bId+'"></div></div>'+
     '<div class="prog-text" data-text="'+bId+'"></div></div>':'';

  return '<div class="card building-card">'+
    '<div class="b-row1">'+
    '<div class="b-emoji">'+b.emoji+'</div>'+
    '<div class="b-info">'+
    '<div class="b-name">'+b.name+' '+(built?'<span class="lvl-badge">Lv '+st.level+'</span>':'')+'</div>'+
    '<div class="b-desc">'+b.desc+'</div>'+
    '<div class="b-recipe">'+inputsText+' → <b>'+outQty+'× '+ITEMS[b.output.item].emoji+'</b></div>'+
    '</div>'+
    '<div>'+statusHtml+'</div>'+
    '</div>'+
    progHtml+btnHtml+
    '</div>';
}

function renderStorage(){
  const cats={};
  for(const[id,it]of Object.entries(inventory)){
    const cat=ITEMS[id].category;
    if(!cats[cat])cats[cat]=[];
    cats[cat].push([id,it]);
  }
  let html='';
  for(const[catName,arr]of Object.entries(cats)){
    html+='<div class="cat-header">'+catName+'</div><div class="item-grid">';
    for(const[id,it]of arr){
      html+='<div class="item-card">'+
        '<div class="item-emoji">'+ITEMS[id].emoji+'</div>'+
        '<div class="item-name">'+ITEMS[id].name+'</div>'+
        '<div class="item-qty">'+nf.format(it.qty)+'</div>'+
        '</div>';
    }
    html+='</div>';
  }
  return html;
}

function renderMarket(){
  let html='<div class="section-title">Pasar <span style="font-size:10px;color:var(--text-mute);text-transform:none;letter-spacing:0;">Jual hasil produksi</span></div>';
  for(const[id,it]of Object.entries(inventory)){
    const def=ITEMS[id];
    const disabled=it.qty<=0?'disabled':'';
    html+='<div class="market-row">'+
      '<div class="market-emoji">'+def.emoji+'</div>'+
      '<div class="market-info">'+
      '<div class="market-name">'+def.name+'</div>'+
      '<div class="market-price">$'+it.price.toFixed(2)+'/unit · Stok: '+nf.format(it.qty)+'</div>'+
      '</div>'+
      '<button class="sell-btn" '+disabled+' onclick="sellItem(\''+id+'\')">'+(it.qty>0?money(it.qty*it.price):'—')+'</button>'+
      '</div>';
  }
  return html;
}

function renderProfile(){
  return '<div class="section-title">Profil Perusahaan</div>'+
    '<div class="card" style="text-align:center;padding:22px;">'+
    '<div style="font-size:48px;margin-bottom:8px;">'+(profile.avatar||'🏭')+'</div>'+
    '<div style="font-size:18px;font-weight:800;letter-spacing:-0.03em;">'+profile.company_name+'</div>'+
    '<div style="font-size:12px;color:var(--text-mute);margin-top:4px;">@'+profile.username+'</div>'+
    '</div>'+
    '<div class="card">'+
    row('Level',profile.level)+
    row('Total XP',nf.format(profile.xp))+
    row('Uang Kas',money(profile.cash),'#a7f3c4')+
    '</div>'+
    '<button class="btn btn-red" onclick="doLogout()">🚪 Keluar</button>';
}
function row(k,v,color){
  return '<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);">'+
    '<span style="color:var(--text-dim);font-size:13px;font-weight:600;">'+k+'</span>'+
    '<span style="font-weight:800;font-variant-numeric:tabular-nums;'+(color?'color:'+color+';':'')+'">'+v+'</span>'+
    '</div>';
}

function tickProgress(){
  let active=false;
  for(const[bId,b]of Object.entries(BUILDINGS)){
    const st=buildings[bId];
    if(!st.producing||!st.endsAt)continue;
    active=true;
    const remain=Math.max(0,st.endsAt-Date.now());
    const pct=Math.min(100,100-(remain/b.duration*100));
    const bar=document.querySelector('[data-bar="'+bId+'"]');
    const txt=document.querySelector('[data-text="'+bId+'"]');
    if(bar)bar.style.width=pct+'%';
    if(txt)txt.textContent=(remain/1000).toFixed(1)+'s';
    if(remain<=0)finishProduction(bId);
  }
  if(active)progressRaf=requestAnimationFrame(tickProgress);
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    currentTab=t.dataset.tab;
    render();
  });
});

/* ============================================================
   INIT
   ============================================================ */
(async()=>{
  showLoading('Mengecek sesi...');
  const {data}=await sb.auth.getSession();
  if(data.session){user=data.session.user;await enterGame();}
  else{hideLoading();showScreen('auth');}
  setInterval(recoverPrices,12000);
})();

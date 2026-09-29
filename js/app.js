/* ============================================================
   INIT SUPABASE
   ============================================================ */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   STATE
   ============================================================ */
let user = null, profile = null;
let buildings = {}, inventory = {};
let currentTab = 'buildings';
let progressRaf = null;
let modalItemId = null;

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

/* Hitung rating berdasarkan level */
function getRating(){
  const l = profile.level;
  if (l >= 15) return {text:'AAA', cls:'top'};
  if (l >= 12) return {text:'AA',  cls:'top'};
  if (l >= 9)  return {text:'A',   cls:'high'};
  if (l >= 7)  return {text:'BBB', cls:'high'};
  if (l >= 5)  return {text:'BB',  cls:''};
  if (l >= 3)  return {text:'B',   cls:''};
  return {text:'C', cls:''};
}

/* Hitung Company Value: cash + value bangunan + value inventory */
function getCompanyValue(){
  let v = profile.cash;
  // Value bangunan
  for (const [bId, b] of Object.entries(buildings)) {
    if (b.level > 0) {
      v += BUILDINGS[bId].baseCost * b.level * 0.7; // 70% dari harga beli
    }
  }
  // Value inventory
  for (const [itId, it] of Object.entries(inventory)) {
    v += it.qty * it.price;
  }
  return Math.floor(v);
}

/* Format tanggal */
function fmtDate(ts){
  if(!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', {day:'numeric', month:'numeric', year:'numeric'});
}
function fmtTime(){
  return new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
}
function timeAgo(ts){
  if(!ts) return 'Baru saja';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return m + ' menit lalu';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' jam lalu';
  const d = Math.floor(h / 24);
  return d + ' hari lalu';
}

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
  // Update last_seen
  try { await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id); } catch(e){}
  if(progressRaf)cancelAnimationFrame(progressRaf);
  Object.values(buildings).forEach(b=>{clearTimeout(b._timer);clearTimeout(b._upTimer);});
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
  // Update last_seen
  await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);
  profile.last_seen = new Date().toISOString();
  
  if(!profile.company_name||profile.company_name==='PT Baru'){
    hideLoading();showScreen('onboarding');return;
  }
  await loadGameData();
  hideLoading();showScreen('game');render();resumeAllActions();
}

async function loadGameData(){
  const {data:bData}=await sb.from('buildings').select('*').eq('user_id',user.id);
  buildings={};
  for(const bId of Object.keys(BUILDINGS)){
    buildings[bId]={level:0,producing:false,endsAt:0,auto:false,upgrading:false,upgradeEndsAt:0};
  }
  if(bData){
    for(const row of bData){
      if(buildings[row.building_id]){
        buildings[row.building_id]={
          level:row.level||0,
          producing:row.producing||false,
          endsAt:row.ends_at?new Date(row.ends_at).getTime():0,
          auto:row.auto||false,
          upgrading:row.upgrading||false,
          upgradeEndsAt:row.upgrade_ends_at?new Date(row.upgrade_ends_at).getTime():0,
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
    user_id:user.id,building_id:bId,
    level:b.level,auto:b.auto,producing:b.producing,
    ends_at:b.endsAt?new Date(b.endsAt).toISOString():null,
    upgrading:b.upgrading,
    upgrade_ends_at:b.upgradeEndsAt?new Date(b.upgradeEndsAt).toISOString():null,
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
function getUpgradeDurationMs(bId){
  const base = BUILDINGS[bId].upgradeTime * 1000;
  const lvl = buildings[bId].level;
  return Math.floor(base * (1 + lvl * 0.5));
}
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
  if(st.upgrading)return toast('Sedang di-upgrade...','info');
  if(st.producing)return toast('Tunggu produksi selesai','info');
  if(st.level>=CONFIG.MAX_LEVEL)return toast('Max level','info');
  const c=upgradeCost(bId);
  if(profile.cash<c)return toast('Uang tidak cukup','bad');
  profile.cash-=c;
  st.upgrading=true;
  st.upgradeEndsAt=Date.now()+getUpgradeDurationMs(bId);
  await Promise.all([syncProfile(),syncBuilding(bId)]);
  render();
  const dur = Math.floor(getUpgradeDurationMs(bId)/1000);
  toast('⬆️ Upgrade dimulai ('+dur+'s)','info');
  scheduleUpgradeFinish(bId);
}

function scheduleUpgradeFinish(bId){
  const st=buildings[bId];
  const remain=st.upgradeEndsAt-Date.now();
  if(remain<=0){finishUpgrade(bId);return;}
  clearTimeout(st._upTimer);
  st._upTimer=setTimeout(()=>finishUpgrade(bId),remain);
}

async function finishUpgrade(bId){
  const st=buildings[bId];
  if(!st.upgrading)return;
  st.upgrading=false;st.upgradeEndsAt=0;st.level++;
  await syncBuilding(bId);
  render();
  toast('🎉 '+BUILDINGS[bId].name+' → Lv '+st.level+'!','good');
}

async function toggleAuto(bId){
  const st=buildings[bId];
  st.auto=!st.auto;
  await syncBuilding(bId);
  render();
  if(st.auto&&!st.producing&&!st.upgrading&&hasInputs(bId))startProduction(bId);
}

async function startProduction(bId){
  const st=buildings[bId];
  if(!st.level||st.producing||st.upgrading)return;
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
  if(st.auto&&hasInputs(bId)&&!st.upgrading){
    setTimeout(()=>startProduction(bId),50);
  } else {
    render();
  }
}

/* ============================================================
   SELL MODAL
   ============================================================ */
function openSellModal(itemId){
  const it=inventory[itemId];
  if(it.qty<=0)return;
  modalItemId=itemId;
  const def=ITEMS[itemId];
  const container=$('modalContainer');
  container.innerHTML=`
    <div class="modal-backdrop" id="sellBackdrop" onclick="if(event.target.id==='sellBackdrop')closeSellModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-grip"></div>
        <div class="modal-title">${def.emoji} Jual ${def.name}</div>
        <div class="modal-field">
          <label>Jumlah (max: ${nf.format(it.qty)})</label>
          <div class="qty-control">
            <button onclick="adjustSellQty(-10)">−10</button>
            <input type="number" id="sellQtyInput" value="${it.qty}" min="1" max="${it.qty}" oninput="updateSellTotal()">
            <button onclick="adjustSellQty(10)">+10</button>
          </div>
          <button class="btn-max" onclick="setSellQty(${it.qty})">MAX (${nf.format(it.qty)})</button>
        </div>
        <div class="modal-info">
          <div class="modal-info-row">
            <span class="k">Harga per unit</span>
            <span class="v">$${it.price.toFixed(2)}</span>
          </div>
          <div class="modal-info-row">
            <span class="k">Total pendapatan</span>
            <span class="v gold" id="sellTotal">$${(it.qty*it.price).toFixed(2)}</span>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="closeSellModal()">Batal</button>
          <button class="btn btn-gold" onclick="confirmSell()">💰 Jual</button>
        </div>
      </div>
    </div>`;
}

function closeSellModal(){
  $('modalContainer').innerHTML='';
  modalItemId=null;
}
function adjustSellQty(delta){
  const it=inventory[modalItemId];
  const input=$('sellQtyInput');
  let v=parseInt(input.value)||0;
  v=Math.max(1,Math.min(it.qty,v+delta));
  input.value=v;updateSellTotal();
}
function setSellQty(v){
  const it=inventory[modalItemId];
  $('sellQtyInput').value=Math.min(v,it.qty);
  updateSellTotal();
}
function updateSellTotal(){
  const it=inventory[modalItemId];
  let v=parseInt($('sellQtyInput').value)||0;
  v=Math.max(0,Math.min(it.qty,v));
  $('sellTotal').textContent='$'+(v*it.price).toFixed(2);
}
async function confirmSell(){
  const itemId=modalItemId;
  const it=inventory[itemId];
  let v=parseInt($('sellQtyInput').value)||0;
  v=Math.max(1,Math.min(it.qty,v));
  const revenue=Math.floor(v*it.price);
  it.qty-=v;profile.cash+=revenue;addXP(Math.floor(revenue/10));
  const impact=Math.min(0.2,v*0.0005);
  it.price=Math.max(ITEMS[itemId].basePrice*CONFIG.MIN_PRICE,it.price*(1-impact));
  await Promise.all([syncInventory(itemId),syncProfile()]);
  closeSellModal();render();toast('💰 +'+money(revenue),'good');
}

/* ============================================================
   PROFILE ACTIONS
   ============================================================ */
async function saveDescription(){
  const ta = document.getElementById('descInput');
  if (!ta) return;
  const desc = ta.value.trim();
  if (desc.length > 200) return toast('Maksimal 200 karakter','bad');
  const { error } = await sb.from('profiles').update({ company_description: desc }).eq('id', user.id);
  if (error) return toast('Gagal menyimpan','bad');
  profile.company_description = desc;
  toast('✅ Deskripsi tersimpan','good');
}

function copyCompanyId(){
  const text = profile.username + ' (ID: ' + user.id.slice(0,8) + ')';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(()=>{
      toast('📋 ID disalin','good');
    }).catch(()=>{
      prompt('Salin manual:', text);
    });
  } else {
    prompt('Salin manual:', text);
  }
}

async function changePassword(){
  const newPass = prompt('Masukkan password baru (min 6 karakter):');
  if (!newPass) return;
  if (newPass.length < 6) return toast('Password minimal 6 karakter','bad');
  const { error } = await sb.auth.updateUser({ password: newPass });
  if (error) return toast('Gagal: ' + error.message,'bad');
  toast('✅ Password diubah','good');
}

async function deleteAccount(){
  if (!confirm('⚠️ HAPUS akun permanen? Semua data akan hilang.')) return;
  if (!confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    await sb.from('profiles').delete().eq('id', user.id);
    await sb.from('inventory').delete().eq('user_id', user.id);
    await sb.from('buildings').delete().eq('user_id', user.id);
    await sb.auth.signOut();
    user = null; profile = null; buildings = {}; inventory = {};
    $('loginForm').reset(); $('registerForm').reset();
    showScreen('auth'); switchTab('login');
    toast('Akun dihapus','info');
  } catch(e) {
    toast('Gagal menghapus: ' + e.message,'bad');
  }
}

/* ============================================================
   MISC
   ============================================================ */
function recoverPrices(){
  let changed=false;
  for(const[id,it]of Object.entries(inventory)){
    const base=ITEMS[id].basePrice;
    if(it.price<base){it.price=Math.min(base,it.price*CONFIG.PRICE_RECOVER);changed=true;}
  }
  if(changed&&currentTab==='market')render();
}

function resumeAllActions(){
  for(const bId of Object.keys(BUILDINGS)){
    const st=buildings[bId];
    if(st.upgrading&&st.upgradeEndsAt){
      if(Date.now()>=st.upgradeEndsAt)finishUpgrade(bId);
      else scheduleUpgradeFinish(bId);
    } else if(st.producing&&st.endsAt){
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
  const built=st.level>0;
  const maxed=st.level>=CONFIG.MAX_LEVEL;
  const bCost=buildCost(bId);
  const uCost=upgradeCost(bId);
  const outQty=built?getOutputQty(bId):b.output.qty;

  const inputsText=Object.entries(b.inputs).map(([itId])=>{
    const need=built?getInputQty(bId,itId):b.inputs[itId];
    const have=inventory[itId].qty,ok=have>=need;
    return '<span style="color:'+(ok?'#a7f3c4':'#fca5a5')+'">'+need+'× '+ITEMS[itId].emoji+'</span>';
  }).join(' + ')||'<span style="color:#a7f3c4">Gratis</span>';

  let statusHtml='';
  if(!built)statusHtml='<span class="status locked">Belum</span>';
  else if(st.upgrading)statusHtml='<span class="status upgrading">Upgrade</span>';
  else if(st.producing)statusHtml='<span class="status busy">Produksi</span>';
  else if(st.auto&&!hasInputs(bId))statusHtml='<span class="status busy">Kurang</span>';
  else if(st.auto)statusHtml='<span class="status auto">Auto</span>';
  else statusHtml='<span class="status idle">Siap</span>';

  let btnHtml='';
  if(!built){
    const dis=profile.cash<bCost?'disabled':'';
    btnHtml='<button class="btn btn-primary" '+dis+' onclick="build(\''+bId+'\')">Bangun · '+money(bCost)+'</button>';
  } else {
    const canUp=!maxed&&!st.upgrading&&!st.producing&&profile.cash>=uCost;
    const canProd=hasInputs(bId)&&!st.producing&&!st.upgrading;
    const btnUpTxt = st.upgrading ? '⏳ Upgrading...' : (maxed?'✓ Max':'⬆️ Lv '+st.level+'→'+(st.level+1)+' · '+money(uCost));
    const btnUp='<button class="btn btn-purple btn-sm" '+(canUp?'':'disabled')+' onclick="upgrade(\''+bId+'\')">'+btnUpTxt+'</button>';
    const btnProd='<button class="btn btn-green btn-sm" '+(canProd?'':'disabled')+' onclick="startProduction(\''+bId+'\')">'+(st.producing?'⏳...':'⚡ Produksi')+'</button>';
    btnHtml='<div class="btn-row">'+btnUp+btnProd+'</div>'+
      '<div style="margin-top:8px;display:flex;justify-content:flex-end;">'+
      '<button class="toggle '+(st.auto?'on':'')+'" onclick="toggleAuto(\''+bId+'\')"><div class="toggle-dot"></div>Auto</button>'+
      '</div>';
  }

  let progHtml='';
  if(st.upgrading){
    progHtml='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar upgrade" data-upbar="'+bId+'"></div></div>'+
      '<div class="prog-text" data-uptext="'+bId+'"></div></div>';
  } else if(st.producing){
    progHtml='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar" data-bar="'+bId+'"></div></div>'+
      '<div class="prog-text" data-text="'+bId+'"></div></div>';
  }

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
      html+='<div class="item-card" onclick="if('+it.qty+'>0){currentTab=\'market\';document.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\'));document.querySelector(\'[data-tab=\"market\"]\').classList.add(\'active\');render();openSellModal(\''+id+'\');}">'+
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
  let html='<div class="section-title">Pasar <span style="font-size:10px;color:var(--text-mute);text-transform:none;letter-spacing:0;">Tap untuk jual</span></div>';
  for(const[id,it]of Object.entries(inventory)){
    const def=ITEMS[id];
    const disabled=it.qty<=0?'disabled':'';
    html+='<div class="market-row">'+
      '<div class="market-emoji">'+def.emoji+'</div>'+
      '<div class="market-info">'+
      '<div class="market-name">'+def.name+'</div>'+
      '<div class="market-price">$'+it.price.toFixed(2)+'/unit · Stok: '+nf.format(it.qty)+'</div>'+
      '</div>'+
      '<button class="sell-btn" '+disabled+' onclick="openSellModal(\''+id+'\')">'+(it.qty>0?'Jual':'—')+'</button>'+
      '</div>';
  }
  return html;
}

function renderProfile(){
  const rating = getRating();
  const value = getCompanyValue();
  const desc = profile.company_description || '';
  const country = profile.country || 'Indonesia';
  const established = fmtDate(profile.created_at);
  const lastSeen = timeAgo(profile.last_seen);
  const localTime = fmtTime();

  // Hitung jumlah bangunan aktif
  const builtCount = Object.values(buildings).filter(b => b.level > 0).length;

  return `
    <!-- COMPANY HERO -->
    <div class="profile-hero">
      <div class="profile-hero-top">
        <div class="profile-logo">${profile.avatar||'🏭'}</div>
        <div class="profile-hero-info">
          <div class="profile-status"><span class="dot"></span>Online</div>
          <div class="profile-company-name">${profile.company_name}</div>
          <div class="profile-company-type">Perseroan Terbatas · @${profile.username}</div>
        </div>
      </div>
      <div class="profile-actions">
        <button class="profile-btn" onclick="copyCompanyId()">📋 Copy ID</button>
        <button class="profile-btn" onclick="toast('Segera hadir','info')">✏️ Edit Profil</button>
      </div>
    </div>

    <!-- RANKINGS -->
    <div class="card">
      <div class="card-section-header">Rankings</div>
      <div class="ranking-box">
        <div class="ranking-item">
          <div class="ranking-label">Company Value</div>
          <div class="ranking-value gold">${money(value)}</div>
        </div>
        <div class="ranking-item">
          <div class="ranking-label">EVA Score</div>
          <div class="ranking-value">${nf.format(profile.xp)}</div>
        </div>
      </div>
    </div>

    <!-- INFO -->
    <div class="card">
      <div class="card-section-header">Info Perusahaan</div>
      <div class="p-compact-list">
        <div class="info-row">
          <span class="info-key">Rating</span>
          <span class="info-val"><span class="rating-badge ${rating.cls}">${rating.text}</span></span>
        </div>
        <div class="info-row">
          <span class="info-key">Level</span>
          <span class="info-val">${profile.level}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Total XP</span>
          <span class="info-val">${nf.format(profile.xp)}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Bangunan</span>
          <span class="info-val">${builtCount} unit</span>
        </div>
        <div class="info-row">
          <span class="info-key">Negara</span>
          <span class="info-val">🇮🇩 ${country}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Terdaftar</span>
          <span class="info-val">${established}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Terakhir dilihat</span>
          <span class="info-val">${lastSeen}</span>
        </div>
        <div class="info-row">
          <span class="info-key">Waktu lokal</span>
          <span class="info-val">${localTime}</span>
        </div>
      </div>
    </div>

    <!-- DESKRIPSI -->
    <div class="card">
      <div class="card-section-header">Deskripsi Publik</div>
      <textarea class="description-textarea" id="descInput"
        placeholder="Ceritakan tentang perusahaanmu... (maks 200 karakter)"
        maxlength="200">${desc}</textarea>
      <button class="btn btn-green btn-sm" style="margin-top:10px;" onclick="saveDescription()">💾 Simpan Deskripsi</button>
    </div>

    <!-- ACCOUNT -->
    <div class="card">
      <div class="card-section-header">Akun</div>
      <div class="account-menu">
        <div class="account-item" onclick="toast('Segera hadir','info')">
          <div class="account-icon">🌐</div>
          <div class="account-label">Bahasa</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="toast('Segera hadir','info')">
          <div class="account-icon">⚙️</div>
          <div class="account-label">Preferensi</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="changePassword()">
          <div class="account-icon">🔑</div>
          <div class="account-label">Ubah Password</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="doLogout()">
          <div class="account-icon">🚪</div>
          <div class="account-label">Keluar</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="deleteAccount()">
          <div class="account-icon" style="background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.3);">🗑️</div>
          <div class="account-label danger">Hapus Akun</div>
          <div class="account-arrow">›</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;font-size:10px;color:var(--text-mute);padding:14px 0 8px;">
      JurkonCompanies v3.1 · Cloud Sync Aktif
    </div>
  `;
}

function tickProgress(){
  let active=false;
  for(const[bId,b]of Object.entries(BUILDINGS)){
    const st=buildings[bId];
    if(st.upgrading&&st.upgradeEndsAt){
      active=true;
      const total=getUpgradeDurationMs(bId);
      const remain=Math.max(0,st.upgradeEndsAt-Date.now());
      const pct=Math.min(100,100-(remain/total*100));
      const bar=document.querySelector('[data-upbar="'+bId+'"]');
      const txt=document.querySelector('[data-uptext="'+bId+'"]');
      if(bar)bar.style.width=pct+'%';
      if(txt)txt.textContent='Upgrade: '+(remain/1000).toFixed(1)+'s';
      if(remain<=0)finishUpgrade(bId);
    }
    if(st.producing&&st.endsAt){
      active=true;
      const remain=Math.max(0,st.endsAt-Date.now());
      const pct=Math.min(100,100-(remain/b.duration*100));
      const bar=document.querySelector('[data-bar="'+bId+'"]');
      const txt=document.querySelector('[data-text="'+bId+'"]');
      if(bar)bar.style.width=pct+'%';
      if(txt)txt.textContent='Produksi: '+(remain/1000).toFixed(1)+'s';
      if(remain<=0)finishProduction(bId);
    }
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

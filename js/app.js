/* ============================================================
   INIT
   ============================================================ */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
function showLoading(t='Loading...'){$('loadingText').textContent=t;$('loading').classList.remove('hidden');}
function hideLoading(){$('loading').classList.add('hidden');}

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
function getCompanyValue(){
  let v = profile.cash;
  for (const [bId, b] of Object.entries(buildings)) {
    if (b.level > 0) v += BUILDINGS[bId].baseCost * b.level * 0.7;
  }
  for (const [itId, it] of Object.entries(inventory)) {
    v += it.qty * it.price;
  }
  return Math.floor(v);
}
function fmtDate(ts){
  if(!ts) return '-';
  return new Date(ts).toLocaleDateString(currentLang === 'id' ? 'id-ID' : 'en-US',
    {day:'numeric', month:'numeric', year:'numeric'});
}
function fmtTime(){
  return new Date().toLocaleTimeString(currentLang === 'id' ? 'id-ID' : 'en-US',
    {hour:'2-digit', minute:'2-digit'});
}
function timeAgo(ts){
  if(!ts) return currentLang === 'id' ? 'Baru saja' : 'Just now';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return currentLang === 'id' ? 'Baru saja' : 'Just now';
  if (m < 60) return m + (currentLang === 'id' ? ' menit lalu' : ' min ago');
  const h = Math.floor(m / 60);
  if (h < 24) return h + (currentLang === 'id' ? ' jam lalu' : ' h ago');
  return Math.floor(h / 24) + (currentLang === 'id' ? ' hari lalu' : ' d ago');
}

/* Update teks statis di HTML (auth & onboarding) */
function updateStaticUI(){
  document.title = 'JurkonCompanies';
  const authScreen = $('screen-auth');
  if (authScreen) {
    authScreen.querySelector('.auth-sub').textContent = t('tagline');
    $('tabLogin').textContent = t('login');
    $('tabRegister').textContent = t('register');
    // Login form
    const lf = $('loginForm');
    lf.querySelector('label').textContent = t('email');
    $('loginEmail').placeholder = t('ph_email');
    lf.querySelectorAll('label')[1].textContent = t('password');
    $('loginPassword').placeholder = t('ph_password');
    $('loginBtn').textContent = t('btn_login');
    // Register form
    const rf = $('registerForm');
    const rLabels = rf.querySelectorAll('label');
    rLabels[0].textContent = t('email');
    $('regEmail').placeholder = t('ph_email');
    rLabels[1].textContent = t('password');
    $('regPassword').placeholder = t('ph_password_new');
    rLabels[2].textContent = t('username');
    $('regUsername').placeholder = t('ph_username');
    $('registerBtn').textContent = t('btn_register');
  }
  const ob = $('screen-onboarding');
  if (ob) {
    ob.querySelector('.auth-title').textContent = t('create_profile');
    ob.querySelector('.auth-sub').textContent = t('create_profile_sub');
    const labels = ob.querySelectorAll('label');
    labels[0].textContent = t('choose_logo');
    labels[1].textContent = t('company_name_label');
    $('onboardCompany').placeholder = t('company_name_ph');
    $('onboardBtn').textContent = t('btn_start');
  }
  // Tabs
  const tabMap = {buildings:'tab_buildings',storage:'tab_storage',market:'tab_market',profile:'tab_profile'};
  document.querySelectorAll('.tab').forEach(tabEl=>{
    const key = tabMap[tabEl.dataset.tab];
    if (key) tabEl.querySelector('.tab-label').textContent = t(key);
  });
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
  $('loginBtn').disabled=true;$('loginBtn').textContent=t('msg_logging');
  showLoading(t('msg_logging'));
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){
    hideLoading();
    $('loginBtn').disabled=false;$('loginBtn').textContent=t('btn_login');
    return showMsg('authMsg','❌ '+error.message,'error');
  }
  user=data.user;await enterGame();
}

async function doRegister(e){
  e.preventDefault();hideMsg('authMsg');
  const email=$('regEmail').value.trim();
  const password=$('regPassword').value;
  const username=$('regUsername').value.trim();
  if(password.length<6)return showMsg('authMsg','Password min. 6 chars','error');
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))return showMsg('authMsg','Username: 3-20 a-z/0-9/_','error');
  $('registerBtn').disabled=true;$('registerBtn').textContent=t('msg_registering');
  showLoading(t('msg_registering'));
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});
  if(error){
    hideLoading();
    $('registerBtn').disabled=false;$('registerBtn').textContent=t('btn_register');
    return showMsg('authMsg','❌ '+error.message,'error');
  }
  user=data.user;await enterGame();
}

async function doLogout(){
  if(!confirm(currentLang === 'id' ? 'Keluar dari akun?' : 'Log out?'))return;
  try { await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id); } catch(e){}
  if(progressRaf)cancelAnimationFrame(progressRaf);
  Object.values(buildings).forEach(b=>{clearTimeout(b._timer);clearTimeout(b._upTimer);});
  await sb.auth.signOut();
  user=null;profile=null;buildings={};inventory={};
  $('loginForm').reset();$('registerForm').reset();
  showScreen('auth');switchTab('login');
  toast(t('t_logout_msg'),'info');
}

/* ============================================================
   ENTER GAME
   ============================================================ */
async function enterGame(){
  showLoading('Loading...');
  const {data:prof,error:pErr}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(pErr){hideLoading();return showMsg('authMsg','❌ '+pErr.message,'error');}
  profile=prof;
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
          level:row.level||0,producing:row.producing||false,
          endsAt:row.ends_at?new Date(row.ends_at).getTime():0,
          auto:row.auto||false,upgrading:row.upgrading||false,
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
  if(company.length<3)return showMsg('onboardMsg','Min. 3 chars','error');
  if(company.length>30)return showMsg('onboardMsg','Max. 30 chars','error');
  $('onboardBtn').disabled=true;$('onboardBtn').textContent=t('msg_saving');
  showLoading(t('msg_creating_company'));
  const {error}=await sb.from('profiles').update({company_name:company,avatar}).eq('id',user.id);
  if(error){
    hideLoading();
    $('onboardBtn').disabled=false;$('onboardBtn').textContent=t('btn_start');
    return showMsg('onboardMsg','❌ '+error.message,'error');
  }
  profile.company_name=company;profile.avatar=avatar;
  await loadGameData();
  hideLoading();showScreen('game');render();
  toast(t('t_welcome')+', '+company+'!','good');
}

/* ============================================================
   SYNC
   ============================================================ */
async function syncProfile(){
  await sb.from('profiles').update({cash:profile.cash,xp:profile.xp,level:profile.level}).eq('id',user.id);
}
async function syncBuilding(bId){
  const b=buildings[bId];
  await sb.from('buildings').upsert({
    user_id:user.id,building_id:bId,level:b.level,auto:b.auto,producing:b.producing,
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
  return Math.floor(BUILDINGS[bId].upgradeTime * 1000 * (1 + buildings[bId].level * 0.5));
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
  if(nl>profile.level){profile.level=nl;toast('🎉 Lv '+nl+'!','good');}
}

async function build(bId){
  if(buildings[bId].level>0)return;
  const c=buildCost(bId);
  if(profile.cash<c)return toast(t('t_not_enough_money'),'bad');
  profile.cash-=c;buildings[bId].level=1;
  await syncProfile();await syncBuilding(bId);
  render();toast('🏭 '+t(BUILDINGS[bId].nameKey)+' '+t('t_building_done'),'good');
}

async function upgrade(bId){
  const st=buildings[bId];
  if(!st.level)return build(bId);
  if(st.upgrading)return toast(t('status_upgrading')+'...','info');
  if(st.producing)return toast('Wait production','info');
  if(st.level>=CONFIG.MAX_LEVEL)return toast(t('t_max_level'),'info');
  const c=upgradeCost(bId);
  if(profile.cash<c)return toast(t('t_not_enough_money'),'bad');
  profile.cash-=c;st.upgrading=true;
  st.upgradeEndsAt=Date.now()+getUpgradeDurationMs(bId);
  await Promise.all([syncProfile(),syncBuilding(bId)]);
  render();
  toast(t('t_upgrade_started')+' ('+Math.floor(getUpgradeDurationMs(bId)/1000)+'s)','info');
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
  toast('🎉 '+t(BUILDINGS[bId].nameKey)+' → Lv '+st.level+'!','good');
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
    if(!st.auto)toast(t('t_insufficient_input'),'bad');
    return;
  }
  const b=BUILDINGS[bId];
  for(const it of Object.keys(b.inputs))inventory[it].qty-=getInputQty(bId,it);
  st.producing=true;st.endsAt=Date.now()+b.duration;
  const promises=[syncBuilding(bId)];
  for(const it of Object.keys(b.inputs))promises.push(syncInventory(it));
  await Promise.all(promises);
  render();scheduleFinish(bId);
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
   SELL — Dipanggil dari gudang (auto switch tab) atau pasar
   ============================================================ */
function sellFromStorage(itemId){
  const it = inventory[itemId];
  if (it.qty <= 0) {
    toast(t('t_insufficient_input'),'bad');
    return;
  }
  // Pindah ke tab market
  currentTab = 'market';
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  const mTab = document.querySelector('.tab[data-tab="market"]');
  if (mTab) mTab.classList.add('active');
  render();
  // Buka modal jual
  openSellModal(itemId);
}

function openSellModal(itemId){
  const it=inventory[itemId];
  if(it.qty<=0)return;
  modalItemId=itemId;
  const def=ITEMS[itemId];
  const defName = t(def.nameKey);
  const container=$('modalContainer');
  container.innerHTML=`
    <div class="modal-backdrop" id="sellBackdrop" onclick="if(event.target.id==='sellBackdrop')closeSellModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-grip"></div>
        <div class="modal-title">${def.emoji} ${t('sell_modal_title')} ${defName}</div>
        <div class="modal-field">
          <label>${t('sell_qty')} (${t('sell_max')}: ${nf.format(it.qty)})</label>
          <div class="qty-control">
            <button onclick="adjustSellQty(-10)">−10</button>
            <input type="number" id="sellQtyInput" value="${it.qty}" min="1" max="${it.qty}" oninput="updateSellTotal()">
            <button onclick="adjustSellQty(10)">+10</button>
          </div>
          <button class="btn-max" onclick="setSellQty(${it.qty})">${t('sell_max')} (${nf.format(it.qty)})</button>
        </div>
        <div class="modal-info">
          <div class="modal-info-row">
            <span class="k">${t('sell_price_per')}</span>
            <span class="v">$${it.price.toFixed(2)}</span>
          </div>
          <div class="modal-info-row">
            <span class="k">${t('sell_total')}</span>
            <span class="v gold" id="sellTotal">$${(it.qty*it.price).toFixed(2)}</span>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="closeSellModal()">${t('sell_cancel')}</button>
          <button class="btn btn-gold" onclick="confirmSell()">${t('sell_confirm')}</button>
        </div>
      </div>
    </div>`;
}
function closeSellModal(){$('modalContainer').innerHTML='';modalItemId=null;}
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
  if (desc.length > 200) return toast('Max 200','bad');
  const { error } = await sb.from('profiles').update({ company_description: desc }).eq('id', user.id);
  if (error) return toast('❌','bad');
  profile.company_description = desc;
  toast(t('t_desc_saved'),'good');
}
function copyCompanyId(){
  const text = profile.username + ' (ID: ' + user.id.slice(0,8) + ')';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(()=>toast(t('t_copied'),'good')).catch(()=>prompt('Copy:', text));
  } else { prompt('Copy:', text); }
}
async function changePassword(){
  const newPass = prompt(t('p_change_password') + ' (min 6):');
  if (!newPass) return;
  if (newPass.length < 6) return toast('Min 6','bad');
  const { error } = await sb.auth.updateUser({ password: newPass });
  if (error) return toast('❌ '+error.message,'bad');
  toast(t('t_password_changed'),'good');
}
async function deleteAccount(){
  if (!confirm('⚠️ Delete account?')) return;
  if (!confirm('Sure?')) return;
  try {
    await sb.from('profiles').delete().eq('id', user.id);
    await sb.from('inventory').delete().eq('user_id', user.id);
    await sb.from('buildings').delete().eq('user_id', user.id);
    await sb.auth.signOut();
    user=null;profile=null;buildings={};inventory={};
    $('loginForm').reset();$('registerForm').reset();
    showScreen('auth');switchTab('login');
    toast('Account deleted','info');
  } catch(e) { toast('❌ '+e.message,'bad'); }
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
    const cat = t(b.categoryKey);
    if(!cats[cat])cats[cat]=[];
    cats[cat].push([bId,b]);
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
  const bName = t(b.nameKey);
  const bDesc = t(b.descKey);

  const inputsText=Object.entries(b.inputs).map(([itId])=>{
    const need=built?getInputQty(bId,itId):b.inputs[itId];
    const have=inventory[itId].qty,ok=have>=need;
    return '<span style="color:'+(ok?'#a7f3c4':'#fca5a5')+'">'+need+'× '+ITEMS[itId].emoji+'</span>';
  }).join(' + ')||'<span style="color:#a7f3c4">Free</span>';

  let statusHtml='';
  if(!built)statusHtml='<span class="status locked">'+t('status_not_built')+'</span>';
  else if(st.upgrading)statusHtml='<span class="status upgrading">'+t('status_upgrading')+'</span>';
  else if(st.producing)statusHtml='<span class="status busy">'+t('status_producing')+'</span>';
  else if(st.auto&&!hasInputs(bId))statusHtml='<span class="status busy">'+t('status_low_input')+'</span>';
  else if(st.auto)statusHtml='<span class="status auto">'+t('status_auto')+'</span>';
  else statusHtml='<span class="status idle">'+t('status_ready')+'</span>';

  let btnHtml='';
  if(!built){
    const dis=profile.cash<bCost?'disabled':'';
    btnHtml='<button class="btn btn-primary" '+dis+' onclick="build(\''+bId+'\')">'+t('btn_build')+' · '+money(bCost)+'</button>';
  } else {
    const canUp=!maxed&&!st.upgrading&&!st.producing&&profile.cash>=uCost;
    const canProd=hasInputs(bId)&&!st.producing&&!st.upgrading;
    const btnUpTxt = st.upgrading ? t('btn_upgrading') : (maxed?t('btn_max'):'⬆️ Lv '+st.level+'→'+(st.level+1)+' · '+money(uCost));
    const btnUp='<button class="btn btn-purple btn-sm" '+(canUp?'':'disabled')+' onclick="upgrade(\''+bId+'\')">'+btnUpTxt+'</button>';
    const btnProd='<button class="btn btn-green btn-sm" '+(canProd?'':'disabled')+' onclick="startProduction(\''+bId+'\')">'+(st.producing?t('btn_producing'):t('btn_produce'))+'</button>';
    btnHtml='<div class="btn-row">'+btnUp+btnProd+'</div>'+
      '<div style="margin-top:8px;display:flex;justify-content:flex-end;">'+
      '<button class="toggle '+(st.auto?'on':'')+'" onclick="toggleAuto(\''+bId+'\')"><div class="toggle-dot"></div>'+t('btn_auto')+'</button>'+
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
    '<div class="b-name">'+bName+' '+(built?'<span class="lvl-badge">Lv '+st.level+'</span>':'')+'</div>'+
    '<div class="b-desc">'+bDesc+'</div>'+
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
    const cat=t(ITEMS[id].categoryKey);
    if(!cats[cat])cats[cat]=[];
    cats[cat].push([id,it]);
  }
  let html='';
  for(const[catName,arr]of Object.entries(cats)){
    html+='<div class="cat-header">'+catName+'</div><div class="item-grid">';
    for(const[id,it]of arr){
      // Kalau qty > 0, aktifkan tap untuk jual
      const onclick = it.qty>0 ? ' onclick="sellFromStorage(\''+id+'\')"' : '';
      html+='<div class="item-card"'+onclick+' style="'+(it.qty>0?'cursor:pointer;':'')+'">'+
        '<div class="item-emoji">'+ITEMS[id].emoji+'</div>'+
        '<div class="item-name">'+t(ITEMS[id].nameKey)+'</div>'+
        '<div class="item-qty">'+nf.format(it.qty)+'</div>'+
        (it.qty>0?'<div style="font-size:9px;color:#fbbf24;font-weight:700;margin-top:2px;">TAP TO SELL</div>':'')+
        '</div>';
    }
    html+='</div>';
  }
  return html;
}

function renderMarket(){
  let html='<div class="section-title">'+t('market_title')+' <span style="font-size:10px;color:var(--text-mute);text-transform:none;letter-spacing:0;">'+t('market_hint')+'</span></div>';
  for(const[id,it]of Object.entries(inventory)){
    const def=ITEMS[id];
    const disabled=it.qty<=0?'disabled':'';
    html+='<div class="market-row">'+
      '<div class="market-emoji">'+def.emoji+'</div>'+
      '<div class="market-info">'+
      '<div class="market-name">'+t(def.nameKey)+'</div>'+
      '<div class="market-price">$'+it.price.toFixed(2)+'/unit · '+t('tab_storage')+': '+nf.format(it.qty)+'</div>'+
      '</div>'+
      '<button class="sell-btn" '+disabled+' onclick="openSellModal(\''+id+'\')">'+(it.qty>0?t('btn_sell'):'—')+'</button>'+
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
  const builtCount = Object.values(buildings).filter(b => b.level > 0).length;
  const langId = currentLang === 'id' ? 'selected' : '';
  const langEn = currentLang === 'en' ? 'selected' : '';

  return `
    <div class="profile-hero">
      <div class="profile-hero-top">
        <div class="profile-logo">${profile.avatar||'🏭'}</div>
        <div class="profile-hero-info">
          <div class="profile-status"><span class="dot"></span>${t('p_online')}</div>
          <div class="profile-company-name">${profile.company_name}</div>
          <div class="profile-company-type">${t('p_pt')} · @${profile.username}</div>
        </div>
      </div>
      <div class="profile-actions">
        <button class="profile-btn" onclick="copyCompanyId()">${t('p_copy_id')}</button>
        <button class="profile-btn" onclick="toast('${t('t_coming_soon')}','info')">${t('p_edit_profile')}</button>
      </div>
    </div>

    <div class="card">
      <div class="card-section-header">${t('p_rankings')}</div>
      <div class="ranking-box">
        <div class="ranking-item">
          <div class="ranking-label">${t('p_company_value')}</div>
          <div class="ranking-value gold">${money(value)}</div>
        </div>
        <div class="ranking-item">
          <div class="ranking-label">${t('p_eva')}</div>
          <div class="ranking-value">${nf.format(profile.xp)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-section-header">${t('p_info')}</div>
      <div class="p-compact-list">
        <div class="info-row">
          <span class="info-key">${t('p_rating')}</span>
          <span class="info-val"><span class="rating-badge ${rating.cls}">${rating.text}</span></span>
        </div>
        <div class="info-row"><span class="info-key">${t('p_level')}</span><span class="info-val">${profile.level}</span></div>
        <div class="info-row"><span class="info-key">${t('p_xp')}</span><span class="info-val">${nf.format(profile.xp)}</span></div>
        <div class="info-row"><span class="info-key">${t('p_buildings')}</span><span class="info-val">${builtCount} ${t('p_units')}</span></div>
        <div class="info-row"><span class="info-key">${t('p_country')}</span><span class="info-val">${currentLang==='id'?'🇮🇩':'🇮🇩'} ${country}</span></div>
        <div class="info-row"><span class="info-key">${t('p_established')}</span><span class="info-val">${established}</span></div>
        <div class="info-row"><span class="info-key">${t('p_last_seen')}</span><span class="info-val">${lastSeen}</span></div>
        <div class="info-row"><span class="info-key">${t('p_local_time')}</span><span class="info-val">${localTime}</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-section-header">${t('p_description')}</div>
      <textarea class="description-textarea" id="descInput"
        placeholder="${t('p_description_ph')}"
        maxlength="200">${desc}</textarea>
      <button class="btn btn-green btn-sm" style="margin-top:10px;" onclick="saveDescription()">${t('btn_save_desc')}</button>
    </div>

    <div class="card">
      <div class="card-section-header">${t('p_account')}</div>
      <div class="account-menu">
        <div class="account-item" onclick="showLangPicker()">
          <div class="account-icon">🌐</div>
          <div class="account-label">${t('p_language')}</div>
          <div class="account-arrow" style="font-weight:700;color:var(--text-dim);font-size:12px;">${currentLang==='id'?'🇮🇩 Indonesia':'🇬🇧 English'}</div>
        </div>
        <div class="account-item" onclick="toast('${t('t_coming_soon')}','info')">
          <div class="account-icon">⚙️</div>
          <div class="account-label">${t('p_preferences')}</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="changePassword()">
          <div class="account-icon">🔑</div>
          <div class="account-label">${t('p_change_password')}</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="doLogout()">
          <div class="account-icon">🚪</div>
          <div class="account-label">${t('p_logout')}</div>
          <div class="account-arrow">›</div>
        </div>
        <div class="account-item" onclick="deleteAccount()">
          <div class="account-icon" style="background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.3);">🗑️</div>
          <div class="account-label danger">${t('p_delete')}</div>
          <div class="account-arrow">›</div>
        </div>
      </div>
    </div>

    <div style="text-align:center;font-size:10px;color:var(--text-mute);padding:14px 0 8px;">
      JurkonCompanies v3.2 · Cloud Sync
    </div>
  `;
}

/* Language picker modal */
function showLangPicker(){
  const container = $('modalContainer');
  container.innerHTML = `
    <div class="modal-backdrop" id="langBackdrop" onclick="if(event.target.id==='langBackdrop')closeSellModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-grip"></div>
        <div class="modal-title">🌐 ${t('p_language')}</div>
        <div class="account-item" onclick="pickLang('id')" style="${currentLang==='id'?'background:var(--surface-2);':''}">
          <div class="account-icon" style="font-size:20px;">🇮🇩</div>
          <div class="account-label" style="font-size:15px;">Bahasa Indonesia</div>
          ${currentLang==='id'?'<div style="color:#4ade80;font-weight:800;">✓</div>':''}
        </div>
        <div class="account-item" onclick="pickLang('en')" style="${currentLang==='en'?'background:var(--surface-2);':''}">
          <div class="account-icon" style="font-size:20px;">🇬🇧</div>
          <div class="account-label" style="font-size:15px;">English</div>
          ${currentLang==='en'?'<div style="color:#4ade80;font-weight:800;">✓</div>':''}
        </div>
        <button class="btn btn-outline" style="margin-top:12px;" onclick="closeSellModal()">${t('sell_cancel')}</button>
      </div>
    </div>`;
}
function pickLang(lang){
  setLang(lang);
  closeSellModal();
  toast(lang === 'id' ? '🇮🇩 Bahasa Indonesia' : '🇬🇧 English', 'good');
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
      if(txt)txt.textContent=(currentLang==='id'?'Upgrade: ':'Upgrading: ')+(remain/1000).toFixed(1)+'s';
      if(remain<=0)finishUpgrade(bId);
    }
    if(st.producing&&st.endsAt){
      active=true;
      const remain=Math.max(0,st.endsAt-Date.now());
      const pct=Math.min(100,100-(remain/b.duration*100));
      const bar=document.querySelector('[data-bar="'+bId+'"]');
      const txt=document.querySelector('[data-text="'+bId+'"]');
      if(bar)bar.style.width=pct+'%';
      if(txt)txt.textContent=(currentLang==='id'?'Produksi: ':'Producing: ')+(remain/1000).toFixed(1)+'s';
      if(remain<=0)finishProduction(bId);
    }
  }
  if(active)progressRaf=requestAnimationFrame(tickProgress);
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.tab').forEach(tabEl=>{
  tabEl.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    tabEl.classList.add('active');
    currentTab=tabEl.dataset.tab;
    render();
  });
});

/* ============================================================
   INIT
   ============================================================ */
(async()=>{
  document.documentElement.lang = currentLang;
  updateStaticUI();
  showLoading('Loading...');
  const {data}=await sb.auth.getSession();
  if(data.session){user=data.session.user;await enterGame();}
  else{hideLoading();showScreen('auth');}
  setInterval(recoverPrices,12000);
})();

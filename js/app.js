const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let user = null, profile = null;
let buildings = {}, inventory = {};
let marketOrders = [], myOrders = [];
let leaderboardData = null;
let transactions = [];
let research = {};
let tickerPrices = {};
let currentTab = 'buildings';
let storageSubTab = 'rank';
let historyFilter = 'all';
let progressRaf = null, researchRaf = null, boostRaf = null;
let modalItemId = null, modalSellOrderItem = null;
let marketFilter = 'all';
let realtimeChannel = null;
let isGuest = false;

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('en-US');
const money = n => '$' + nf.format(Math.floor(n));

function showScreen(n){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('screen-'+n).classList.add('active');window.scrollTo(0,0);}
function toast(m,t='info'){const e=$('toast');e.textContent=m;e.className='show '+t;clearTimeout(e._t);e._t=setTimeout(()=>e.className='',2500);}
function showMsg(id,m,t){const e=$(id);e.textContent=m;e.className='msg show '+t;clearTimeout(e._t);e._t=setTimeout(()=>e.className='msg',5000);}
function hideMsg(id){$(id).className='msg';}
function showLoading(t='Loading...'){$('loadingText').textContent=t;$('loading').classList.remove('hidden');}
function hideLoading(){$('loading').classList.add('hidden');}

/* ============================================================
   RANDOM COMPANY NAME
   ============================================================ */
const NAME_PREFIXES = ['Alpha','Beta','Prime','Swift','Nova','Apex','Zenith','Vertex','Orbit','Pulse','Vortex','Delta','Sigma','Omega','Titan','Fusion','Crystal','Stellar','Nexus','Quantum','Echo','Rapid','Bright','Core'];
const NAME_SUFFIXES = ['Industries','Corp','Trading','Holdings','Group','Enterprises','Solutions','Logistics','Manufacturing','Ventures','Dynamics','Systems'];
const NAME_EXTRA = ['Co','Ltd','Inc','LLC','Global','International','Nusantara','Mandiri'];

function generateRandomCompanyName(){
  const p = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const s = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  if(Math.random() < 0.5){const e = NAME_EXTRA[Math.floor(Math.random() * NAME_EXTRA.length)];return `${p} ${s} ${e}`;}
  return `${p} ${s}`;
}

function generateRandomAvatar(){const avatars = ['🏭','⚡','🚀','🌾','⛏️','💎','🏗️','🔧'];return avatars[Math.floor(Math.random() * avatars.length)];}

/* ============================================================
   PIXEL AVATAR GENERATOR
   ============================================================ */
function generatePixelAvatar(){
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1c20';
  ctx.fillRect(0, 0, size, size);
  const palette = ['#4ade80','#60a5fa','#a78bfa','#fbbf24','#f87171','#22d3ee','#f472b6','#34d399','#fb923c','#38bdf8','#a3e635','#facc15','#c084fc','#2dd4bf','#fde047'];
  const color = palette[Math.floor(Math.random() * palette.length)];
  ctx.fillStyle = color;
  const half = Math.ceil(size / 2);
  for (let x = 0; x < half; x++) {
    for (let y = 0; y < size; y++) {
      if (Math.random() > 0.55) {
        ctx.fillRect(x, y, 1, 1);
        ctx.fillRect(size - 1 - x, y, 1, 1);
      }
    }
  }
  return canvas.toDataURL('image/png');
}

function isPixelAvatar(avatar){return typeof avatar === 'string' && avatar.indexOf('data:image') === 0;}
function avatarHtml(avatar){if(!avatar) avatar = '🏭';if(isPixelAvatar(avatar)){return `<img src="${avatar}" alt="">`;}return avatar;}

function isBeginnerBoostActive(){if(!profile||!profile.created_at) return false;const created=new Date(profile.created_at).getTime();return Date.now() < created + BEGINNER_BOOST_HOURS*3600*1000;}
function getBoostRemaining(){if(!isBeginnerBoostActive()) return 0;const created=new Date(profile.created_at).getTime();return (created+BEGINNER_BOOST_HOURS*3600*1000)-Date.now();}
function getBoostMult(){return isBeginnerBoostActive()?BEGINNER_BOOST_MULT:1;}
function formatBoostTime(ms){const t=Math.floor(ms/1000);const h=Math.floor(t/3600);const m=Math.floor((t%3600)/60);const s=t%60;return `${h}j ${m}m ${s}s`;}

function getRating(){const l=profile.level;if(l>=15)return{text:'AAA',cls:'top'};if(l>=12)return{text:'AA',cls:'top'};if(l>=9)return{text:'A',cls:'high'};if(l>=7)return{text:'BBB',cls:'high'};if(l>=5)return{text:'BB',cls:''};if(l>=3)return{text:'B',cls:''};return{text:'C',cls:''};}
function getCompanyValue(){let v=profile.cash;for(const[bId,b]of Object.entries(buildings)){if(b.level>0)v+=BUILDINGS[bId].baseCost*b.level*0.7;}for(const[itId,it]of Object.entries(inventory))v+=it.qty*it.price;return Math.floor(v);}
function fmtDate(ts){if(!ts)return '-';return new Date(ts).toLocaleDateString(currentLang==='id'?'id-ID':'en-US',{day:'numeric',month:'numeric',year:'numeric'});}
function fmtTime(){return new Date().toLocaleTimeString(currentLang==='id'?'id-ID':'en-US',{hour:'2-digit',minute:'2-digit'});}
function timeAgo(ts){if(!ts)return currentLang==='id'?'Baru saja':'Just now';const diff=Date.now()-new Date(ts).getTime();const m=Math.floor(diff/60000);if(m<1)return currentLang==='id'?'Baru saja':'Just now';if(m<60)return m+(currentLang==='id'?' menit lalu':' min ago');const h=Math.floor(m/60);if(h<24)return h+(currentLang==='id'?' jam lalu':' h ago');return Math.floor(h/24)+(currentLang==='id'?' hari lalu':' d ago');}
function starsHtml(level){let s='';for(let i=0;i<RESEARCH_CONFIG.MAX_LEVEL;i++){s+=i<level?'⭐':'☆';}return s;}

function updateStaticUI(){
  document.title='Catalyst';
  const authScreen=$('screen-auth');
  if(authScreen){authScreen.querySelector('.auth-sub').textContent=t('tagline');$('tabLogin').textContent=t('login');$('tabRegister').textContent=t('register');
    const lf=$('loginForm');lf.querySelector('label').textContent=t('email');$('loginEmail').placeholder=t('ph_email');lf.querySelectorAll('label')[1].textContent=t('password');$('loginPassword').placeholder=t('ph_password');$('loginBtn').textContent=t('btn_login');
    const rf=$('registerForm');const rLabels=rf.querySelectorAll('label');rLabels[0].textContent=t('email');$('regEmail').placeholder=t('ph_email');rLabels[1].textContent=t('password');$('regPassword').placeholder=t('ph_password_new');rLabels[2].textContent=t('username');$('regUsername').placeholder=t('ph_username');$('registerBtn').textContent=t('btn_register');}
  const tabMap={buildings:'tab_buildings',storage:'tab_storage',exchange:'tab_exchange',search:'tab_search',chat:'tab_chat'};
  document.querySelectorAll('.tab').forEach(tabEl=>{const key=tabMap[tabEl.dataset.tab];if(key)tabEl.querySelector('.tab-label').textContent=t(key);});
}

async function logTransaction(type,itemId,qty,amount,note){try{await sb.from('transactions').insert({user_id:user.id,type,item_id:itemId||null,qty:qty||0,amount:amount||0,note:note||null});transactions.unshift({type,item_id:itemId,qty:qty||0,amount:amount||0,note:note||null,created_at:new Date().toISOString()});if(transactions.length>100)transactions.pop();}catch(e){console.warn(e);}}
async function loadTransactions(){try{const{data,error}=await sb.from('transactions').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(error){transactions=[];return;}transactions=data||[];}catch(e){transactions=[];}}
async function loadResearch(){try{const{data,error}=await sb.from('research').select('*').eq('user_id',user.id);research={};for(const iId of RESEARCH_CONFIG.PILOT_ITEMS)research[iId]={level:0,researching:false,endsAt:0};if(error){console.warn(error);return;}for(const row of (data||[])){if(research[row.item_id]){research[row.item_id]={level:row.level||0,researching:row.researching||false,endsAt:row.research_ends_at?new Date(row.research_ends_at).getTime():0};}}}catch(e){console.warn(e);}}
async function syncResearch(itemId){const r=research[itemId];await sb.from('research').upsert({user_id:user.id,item_id:itemId,level:r.level,researching:r.researching,research_ends_at:r.endsAt?new Date(r.endsAt).toISOString():null},{onConflict:'user_id,item_id'});}

function switchTab(tab){$('tabLogin').classList.toggle('active',tab==='login');$('tabRegister').classList.toggle('active',tab==='register');$('loginForm').style.display=tab==='login'?'block':'none';$('registerForm').style.display=tab==='register'?'block':'none';hideMsg('authMsg');}

async function doLogin(e){e.preventDefault();hideMsg('authMsg');const email=$('loginEmail').value.trim(),password=$('loginPassword').value;$('loginBtn').disabled=true;$('loginBtn').textContent=t('msg_logging');showLoading(t('msg_logging'));const{data,error}=await sb.auth.signInWithPassword({email,password});if(error){hideLoading();$('loginBtn').disabled=false;$('loginBtn').textContent=t('btn_login');return showMsg('authMsg','❌ '+error.message,'error');}user=data.user;isGuest=false;await enterGame();}

async function doRegister(e){e.preventDefault();hideMsg('authMsg');const email=$('regEmail').value.trim(),password=$('regPassword').value,username=$('regUsername').value.trim();if(password.length<6)return showMsg('authMsg','Password min 6','error');if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))return showMsg('authMsg','Username: 3-20 a-z/0-9/_','error');$('registerBtn').disabled=true;$('registerBtn').textContent=t('msg_registering');showLoading(t('msg_registering'));const{data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});if(error){hideLoading();$('registerBtn').disabled=false;$('registerBtn').textContent=t('btn_register');return showMsg('authMsg','❌ '+error.message,'error');}user=data.user;isGuest=false;await enterGame();}

async function doLogout(){
  if(!confirm(currentLang==='id'?'Keluar?':'Log out?'))return;
  try{await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);}catch(e){}
  if(progressRaf)cancelAnimationFrame(progressRaf);
  if(researchRaf)cancelAnimationFrame(researchRaf);
  if(boostRaf)cancelAnimationFrame(boostRaf);
  Object.values(buildings).forEach(b=>{clearTimeout(b._timer);clearTimeout(b._upTimer);});
  Object.values(research).forEach(r=>clearTimeout(r._timer));
  if(realtimeChannel){sb.removeChannel(realtimeChannel);realtimeChannel=null;}
  await sb.auth.signOut();
  user=null;profile=null;buildings={};inventory={};marketOrders=[];myOrders=[];leaderboardData=null;transactions=[];research={};
  $('loginForm').reset();$('registerForm').reset();
  showScreen('auth');switchTab('login');
  toast(t('t_logout_msg'),'info');
}

/* ============================================================
   AUTO-GENERATE PROFILE UNTUK GUEST
   ============================================================ */
async function ensureGuestProfile(){
  const {data: existing} = await sb.from('profiles').select('id, company_name').eq('id', user.id).maybeSingle();
  if(existing && existing.company_name && existing.company_name !== 'PT Baru') return;
  const name = generateRandomCompanyName();
  const avatar = generatePixelAvatar();
  const username = 'guest_' + user.id.slice(0, 6);
  await sb.from('profiles').upsert({
    id: user.id,
    username: username,
    company_name: name,
    avatar: avatar,
    cash: 500,
  }, {onConflict: 'id'});
}

async function enterGame(){
  showLoading('Loading...');
  const{data:prof,error:pErr}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(pErr){hideLoading();return showMsg('authMsg','❌ '+pErr.message,'error');}
  profile=prof;
  if(profile.tutorial_step===undefined) profile.tutorial_step=0;
  if(profile.tutorial_dismissed===undefined) profile.tutorial_dismissed=false;
  if(profile.level_rewards_claimed===undefined) profile.level_rewards_claimed='';
  if(profile.last_emergency_grant===undefined) profile.last_emergency_grant=null;

  // Kalau belum punya nama perusahaan, auto-generate (untuk guest baru)
  if(!profile.company_name || profile.company_name === 'PT Baru'){
    const name = generateRandomCompanyName();
    const avatar = generatePixelAvatar();
    await sb.from('profiles').update({company_name: name, avatar: avatar}).eq('id', user.id);
    profile.company_name = name;
    profile.avatar = avatar;
  }

  try{await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);}catch(e){}
  profile.last_seen=new Date().toISOString();

  // Deteksi apakah guest
  isGuest = !!(user && user.is_anonymous);

  await loadGameData();await loadMarketOrders();await loadTransactions();await loadResearch();
  subscribeRealtime();
  hideLoading();showScreen('game');render();resumeAllActions();resumeAllResearch();startBoostTimer();
}

async function loadGameData(){
  const{data:bData}=await sb.from('buildings').select('*').eq('user_id',user.id);
  buildings={};
  for(const bId of Object.keys(BUILDINGS))buildings[bId]={level:0,producing:false,endsAt:0,auto:false,upgrading:false,upgradeEndsAt:0};
  if(bData){for(const row of bData){if(buildings[row.building_id]){buildings[row.building_id]={level:row.level||0,producing:row.producing||false,endsAt:row.ends_at?new Date(row.ends_at).getTime():0,auto:row.auto||false,upgrading:row.upgrading||false,upgradeEndsAt:row.upgrade_ends_at?new Date(row.upgrade_ends_at).getTime():0};}}}
  const{data:iData}=await sb.from('inventory').select('*').eq('user_id',user.id);
  inventory={};
  for(const iId of Object.keys(ITEMS))inventory[iId]={qty:0,price:ITEMS[iId].basePrice};
  if(iData){for(const row of iData){if(inventory[row.item_id])inventory[row.item_id].qty=row.qty;}}
}
async function loadMarketOrders(){const{data,error}=await sb.from('market_orders').select('*').eq('status','open').order('price_per_unit',{ascending:false}).order('created_at',{ascending:true});if(error){console.warn(error);return;}const all=data||[];marketOrders=all.filter(o=>o.seller_id!==user.id);myOrders=all.filter(o=>o.seller_id===user.id);updateTickerFromMarket();}
async function loadLeaderboard(){const{data,error}=await sb.from('profiles').select('id, username, company_name, avatar, level, xp, company_value').order('company_value',{ascending:false}).limit(50);if(error){console.warn(error);leaderboardData=[];return;}leaderboardData=data||[];}
function updateTickerFromMarket(){const lowest={};for(const o of marketOrders){if(!lowest[o.item_id]||o.price_per_unit<lowest[o.item_id])lowest[o.item_id]=parseFloat(o.price_per_unit);}for(const itemId of Object.keys(ITEMS)){const newPrice=lowest[itemId]||null;const prev=tickerPrices[itemId]?tickerPrices[itemId].price:null;tickerPrices[itemId]={price:newPrice,prevPrice:prev};}renderTicker();}
function renderTicker(){const bar=$('tickerBar');if(!bar)return;let html='',hasAny=false;for(const itemId of EXCHANGE_CONFIG.TICKER_ITEMS){const def=ITEMS[itemId];if(!def)continue;const tp=tickerPrices[itemId]||{};const price=tp.price,prev=tp.prevPrice;let change='flat',arrow='—',pct='';if(price!=null&&prev!=null&&prev>0){const diff=((price-prev)/prev)*100;if(diff>0.5){change='up';arrow='↑';pct=diff.toFixed(1)+'%';}else if(diff<-0.5){change='down';arrow='↓';pct=Math.abs(diff).toFixed(1)+'%';}}const priceText=price!=null?'$'+price.toFixed(2):'—';html+=`<div class="ticker-item" onclick="jumpToExchange('${itemId}')"><span class="t-emoji">${def.emoji}</span><span class="t-price">${priceText}</span><span class="t-change ${change}">${arrow}${pct?' '+pct:''}</span></div>`;if(price!=null)hasAny=true;}if(!hasAny&&marketOrders.length===0)bar.innerHTML='<div class="ticker-loading">'+t('ex_empty')+'</div>';else bar.innerHTML=html;}
function jumpToExchange(itemId){marketFilter=itemId;currentTab='exchange';document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));const tabEl=document.querySelector('.tab[data-tab="exchange"]');if(tabEl)tabEl.classList.add('active');render();}
function subscribeRealtime(){if(realtimeChannel)sb.removeChannel(realtimeChannel);realtimeChannel=sb.channel('jc-market').on('postgres_changes',{event:'*',schema:'public',table:'market_orders'},async()=>{await loadMarketOrders();if(currentTab==='exchange')render();}).subscribe();}

async function syncProfile(){const cv=getCompanyValue();profile.company_value=cv;await sb.from('profiles').update({cash:profile.cash,xp:profile.xp,level:profile.level,company_value:cv}).eq('id',user.id);if(profile.cash>=5000) advanceTutorial(6);}
async function syncBuilding(bId){const b=buildings[bId];await sb.from('buildings').upsert({user_id:user.id,building_id:bId,level:b.level,auto:b.auto,producing:b.producing,ends_at:b.endsAt?new Date(b.endsAt).toISOString():null,upgrading:b.upgrading,upgrade_ends_at:b.upgradeEndsAt?new Date(b.upgradeEndsAt).toISOString():null},{onConflict:'user_id,building_id'});}
async function syncInventory(itemId){await sb.from('inventory').upsert({user_id:user.id,item_id:itemId,qty:inventory[itemId].qty},{onConflict:'user_id,item_id'});}

function buildCost(bId){return BUILDINGS[bId].baseCost;}
function upgradeCost(bId){return Math.floor(BUILDINGS[bId].baseCost*Math.pow(1.5,buildings[bId].level));}
function getUpgradeDurationMs(bId){const base=BUILDINGS[bId].upgradeTime*1000;const lvl=buildings[bId].level;const raw=lvl===0?base:Math.floor(base*(1+lvl*0.5));return Math.floor(raw/getBoostMult());}
function getProductionDuration(bId){return Math.floor(BUILDINGS[bId].duration/getBoostMult());}
function getOutputQty(bId){const l=buildings[bId].level;return l?Math.floor(BUILDINGS[bId].output.qty*(1+(l-1)*0.5)):0;}
function getInputQty(bId,itemId){const l=buildings[bId].level;return l?Math.ceil(BUILDINGS[bId].inputs[itemId]*(1+(l-1)*0.3)):0;}
function hasInputs(bId){for(const it of Object.keys(BUILDINGS[bId].inputs)){if(inventory[it].qty<getInputQty(bId,it))return false;}return true;}

function addXP(n){profile.xp+=n;const nl=1+Math.floor(profile.xp/1500);if(nl>profile.level){profile.level=nl;toast('🎉 Lv '+nl+'!','good');checkLevelRewards();}}
async function checkLevelRewards(){const claimed=(profile.level_rewards_claimed||'').split(',').filter(x=>x);for(const[lvlStr,reward]of Object.entries(LEVEL_REWARDS)){const lvl=parseInt(lvlStr);if(profile.level>=lvl&&!claimed.includes(lvlStr)){profile.cash+=reward;claimed.push(lvlStr);profile.level_rewards_claimed=claimed.join(',');await syncProfile();setTimeout(()=>{toast('🎁 '+t('levelup_reward')+' Lv '+lvl+': +'+money(reward),'good');},600);}}}

/* EMERGENCY GRANT */
function canClaimEmergencyGrant(){if(!profile)return false;if(profile.cash>=100)return false;if(!profile.last_emergency_grant)return true;const last=new Date(profile.last_emergency_grant).getTime();return (Date.now()-last)>24*3600*1000;}
function getEmergencyCooldownRemaining(){if(!profile||!profile.last_emergency_grant)return 0;const last=new Date(profile.last_emergency_grant).getTime();const remain=24*3600*1000-(Date.now()-last);return remain>0?remain:0;}
async function claimEmergencyGrant(){if(!canClaimEmergencyGrant()){const remain=getEmergencyCooldownRemaining();const hours=Math.ceil(remain/3600000);return toast(currentLang==='id'?`⏳ Tunggu ${hours} jam lagi`:`⏳ Wait ${hours}h more`,'info');}const amount=500;profile.cash+=amount;profile.last_emergency_grant=new Date().toISOString();await sb.from('profiles').update({cash:profile.cash,last_emergency_grant:profile.last_emergency_grant}).eq('id',user.id);await logTransaction('emergency_grant',null,0,amount,'Emergency grant');render();toast('🚨 +'+money(amount)+' '+(currentLang==='id'?'bantuan darurat':'emergency grant'),'good');}
function renderEmergencyCard(){if(!profile)return '';if(profile.cash>=100)return '';if(!canClaimEmergencyGrant()){const remain=getEmergencyCooldownRemaining();const hours=Math.ceil(remain/3600000);return `<div class="card" style="border:1px solid rgba(224,62,62,0.4);background:#fff5f5;padding:12px;"><div style="display:flex;align-items:center;gap:10px;"><div style="font-size:22px;">🚨</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#b82020;">${currentLang==='id'?'Bantuan Darurat':'Emergency Grant'}</div><div style="font-size:10.5px;color:#b82020;margin-top:2px;">${currentLang==='id'?'Tersedia dalam':'Available in'} ${hours}j</div></div></div></div>`;}return `<div class="card" style="border:1px solid rgba(224,62,62,0.5);background:linear-gradient(180deg,#fff5f5,#fff);padding:12px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><div style="font-size:22px;">🚨</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#b82020;">${currentLang==='id'?'Uang Menipis!':'Low Cash!'}</div><div style="font-size:10.5px;color:#b82020;margin-top:2px;">${currentLang==='id'?'Klaim bantuan darurat $500 (sekali per 24 jam)':'Claim $500 emergency grant (once per 24h)'}</div></div></div><button class="btn btn-red btn-sm" onclick="claimEmergencyGrant()">🚨 ${currentLang==='id'?'Klaim $500':'Claim $500'}</button></div>`;}

/* ============================================================
   SAVE PROGRESS MODAL (untuk guest)
   ============================================================ */
function openSaveModal(){
  if(!isGuest) return;
  $('modalContainer').innerHTML = `
    <div class="modal-backdrop" id="saveBackdrop" onclick="if(event.target.id==='saveBackdrop')closeModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-grip"></div>
        <div class="modal-title">💾 ${t('save_title')}</div>
        <div style="background:#fff5d9;border:1px solid #f0c674;padding:12px;border-radius:10px;margin-bottom:14px;font-size:12px;color:#8a6000;line-height:1.5;">
          ⚠️ ${t('guest_banner')}
        </div>
        <div style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-bottom:14px;">
          ${t('save_desc')}
        </div>
        <div class="modal-field">
          <label>${t('email')}</label>
          <input type="email" id="saveEmail" placeholder="${t('ph_email')}" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;">
        </div>
        <div class="modal-field">
          <label>${t('password')}</label>
          <input type="password" id="savePassword" placeholder="${t('ph_password_new')}" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;">
        </div>
        <div class="modal-field">
          <label>${t('username')}</label>
          <input type="text" id="saveUsername" placeholder="${t('ph_username')}" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;">
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="closeModal()">${t('save_later')}</button>
          <button class="btn btn-green" id="saveBtn" onclick="submitSave()">${t('save_submit')}</button>
        </div>
      </div>
    </div>
  `;
}

async function submitSave(){
  const email = $('saveEmail').value.trim();
  const password = $('savePassword').value;
  const username = $('saveUsername').value.trim();

  if(!email || !password || !username) return toast(currentLang==='id'?'Isi semua field':'Fill all fields','bad');
  if(password.length < 6) return toast('Password min 6','bad');
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return toast('Username: 3-20 a-z/0-9/_','bad');

  $('saveBtn').disabled = true;
  $('saveBtn').textContent = '⏳...';

  try {
    // Cek username sudah ada atau belum
    const {data: existing} = await sb.from('profiles').select('id').eq('username', username).neq('id', user.id).maybeSingle();
    if(existing){
      $('saveBtn').disabled = false;
      $('saveBtn').textContent = t('save_submit');
      return toast(currentLang==='id'?'Username sudah dipakai':'Username taken','bad');
    }

    // Upgrade anonymous user jadi real user
    const {error} = await sb.auth.updateUser({ email, password });
    if(error) throw error;

    // Update username di profile
    await sb.from('profiles').update({ username }).eq('id', user.id);
    profile.username = username;
    isGuest = false;

    closeModal();
    render();
    toast(t('save_success'), 'good');
  } catch(e) {
    $('saveBtn').disabled = false;
    $('saveBtn').textContent = t('save_submit');
    toast('❌ ' + e.message, 'bad');
  }
}

/* SEARCH + CHAT */
function renderSearch(){return `<div class="ex-empty"><span class="big">🔍</span><div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px;">${t('search_title')}</div><div style="font-size:11.5px;">${t('coming_soon_desc')}</div></div>`;}
function renderChat(){return `<div class="ex-empty"><span class="big">💬</span><div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px;">${t('chat_title')}</div><div style="font-size:11.5px;">${t('coming_soon_desc')}</div></div>`;}

async function build(bId){
  const st=buildings[bId];
  if(st.level>0 || st.upgrading) return;
  const c=buildCost(bId);
  if(profile.cash<c)return toast(t('t_not_enough_money'),'bad');
  const remaining = profile.cash - c;
  if (remaining < 500) {
    const msg = currentLang === 'id' ? `⚠️ Peringatan!\n\nBangun ${t(BUILDINGS[bId].nameKey)} akan memakan $${nf.format(c)}.\n\nSisa uang: $${nf.format(remaining)}\n\nLanjut?` : `⚠️ Warning!\n\nBuilding ${t(BUILDINGS[bId].nameKey)} will cost $${nf.format(c)}.\n\nRemaining: $${nf.format(remaining)}\n\nContinue?`;
    if (!confirm(msg)) return toast(currentLang==='id'?'Dibatalkan':'Cancelled','info');
  }
  const oldCash = profile.cash, oldUpgrading = st.upgrading, oldEndsAt = st.upgradeEndsAt;
  profile.cash-=c; st.upgrading=true; st.upgradeEndsAt=Date.now()+getUpgradeDurationMs(bId);
  try { await Promise.all([syncProfile(),syncBuilding(bId)]); }
  catch(e) { profile.cash=oldCash; st.upgrading=oldUpgrading; st.upgradeEndsAt=oldEndsAt; console.error(e); return toast('❌ Sync error: '+e.message,'bad'); }
  await logTransaction('build', bId, 0, -c);
  await advanceTutorial(1);
  render();
  const sec=Math.floor(getUpgradeDurationMs(bId)/1000);
  const boostText=isBeginnerBoostActive()?' (🚀 2x)':'';
  toast('🏗️ '+t(BUILDINGS[bId].nameKey)+' · '+sec+'s'+boostText,'info');
  scheduleUpgradeFinish(bId);
}
async function upgrade(bId){
  const st=buildings[bId];
  if(!st.level)return build(bId);
  if(st.upgrading)return toast(t('status_upgrading')+'...','info');
  if(st.producing)return toast('Wait','info');
  if(st.level>=CONFIG.MAX_LEVEL)return toast(t('t_max_level'),'info');
  const c=upgradeCost(bId);
  if(profile.cash<c)return toast(t('t_not_enough_money'),'bad');
  const remaining = profile.cash - c;
  if (remaining < 500) {
    const msg = currentLang === 'id' ? `⚠️ Peringatan!\n\nUpgrade ${t(BUILDINGS[bId].nameKey)} ke Lv ${st.level+1} akan memakan $${nf.format(c)}.\n\nSisa uang: $${nf.format(remaining)}\n\nLanjut?` : `⚠️ Warning!\n\nUpgrade ${t(BUILDINGS[bId].nameKey)} to Lv ${st.level+1} will cost $${nf.format(c)}.\n\nRemaining: $${nf.format(remaining)}\n\nContinue?`;
    if (!confirm(msg)) return toast(currentLang==='id'?'Dibatalkan':'Cancelled','info');
  }
  const oldCash = profile.cash, oldUpgrading = st.upgrading, oldEndsAt = st.upgradeEndsAt;
  profile.cash-=c; st.upgrading=true; st.upgradeEndsAt=Date.now()+getUpgradeDurationMs(bId);
  try { await Promise.all([syncProfile(),syncBuilding(bId)]); }
  catch(e) { profile.cash=oldCash; st.upgrading=oldUpgrading; st.upgradeEndsAt=oldEndsAt; console.error(e); return toast('❌ Sync error: '+e.message,'bad'); }
  await logTransaction('upgrade', bId, 0, -c, 'Lv '+(st.level+1));
  render();
  const boostText=isBeginnerBoostActive()?' (🚀 2x)':'';
  toast(t('t_upgrade_started')+' ('+Math.floor(getUpgradeDurationMs(bId)/1000)+'s)'+boostText,'info');
  scheduleUpgradeFinish(bId);
}
function scheduleUpgradeFinish(bId){const st=buildings[bId];const remain=st.upgradeEndsAt-Date.now();if(remain<=0){finishUpgrade(bId);return;}clearTimeout(st._upTimer);st._upTimer=setTimeout(()=>finishUpgrade(bId),remain);}
async function finishUpgrade(bId){const st=buildings[bId];if(!st.upgrading)return;const wasNewBuild=st.level===0;st.upgrading=false;st.upgradeEndsAt=0;st.level+=1;await syncBuilding(bId);render();if(wasNewBuild){toast('🏭 '+t(BUILDINGS[bId].nameKey)+' '+t('t_building_done'),'good');}else{toast('🎉 '+t(BUILDINGS[bId].nameKey)+' → Lv '+st.level+'!','good');}}
async function toggleAuto(bId){const st=buildings[bId];st.auto=!st.auto;await syncBuilding(bId);render();if(st.auto&&!st.producing&&!st.upgrading&&hasInputs(bId))startProduction(bId);}
async function startProduction(bId){const st=buildings[bId];if(!st.level||st.producing||st.upgrading)return;if(!hasInputs(bId)){if(!st.auto)toast(t('t_insufficient_input'),'bad');return;}const b=BUILDINGS[bId];for(const it of Object.keys(b.inputs))inventory[it].qty-=getInputQty(bId,it);st.producing=true;st.endsAt=Date.now()+getProductionDuration(bId);const promises=[syncBuilding(bId)];for(const it of Object.keys(b.inputs))promises.push(syncInventory(it));await Promise.all(promises);render();scheduleFinish(bId);}
function scheduleFinish(bId){const st=buildings[bId];const remain=st.endsAt-Date.now();if(remain<=0){finishProduction(bId);return;}clearTimeout(st._timer);st._timer=setTimeout(()=>finishProduction(bId),remain);}
async function finishProduction(bId){const st=buildings[bId];if(!st.producing)return;const b=BUILDINGS[bId];const qty=getOutputQty(bId);st.producing=false;st.endsAt=0;inventory[b.output.item].qty+=qty;addXP(qty);await Promise.all([syncBuilding(bId),syncInventory(b.output.item),syncProfile()]);await logTransaction('produce',b.output.item,qty,0,t(BUILDINGS[bId].nameKey));await advanceTutorial(2);if(st.auto&&hasInputs(bId)&&!st.upgrading)setTimeout(()=>startProduction(bId),50);else render();}

/* TUTORIAL */
async function advanceTutorial(stepDone){
  if(!profile)return;
  if(profile.tutorial_dismissed)return;
  if(profile.tutorial_step>=stepDone)return;
  if(profile.tutorial_step!==stepDone-1)return;
  const step=TUTORIAL_STEPS.find(s=>s.id===stepDone);
  if(!step)return;
  profile.tutorial_step=stepDone;
  profile.cash+=step.reward;
  await syncProfile();
  setTimeout(()=>{toast('✅ '+t(step.stepKey)+' +'+money(step.reward),'good');},400);
  if(profile.tutorial_step>=TUTORIAL_STEPS.length){
    setTimeout(()=>{
      toast(t('tutorial_done'),'good');
      if(isGuest) setTimeout(()=>openSaveModal(), 2000);
    },1800);
  }
}
async function dismissTutorial(){
  if(!confirm(currentLang==='id'?'Lewati tutorial?':'Skip tutorial?'))return;
  profile.tutorial_dismissed=true;
  await sb.from('profiles').update({tutorial_dismissed:true}).eq('id',user.id);
  render();
  toast(t('tutorial_skipped'),'info');
  if(isGuest) setTimeout(()=>openSaveModal(), 1200);
}
function renderTutorialCard(){if(!profile)return '';if(profile.tutorial_dismissed)return '';if(profile.tutorial_step>=TUTORIAL_STEPS.length)return '';const total=TUTORIAL_STEPS.length;const step=profile.tutorial_step;const pct=(step/total)*100;let stepsHtml='';for(let i=0;i<total;i++){const s=TUTORIAL_STEPS[i];const done=i<step;const current=i===step;const icon=done?'✅':(current?'▶️':'⬜');const style=done?'opacity:0.55;text-decoration:line-through;':(current?'font-weight:800;color:#1e88e5;':'color:#8b95a3;');stepsHtml+=`<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;${style}"><span style="font-size:13px;flex-shrink:0;">${icon}</span><span>${t(s.stepKey)}</span></div>`;}const totalReward=TUTORIAL_STEPS.reduce((s,x)=>s+x.reward,0);return `<div class="card" style="border:1px solid rgba(30,136,229,0.4);background:linear-gradient(180deg,#e6f0fb,#fff);padding:14px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:13px;font-weight:800;color:#1565c0;">🎓 ${t('tutorial_title')}</div><button onclick="dismissTutorial()" style="background:none;border:none;color:#8b95a3;font-size:11px;font-weight:700;cursor:pointer;padding:4px 8px;font-family:inherit;">${t('tutorial_skip')} ✕</button></div><div style="background:#fff;border-radius:99px;height:6px;margin-bottom:10px;overflow:hidden;border:1px solid #d0e3f5;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#1e88e5,#42a5f5);transition:width 0.3s;"></div></div><div style="font-size:11px;color:#5a6472;margin-bottom:8px;font-weight:600;">${t('tutorial_progress')}: ${step} / ${total}</div>${stepsHtml}<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.08);font-size:11px;color:#5a6472;">🎁 ${t('tutorial_total_reward')}: <b style="color:#1f7a3a;">+${money(totalReward)}</b></div></div>`;}
function renderBoostCard(){if(!isBeginnerBoostActive())return '';const remaining=getBoostRemaining();return `<div class="card" style="border:1px solid rgba(230,149,0,0.4);background:linear-gradient(180deg,#fff5d9,#fff);padding:12px;"><div style="display:flex;align-items:center;gap:10px;"><div style="font-size:22px;">🚀</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#8a6000;">${t('boost_active')}</div><div style="font-size:10.5px;color:#8a6000;margin-top:2px;">${t('boost_desc')}</div></div><div style="font-size:11px;font-weight:800;color:#8a6000;font-variant-numeric:tabular-nums;" data-boost-timer>${formatBoostTime(remaining)}</div></div></div>`;}
function startBoostTimer(){if(boostRaf)cancelAnimationFrame(boostRaf);const tick=()=>{if(!isBeginnerBoostActive())return;const el=document.querySelector('[data-boost-timer]');if(el){el.textContent=formatBoostTime(getBoostRemaining());}boostRaf=requestAnimationFrame(tick);};tick();}

/* SELL */
function sellFromStorage(itemId){const it=inventory[itemId];if(it.qty<=0)return toast(t('t_insufficient_input'),'bad');openSellModal(itemId);}
function openSellModal(itemId){const it=inventory[itemId];if(it.qty<=0)return;modalItemId=itemId;const def=ITEMS[itemId];const defName=t(def.nameKey);$('modalContainer').innerHTML=`<div class="modal-backdrop" id="sellBackdrop" onclick="if(event.target.id==='sellBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">${def.emoji} ${t('sell_modal_title')} ${defName}</div><div class="modal-field"><label>${t('sell_qty')} (${t('sell_max')}: ${nf.format(it.qty)})</label><div class="qty-control"><button onclick="adjustSellQty(-10)">−10</button><input type="number" id="sellQtyInput" value="${it.qty}" min="1" max="${it.qty}" oninput="updateSellTotal()"><button onclick="adjustSellQty(10)">+10</button></div><button class="btn-max" onclick="setSellQty(${it.qty})">${t('sell_max')} (${nf.format(it.qty)})</button></div><div class="modal-info"><div class="modal-info-row"><span class="k">${t('sell_price_per')}</span><span class="v">$${it.price.toFixed(2)}</span></div><div class="modal-info-row"><span class="k">${t('sell_total')}</span><span class="v gold" id="sellTotal">$${(it.qty*it.price).toFixed(2)}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-gold" onclick="confirmSell()">${t('sell_confirm')}</button></div></div></div>`;}
function closeModal(){$('modalContainer').innerHTML='';modalItemId=null;modalSellOrderItem=null;}
function adjustSellQty(d){const it=inventory[modalItemId];const inp=$('sellQtyInput');let v=parseInt(inp.value)||0;v=Math.max(1,Math.min(it.qty,v+d));inp.value=v;updateSellTotal();}
function setSellQty(v){const it=inventory[modalItemId];$('sellQtyInput').value=Math.min(v,it.qty);updateSellTotal();}
function updateSellTotal(){const it=inventory[modalItemId];let v=parseInt($('sellQtyInput').value)||0;v=Math.max(0,Math.min(it.qty,v));$('sellTotal').textContent='$'+(v*it.price).toFixed(2);}
async function confirmSell(){const itemId=modalItemId,it=inventory[itemId];let v=parseInt($('sellQtyInput').value)||0;v=Math.max(1,Math.min(it.qty,v));const revenue=Math.floor(v*it.price);it.qty-=v;profile.cash+=revenue;addXP(Math.floor(revenue/10));const impact=Math.min(0.2,v*0.0005);it.price=Math.max(ITEMS[itemId].basePrice*CONFIG.MIN_PRICE,it.price*(1-impact));await Promise.all([syncInventory(itemId),syncProfile()]);await logTransaction('sell_instant',itemId,v,revenue);await advanceTutorial(3);closeModal();render();toast('💰 +'+money(revenue),'good');}

function openCreateOrderModal(){const owned=Object.entries(inventory).filter(([id,it])=>it.qty>0);if(owned.length===0)return toast(currentLang==='id'?'Tidak ada barang untuk dijual':'Nothing to sell','bad');let itemsHtml='';for(const[id,it]of owned){const def=ITEMS[id];itemsHtml+=`<div class="sell-item-opt" data-item="${id}" onclick="pickSellOrderItem('${id}')"><div class="e">${def.emoji}</div><div class="n">${t(def.nameKey)}</div><div class="q">${nf.format(it.qty)}</div></div>`;}$('modalContainer').innerHTML=`<div class="modal-backdrop" id="orderBackdrop" onclick="if(event.target.id==='orderBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">📢 ${t('ex_create_order')}</div><div class="modal-field"><label>${currentLang==='id'?'Pilih Barang':'Select Item'}</label><div class="sell-item-picker">${itemsHtml}</div></div><div id="orderFormArea" style="display:none;"><div class="modal-field"><label>${t('sell_qty')} (<span id="ordMaxLabel">0</span>)</label><div class="qty-control"><button onclick="adjustOrderQty(-10)">−10</button><input type="number" id="orderQty" value="1" min="1" oninput="updateOrderTotal()"><button onclick="adjustOrderQty(10)">+10</button></div></div><div class="modal-field"><label>${currentLang==='id'?'Harga per Unit ($)':'Price per Unit ($)'}</label><div class="qty-control"><button onclick="adjustOrderPrice(-0.5)">−0.5</button><input type="number" id="orderPrice" value="0.00" step="0.01" min="0.01" oninput="updateOrderTotal()"><button onclick="adjustOrderPrice(0.5)">+0.5</button></div><div style="font-size:10.5px;color:var(--text-mute);margin-top:6px;text-align:center;">${currentLang==='id'?'Harga pasar':'Market price'}: <span id="orderMarketPrice" style="color:#e69500;font-weight:700;">—</span></div></div><div class="modal-info"><div class="modal-info-row"><span class="k">${currentLang==='id'?'Total':'Total'}</span><span class="v gold" id="orderTotal">$0.00</span></div><div class="modal-info-row"><span class="k">${currentLang==='id'?'Order aktif':'Active'}</span><span class="v">${myOrders.length} / ${EXCHANGE_CONFIG.MAX_SELL_ORDERS}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-gold" id="orderSubmitBtn" onclick="submitSellOrder()">📢 ${currentLang==='id'?'Pasang':'Post'}</button></div></div></div></div>`;}
function pickSellOrderItem(itemId){modalSellOrderItem=itemId;document.querySelectorAll('.sell-item-opt').forEach(el=>el.classList.toggle('selected',el.dataset.item===itemId));const it=inventory[itemId];const def=ITEMS[itemId];$('orderFormArea').style.display='block';$('ordMaxLabel').textContent=nf.format(it.qty);$('orderQty').value=Math.min(it.qty,1);$('orderQty').max=it.qty;const lowest=marketOrders.filter(o=>o.item_id===itemId).reduce((min,o)=>Math.min(min,parseFloat(o.price_per_unit)),Infinity);const suggested=lowest===Infinity?def.basePrice:lowest;$('orderPrice').value=suggested.toFixed(2);$('orderMarketPrice').textContent=lowest===Infinity?'—':'$'+lowest.toFixed(2);updateOrderTotal();}
function adjustOrderQty(d){const it=inventory[modalSellOrderItem];const inp=$('orderQty');let v=parseInt(inp.value)||0;v=Math.max(1,Math.min(it.qty,v+d));inp.value=v;updateOrderTotal();}
function adjustOrderPrice(d){const inp=$('orderPrice');let v=parseFloat(inp.value)||0;v=Math.max(0.01,v+d);inp.value=v.toFixed(2);updateOrderTotal();}
function updateOrderTotal(){const q=parseInt($('orderQty').value)||0;const p=parseFloat($('orderPrice').value)||0;$('orderTotal').textContent='$'+(q*p).toFixed(2);}
async function submitSellOrder(){if(!modalSellOrderItem)return;if(myOrders.length>=EXCHANGE_CONFIG.MAX_SELL_ORDERS)return toast(currentLang==='id'?'Maksimum order tercapai':'Max orders','bad');const it=inventory[modalSellOrderItem];const qty=parseInt($('orderQty').value)||0;const price=parseFloat($('orderPrice').value)||0;if(qty<1||qty>it.qty)return toast('Invalid qty','bad');if(price<0.01)return toast('Invalid price','bad');$('orderSubmitBtn').disabled=true;$('orderSubmitBtn').textContent='⏳...';const{error}=await sb.from('market_orders').insert({seller_id:user.id,seller_username:profile.company_name||profile.username,seller_avatar:profile.avatar||'🏭',item_id:modalSellOrderItem,qty:qty,price_per_unit:price,status:'open'});if(error){$('orderSubmitBtn').disabled=false;$('orderSubmitBtn').textContent='📢 Post';return toast('❌ '+error.message,'bad');}it.qty-=qty;await syncInventory(modalSellOrderItem);await logTransaction('sell_order',modalSellOrderItem,qty,qty*price);await advanceTutorial(4);closeModal();await loadMarketOrders();render();toast(currentLang==='id'?'📢 Order dipasang!':'📢 Order posted!','good');}

function openBuyModal(orderId){const order=marketOrders.find(o=>o.id===orderId);if(!order)return;const def=ITEMS[order.item_id];const price=parseFloat(order.price_per_unit);const maxQty=order.qty;$('modalContainer').innerHTML=`<div class="modal-backdrop" id="buyBackdrop" onclick="if(event.target.id==='buyBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">${def.emoji} ${t('ex_buy')} ${t(def.nameKey)}</div><div class="modal-info" style="margin-bottom:12px;"><div class="modal-info-row"><span class="k">${currentLang==='id'?'Penjual':'Seller'}</span><span class="v">${order.seller_username}</span></div><div class="modal-info-row"><span class="k">${currentLang==='id'?'Harga':'Price'}</span><span class="v">$${price.toFixed(2)}/unit</span></div></div><div class="modal-field"><label>${t('sell_qty')} (max: ${nf.format(maxQty)})</label><div class="qty-control"><button onclick="adjustBuyQty(-10, ${orderId})">−10</button><input type="number" id="buyQty" value="${maxQty}" min="1" max="${maxQty}" oninput="updateBuyTotal(${orderId}, ${price})"><button onclick="adjustBuyQty(10, ${orderId})">+10</button></div><button class="btn-max" onclick="setBuyQty(${orderId}, ${maxQty}, ${price})">MAX (${nf.format(maxQty)})</button></div><div class="modal-info"><div class="modal-info-row"><span class="k">${currentLang==='id'?'Total bayar':'Total'}</span><span class="v gold" id="buyTotal">$${(maxQty*price).toFixed(2)}</span></div><div class="modal-info-row"><span class="k">${currentLang==='id'?'Kas kamu':'Your cash'}</span><span class="v">${money(profile.cash)}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-green" id="buyConfirmBtn" onclick="confirmBuy(${orderId})">🛒 ${t('ex_buy')}</button></div></div></div>`;}
function adjustBuyQty(d,orderId){const order=marketOrders.find(o=>o.id===orderId);const inp=$('buyQty');let v=parseInt(inp.value)||0;v=Math.max(1,Math.min(order.qty,v+d));inp.value=v;updateBuyTotal(orderId,parseFloat(order.price_per_unit));}
function setBuyQty(orderId,max,price){$('buyQty').value=max;updateBuyTotal(orderId,price);}
function updateBuyTotal(orderId,price){const order=marketOrders.find(o=>o.id===orderId);let v=parseInt($('buyQty').value)||0;v=Math.max(0,Math.min(order.qty,v));$('buyTotal').textContent='$'+(v*price).toFixed(2);}
async function confirmBuy(orderId){const order=marketOrders.find(o=>o.id===orderId);if(!order)return;let qty=parseInt($('buyQty').value)||0;qty=Math.max(1,Math.min(order.qty,qty));$('buyConfirmBtn').disabled=true;$('buyConfirmBtn').textContent='⏳...';const{data,error}=await sb.rpc('buy_market_order',{p_order_id:orderId,p_qty:qty});if(error){$('buyConfirmBtn').disabled=false;$('buyConfirmBtn').textContent='🛒 Buy';return toast('❌ '+error.message,'bad');}const result=data;profile.cash-=result.total;inventory[result.item_id].qty+=result.qty;await logTransaction('buy_order',result.item_id,result.qty,-result.total);await advanceTutorial(5);closeModal();await loadMarketOrders();render();toast('🛒 +'+result.qty+' '+ITEMS[result.item_id].emoji+' (-'+money(result.total)+')','good');}
async function cancelOrder(orderId){const order=myOrders.find(o=>o.id===orderId);if(!order)return;if(!confirm(currentLang==='id'?'Batalkan order ini?':'Cancel this order?'))return;const{error}=await sb.from('market_orders').update({status:'cancelled'}).eq('id',orderId);if(error)return toast('❌ '+error.message,'bad');inventory[order.item_id].qty+=order.qty;await syncInventory(order.item_id);await logTransaction('cancel_order',order.item_id,order.qty,0);await loadMarketOrders();render();toast(currentLang==='id'?'Order dibatalkan':'Cancelled','info');}

/* RESEARCH */
async function startResearch(itemId){const r=research[itemId];if(!r)return;if(r.researching)return toast(t('research_in_progress'),'info');if(r.level>=RESEARCH_CONFIG.MAX_LEVEL)return toast(t('research_max'),'info');const cost=getResearchCost(r.level);if(profile.cash<cost)return toast(t('t_not_enough_money'),'bad');profile.cash-=cost;r.researching=true;r.endsAt=Date.now()+getResearchDuration(r.level);await Promise.all([syncProfile(),syncResearch(itemId)]);await logTransaction('research_start',itemId,0,-cost,'Lv '+(r.level+1));render();const sec=Math.round(getResearchDuration(r.level)/1000);toast('🔬 Research started ('+sec+'s)','info');scheduleResearchFinish(itemId);}
function scheduleResearchFinish(itemId){const r=research[itemId];if(!r||!r.researching)return;const remain=r.endsAt-Date.now();if(remain<=0){finishResearch(itemId);return;}clearTimeout(r._timer);r._timer=setTimeout(()=>finishResearch(itemId),remain);}
async function finishResearch(itemId){const r=research[itemId];if(!r||!r.researching)return;r.researching=false;r.endsAt=0;r.level+=1;await syncResearch(itemId);await logTransaction('research_done',itemId,0,0,'Lv '+r.level);if(currentTab==='storage'&&storageSubTab==='research')render();toast('🎉 '+t(ITEMS[itemId].nameKey)+' → '+starsHtml(r.level),'good');}
function resumeAllResearch(){for(const itemId of Object.keys(research)){const r=research[itemId];if(r.researching&&r.endsAt){if(Date.now()>=r.endsAt)finishResearch(itemId);else scheduleResearchFinish(itemId);}}}

function recoverPrices(){let changed=false;for(const[id,it]of Object.entries(inventory)){const base=ITEMS[id].basePrice;if(it.price<base){it.price=Math.min(base,it.price*CONFIG.PRICE_RECOVER);changed=true;}}if(changed&&currentTab==='exchange')render();}
function resumeAllActions(){for(const bId of Object.keys(BUILDINGS)){const st=buildings[bId];if(st.upgrading&&st.upgradeEndsAt){if(Date.now()>=st.upgradeEndsAt)finishUpgrade(bId);else scheduleUpgradeFinish(bId);}else if(st.producing&&st.endsAt){if(Date.now()>=st.endsAt)finishProduction(bId);else scheduleFinish(bId);}else if(st.auto&&st.level>0&&hasInputs(bId))startProduction(bId);}}

function openEditProfileModal(){const avatars=['🏭','⚡','🚀','🌾','⛏️','💎','🏗️','🔧'];const avatarHtmlStr=avatars.map(e=>`<div class="avatar-opt ${(profile.avatar||'🏭')===e?'selected':''}" data-emoji="${e}" onclick="pickEditAvatar('${e}')">${e}</div>`).join('');const countries=[{code:'id',name:'🇮🇩 Indonesia'},{code:'us',name:'🇺🇸 United States'},{code:'sg',name:'🇸🇬 Singapore'},{code:'my',name:'🇲🇾 Malaysia'},{code:'jp',name:'🇯🇵 Japan'}];const countryHtml=countries.map(c=>`<option value="${c.code}" ${(profile.country_code||'id')===c.code?'selected':''}>${c.name}</option>`).join('');$('modalContainer').innerHTML=`<div class="modal-backdrop" id="editBackdrop" onclick="if(event.target.id==='editBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">✏️ ${t('edit_profile_title')}</div><div class="modal-field"><label>${t('edit_avatar')}</label><div class="avatar-grid">${avatarHtmlStr}</div></div><div class="modal-field"><label>${t('edit_company_name')}</label><input type="text" id="editCompanyName" value="${profile.company_name||''}" maxlength="30" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;"></div><div class="modal-field"><label>${t('edit_country')}</label><select id="editCountry" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;">${countryHtml}</select></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-green" id="editSaveBtn" onclick="saveEditProfile()">${t('edit_save')}</button></div></div></div>`;}
function pickEditAvatar(e){document.querySelectorAll('#modalContainer .avatar-opt').forEach(o=>o.classList.remove('selected'));const el=document.querySelector(`#modalContainer .avatar-opt[data-emoji="${e}"]`);if(el)el.classList.add('selected');}
async function saveEditProfile(){const company=$('editCompanyName').value.trim();const avatarEl=document.querySelector('#modalContainer .avatar-opt.selected');const avatar=avatarEl?avatarEl.dataset.emoji:profile.avatar;const country_code=$('editCountry').value;if(company.length<3)return toast('Min 3','bad');if(company.length>30)return toast('Max 30','bad');$('editSaveBtn').disabled=true;$('editSaveBtn').textContent='⏳...';const{error}=await sb.from('profiles').update({company_name:company,avatar:avatar,country_code:country_code}).eq('id',user.id);if(error){$('editSaveBtn').disabled=false;$('editSaveBtn').textContent=t('edit_save');return toast('❌ '+error.message,'bad');}profile.company_name=company;profile.avatar=avatar;profile.country_code=country_code;closeModal();render();toast(t('t_profile_saved'),'good');}

function setStorageSub(id){storageSubTab=id;if(id==='rank'){leaderboardData=null;render();loadLeaderboard().then(()=>{if(currentTab==='storage'&&storageSubTab==='rank')render();});return;}if(id==='history'){transactions=[];render();loadTransactions().then(()=>{if(currentTab==='storage'&&storageSubTab==='history')render();});return;}if(id==='research'){research={};render();loadResearch().then(()=>{if(currentTab==='storage'&&storageSubTab==='research'){render();resumeAllResearch();}});return;}render();}
function setHistoryFilter(f){historyFilter=f;render();}

function renderStorage(){let html='<div class="sub-nav">';const subs=[{id:'rank',icon:'📊',label:t('storage_rank')},{id:'history',icon:'📜',label:t('storage_history')},{id:'incoming',icon:'📥',label:t('storage_incoming')},{id:'outgoing',icon:'📤',label:t('storage_outgoing')},{id:'buildings',icon:'🏭',label:t('storage_buildings')},{id:'research',icon:'🔬',label:t('storage_research')}];for(const s of subs)html+=`<button class="sub-tab ${storageSubTab===s.id?'active':''}" onclick="setStorageSub('${s.id}')"><span class="sub-icon">${s.icon}</span><span class="sub-label">${s.label}</span></button>`;html+='</div>';if(storageSubTab==='rank')html+=renderRankTab();else if(storageSubTab==='buildings')html+=renderBuildingsListTab();else if(storageSubTab==='history')html+=renderHistoryTab();else if(storageSubTab==='research')html+=renderResearchTab();else html+=renderComingSoon();return html;}
function renderRankTab(){if(leaderboardData===null){loadLeaderboard().then(()=>{if(currentTab==='storage'&&storageSubTab==='rank')render();});return '<div class="ex-empty"><span class="big">⏳</span>'+t('loading_data')+'</div>';}if(leaderboardData.length===0)return '<div class="ex-empty"><span class="big">📊</span>'+t('rank_title')+'</div>';let html='<div class="section-title">'+t('rank_title')+'</div>';let rank=1;for(const p of leaderboardData){const isMe=p.id===user.id;let posHtml='#'+rank,posCls='';if(rank===1){posHtml='🥇';posCls='gold';}else if(rank===2){posHtml='🥈';posCls='gold';}else if(rank===3){posHtml='🥉';posCls='gold';}html+=`<div class="rank-row ${isMe?'me':''}"><div class="rank-pos ${posCls}">${posHtml}</div><div class="rank-avatar">${avatarHtml(p.avatar)}</div><div class="rank-info"><div class="rank-name">${p.company_name||p.username}${isMe?'<span class="rank-you">'+t('rank_you')+'</span>':''}</div><div class="rank-meta">Lv ${p.level||1} · @${p.username}</div></div><div class="rank-value">${money(p.company_value||0)}</div></div>`;rank++;}return html;}
function renderBuildingsListTab(){let html='<div class="section-title">'+t('buildings_list_title')+'</div>';const cats={};for(const[bId,b]of Object.entries(BUILDINGS)){const cat=t(b.categoryKey);if(!cats[cat])cats[cat]=[];cats[cat].push([bId,b]);}for(const[catName,arr]of Object.entries(cats)){html+='<div class="cat-header">'+catName+'</div>';for(const[bId,b]of arr){const st=buildings[bId];const built=st.level>0;html+=`<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px;"><div style="font-size:26px;flex-shrink:0;">${b.emoji}</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;">${t(b.nameKey)}</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${built?'Lv '+st.level:'—'}</div></div>${built?'<div class="lvl-badge">Lv '+st.level+'</div>':'<div class="status locked">'+t('status_not_built')+'</div>'}</div>`;}}return html;}
function renderHistoryTab(){let html='<div class="section-title">'+t('history_title')+'</div>';html+='<div class="ex-filters">';html+=`<div class="ex-chip ${historyFilter==='all'?'active':''}" onclick="setHistoryFilter('all')">${t('history_filter_all')}</div>`;html+=`<div class="ex-chip ${historyFilter==='in'?'active':''}" onclick="setHistoryFilter('in')">⬇️ ${t('history_filter_in')}</div>`;html+=`<div class="ex-chip ${historyFilter==='out'?'active':''}" onclick="setHistoryFilter('out')">⬆️ ${t('history_filter_out')}</div>`;html+='</div>';let filtered=transactions;if(historyFilter==='in')filtered=transactions.filter(tx=>tx.amount>0);else if(historyFilter==='out')filtered=transactions.filter(tx=>tx.amount<0);if(filtered.length===0){html+='<div class="ex-empty"><span class="big">📜</span>'+t('history_empty')+'</div>';return html;}for(const tx of filtered){const def=tx.item_id?ITEMS[tx.item_id]:null;const isIn=tx.amount>0;const isNeutral=tx.amount===0;let color='#5a6472';if(isIn)color='#2e9e4f';else if(!isNeutral)color='#e03e3e';const amountStr=tx.amount===0?'':((tx.amount>0?'+':'')+money(Math.abs(tx.amount)));const icon=isIn?'⬇️':(isNeutral?'🔄':'⬆️');const typeLabel=t('tx_'+tx.type)||tx.type;html+=`<div class="card" style="display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:7px;"><div style="font-size:20px;flex-shrink:0;">${def?def.emoji:icon}</div><div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:800;">${typeLabel}${def?' · '+t(def.nameKey):''}</div><div style="font-size:10.5px;color:var(--text-mute);margin-top:2px;">${tx.qty>0?nf.format(tx.qty)+' unit · ':''}${timeAgo(tx.created_at)}</div></div><div style="font-size:12.5px;font-weight:800;color:${color};font-variant-numeric:tabular-nums;flex-shrink:0;">${amountStr}</div></div>`;}return html;}
function renderResearchTab(){if(Object.keys(research).length===0)return '<div class="ex-empty"><span class="big">⏳</span>'+t('loading_data')+'</div>';let html='<div class="section-title">'+t('research_title')+'</div>';html+='<div style="background:var(--surface-2);padding:12px;border-radius:10px;margin-bottom:12px;font-size:12px;color:var(--text-dim);line-height:1.5;">'+t('research_intro')+'</div>';for(const itemId of RESEARCH_CONFIG.PILOT_ITEMS){const def=ITEMS[itemId];const r=research[itemId];const maxed=r.level>=RESEARCH_CONFIG.MAX_LEVEL;const cost=getResearchCost(r.level);const dur=Math.round(getResearchDuration(r.level)/1000);const canAfford=profile.cash>=cost;let statusText='';let btnHtml='';let progHtml='';if(maxed){statusText='<span class="status auto">'+t('research_max')+'</span>';btnHtml='<button class="btn btn-outline btn-sm" disabled>'+t('research_max')+'</button>';}else if(r.researching){statusText='<span class="status busy">'+t('research_in_progress')+'</span>';btnHtml='<button class="btn btn-purple btn-sm" disabled>⏳ '+t('research_in_progress')+'</button>';progHtml='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar upgrade" data-research-bar="'+itemId+'"></div></div><div class="prog-text" data-research-text="'+itemId+'"></div></div>';}else{statusText='<span class="status idle">'+t('status_ready')+'</span>';const dis=!canAfford?'disabled':'';btnHtml='<button class="btn btn-purple btn-sm" '+dis+' onclick="startResearch(\''+itemId+'\')">'+t('research_start')+' · '+money(cost)+'</button>';}html+='<div class="card building-card"><div class="b-row1"><div class="b-emoji">'+def.emoji+'</div><div class="b-info"><div class="b-name">'+t(def.nameKey)+'</div><div class="b-desc" style="font-size:14px;letter-spacing:2px;margin-top:4px;">'+starsHtml(r.level)+'</div><div class="b-recipe">'+t('research_star_level')+': <b>'+r.level+' / '+RESEARCH_CONFIG.MAX_LEVEL+'</b></div></div><div>'+statusText+'</div></div>'+progHtml+btnHtml+'</div>';}return html;}
function renderComingSoon(){return `<div class="ex-empty"><span class="big">🚧</span><div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px;">${t('coming_soon_title')}</div><div style="font-size:11.5px;">${t('coming_soon_desc')}</div></div>`;}

function openProfile(){currentTab='profile';document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));render();}

function render(){
  if(!profile)return;
  $('hdrLogo').innerHTML=avatarHtml(profile.avatar);
  $('hdrCompany').textContent=profile.company_name;
  $('hdrCash').textContent=money(profile.cash);
  $('hdrLevel').textContent=profile.level;
  const hpa=$('hdrProfileAvatar');
  if(hpa)hpa.innerHTML=avatarHtml(profile.avatar);
  const c=$('gameContent');
  if(currentTab==='buildings')c.innerHTML=renderBuildings();
  else if(currentTab==='storage')c.innerHTML=renderStorage();
  else if(currentTab==='exchange')c.innerHTML=renderExchange();
  else if(currentTab==='profile')c.innerHTML=renderProfile();
  else if(currentTab==='search')c.innerHTML=renderSearch();
  else if(currentTab==='chat')c.innerHTML=renderChat();
  cancelAnimationFrame(progressRaf);
  if(currentTab==='buildings')tickProgress();
  if(currentTab==='storage'&&storageSubTab==='research')tickResearchProgress();
  if(currentTab==='exchange')renderTicker();
}
function renderBuildings(){let html=renderBoostCard();html+=renderEmergencyCard();html+=renderTutorialCard();const cats={};for(const[bId,b]of Object.entries(BUILDINGS)){const cat=t(b.categoryKey);if(!cats[cat])cats[cat]=[];cats[cat].push([bId,b]);}for(const[catName,arr]of Object.entries(cats)){html+='<div class="cat-header">'+catName+'</div>';for(const[bId,b]of arr)html+=renderOneBuilding(bId,b);}return html;}

function renderOneBuilding(bId,b){
  const st=buildings[bId];
  const built=st.level>0;
  const maxed=st.level>=CONFIG.MAX_LEVEL;
  const constructing = st.upgrading && st.level === 0;
  const upgrading = st.upgrading && st.level > 0;
  const bCost=buildCost(bId),uCost=upgradeCost(bId);
  const outQty=built?getOutputQty(bId):b.output.qty;
  const bName=t(b.nameKey),bDesc=t(b.descKey);
  const inputsText=Object.entries(b.inputs).map(([itId])=>{const need=built?getInputQty(bId,itId):b.inputs[itId];const have=inventory[itId].qty,ok=have>=need;return '<span style="color:'+(ok?'#2e9e4f':'#e03e3e')+'">'+need+'× '+ITEMS[itId].emoji+'</span>';}).join(' + ')||'<span style="color:#2e9e4f">Free</span>';
  let statusHtml='';
  if(constructing)statusHtml='<span class="status busy">🏗️ Build</span>';
  else if(!built)statusHtml='<span class="status locked">'+t('status_not_built')+'</span>';
  else if(upgrading)statusHtml='<span class="status upgrading">'+t('status_upgrading')+'</span>';
  else if(st.producing)statusHtml='<span class="status busy">'+t('status_producing')+'</span>';
  else if(st.auto&&!hasInputs(bId))statusHtml='<span class="status busy">'+t('status_low_input')+'</span>';
  else if(st.auto)statusHtml='<span class="status auto">'+t('status_auto')+'</span>';
  else statusHtml='<span class="status idle">'+t('status_ready')+'</span>';
  let btnHtml='';
  if(constructing){
    btnHtml='<button class="btn btn-outline" disabled>🏗️ '+t('status_upgrading')+'...</button>';
  } else if(!built){
    const dis=profile.cash<bCost?'disabled':'';
    btnHtml='<button class="btn btn-primary" '+dis+' onclick="build(\''+bId+'\')">'+t('btn_build')+' · '+money(bCost)+'</button>';
  } else {
    const canUp=!maxed&&!st.upgrading&&!st.producing&&profile.cash>=uCost;
    const canProd=hasInputs(bId)&&!st.producing&&!st.upgrading;
    const btnUpTxt=upgrading?t('btn_upgrading'):(maxed?t('btn_max'):'⬆️ Lv '+st.level+'→'+(st.level+1)+' · '+money(uCost));
    const btnUp='<button class="btn btn-purple btn-sm" '+(canUp?'':'disabled')+' onclick="upgrade(\''+bId+'\')">'+btnUpTxt+'</button>';
    const btnProd='<button class="btn btn-green btn-sm" '+(canProd?'':'disabled')+' onclick="startProduction(\''+bId+'\')">'+(st.producing?t('btn_producing'):t('btn_produce'))+'</button>';
    btnHtml='<div class="btn-row">'+btnUp+btnProd+'</div><div style="margin-top:8px;display:flex;justify-content:flex-end;"><button class="toggle '+(st.auto?'on':'')+'" onclick="toggleAuto(\''+bId+'\')"><div class="toggle-dot"></div>'+t('btn_auto')+'</button></div>';
  }
  let progHtml='';
  if(constructing||upgrading){
    progHtml='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar upgrade" data-upbar="'+bId+'"></div></div><div class="prog-text" data-uptext="'+bId+'"></div></div>';
  } else if(st.producing){
    progHtml='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar" data-bar="'+bId+'"></div></div><div class="prog-text" data-text="'+bId+'"></div></div>';
  }
  return '<div class="card building-card"><div class="b-row1"><div class="b-emoji">'+b.emoji+'</div><div class="b-info"><div class="b-name">'+bName+' '+(built?'<span class="lvl-badge">Lv '+st.level+'</span>':'')+'</div><div class="b-desc">'+bDesc+'</div><div class="b-recipe">'+inputsText+' → <b>'+outQty+'× '+ITEMS[b.output.item].emoji+'</b></div></div><div>'+statusHtml+'</div></div>'+progHtml+btnHtml+'</div>';
}

function renderExchange(){let html='<div class="ex-sell-bar"><button class="ex-sell-btn" onclick="openCreateOrderModal()">📢 '+t('ex_create_order')+'</button></div>';html+='<div class="ex-filters">';html+=`<div class="ex-chip ${marketFilter==='all'?'active':''}" onclick="setFilter('all')">${t('ex_all')}</div>`;for(const itemId of Object.keys(ITEMS)){const def=ITEMS[itemId];html+=`<div class="ex-chip ${marketFilter===itemId?'active':''}" onclick="setFilter('${itemId}')">${def.emoji} ${t(def.nameKey)}</div>`;}html+='</div>';if(myOrders.length>0){const filtered=marketFilter==='all'?myOrders:myOrders.filter(o=>o.item_id===marketFilter);if(filtered.length>0){html+=`<div class="ex-section"><div class="ex-section-header"><div class="ex-section-title">${t('ex_my_orders')}</div><div class="ex-section-count">${filtered.length}/${EXCHANGE_CONFIG.MAX_SELL_ORDERS}</div></div>`;for(const o of filtered)html+=renderOrderRow(o,true);html+='</div>';}}const filteredMarket=marketFilter==='all'?marketOrders:marketOrders.filter(o=>o.item_id===marketFilter);html+=`<div class="ex-section"><div class="ex-section-header"><div class="ex-section-title">${t('ex_global_market')}</div><div class="ex-section-count">${filteredMarket.length} ${t('ex_orders')}</div></div>`;if(filteredMarket.length===0)html+=`<div class="ex-empty"><span class="big">💱</span>${t('ex_empty')}</div>`;else for(const o of filteredMarket)html+=renderOrderRow(o,false);html+='</div>';return html;}
function setFilter(f){marketFilter=f;render();}
function renderOrderRow(o,isMine){const def=ITEMS[o.item_id];if(!def)return '';const name=t(def.nameKey);const price=parseFloat(o.price_per_unit);const total=o.qty*price;const avatar=o.seller_avatar||'🏭';const time=timeAgo(o.created_at);if(isMine)return `<div class="ex-order mine"><div class="ex-order-avatar">${avatarHtml(avatar)}</div><div class="ex-order-info"><div class="ex-order-seller">${t('ex_you')} · ${time}</div><div class="ex-order-item">${def.emoji} ${name}</div><div class="ex-order-meta">${nf.format(o.qty)} × $${price.toFixed(2)} = $${total.toFixed(2)}</div></div><button class="ex-buy-btn" style="background:#e03e3e;" onclick="cancelOrder(${o.id})">✕</button></div>`;return `<div class="ex-order"><div class="ex-order-avatar">${avatarHtml(avatar)}</div><div class="ex-order-info"><div class="ex-order-seller">${o.seller_username}</div><div class="ex-order-item">${def.emoji} ${name}</div><div class="ex-order-meta">${nf.format(o.qty)} × $${price.toFixed(2)} · ${time}</div></div><div class="ex-order-price"><div class="p">$${price.toFixed(2)}</div><div class="q">/unit</div></div><button class="ex-buy-btn" onclick="openBuyModal(${o.id})">${t('ex_buy')}</button></div>`;}

function renderProfile(){
  const rating=getRating();
  const value=getCompanyValue();
  const desc=profile.company_description||'';
  const country=profile.country||'Indonesia';
  const established=fmtDate(profile.created_at);
  const lastSeen=timeAgo(profile.last_seen);
  const localTime=fmtTime();
  const builtCount=Object.values(buildings).filter(b=>b.level>0).length;

  const guestBanner = isGuest ? `
    <div class="card" style="border:1px solid rgba(230,149,0,0.4);background:linear-gradient(180deg,#fff5d9,#fff);padding:12px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:22px;">⚠️</div>
        <div style="flex:1;">
          <div style="font-size:12.5px;font-weight:800;color:#8a6000;">${t('guest_banner')}</div>
        </div>
        <button class="btn btn-gold btn-sm" style="width:auto;padding:8px 12px;" onclick="openSaveModal()">${t('guest_banner_btn')}</button>
      </div>
    </div>
  ` : '';

  return guestBanner
    +`<div class="profile-hero"><div class="profile-hero-top"><div class="profile-logo">${avatarHtml(profile.avatar)}</div><div class="profile-hero-info"><div class="profile-status"><span class="dot"></span>${t('p_online')}</div><div class="profile-company-name">${profile.company_name}</div><div class="profile-company-type">${t('p_pt')} · @${profile.username}</div></div></div><div class="profile-actions"><button class="profile-btn" onclick="copyCompanyId()">${t('p_copy_id')}</button><button class="profile-btn" onclick="openEditProfileModal()">${t('p_edit_profile')}</button></div></div><div class="card"><div class="card-section-header">${t('p_rankings')}</div><div class="ranking-box"><div class="ranking-item"><div class="ranking-label">${t('p_company_value')}</div><div class="ranking-value gold">${money(value)}</div></div><div class="ranking-item"><div class="ranking-label">${t('p_eva')}</div><div class="ranking-value">${nf.format(profile.xp)}</div></div></div></div><div class="card"><div class="card-section-header">${t('p_info')}</div><div class="p-compact-list"><div class="info-row"><span class="info-key">${t('p_rating')}</span><span class="info-val"><span class="rating-badge ${rating.cls}">${rating.text}</span></span></div><div class="info-row"><span class="info-key">${t('p_level')}</span><span class="info-val">${profile.level}</span></div><div class="info-row"><span class="info-key">${t('p_xp')}</span><span class="info-val">${nf.format(profile.xp)}</span></div><div class="info-row"><span class="info-key">${t('p_buildings')}</span><span class="info-val">${builtCount} ${t('p_units')}</span></div><div class="info-row"><span class="info-key">${t('p_country')}</span><span class="info-val">🇮🇩 ${country}</span></div><div class="info-row"><span class="info-key">${t('p_established')}</span><span class="info-val">${established}</span></div><div class="info-row"><span class="info-key">${t('p_last_seen')}</span><span class="info-val">${lastSeen}</span></div><div class="info-row"><span class="info-key">${t('p_local_time')}</span><span class="info-val">${localTime}</span></div></div></div><div class="card"><div class="card-section-header">${t('p_description')}</div><textarea class="description-textarea" id="descInput" placeholder="${t('p_description_ph')}" maxlength="200">${desc}</textarea><button class="btn btn-green btn-sm" style="margin-top:10px;" onclick="saveDescription()">${t('btn_save_desc')}</button></div><div class="card"><div class="card-section-header">${t('p_account')}</div><div class="account-menu"><div class="account-item" onclick="showLangPicker()"><div class="account-icon">🌐</div><div class="account-label">${t('p_language')}</div><div class="account-arrow" style="font-weight:700;color:var(--text-dim);font-size:12px;">${currentLang==='id'?'🇮🇩 ID':'🇬🇧 EN'}</div></div>${isGuest?'':`<div class="account-item" onclick="changePassword()"><div class="account-icon">🔑</div><div class="account-label">${t('p_change_password')}</div><div class="account-arrow">›</div></div>`}<div class="account-item" onclick="doLogout()"><div class="account-icon">🚪</div><div class="account-label">${isGuest?(currentLang==='id'?'Keluar dari Tamu':'Log out Guest'):t('p_logout')}</div><div class="account-arrow">›</div></div>${isGuest?'':`<div class="account-item" onclick="deleteAccount()"><div class="account-icon" style="background:#fdeaea;border-color:#f5b8b8;">🗑️</div><div class="account-label danger">${t('p_delete')}</div><div class="account-arrow">›</div></div>`}</div></div><div style="text-align:center;font-size:10px;color:var(--text-mute);padding:14px 0 8px;">Catalyst · v13 · Guest Mode ${isGuest?'🆕':''}</div>`;
}
async function saveDescription(){const ta=document.getElementById('descInput');if(!ta)return;const desc=ta.value.trim();if(desc.length>200)return toast('Max 200','bad');const{error}=await sb.from('profiles').update({company_description:desc}).eq('id',user.id);if(error)return toast('❌','bad');profile.company_description=desc;toast(t('t_desc_saved'),'good');}
function copyCompanyId(){const text=profile.username+' (ID: '+user.id.slice(0,8)+')';if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>toast(t('t_copied'),'good')).catch(()=>prompt('Copy:',text));else prompt('Copy:',text);}
async function changePassword(){const np=prompt(t('p_change_password')+' (min 6):');if(!np)return;if(np.length<6)return toast('Min 6','bad');const{error}=await sb.auth.updateUser({password:np});if(error)return toast('❌ '+error.message,'bad');toast(t('t_password_changed'),'good');}
async function deleteAccount(){if(!confirm('⚠️ Delete account?'))return;if(!confirm('Sure?'))return;try{await sb.from('profiles').delete().eq('id',user.id);await sb.from('inventory').delete().eq('user_id',user.id);await sb.from('buildings').delete().eq('user_id',user.id);await sb.from('research').delete().eq('user_id',user.id);await sb.from('market_orders').update({status:'cancelled'}).eq('seller_id',user.id);await sb.auth.signOut();user=null;profile=null;buildings={};inventory={};marketOrders=[];myOrders=[];leaderboardData=null;transactions=[];research={};$('loginForm').reset();$('registerForm').reset();showScreen('auth');switchTab('login');}catch(e){toast('❌ '+e.message,'bad');}}
function showLangPicker(){$('modalContainer').innerHTML=`<div class="modal-backdrop" id="langBackdrop" onclick="if(event.target.id==='langBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">🌐 ${t('p_language')}</div><div class="account-item" onclick="pickLang('id')" style="${currentLang==='id'?'background:var(--surface-2);':''}"><div class="account-icon" style="font-size:20px;">🇮🇩</div><div class="account-label" style="font-size:15px;">Bahasa Indonesia</div>${currentLang==='id'?'<div style="color:#2e9e4f;font-weight:800;">✓</div>':''}</div><div class="account-item" onclick="pickLang('en')" style="${currentLang==='en'?'background:var(--surface-2);':''}"><div class="account-icon" style="font-size:20px;">🇬🇧</div><div class="account-label" style="font-size:15px;">English</div>${currentLang==='en'?'<div style="color:#2e9e4f;font-weight:800;">✓</div>':''}</div><button class="btn btn-outline" style="margin-top:12px;" onclick="closeModal()">${t('sell_cancel')}</button></div></div>`;}
function pickLang(lang){setLang(lang);closeModal();toast(lang==='id'?'🇮🇩 Bahasa Indonesia':'🇬🇧 English','good');}

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
      if(txt){const label = st.level === 0 ? (currentLang==='id'?'Bangun: ':'Building: ') : (currentLang==='id'?'Upgrade: ':'Upgrading: ');txt.textContent=label+(remain/1000).toFixed(1)+'s';}
      if(remain<=0)finishUpgrade(bId);
    }
    if(st.producing&&st.endsAt){
      active=true;
      const dur=getProductionDuration(bId);
      const remain=Math.max(0,st.endsAt-Date.now());
      const pct=Math.min(100,100-(remain/dur*100));
      const bar=document.querySelector('[data-bar="'+bId+'"]');
      const txt=document.querySelector('[data-text="'+bId+'"]');
      if(bar)bar.style.width=pct+'%';
      if(txt)txt.textContent=(currentLang==='id'?'Produksi: ':'Producing: ')+(remain/1000).toFixed(1)+'s';
      if(remain<=0)finishProduction(bId);
    }
  }
  if(active)progressRaf=requestAnimationFrame(tickProgress);
}
function tickResearchProgress(){let active=false;for(const itemId of Object.keys(research)){const r=research[itemId];if(!r.researching||!r.endsAt)continue;active=true;const total=getResearchDuration(r.level);const remain=Math.max(0,r.endsAt-Date.now());const pct=Math.min(100,100-(remain/total*100));const bar=document.querySelector('[data-research-bar="'+itemId+'"]');const txt=document.querySelector('[data-research-text="'+itemId+'"]');if(bar)bar.style.width=pct+'%';if(txt)txt.textContent=t('research_remains')+': '+(remain/1000).toFixed(1)+'s';if(remain<=0)finishResearch(itemId);}if(active)researchRaf=requestAnimationFrame(tickResearchProgress);}

document.querySelectorAll('.tab').forEach(tabEl=>{
  tabEl.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    tabEl.classList.add('active');
    currentTab=tabEl.dataset.tab;
    if(currentTab==='storage'&&leaderboardData===null){
      loadLeaderboard().then(()=>{if(currentTab==='storage'&&storageSubTab==='rank')render();});
    }
    render();
  });
});

/* ============================================================
   INIT — AUTO ANONYMOUS SIGN-IN untuk pemain baru
   ============================================================ */
(async()=>{
  document.documentElement.lang=currentLang;
  updateStaticUI();
  showLoading('Loading...');

  const{data}=await sb.auth.getSession();
  if(data.session){
    user=data.session.user;
    isGuest = !!(user && user.is_anonymous);
    await enterGame();
  } else {
    // Belum ada session → coba anonymous sign-in
    try {
      const {data: anonData, error} = await sb.auth.signInAnonymously();
      if(error){
        console.warn('Anonymous sign-in gagal:', error.message);
        hideLoading();
        showScreen('auth');
        toast('Anonymous sign-in tidak aktif. Login manual.', 'info');
        return;
      }
      user = anonData.user;
      isGuest = true;
      await ensureGuestProfile();
      await enterGame();
    } catch(e){
      console.warn('Auto guest gagal:', e);
      hideLoading();
      showScreen('auth');
    }
  }
  setInterval(recoverPrices,12000);
})();

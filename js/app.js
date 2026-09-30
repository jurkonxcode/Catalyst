const sb=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let user=null,profile=null;
let buildings={},inventory={};
let marketOrders=[],myOrders=[];
let leaderboardData=null;
let transactions=[];
let research={};
let tickerPrices={};
let currentTab='buildings';
let storageSubTab='rank';
let historyFilter='all';
let progressRaf=null,researchRaf=null,boostRaf=null;
let modalItemId=null,modalSellOrderItem=null;
let marketFilter='all';
let realtimeChannel=null;
let isGuest=false;

const $=id=>document.getElementById(id);
const nf=new Intl.NumberFormat('en-US');
const money=n=>'$'+nf.format(Math.floor(n));

function showScreen(n){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('screen-'+n).classList.add('active');window.scrollTo(0,0);}
function toast(m,t='info'){const e=$('toast');e.textContent=m;e.className='show '+t;clearTimeout(e._t);e._t=setTimeout(()=>e.className='',2500);}
function showMsg(id,m,t){const e=$(id);e.textContent=m;e.className='msg show '+t;clearTimeout(e._t);e._t=setTimeout(()=>e.className='msg',5000);}
function hideMsg(id){$(id).className='msg';}
function showLoading(t='Loading...'){$('loadingText').textContent=t;$('loading').classList.remove('hidden');}
function hideLoading(){$('loading').classList.add('hidden');}

const NAME_PREFIXES=['Alpha','Beta','Prime','Swift','Nova','Apex','Zenith','Vertex','Orbit','Pulse','Vortex','Delta','Sigma','Omega','Titan','Fusion','Crystal','Stellar','Nexus','Quantum','Echo','Rapid','Bright','Core'];
const NAME_SUFFIXES=['Industries','Corp','Trading','Holdings','Group','Enterprises','Solutions','Logistics','Manufacturing','Ventures','Dynamics','Systems'];
const NAME_EXTRA=['Co','Ltd','Inc','LLC','Global','International','Nusantara','Mandiri'];
function generateRandomCompanyName(){const p=NAME_PREFIXES[Math.floor(Math.random()*NAME_PREFIXES.length)];const s=NAME_SUFFIXES[Math.floor(Math.random()*NAME_SUFFIXES.length)];if(Math.random()<0.5){const e=NAME_EXTRA[Math.floor(Math.random()*NAME_EXTRA.length)];return `${p} ${s} ${e}`;}return `${p} ${s}`;}
function generateRandomAvatar(){const a=['🏭','⚡','🚀','🌾','⛏️','💎','🏗️','🔧'];return a[Math.floor(Math.random()*a.length)];}
function generatePixelAvatar(){const size=8;const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');ctx.fillStyle='#1a1c20';ctx.fillRect(0,0,size,size);const palette=['#4ade80','#60a5fa','#a78bfa','#fbbf24','#f87171','#22d3ee','#f472b6','#34d399','#fb923c','#38bdf8','#a3e635','#facc15','#c084fc','#2dd4bf','#fde047'];const color=palette[Math.floor(Math.random()*palette.length)];ctx.fillStyle=color;const half=Math.ceil(size/2);for(let x=0;x<half;x++){for(let y=0;y<size;y++){if(Math.random()>0.55){ctx.fillRect(x,y,1,1);ctx.fillRect(size-1-x,y,1,1);}}}return canvas.toDataURL('image/png');}
function isPixelAvatar(a){return typeof a==='string'&&a.indexOf('data:image')===0;}
function avatarHtml(a){if(!a)a='🏭';if(isPixelAvatar(a)){return `<img src="${a}" alt="">`;}return a;}

function isBeginnerBoostActive(){if(!profile||!profile.created_at)return false;const c=new Date(profile.created_at).getTime();return Date.now()<c+BEGINNER_BOOST_HOURS*3600*1000;}
function getBoostRemaining(){if(!isBeginnerBoostActive())return 0;const c=new Date(profile.created_at).getTime();return (c+BEGINNER_BOOST_HOURS*3600*1000)-Date.now();}
function getBoostMult(){return isBeginnerBoostActive()?BEGINNER_BOOST_MULT:1;}
function formatBoostTime(ms){const t=Math.floor(ms/1000);const h=Math.floor(t/3600);const m=Math.floor((t%3600)/60);const s=t%60;return `${h}j ${m}m ${s}s`;}

function getRating(){const l=profile.level;if(l>=15)return{text:'AAA',cls:'top'};if(l>=12)return{text:'AA',cls:'top'};if(l>=9)return{text:'A',cls:'high'};if(l>=7)return{text:'BBB',cls:'high'};if(l>=5)return{text:'BB',cls:''};if(l>=3)return{text:'B',cls:''};return{text:'C',cls:''};}
function getCompanyValue(){let v=profile.cash;for(const[bId,b]of Object.entries(buildings)){if(b.level>0)v+=BUILDINGS[bId].baseCost*b.level*0.7;}for(const[itId,it]of Object.entries(inventory))v+=it.qty*it.price;return Math.floor(v);}
function fmtDate(ts){if(!ts)return '-';return new Date(ts).toLocaleDateString(currentLang==='id'?'id-ID':'en-US',{day:'numeric',month:'numeric',year:'numeric'});}
function fmtTime(){return new Date().toLocaleTimeString(currentLang==='id'?'id-ID':'en-US',{hour:'2-digit',minute:'2-digit'});}
function timeAgo(ts){if(!ts)return currentLang==='id'?'Baru saja':'Just now';const d=Date.now()-new Date(ts).getTime();const m=Math.floor(d/60000);if(m<1)return currentLang==='id'?'Baru saja':'Just now';if(m<60)return m+(currentLang==='id'?' menit lalu':' min ago');const h=Math.floor(m/60);if(h<24)return h+(currentLang==='id'?' jam lalu':' h ago');return Math.floor(h/24)+(currentLang==='id'?' hari lalu':' d ago');}
function starsHtml(l){let s='';for(let i=0;i<RESEARCH_CONFIG.MAX_LEVEL;i++){s+=i<l?'⭐':'☆';}return s;}

function updateStaticUI(){
  document.title='Catalyst';
  const a=$('screen-auth');
  if(a){a.querySelector('.auth-sub').textContent=t('tagline');$('tabLogin').textContent=t('login');$('tabRegister').textContent=t('register');
    const lf=$('loginForm');lf.querySelector('label').textContent=t('email');$('loginEmail').placeholder=t('ph_email');lf.querySelectorAll('label')[1].textContent=t('password');$('loginPassword').placeholder=t('ph_password');$('loginBtn').textContent=t('btn_login');
    const rf=$('registerForm');const rL=rf.querySelectorAll('label');rL[0].textContent=t('email');$('regEmail').placeholder=t('ph_email');rL[1].textContent=t('password');$('regPassword').placeholder=t('ph_password_new');rL[2].textContent=t('username');$('regUsername').placeholder=t('ph_username');$('registerBtn').textContent=t('btn_register');}
  const tabMap={buildings:'Map',storage:'Warehouse',exchange:'Exchange',search:'Search',chat:'Chat'};
  document.querySelectorAll('.tab').forEach(el=>{const k=tabMap[el.dataset.tab];if(k)el.querySelector('.tab-label').textContent=k;});
}

async function logTransaction(type,itemId,qty,amount,note){try{await sb.from('transactions').insert({user_id:user.id,type,item_id:itemId||null,qty:qty||0,amount:amount||0,note:note||null});transactions.unshift({type,item_id:itemId,qty:qty||0,amount:amount||0,note:note||null,created_at:new Date().toISOString()});if(transactions.length>100)transactions.pop();}catch(e){console.warn(e);}}
async function loadTransactions(){try{const{data,error}=await sb.from('transactions').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(error){transactions=[];return;}transactions=data||[];}catch(e){transactions=[];}}
async function loadResearch(){try{const{data,error}=await sb.from('research').select('*').eq('user_id',user.id);research={};for(const i of RESEARCH_CONFIG.PILOT_ITEMS)research[i]={level:0,researching:false,endsAt:0};if(error)return;for(const r of (data||[])){if(research[r.item_id])research[r.item_id]={level:r.level||0,researching:r.researching||false,endsAt:r.research_ends_at?new Date(r.research_ends_at).getTime():0};}}catch(e){}}
async function syncResearch(itemId){const r=research[itemId];await sb.from('research').upsert({user_id:user.id,item_id:itemId,level:r.level,researching:r.researching,research_ends_at:r.endsAt?new Date(r.endsAt).toISOString():null},{onConflict:'user_id,item_id'});}

function switchTab(tab){$('tabLogin').classList.toggle('active',tab==='login');$('tabRegister').classList.toggle('active',tab==='register');$('loginForm').style.display=tab==='login'?'block':'none';$('registerForm').style.display=tab==='register'?'block':'none';hideMsg('authMsg');}
async function doLogin(e){e.preventDefault();hideMsg('authMsg');const email=$('loginEmail').value.trim(),pw=$('loginPassword').value;$('loginBtn').disabled=true;$('loginBtn').textContent=t('msg_logging');showLoading(t('msg_logging'));const{data,error}=await sb.auth.signInWithPassword({email,password:pw});if(error){hideLoading();$('loginBtn').disabled=false;$('loginBtn').textContent=t('btn_login');return showMsg('authMsg','❌ '+error.message,'error');}user=data.user;isGuest=false;await enterGame();}
async function doRegister(e){e.preventDefault();hideMsg('authMsg');const email=$('regEmail').value.trim(),pw=$('regPassword').value,un=$('regUsername').value.trim();if(pw.length<6)return showMsg('authMsg','Password min 6','error');if(!/^[a-zA-Z0-9_]{3,20}$/.test(un))return showMsg('authMsg','Username: 3-20 a-z/0-9/_','error');$('registerBtn').disabled=true;$('registerBtn').textContent=t('msg_registering');showLoading(t('msg_registering'));const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:{username:un}}});if(error){hideLoading();$('registerBtn').disabled=false;$('registerBtn').textContent=t('btn_register');return showMsg('authMsg','❌ '+error.message,'error');}user=data.user;isGuest=false;await enterGame();}
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

async function ensureStarterPack(){
  if(!isGuest)return;
  const bc=Object.values(buildings).filter(b=>b.level>0).length;
  if(bc>0)return;
  buildings.farm.level=1;
  await syncBuilding('farm');
  inventory.seeds.qty+=5;
  inventory.water.qty+=15;
  await Promise.all([syncInventory('seeds'),syncInventory('water')]);
  await logTransaction('build','farm',0,0,'Starter gift');
  setTimeout(()=>toast('🎁 Farm gratis + starter pack!','good'),800);
}

async function enterGame(){
  showLoading('Loading...');
  const{data:prof,error:pErr}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(pErr){hideLoading();return showMsg('authMsg','❌ '+pErr.message,'error');}
  profile=prof;
  if(profile.tutorial_step===undefined)profile.tutorial_step=0;
  if(profile.tutorial_dismissed===undefined)profile.tutorial_dismissed=false;
  if(profile.level_rewards_claimed===undefined)profile.level_rewards_claimed='';
  if(profile.last_emergency_grant===undefined)profile.last_emergency_grant=null;
  if(!profile.company_name||profile.company_name==='PT Baru'){
    const name=generateRandomCompanyName();const avatar=generatePixelAvatar();
    await sb.from('profiles').update({company_name:name,avatar:avatar}).eq('id',user.id);
    profile.company_name=name;profile.avatar=avatar;
  }
  try{await sb.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);}catch(e){}
  profile.last_seen=new Date().toISOString();
  isGuest=!!(user&&user.is_anonymous);
  await loadGameData();
  await ensureStarterPack();
  await loadMarketOrders();await loadTransactions();await loadResearch();
  await loadLeaderboard();
  subscribeRealtime();
  hideLoading();showScreen('game');render();resumeAllActions();resumeAllResearch();startBoostTimer();
}

async function loadGameData(){
  const{data:bData}=await sb.from('buildings').select('*').eq('user_id',user.id);
  buildings={};
  for(const bId of Object.keys(BUILDINGS))buildings[bId]={level:0,producing:false,endsAt:0,auto:false,upgrading:false,upgradeEndsAt:0,prodQty:0,wageCost:0,workersCount:0};
  if(bData){for(const row of bData){if(buildings[row.building_id]){buildings[row.building_id]={level:row.level||0,producing:row.producing||false,endsAt:row.ends_at?new Date(row.ends_at).getTime():0,auto:row.auto||false,upgrading:row.upgrading||false,upgradeEndsAt:row.upgrade_ends_at?new Date(row.upgrade_ends_at).getTime():0,prodQty:row.prod_qty||0,wageCost:0,workersCount:row.workers_count||0};}}}
  const{data:iData}=await sb.from('inventory').select('*').eq('user_id',user.id);
  inventory={};
  for(const iId of Object.keys(ITEMS))inventory[iId]={qty:0,price:ITEMS[iId].basePrice};
  if(iData){for(const row of iData){if(inventory[row.item_id])inventory[row.item_id].qty=row.qty;}}
}
async function loadMarketOrders(){const{data,error}=await sb.from('market_orders').select('*').eq('status','open').order('price_per_unit',{ascending:false}).order('created_at',{ascending:true});if(error)return;const all=data||[];marketOrders=all.filter(o=>o.seller_id!==user.id);myOrders=all.filter(o=>o.seller_id===user.id);updateTickerFromMarket();}
async function loadLeaderboard(){const{data,error}=await sb.from('profiles').select('id, username, company_name, avatar, level, xp, company_value').order('company_value',{ascending:false}).limit(50);if(error){leaderboardData=[];return;}leaderboardData=data||[];}
function updateTickerFromMarket(){const lowest={};for(const o of marketOrders){if(!lowest[o.item_id]||o.price_per_unit<lowest[o.item_id])lowest[o.item_id]=parseFloat(o.price_per_unit);}for(const i of Object.keys(ITEMS)){const np=lowest[i]||null;const prev=tickerPrices[i]?tickerPrices[i].price:null;tickerPrices[i]={price:np,prevPrice:prev};}renderTicker();}
function renderTicker(){const bar=$('tickerBar');if(!bar)return;let html='',has=false;for(const itemId of EXCHANGE_CONFIG.TICKER_ITEMS){const def=ITEMS[itemId];if(!def)continue;const tp=tickerPrices[itemId]||{};const price=tp.price,prev=tp.prevPrice;let c='flat',a='—',p='';if(price!=null&&prev!=null&&prev>0){const d=((price-prev)/prev)*100;if(d>0.5){c='up';a='↑';p=d.toFixed(1)+'%';}else if(d<-0.5){c='down';a='↓';p=Math.abs(d).toFixed(1)+'%';}}const pt=price!=null?'$'+price.toFixed(2):'—';html+=`<div class="ticker-item" onclick="jumpToExchange('${itemId}')"><span class="t-emoji">${def.emoji}</span><span class="t-price">${pt}</span><span class="t-change ${c}">${a}${p?' '+p:''}</span></div>`;if(price!=null)has=true;}if(!has&&marketOrders.length===0)bar.innerHTML='<div class="ticker-loading">'+t('ex_empty')+'</div>';else bar.innerHTML=html;}
function jumpToExchange(itemId){marketFilter=itemId;currentTab='exchange';document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));const el=document.querySelector('.tab[data-tab="exchange"]');if(el)el.classList.add('active');render();}
function subscribeRealtime(){if(realtimeChannel)sb.removeChannel(realtimeChannel);realtimeChannel=sb.channel('jc-market').on('postgres_changes',{event:'*',schema:'public',table:'market_orders'},async()=>{await loadMarketOrders();if(currentTab==='exchange')render();}).subscribe();}

async function syncProfile(){const cv=getCompanyValue();profile.company_value=cv;await sb.from('profiles').update({cash:profile.cash,xp:profile.xp,level:profile.level,company_value:cv}).eq('id',user.id);if(profile.cash>=5000)advanceTutorial(6);}
async function syncBuilding(bId){const b=buildings[bId];await sb.from('buildings').upsert({user_id:user.id,building_id:bId,level:b.level,auto:b.auto,producing:b.producing,ends_at:b.endsAt?new Date(b.endsAt).toISOString():null,upgrading:b.upgrading,upgrade_ends_at:b.upgradeEndsAt?new Date(b.upgradeEndsAt).toISOString():null,prod_qty:b.prodQty||0,workers_count:b.workersCount||0},{onConflict:'user_id,building_id'});}
async function syncInventory(itemId){await sb.from('inventory').upsert({user_id:user.id,item_id:itemId,qty:inventory[itemId].qty},{onConflict:'user_id,item_id'});}

function buildCost(bId){return BUILDINGS[bId].baseCost;}
function upgradeCost(bId){return Math.floor(BUILDINGS[bId].baseCost*Math.pow(1.5,buildings[bId].level));}
function getUpgradeDurationMs(bId){const base=BUILDINGS[bId].upgradeTime*1000;const lvl=buildings[bId].level;const raw=lvl===0?base:Math.floor(base*(1+lvl*0.5));return Math.floor(raw/getBoostMult());}
function getBaseTimePerUnit(bId){const b=BUILDINGS[bId];const lvl=buildings[bId].level||1;const rawBase=b.duration/b.output.qty;const speedMult=1+(lvl-1)*0.15;return rawBase/speedMult;}
function getQtyPerUnitInput(bId,itemId){const b=BUILDINGS[bId];return b.inputs[itemId]/b.output.qty;}
function getMaxQtyByResources(bId){const b=BUILDINGS[bId];let maxQty=Infinity;for(const itemId of Object.keys(b.inputs)){const perUnit=getQtyPerUnitInput(bId,itemId);if(perUnit<=0)continue;const avail=Math.floor(inventory[itemId].qty/perUnit);maxQty=Math.min(maxQty,avail);}return maxQty===Infinity?0:maxQty;}
function getOutputQty(bId){const l=buildings[bId].level;return l?Math.floor(BUILDINGS[bId].output.qty*(1+(l-1)*0.5)):0;}
function hasInputs(bId){for(const it of Object.keys(BUILDINGS[bId].inputs)){if(inventory[it].qty<=0)return false;}return true;}
function formatDuration(sec){if(sec<60)return sec+'s';if(sec<3600)return Math.floor(sec/60)+'m '+((sec%60)?(sec%60)+'s':'');return Math.floor(sec/3600)+'j '+Math.floor((sec%3600)/60)+'m';}
function getWorkersCount(bId){const st=buildings[bId];const b=BUILDINGS[bId];if(!st.level)return 0;return b.workers*st.level;}
function getWagePerHour(bId){const b=BUILDINGS[bId];return b.wage;}
function getWageCostForDuration(bId,durationMs){const workers=getWorkersCount(bId);const wage=getWagePerHour(bId);const hours=durationMs/3600000;return Math.ceil(workers*wage*hours);}

function addXP(n){profile.xp+=n;const nl=1+Math.floor(profile.xp/1500);if(nl>profile.level){profile.level=nl;toast('🎉 Lv '+nl+'!','good');checkLevelRewards();}}
async function checkLevelRewards(){const claimed=(profile.level_rewards_claimed||'').split(',').filter(x=>x);for(const[lvlStr,reward]of Object.entries(LEVEL_REWARDS)){const lvl=parseInt(lvlStr);if(profile.level>=lvl&&!claimed.includes(lvlStr)){profile.cash+=reward;claimed.push(lvlStr);profile.level_rewards_claimed=claimed.join(',');await syncProfile();setTimeout(()=>{toast('🎁 '+t('levelup_reward')+' Lv '+lvl+': +'+money(reward),'good');},600);}}}

function canClaimEmergencyGrant(){if(!profile)return false;if(profile.cash>=100)return false;if(!profile.last_emergency_grant)return true;const l=new Date(profile.last_emergency_grant).getTime();return (Date.now()-l)>24*3600*1000;}
function getEmergencyCooldownRemaining(){if(!profile||!profile.last_emergency_grant)return 0;const l=new Date(profile.last_emergency_grant).getTime();const r=24*3600*1000-(Date.now()-l);return r>0?r:0;}
async function claimEmergencyGrant(){if(!canClaimEmergencyGrant()){const r=getEmergencyCooldownRemaining();const h=Math.ceil(r/3600000);return toast(currentLang==='id'?`⏳ Tunggu ${h} jam lagi`:`⏳ Wait ${h}h more`,'info');}const amount=500;profile.cash+=amount;profile.last_emergency_grant=new Date().toISOString();await sb.from('profiles').update({cash:profile.cash,last_emergency_grant:profile.last_emergency_grant}).eq('id',user.id);await logTransaction('emergency_grant',null,0,amount,'Emergency grant');render();toast('🚨 +'+money(amount),'good');}
function renderEmergencyCard(){if(!profile)return '';if(profile.cash>=100)return '';if(!canClaimEmergencyGrant()){const r=getEmergencyCooldownRemaining();const h=Math.ceil(r/3600000);return `<div class="card" style="border:1px solid rgba(224,62,62,0.4);background:#fff5f5;padding:12px;"><div style="display:flex;align-items:center;gap:10px;"><div style="font-size:22px;">🚨</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#b82020;">${currentLang==='id'?'Bantuan Darurat':'Emergency Grant'}</div><div style="font-size:10.5px;color:#b82020;margin-top:2px;">${currentLang==='id'?'Tersedia dalam':'Available in'} ${h}j</div></div></div></div>`;}return `<div class="card" style="border:1px solid rgba(224,62,62,0.5);background:linear-gradient(180deg,#fff5f5,#fff);padding:12px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><div style="font-size:22px;">🚨</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#b82020;">${currentLang==='id'?'Uang Menipis!':'Low Cash!'}</div><div style="font-size:10.5px;color:#b82020;margin-top:2px;">${currentLang==='id'?'Klaim bantuan darurat $500':'Claim $500 grant'}</div></div></div><button class="btn btn-red btn-sm" onclick="claimEmergencyGrant()">🚨 ${currentLang==='id'?'Klaim $500':'Claim $500'}</button></div>`;}

function openSaveModal(){if(!isGuest)return;$('modalContainer').innerHTML=`<div class="modal-backdrop" id="saveBackdrop" onclick="if(event.target.id==='saveBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">💾 ${t('save_title')}</div><div style="background:#fff5d9;border:1px solid #f0c674;padding:12px;border-radius:10px;margin-bottom:14px;font-size:12px;color:#8a6000;line-height:1.5;">⚠️ ${t('guest_banner')}</div><div style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-bottom:14px;">${t('save_desc')}</div><div class="modal-field"><label>${t('email')}</label><input type="email" id="saveEmail" placeholder="${t('ph_email')}" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;"></div><div class="modal-field"><label>${t('password')}</label><input type="password" id="savePassword" placeholder="${t('ph_password_new')}" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;"></div><div class="modal-field"><label>${t('username')}</label><input type="text" id="saveUsername" placeholder="${t('ph_username')}" style="width:100%;padding:13px;background:var(--surface);border:1px solid var(--border-hi);border-radius:9px;color:var(--text);font-size:15px;"></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('save_later')}</button><button class="btn btn-green" id="saveBtn" onclick="submitSave()">${t('save_submit')}</button></div></div></div>`;}
async function submitSave(){const email=$('saveEmail').value.trim();const pw=$('savePassword').value;const un=$('saveUsername').value.trim();if(!email||!pw||!un)return toast('Fill all','bad');if(pw.length<6)return toast('Password min 6','bad');if(!/^[a-zA-Z0-9_]{3,20}$/.test(un))return toast('Invalid username','bad');$('saveBtn').disabled=true;$('saveBtn').textContent='⏳...';try{const{data:ex}=await sb.from('profiles').select('id').eq('username',un).neq('id',user.id).maybeSingle();if(ex){$('saveBtn').disabled=false;$('saveBtn').textContent=t('save_submit');return toast('Username taken','bad');}const{error}=await sb.auth.updateUser({email,password:pw});if(error)throw error;await sb.from('profiles').update({username:un}).eq('id',user.id);profile.username=un;isGuest=false;closeModal();render();toast(t('save_success'),'good');}catch(e){$('saveBtn').disabled=false;$('saveBtn').textContent=t('save_submit');toast('❌ '+e.message,'bad');}}

/* ============================================================
   SEARCH — Pemain + Item
   ============================================================ */
function renderSearch(){
  return `
    <div class="search-bar">
      <input type="text" id="searchInput" class="search-input" 
        placeholder="${currentLang==='id'?'Cari barang atau pemain...':'Search items or players...'}" 
        value="${window._searchQuery||''}" 
        oninput="onSearchInput(this.value)">
    </div>
    <div id="searchResults">
      <div class="search-hint">
        <div class="big">🔍</div>
        <div class="txt">${currentLang==='id'?'Ketik nama barang atau pemain<br>untuk mulai mencari':'Type item or player name<br>to start searching'}</div>
      </div>
    </div>
  `;
}

function onSearchInput(val){
  window._searchQuery = val;
  const res = $('searchResults');
  if(!res) return;
  const q = val.trim().toLowerCase();
  
  if(q.length < 2){
    res.innerHTML = `<div class="search-hint"><div class="big">🔍</div><div class="txt">${currentLang==='id'?'Ketik minimal 2 karakter':'Type at least 2 characters'}</div></div>`;
    return;
  }
  
  let html = '';
  
  // ITEMS
  const matchedItems = Object.entries(ITEMS).filter(([id, it]) => 
    t(it.nameKey).toLowerCase().includes(q)
  );
  if(matchedItems.length > 0){
    html += `<div class="section-title">${currentLang==='id'?'Barang':'Items'} (${matchedItems.length})</div>`;
    html += '<div class="item-grid">';
    for(const [id, it] of matchedItems){
      const inv = inventory[id] || {qty:0};
      html += `<div class="item-card" onclick="jumpToExchange('${id}')">
        <div class="item-emoji">${it.emoji}</div>
        <div class="item-name">${t(it.nameKey)}</div>
        <div class="item-qty">${nf.format(inv.qty)}</div>
      </div>`;
    }
    html += '</div>';
  }
  
  // PLAYERS
  if(leaderboardData){
    const matchedPlayers = leaderboardData.filter(p => 
      (p.username||'').toLowerCase().includes(q) ||
      (p.company_name||'').toLowerCase().includes(q)
    );
    if(matchedPlayers.length > 0){
      html += `<div class="section-title">${currentLang==='id'?'Pemain':'Players'} (${matchedPlayers.length})</div>`;
      for(const p of matchedPlayers.slice(0, 15)){
        const isMe = p.id === user.id;
        html += `<div class="rank-row ${isMe?'me':''}">
          <div class="rank-avatar">${avatarHtml(p.avatar)}</div>
          <div class="rank-info">
            <div class="rank-name">${p.company_name || p.username}${isMe?'<span class="rank-you">'+t('rank_you')+'</span>':''}</div>
            <div class="rank-meta">Lv ${p.level||1} · @${p.username}</div>
          </div>
          <div class="rank-value">${money(p.company_value||0)}</div>
        </div>`;
      }
    }
  }
  
  if(!html){
    html = `<div class="search-hint"><div class="big">😕</div><div class="txt">${currentLang==='id'?'Tidak ditemukan':'Not found'}<br>"${val}"</div></div>`;
  }
  
  res.innerHTML = html;
}

function renderChat(){
  return `<div class="ex-empty"><span class="big">💬</span>
    <div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px;">${t('chat_title')}</div>
    <div style="font-size:11.5px;">${t('coming_soon_desc')}</div>
  </div>`;
}

/* MARKET MAKER */
function openMarketMakerModal(itemId,price){const def=ITEMS[itemId];if(!def)return;const maxBuy=Math.floor(profile.cash/price);if(maxBuy<=0)return toast(t('t_not_enough_money'),'bad');const defaultQty=Math.min(maxBuy,50);modalItemId='mm_'+itemId;$('modalContainer').innerHTML=`<div class="modal-backdrop" id="mmBackdrop" onclick="if(event.target.id==='mmBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">🛒 ${t('mm_title')} — ${def.emoji} ${t(def.nameKey)}</div><div class="modal-info" style="margin-bottom:12px;"><div class="modal-info-row"><span class="k">${t('sell_price_per')}</span><span class="v">$${price.toFixed(2)}</span></div><div class="modal-info-row"><span class="k">Max</span><span class="v">${nf.format(maxBuy)}</span></div></div><div class="modal-field"><label>${t('sell_qty')}</label><div class="qty-control"><button onclick="adjustMMQty(-10)">−10</button><input type="number" id="mmQty" value="${defaultQty}" min="1" max="${maxBuy}" oninput="updateMMTotal(${price})"><button onclick="adjustMMQty(10)">+10</button></div><button class="btn-max" onclick="setMMQty(${maxBuy},${price})">MAX (${nf.format(maxBuy)})</button></div><div class="modal-info"><div class="modal-info-row"><span class="k">${t('sell_total')}</span><span class="v gold" id="mmTotal">$${(defaultQty*price).toFixed(2)}</span></div><div class="modal-info-row"><span class="k">Cash</span><span class="v">${money(profile.cash)}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-green" id="mmBuyBtn" onclick="confirmMarketMakerBuy('${itemId}',${price})">🛒 ${t('ex_buy')}</button></div></div></div>`;}
function adjustMMQty(d){const inp=$('mmQty');let v=parseInt(inp.value)||0;const max=parseInt(inp.max)||0;v=Math.max(1,Math.min(max,v+d));inp.value=v;const price=parseFloat(inp.dataset.price)||0;if(price)$('mmTotal').textContent='$'+(v*price).toFixed(2);}
function setMMQty(max,price){$('mmQty').value=max;$('mmTotal').textContent='$'+(max*price).toFixed(2);}
function updateMMTotal(price){const v=parseInt($('mmQty').value)||0;$('mmTotal').textContent='$'+(v*price).toFixed(2);}
async function confirmMarketMakerBuy(itemId,price){const qty=parseInt($('mmQty').value)||0;if(qty<=0)return;const total=qty*price;if(total>profile.cash)return toast(t('t_not_enough_money'),'bad');$('mmBuyBtn').disabled=true;$('mmBuyBtn').textContent='⏳...';profile.cash-=total;inventory[itemId].qty+=qty;await Promise.all([syncProfile(),syncInventory(itemId)]);await logTransaction('buy_market_maker',itemId,qty,-total);if(itemId==='seeds')await advanceTutorial(1);if(itemId==='water')await advanceTutorial(2);closeModal();render();toast('🛒 +'+qty+' '+ITEMS[itemId].emoji+' (-'+money(total)+')','good');}

/* BUILD */
async function build(bId){const st=buildings[bId];if(st.level>0||st.upgrading)return;const c=buildCost(bId);if(profile.cash<c)return toast(t('t_not_enough_money'),'bad');const rem=profile.cash-c;if(rem<500){const msg=currentLang==='id'?`⚠️ Bangun ${t(BUILDINGS[bId].nameKey)} biaya $${nf.format(c)}. Sisa $${nf.format(rem)}. Lanjut?`:`Build ${t(BUILDINGS[bId].nameKey)} cost $${nf.format(c)}. Remaining $${nf.format(rem)}. Continue?`;if(!confirm(msg))return toast('Cancelled','info');}const oc=profile.cash,ou=st.upgrading,oe=st.upgradeEndsAt;profile.cash-=c;st.upgrading=true;st.upgradeEndsAt=Date.now()+getUpgradeDurationMs(bId);try{await Promise.all([syncProfile(),syncBuilding(bId)]);}catch(e){profile.cash=oc;st.upgrading=ou;st.upgradeEndsAt=oe;return toast('❌ '+e.message,'bad');}await logTransaction('build',bId,0,-c);const bc=Object.values(buildings).filter(b=>b.level>0).length;if(bc>=1)await advanceTutorial(5);render();const sec=Math.floor(getUpgradeDurationMs(bId)/1000);toast('🏗️ '+t(BUILDINGS[bId].nameKey)+' · '+sec+'s','info');scheduleUpgradeFinish(bId);}
async function upgrade(bId){const st=buildings[bId];if(!st.level)return build(bId);if(st.upgrading)return toast(t('status_upgrading')+'...','info');if(st.producing)return toast('Wait','info');if(st.level>=CONFIG.MAX_LEVEL)return toast(t('t_max_level'),'info');const c=upgradeCost(bId);if(profile.cash<c)return toast(t('t_not_enough_money'),'bad');const rem=profile.cash-c;if(rem<500){const msg=currentLang==='id'?`⚠️ Upgrade biaya $${nf.format(c)}. Sisa $${nf.format(rem)}. Lanjut?`:`Upgrade cost $${nf.format(c)}. Remaining $${nf.format(rem)}. Continue?`;if(!confirm(msg))return toast('Cancelled','info');}const oc=profile.cash,ou=st.upgrading,oe=st.upgradeEndsAt;profile.cash-=c;st.upgrading=true;st.upgradeEndsAt=Date.now()+getUpgradeDurationMs(bId);try{await Promise.all([syncProfile(),syncBuilding(bId)]);}catch(e){profile.cash=oc;st.upgrading=ou;st.upgradeEndsAt=oe;return toast('❌ '+e.message,'bad');}await logTransaction('upgrade',bId,0,-c,'Lv '+(st.level+1));render();toast(t('t_upgrade_started')+' ('+Math.floor(getUpgradeDurationMs(bId)/1000)+'s)','info');scheduleUpgradeFinish(bId);}
function scheduleUpgradeFinish(bId){const st=buildings[bId];const r=st.upgradeEndsAt-Date.now();if(r<=0){finishUpgrade(bId);return;}clearTimeout(st._upTimer);st._upTimer=setTimeout(()=>finishUpgrade(bId),r);}
async function finishUpgrade(bId){const st=buildings[bId];if(!st.upgrading)return;const wnb=st.level===0;st.upgrading=false;st.upgradeEndsAt=0;st.level+=1;await syncBuilding(bId);render();if(wnb){toast('🏭 '+t(BUILDINGS[bId].nameKey)+' '+t('t_building_done'),'good');}else{toast('🎉 '+t(BUILDINGS[bId].nameKey)+' → Lv '+st.level+'!','good');}}

async function toggleAuto(bId){const st=buildings[bId];st.auto=!st.auto;await syncBuilding(bId);render();if(st.auto&&!st.producing&&!st.upgrading&&hasInputs(bId))autoStartProduction(bId);}

/* PRODUCTION */
function openProductionModal(bId){
  const st=buildings[bId];
  if(!st.level||st.producing||st.upgrading)return;
  const maxQty=getMaxQtyByResources(bId);
  if(maxQty<=0)return toast(t('t_insufficient_input'),'bad');
  window._prodModal={bId,selected:'30s',maxQty};
  renderProductionModal();
}
function closeProdModal(){$('modalContainer').innerHTML='';window._prodModal=null;}
function selectDuration(opt){if(!window._prodModal)return;window._prodModal.selected=opt;renderProductionModal();}
function renderProductionModal(){
  const modal=window._prodModal;
  if(!modal)return;
  const{bId,selected,maxQty}=modal;
  const b=BUILDINGS[bId];
  const baseTime=getBaseTimePerUnit(bId);
  const presets=[{label:'5s',ms:5000},{label:'30s',ms:30000},{label:'5m',ms:300000},{label:'15m',ms:900000},{label:'1j',ms:3600000},{label:'MAX',ms:0}];
  let qty,durationMs;
  if(selected==='MAX'){qty=maxQty;durationMs=Math.floor(qty*baseTime);}
  else{const p=presets.find(x=>x.label===selected);durationMs=p.ms;qty=Math.min(maxQty,Math.floor(durationMs/baseTime));}
  if(qty<=0)return toast(t('t_insufficient_input'),'bad');
  const inputsReq={};
  for(const itemId of Object.keys(b.inputs)){inputsReq[itemId]=Math.ceil(qty*getQtyPerUnitInput(bId,itemId));}
  const durSec=Math.floor(durationMs/1000);
  const durText=formatDuration(durSec);
  const outDef=ITEMS[b.output.item];
  const wageCost=getWageCostForDuration(bId,durationMs);
  const workers=getWorkersCount(bId);
  const canAffordWage=profile.cash>=wageCost;
  $('modalContainer').innerHTML=`<div class="modal-backdrop" id="prodBackdrop" onclick="if(event.target.id==='prodBackdrop')closeProdModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">${b.emoji} ${currentLang==='id'?'Produksi':'Production'} ${t(b.nameKey)}</div><div class="modal-field"><label>${currentLang==='id'?'Pilih Durasi':'Duration'}</label><div class="duration-grid">${presets.map(p=>`<button class="duration-btn ${selected===p.label?'active':''}" onclick="selectDuration('${p.label}')">${p.label}</button>`).join('')}</div></div><div class="modal-info"><div class="modal-info-row"><span class="k">${currentLang==='id'?'Hasil':'Output'}</span><span class="v">${nf.format(qty)}× ${outDef.emoji} ${t(outDef.nameKey)}</span></div><div class="modal-info-row"><span class="k">${currentLang==='id'?'Selesai':'Finish'}</span><span class="v">${durText}</span></div><div class="modal-info-row"><span class="k">👷 ${t('workers_label')}</span><span class="v">${nf.format(workers)}</span></div><div class="modal-info-row"><span class="k">💵 ${t('wages_cost')}</span><span class="v" style="color:${canAffordWage?'#2e9e4f':'#e03e3e'}">${money(wageCost)}</span></div></div><div class="modal-field"><label>${currentLang==='id'?'Bahan Dibutuhkan':'Materials'}</label><div class="material-list">${Object.entries(inputsReq).map(([itemId,need])=>{const have=inventory[itemId].qty;const ok=have>=need;return `<div class="material-row ${ok?'ok':'bad'}"><span>${ITEMS[itemId].emoji} ${t(ITEMS[itemId].nameKey)}</span><span>${nf.format(need)} / ${nf.format(have)}</span></div>`;}).join('')}</div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeProdModal()">${t('sell_cancel')}</button><button class="btn btn-green" onclick="confirmProduction()" ${!canAffordWage?'disabled':''}>${canAffordWage?'⚡ '+(currentLang==='id'?'Mulai':'Start'):'💸 '+(currentLang==='id'?'Kas Kurang':'No Cash')}</button></div></div></div>`;
}
async function confirmProduction(){
  const modal=window._prodModal;
  if(!modal)return;
  const{bId,selected,maxQty}=modal;
  const st=buildings[bId];
  const b=BUILDINGS[bId];
  const baseTime=getBaseTimePerUnit(bId);
  const presets=[{label:'5s',ms:5000},{label:'30s',ms:30000},{label:'5m',ms:300000},{label:'15m',ms:900000},{label:'1j',ms:3600000}];
  let qty,durationMs;
  if(selected==='MAX'){qty=maxQty;durationMs=Math.floor(qty*baseTime);}
  else{const p=presets.find(x=>x.label===selected);durationMs=p.ms;qty=Math.min(maxQty,Math.floor(durationMs/baseTime));}
  if(qty<=0)return toast(t('t_insufficient_input'),'bad');
  const wageCost=getWageCostForDuration(bId,durationMs);
  if(profile.cash<wageCost)return toast(t('t_not_enough_money'),'bad');
  for(const itemId of Object.keys(b.inputs)){const need=Math.ceil(qty*getQtyPerUnitInput(bId,itemId));inventory[itemId].qty-=need;}
  profile.cash-=wageCost;
  st.producing=true;st.endsAt=Date.now()+durationMs;st.prodQty=qty;st.wageCost=wageCost;
  const promises=[syncBuilding(bId),syncProfile()];
  for(const itemId of Object.keys(b.inputs))promises.push(syncInventory(itemId));
  await Promise.all(promises);
  closeProdModal();render();scheduleFinish(bId);
  toast('⚡ '+qty+'× '+t(ITEMS[b.output.item].nameKey)+' • -'+money(wageCost),'good');
}
async function autoStartProduction(bId){
  const st=buildings[bId];
  if(!st.level||st.producing||st.upgrading)return;
  if(!hasInputs(bId))return;
  const b=BUILDINGS[bId];
  const baseTime=getBaseTimePerUnit(bId);
  const maxQty=getMaxQtyByResources(bId);
  const durationMs=5000;
  const qty=Math.min(maxQty,Math.floor(durationMs/baseTime));
  if(qty<=0)return;
  const wageCost=getWageCostForDuration(bId,durationMs);
  if(profile.cash<wageCost){if(st.auto){st.auto=false;await syncBuilding(bId);toast('⚠️ Auto OFF — kas kurang','info');}return;}
  for(const itemId of Object.keys(b.inputs)){inventory[itemId].qty-=Math.ceil(qty*getQtyPerUnitInput(bId,itemId));}
  profile.cash-=wageCost;
  st.producing=true;st.endsAt=Date.now()+durationMs;st.prodQty=qty;st.wageCost=wageCost;
  const promises=[syncBuilding(bId),syncProfile()];
  for(const itemId of Object.keys(b.inputs))promises.push(syncInventory(itemId));
  await Promise.all(promises);
  render();scheduleFinish(bId);
}
function scheduleFinish(bId){const st=buildings[bId];const r=st.endsAt-Date.now();if(r<=0){finishProduction(bId);return;}clearTimeout(st._timer);st._timer=setTimeout(()=>finishProduction(bId),r);}
async function finishProduction(bId){
  const st=buildings[bId];
  if(!st.producing)return;
  const b=BUILDINGS[bId];
  const qty=st.prodQty||getOutputQty(bId);
  const wageCost=st.wageCost||0;
  st.producing=false;st.endsAt=0;st.prodQty=0;st.wageCost=0;
  inventory[b.output.item].qty+=qty;
  addXP(qty);
  await Promise.all([syncBuilding(bId),syncInventory(b.output.item),syncProfile()]);
  await logTransaction('produce',b.output.item,qty,0,t(BUILDINGS[bId].nameKey));
  if(wageCost>0)await logTransaction('wages',null,0,-wageCost,t(BUILDINGS[bId].nameKey));
  if(b.output.item==='apples')await advanceTutorial(3);
  if(st.auto&&hasInputs(bId)&&!st.upgrading)setTimeout(()=>autoStartProduction(bId),50);
  else render();
}

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
    setTimeout(()=>{toast(t('tutorial_done'),'good');if(isGuest)setTimeout(()=>openSaveModal(),2000);},1800);
  }
}
async function dismissTutorial(){if(!confirm(currentLang==='id'?'Lewati tutorial?':'Skip tutorial?'))return;profile.tutorial_dismissed=true;await sb.from('profiles').update({tutorial_dismissed:true}).eq('id',user.id);render();toast(t('tutorial_skipped'),'info');if(isGuest)setTimeout(()=>openSaveModal(),1200);}
function renderTutorialCard(){if(!profile)return '';if(profile.tutorial_dismissed)return '';if(profile.tutorial_step>=TUTORIAL_STEPS.length)return '';const total=TUTORIAL_STEPS.length;const step=profile.tutorial_step;const pct=(step/total)*100;let stepsHtml='';for(let i=0;i<total;i++){const s=TUTORIAL_STEPS[i];const done=i<step;const cur=i===step;const icon=done?'✅':(cur?'▶️':'⬜');const style=done?'opacity:0.55;text-decoration:line-through;':(cur?'font-weight:800;color:#1e88e5;':'color:#8b95a3;');stepsHtml+=`<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;${style}"><span style="font-size:13px;flex-shrink:0;">${icon}</span><span>${t(s.stepKey)}</span></div>`;}const tr=TUTORIAL_STEPS.reduce((s,x)=>s+x.reward,0);return `<div class="card" style="border:1px solid rgba(30,136,229,0.4);background:linear-gradient(180deg,#e6f0fb,#fff);padding:14px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:13px;font-weight:800;color:#1565c0;">🎓 ${t('tutorial_title')}</div><button onclick="dismissTutorial()" style="background:none;border:none;color:#8b95a3;font-size:11px;font-weight:700;cursor:pointer;padding:4px 8px;font-family:inherit;">${t('tutorial_skip')} ✕</button></div><div style="background:#fff;border-radius:99px;height:6px;margin-bottom:10px;overflow:hidden;border:1px solid #d0e3f5;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#1e88e5,#42a5f5);transition:width 0.3s;"></div></div><div style="font-size:11px;color:#5a6472;margin-bottom:8px;font-weight:600;">${t('tutorial_progress')}: ${step} / ${total}</div>${stepsHtml}<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.08);font-size:11px;color:#5a6472;">🎁 ${t('tutorial_total_reward')}: <b style="color:#1f7a3a;">+${money(tr)}</b></div></div>`;}
function renderBoostCard(){if(!isBeginnerBoostActive())return '';const r=getBoostRemaining();return `<div class="card" style="border:1px solid rgba(230,149,0,0.4);background:linear-gradient(180deg,#fff5d9,#fff);padding:12px;"><div style="display:flex;align-items:center;gap:10px;"><div style="font-size:22px;">🚀</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#8a6000;">${t('boost_active')}</div><div style="font-size:10.5px;color:#8a6000;margin-top:2px;">${t('boost_desc')}</div></div><div style="font-size:11px;font-weight:800;color:#8a6000;font-variant-numeric:tabular-nums;" data-boost-timer>${formatBoostTime(r)}</div></div></div>`;}
function startBoostTimer(){if(boostRaf)cancelAnimationFrame(boostRaf);const tick=()=>{if(!isBeginnerBoostActive())return;const el=document.querySelector('[data-boost-timer]');if(el){el.textContent=formatBoostTime(getBoostRemaining());}boostRaf=requestAnimationFrame(tick);};tick();}

function sellFromStorage(itemId){const it=inventory[itemId];if(it.qty<=0)return toast(t('t_insufficient_input'),'bad');openSellModal(itemId);}
function openSellModal(itemId){const it=inventory[itemId];if(it.qty<=0)return;modalItemId=itemId;const def=ITEMS[itemId];$('modalContainer').innerHTML=`<div class="modal-backdrop" id="sellBackdrop" onclick="if(event.target.id==='sellBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">${def.emoji} ${t('sell_modal_title')} ${t(def.nameKey)}</div><div class="modal-field"><label>${t('sell_qty')} (${t('sell_max')}: ${nf.format(it.qty)})</label><div class="qty-control"><button onclick="adjustSellQty(-10)">−10</button><input type="number" id="sellQtyInput" value="${it.qty}" min="1" max="${it.qty}" oninput="updateSellTotal()"><button onclick="adjustSellQty(10)">+10</button></div><button class="btn-max" onclick="setSellQty(${it.qty})">${t('sell_max')} (${nf.format(it.qty)})</button></div><div class="modal-info"><div class="modal-info-row"><span class="k">${t('sell_price_per')}</span><span class="v">$${it.price.toFixed(2)}</span></div><div class="modal-info-row"><span class="k">${t('sell_total')}</span><span class="v gold" id="sellTotal">$${(it.qty*it.price).toFixed(2)}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-gold" onclick="confirmSell()">${t('sell_confirm')}</button></div></div></div>`;}
function closeModal(){$('modalContainer').innerHTML='';modalItemId=null;modalSellOrderItem=null;}
function adjustSellQty(d){const it=inventory[modalItemId];const inp=$('sellQtyInput');let v=parseInt(inp.value)||0;v=Math.max(1,Math.min(it.qty,v+d));inp.value=v;updateSellTotal();}
function setSellQty(v){const it=inventory[modalItemId];$('sellQtyInput').value=Math.min(v,it.qty);updateSellTotal();}
function updateSellTotal(){const it=inventory[modalItemId];let v=parseInt($('sellQtyInput').value)||0;v=Math.max(0,Math.min(it.qty,v));$('sellTotal').textContent='$'+(v*it.price).toFixed(2);}
async function confirmSell(){const itemId=modalItemId,it=inventory[itemId];let v=parseInt($('sellQtyInput').value)||0;v=Math.max(1,Math.min(it.qty,v));const rev=Math.floor(v*it.price);it.qty-=v;profile.cash+=rev;addXP(Math.floor(rev/10));const imp=Math.min(0.2,v*0.0005);it.price=Math.max(ITEMS[itemId].basePrice*CONFIG.MIN_PRICE,it.price*(1-imp));await Promise.all([syncInventory(itemId),syncProfile()]);await logTransaction('sell_instant',itemId,v,rev);if(itemId==='apples')await advanceTutorial(4);closeModal();render();toast('💰 +'+money(rev),'good');}

function openCreateOrderModal(){const owned=Object.entries(inventory).filter(([id,it])=>it.qty>0);if(owned.length===0)return toast('Nothing to sell','bad');let ih='';for(const[id,it]of owned){const def=ITEMS[id];ih+=`<div class="sell-item-opt" data-item="${id}" onclick="pickSellOrderItem('${id}')"><div class="e">${def.emoji}</div><div class="n">${t(def.nameKey)}</div><div class="q">${nf.format(it.qty)}</div></div>`;}$('modalContainer').innerHTML=`<div class="modal-backdrop" id="orderBackdrop" onclick="if(event.target.id==='orderBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">📢 ${t('ex_create_order')}</div><div class="modal-field"><label>${currentLang==='id'?'Pilih Barang':'Select'}</label><div class="sell-item-picker">${ih}</div></div><div id="orderFormArea" style="display:none;"><div class="modal-field"><label>${t('sell_qty')} (<span id="ordMaxLabel">0</span>)</label><div class="qty-control"><button onclick="adjustOrderQty(-10)">−10</button><input type="number" id="orderQty" value="1" min="1" oninput="updateOrderTotal()"><button onclick="adjustOrderQty(10)">+10</button></div></div><div class="modal-field"><label>${currentLang==='id'?'Harga/Unit':'Price/Unit'} ($)</label><div class="qty-control"><button onclick="adjustOrderPrice(-0.5)">−0.5</button><input type="number" id="orderPrice" value="0.00" step="0.01" min="0.01" oninput="updateOrderTotal()"><button onclick="adjustOrderPrice(0.5)">+0.5</button></div></div><div class="modal-info"><div class="modal-info-row"><span class="k">Total</span><span class="v gold" id="orderTotal">$0.00</span></div><div class="modal-info-row"><span class="k">Active</span><span class="v">${myOrders.length} / ${EXCHANGE_CONFIG.MAX_SELL_ORDERS}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-gold" id="orderSubmitBtn" onclick="submitSellOrder()">📢 ${currentLang==='id'?'Pasang':'Post'}</button></div></div></div></div>`;}
function pickSellOrderItem(itemId){modalSellOrderItem=itemId;document.querySelectorAll('.sell-item-opt').forEach(el=>el.classList.toggle('selected',el.dataset.item===itemId));const it=inventory[itemId];const def=ITEMS[itemId];$('orderFormArea').style.display='block';$('ordMaxLabel').textContent=nf.format(it.qty);$('orderQty').value=Math.min(it.qty,1);$('orderQty').max=it.qty;const low=marketOrders.filter(o=>o.item_id===itemId).reduce((m,o)=>Math.min(m,parseFloat(o.price_per_unit)),Infinity);const sg=low===Infinity?def.basePrice:low;$('orderPrice').value=sg.toFixed(2);updateOrderTotal();}
function adjustOrderQty(d){const it=inventory[modalSellOrderItem];const inp=$('orderQty');let v=parseInt(inp.value)||0;v=Math.max(1,Math.min(it.qty,v+d));inp.value=v;updateOrderTotal();}
function adjustOrderPrice(d){const inp=$('orderPrice');let v=parseFloat(inp.value)||0;v=Math.max(0.01,v+d);inp.value=v.toFixed(2);updateOrderTotal();}
function updateOrderTotal(){const q=parseInt($('orderQty').value)||0;const p=parseFloat($('orderPrice').value)||0;$('orderTotal').textContent='$'+(q*p).toFixed(2);}
async function submitSellOrder(){if(!modalSellOrderItem)return;if(myOrders.length>=EXCHANGE_CONFIG.MAX_SELL_ORDERS)return toast('Max orders','bad');const it=inventory[modalSellOrderItem];const qty=parseInt($('orderQty').value)||0;const price=parseFloat($('orderPrice').value)||0;if(qty<1||qty>it.qty)return toast('Invalid qty','bad');if(price<0.01)return toast('Invalid price','bad');$('orderSubmitBtn').disabled=true;$('orderSubmitBtn').textContent='⏳...';const{error}=await sb.from('market_orders').insert({seller_id:user.id,seller_username:profile.company_name||profile.username,seller_avatar:profile.avatar||'🏭',item_id:modalSellOrderItem,qty:qty,price_per_unit:price,status:'open'});if(error){$('orderSubmitBtn').disabled=false;$('orderSubmitBtn').textContent='📢';return toast('❌ '+error.message,'bad');}it.qty-=qty;await syncInventory(modalSellOrderItem);await logTransaction('sell_order',modalSellOrderItem,qty,qty*price);closeModal();await loadMarketOrders();render();toast('📢 Order posted!','good');}

function openBuyModal(orderId){const order=marketOrders.find(o=>o.id===orderId);if(!order)return;const def=ITEMS[order.item_id];const price=parseFloat(order.price_per_unit);const mq=order.qty;$('modalContainer').innerHTML=`<div class="modal-backdrop" id="buyBackdrop" onclick="if(event.target.id==='buyBackdrop')closeModal()"><div class="modal-sheet" onclick="event.stopPropagation()"><div class="modal-grip"></div><div class="modal-title">${def.emoji} ${t('ex_buy')} ${t(def.nameKey)}</div><div class="modal-info" style="margin-bottom:12px;"><div class="modal-info-row"><span class="k">Seller</span><span class="v">${order.seller_username}</span></div><div class="modal-info-row"><span class="k">Price</span><span class="v">$${price.toFixed(2)}/unit</span></div></div><div class="modal-field"><label>${t('sell_qty')} (max: ${nf.format(mq)})</label><div class="qty-control"><button onclick="adjustBuyQty(-10,${orderId})">−10</button><input type="number" id="buyQty" value="${mq}" min="1" max="${mq}" oninput="updateBuyTotal(${orderId},${price})"><button onclick="adjustBuyQty(10,${orderId})">+10</button></div><button class="btn-max" onclick="setBuyQty(${orderId},${mq},${price})">MAX (${nf.format(mq)})</button></div><div class="modal-info"><div class="modal-info-row"><span class="k">Total</span><span class="v gold" id="buyTotal">$${(mq*price).toFixed(2)}</span></div></div><div class="btn-row"><button class="btn btn-outline" onclick="closeModal()">${t('sell_cancel')}</button><button class="btn btn-green" id="buyConfirmBtn" onclick="confirmBuy(${orderId})">🛒 ${t('ex_buy')}</button></div></div></div>`;}
function adjustBuyQty(d,orderId){const order=marketOrders.find(o=>o.id===orderId);const inp=$('buyQty');let v=parseInt(inp.value)||0;v=Math.max(1,Math.min(order.qty,v+d));inp.value=v;updateBuyTotal(orderId,parseFloat(order.price_per_unit));}
function setBuyQty(orderId,max,price){$('buyQty').value=max;updateBuyTotal(orderId,price);}
function updateBuyTotal(orderId,price){const order=marketOrders.find(o=>o.id===orderId);let v=parseInt($('buyQty').value)||0;v=Math.max(0,Math.min(order.qty,v));$('buyTotal').textContent='$'+(v*price).toFixed(2);}
async function confirmBuy(orderId){const order=marketOrders.find(o=>o.id===orderId);if(!order)return;let qty=parseInt($('buyQty').value)||0;qty=Math.max(1,Math.min(order.qty,qty));$('buyConfirmBtn').disabled=true;$('buyConfirmBtn').textContent='⏳...';const{data,error}=await sb.rpc('buy_market_order',{p_order_id:orderId,p_qty:qty});if(error){$('buyConfirmBtn').disabled=false;$('buyConfirmBtn').textContent='🛒';return toast('❌ '+error.message,'bad');}const result=data;profile.cash-=result.total;inventory[result.item_id].qty+=result.qty;await logTransaction('buy_order',result.item_id,result.qty,-result.total);if(result.item_id==='seeds')await advanceTutorial(1);if(result.item_id==='water')await advanceTutorial(2);closeModal();await loadMarketOrders();render();toast('🛒 +'+result.qty+' '+ITEMS[result.item_id].emoji+' (-'+money(result.total)+')','good');}
async function cancelOrder(orderId){const order=myOrders.find(o=>o.id===orderId);if(!order)return;if(!confirm('Cancel?'))return;const{error}=await sb.from('market_orders').update({status:'cancelled'}).eq('id',orderId);if(error)return toast('❌ '+error.message,'bad');inventory[order.item_id].qty+=order.qty;await syncInventory(order.item_id);await logTransaction('cancel_order',order.item_id,order.qty,0);await loadMarketOrders();render();toast('Cancelled','info');}

async function startResearch(itemId){const r=research[itemId];if(!r)return;if(r.researching)return toast(t('research_in_progress'),'info');if(r.level>=RESEARCH_CONFIG.MAX_LEVEL)return toast(t('research_max'),'info');const cost=getResearchCost(r.level);if(profile.cash<cost)return toast(t('t_not_enough_money'),'bad');profile.cash-=cost;r.researching=true;r.endsAt=Date.now()+getResearchDuration(r.level);await Promise.all([syncProfile(),syncResearch(itemId)]);await logTransaction('research_start',itemId,0,-cost,'Lv '+(r.level+1));render();scheduleResearchFinish(itemId);}
function scheduleResearchFinish(itemId){const r=research[itemId];if(!r||!r.researching)return;const rm=r.endsAt-Date.now();if(rm<=0){finishResearch(itemId);return;}clearTimeout(r._timer);r._timer=setTimeout(()=>finishResearch(itemId),rm);}
async function finishResearch(itemId){const r=research[itemId];if(!r||!r.researching)return;r.researching=false;r.endsAt=0;r.level+=1;await syncResearch(itemId);await logTransaction('research_done',itemId,0,0,'Lv '+r.level);if(currentTab==='storage'&&storageSubTab==='research')render();toast('🎉 '+t(ITEMS[itemId].nameKey)+' → '+starsHtml(r.level),'good');}
function resumeAllResearch(){for(const itemId of Object.keys(research)){const r=research[itemId];if(r.researching&&r.endsAt){if(Date.now()>=r.endsAt)finishResearch(itemId);else scheduleResearchFinish(itemId);}}}

function recoverPrices(){let c=false;for(const[id,it]of Object.entries(inventory)){const b=ITEMS[id].basePrice;if(it.price<b){it.price=Math.min(b,it.price*CONFIG.PRICE_RECOVER);c=true;}}if(c&&currentTab==='exchange')render();}
function resumeAllActions(){for(const bId of Object.keys(BUILDINGS)){const st=buildings[bId];if(st.upgrading&&st.upgradeEndsAt){if(Date.now()>=st.upgradeEndsAt)finishUpgrade(bId);else scheduleUpgradeFinish(bId);}else if(st.producing&&st.endsAt){if(Date.now()>=st.endsAt)finishProduction(bId);else scheduleFinish(bId);}else if(st.auto&&st.level>0&&hasInputs(bId)){autoStartProduction(bId);}}}

function openProfile(){currentTab='profile';document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));render();}
function setStorageSub(id){storageSubTab=id;if(id==='rank'){leaderboardData=null;render();loadLeaderboard().then(()=>{if(currentTab==='storage'&&storageSubTab==='rank')render();});return;}if(id==='history'){transactions=[];render();loadTransactions().then(()=>{if(currentTab==='storage'&&storageSubTab==='history')render();});return;}if(id==='research'){research={};render();loadResearch().then(()=>{if(currentTab==='storage'&&storageSubTab==='research'){render();resumeAllResearch();}});return;}render();}
function setHistoryFilter(f){historyFilter=f;render();}

function renderStorage(){let h='<div class="sub-nav">';const subs=[{id:'rank',icon:'📊',label:t('storage_rank')},{id:'history',icon:'📜',label:t('storage_history')},{id:'incoming',icon:'📥',label:t('storage_incoming')},{id:'outgoing',icon:'📤',label:t('storage_outgoing')},{id:'buildings',icon:'🏭',label:t('storage_buildings')},{id:'research',icon:'🔬',label:t('storage_research')}];for(const s of subs)h+=`<button class="sub-tab ${storageSubTab===s.id?'active':''}" onclick="setStorageSub('${s.id}')"><span class="sub-icon">${s.icon}</span><span class="sub-label">${s.label}</span></button>`;h+='</div>';if(storageSubTab==='rank')h+=renderRankTab();else if(storageSubTab==='buildings')h+=renderBuildingsListTab();else if(storageSubTab==='history')h+=renderHistoryTab();else if(storageSubTab==='research')h+=renderResearchTab();else h+=renderComingSoon();return h;}
function renderRankTab(){if(leaderboardData===null){loadLeaderboard().then(()=>{if(currentTab==='storage'&&storageSubTab==='rank')render();});return '<div class="ex-empty"><span class="big">⏳</span>'+t('loading_data')+'</div>';}if(leaderboardData.length===0)return '<div class="ex-empty">📊</div>';let h='<div class="section-title">'+t('rank_title')+'</div>';let r=1;for(const p of leaderboardData){const me=p.id===user.id;let ph='#'+r,pc='';if(r===1){ph='🥇';pc='gold';}else if(r===2){ph='🥈';pc='gold';}else if(r===3){ph='🥉';pc='gold';}h+=`<div class="rank-row ${me?'me':''}"><div class="rank-pos ${pc}">${ph}</div><div class="rank-avatar">${avatarHtml(p.avatar)}</div><div class="rank-info"><div class="rank-name">${p.company_name||p.username}${me?'<span class="rank-you">'+t('rank_you')+'</span>':''}</div><div class="rank-meta">Lv ${p.level||1} · @${p.username}</div></div><div class="rank-value">${money(p.company_value||0)}</div></div>`;r++;}return h;}
function renderBuildingsListTab(){let h='<div class="section-title">'+t('buildings_list_title')+'</div>';const cats={};for(const[bId,b]of Object.entries(BUILDINGS)){const cat=t(b.categoryKey);if(!cats[cat])cats[cat]=[];cats[cat].push([bId,b]);}for(const[cn,arr]of Object.entries(cats)){h+='<div class="cat-header">'+cn+'</div>';for(const[bId,b]of arr){const st=buildings[bId];const bl=st.level>0;h+=`<div class="card" style="display:flex;align-items:center;gap:12px;padding:12px;"><div style="font-size:26px;flex-shrink:0;">${b.emoji}</div><div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:800;">${t(b.nameKey)}</div><div style="font-size:11px;color:var(--text-dim);margin-top:2px;">${bl?'Lv '+st.level:'—'}</div></div>${bl?'<div class="lvl-badge">Lv '+st.level+'</div>':'<div class="status locked">'+t('status_not_built')+'</div>'}</div>`;}}return h;}
function renderHistoryTab(){let h='<div class="section-title">'+t('history_title')+'</div>';h+='<div class="ex-filters">';h+=`<div class="ex-chip ${historyFilter==='all'?'active':''}" onclick="setHistoryFilter('all')">${t('history_filter_all')}</div>`;h+=`<div class="ex-chip ${historyFilter==='in'?'active':''}" onclick="setHistoryFilter('in')">⬇️ ${t('history_filter_in')}</div>`;h+=`<div class="ex-chip ${historyFilter==='out'?'active':''}" onclick="setHistoryFilter('out')">⬆️ ${t('history_filter_out')}</div>`;h+='</div>';let f=transactions;if(historyFilter==='in')f=transactions.filter(tx=>tx.amount>0);else if(historyFilter==='out')f=transactions.filter(tx=>tx.amount<0);if(f.length===0){h+='<div class="ex-empty"><span class="big">📜</span>'+t('history_empty')+'</div>';return h;}for(const tx of f){const def=tx.item_id?ITEMS[tx.item_id]:null;const isIn=tx.amount>0;const isN=tx.amount===0;let c='#5a6472';if(isIn)c='#2e9e4f';else if(!isN)c='#e03e3e';const aStr=tx.amount===0?'':((tx.amount>0?'+':'')+money(Math.abs(tx.amount)));const ic=isIn?'⬇️':(isN?'🔄':'⬆️');const tl=t('tx_'+tx.type)||tx.type;h+=`<div class="card" style="display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:7px;"><div style="font-size:20px;flex-shrink:0;">${def?def.emoji:ic}</div><div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:800;">${tl}${def?' · '+t(def.nameKey):''}</div><div style="font-size:10.5px;color:var(--text-mute);margin-top:2px;">${tx.qty>0?nf.format(tx.qty)+' unit · ':''}${timeAgo(tx.created_at)}</div></div><div style="font-size:12.5px;font-weight:800;color:${c};font-variant-numeric:tabular-nums;flex-shrink:0;">${aStr}</div></div>`;}return h;}
function renderResearchTab(){if(Object.keys(research).length===0)return '<div class="ex-empty">⏳</div>';let h='<div class="section-title">'+t('research_title')+'</div>';h+='<div style="background:var(--surface-2);padding:12px;border-radius:10px;margin-bottom:12px;font-size:12px;color:var(--text-dim);line-height:1.5;">'+t('research_intro')+'</div>';for(const itemId of RESEARCH_CONFIG.PILOT_ITEMS){const def=ITEMS[itemId];const r=research[itemId];const mx=r.level>=RESEARCH_CONFIG.MAX_LEVEL;const cost=getResearchCost(r.level);const can=profile.cash>=cost;let stt='',bt='',pt='';if(mx){stt='<span class="status auto">'+t('research_max')+'</span>';bt='<button class="btn btn-outline btn-sm" disabled>'+t('research_max')+'</button>';}else if(r.researching){stt='<span class="status busy">'+t('research_in_progress')+'</span>';bt='<button class="btn btn-purple btn-sm" disabled>⏳</button>';pt='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar upgrade" data-research-bar="'+itemId+'"></div></div><div class="prog-text" data-research-text="'+itemId+'"></div></div>';}else{stt='<span class="status idle">'+t('status_ready')+'</span>';const dis=!can?'disabled':'';bt='<button class="btn btn-purple btn-sm" '+dis+' onclick="startResearch(\''+itemId+'\')">'+t('research_start')+' · '+money(cost)+'</button>';}h+='<div class="card building-card"><div class="b-row1"><div class="b-emoji">'+def.emoji+'</div><div class="b-info"><div class="b-name">'+t(def.nameKey)+'</div><div class="b-desc" style="font-size:14px;letter-spacing:2px;margin-top:4px;">'+starsHtml(r.level)+'</div><div class="b-recipe">'+t('research_star_level')+': <b>'+r.level+' / '+RESEARCH_CONFIG.MAX_LEVEL+'</b></div></div><div>'+stt+'</div></div>'+pt+bt+'</div>';}return h;}
function renderComingSoon(){return `<div class="ex-empty"><span class="big">🚧</span><div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px;">${t('coming_soon_title')}</div><div style="font-size:11.5px;">${t('coming_soon_desc')}</div></div>`;}

/* MAIN RENDER */
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

/* MAP — Compact Grid */
function renderBuildings(){
  let h='';
  h+=renderBoostCard();
  h+=renderEmergencyCard();
  h+=renderTutorialCard();
  h+='<div class="compact-grid">';
  for(const[bId,b]of Object.entries(BUILDINGS)){
    h+=renderCompactCard(bId,b);
  }
  h+='</div>';
  return h;
}
function renderCompactCard(bId,b){
  const st=buildings[bId];
  const bl=st.level>0;
  const cons=st.upgrading&&st.level===0;
  const upg=st.upgrading&&st.level>0;
  const prod=st.producing;
  let cls='compact-card';
  let status='';
  let badge='';
  if(!bl&&!cons){cls+=' empty';status='+ '+money(buildCost(bId));}
  else if(cons){cls+=' building';status='🏗️ '+(currentLang==='id'?'Bangun':'Building');}
  else if(upg){cls+=' upgrading';status='⬆️ Lv '+(st.level+1);}
  else if(prod){cls+=' producing';status='⚡ '+(st.prodQty||0);}
  else {status='Lv '+st.level;badge=st.auto?'⚙️':'';}
  return `<div class="${cls}" onclick="openCompactDetail('${bId}')">
    ${badge?`<div class="compact-badge">${badge}</div>`:''}
    <div class="compact-emoji">${b.emoji}</div>
    <div class="compact-name">${t(b.nameKey)}</div>
    <div class="compact-status">${status}</div>
  </div>`;
}
function openCompactDetail(bId){
  const b=BUILDINGS[bId];
  if(!b)return;
  $('modalContainer').innerHTML=`
    <div class="modal-backdrop" id="compactBackdrop" onclick="if(event.target.id==='compactBackdrop')closeModal()">
      <div class="modal-sheet" onclick="event.stopPropagation()">
        <div class="modal-grip"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;">
            <span style="font-size:24px;">${b.emoji}</span>
            <span>${t(b.nameKey)}</span>
          </div>
          <button onclick="closeModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-mute);padding:4px 8px;font-family:inherit;">✕</button>
        </div>
        ${renderOneBuilding(bId,b)}
      </div>
    </div>`;
}

function renderOneBuilding(bId,b){
  const st=buildings[bId];
  const bl=st.level>0;
  const mx=st.level>=CONFIG.MAX_LEVEL;
  const cons=st.upgrading&&st.level===0;
  const upg=st.upgrading&&st.level>0;
  const bc=buildCost(bId),uc=upgradeCost(bId);
  const outQty=bl?getOutputQty(bId):b.output.qty;
  const rate=(b.output.qty/(b.duration/1000)).toFixed(1);
  const inputsText=Object.entries(b.inputs).map(([itId])=>{const need=bl?Math.ceil(getQtyPerUnitInput(bId,itId)*getOutputQty(bId)):b.inputs[itId];const have=inventory[itId].qty;const ok=have>=need;return '<span style="color:'+(ok?'#2e9e4f':'#e03e3e')+'">'+need+'× '+ITEMS[itId].emoji+'</span>';}).join(' + ')||'<span style="color:#2e9e4f">Free</span>';
  let sh='';
  if(cons)sh='<span class="status busy">🏗️ Build</span>';
  else if(!bl)sh='<span class="status locked">'+t('status_not_built')+'</span>';
  else if(upg)sh='<span class="status upgrading">'+t('status_upgrading')+'</span>';
  else if(st.producing)sh='<span class="status busy">'+t('status_producing')+'</span>';
  else if(st.auto&&!hasInputs(bId))sh='<span class="status busy">'+t('status_low_input')+'</span>';
  else if(st.auto)sh='<span class="status auto">'+t('status_auto')+'</span>';
  else sh='<span class="status idle">'+t('status_ready')+'</span>';
  let bh='';
  if(cons){bh='<button class="btn btn-outline" disabled>🏗️...</button>';}
  else if(!bl){const dis=profile.cash<bc?'disabled':'';bh='<button class="btn btn-primary" '+dis+' onclick="build(\''+bId+'\')">'+t('btn_build')+' · '+money(bc)+'</button>';}
  else{
    const canUp=!mx&&!st.upgrading&&!st.producing&&profile.cash>=uc;
    const canProd=hasInputs(bId)&&!st.producing&&!st.upgrading;
    const bTxt=upg?t('btn_upgrading'):(mx?t('btn_max'):'⬆️ Lv '+st.level+'→'+(st.level+1)+' · '+money(uc));
    const bU='<button class="btn btn-purple btn-sm" '+(canUp?'':'disabled')+' onclick="upgrade(\''+bId+'\')">'+bTxt+'</button>';
    const bP='<button class="btn btn-green btn-sm" '+(canProd?'':'disabled')+' onclick="openProductionModal(\''+bId+'\')">'+(st.producing?t('btn_producing'):t('btn_produce'))+'</button>';
    bh='<div class="btn-row">'+bU+bP+'</div><div style="margin-top:8px;display:flex;justify-content:flex-end;"><button class="toggle '+(st.auto?'on':'')+'" onclick="toggleAuto(\''+bId+'\')"><div class="toggle-dot"></div>'+t('btn_auto')+'</button></div>';
  }
  let ph='';
  if(cons||upg){ph='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar upgrade" data-upbar="'+bId+'"></div></div><div class="prog-text" data-uptext="'+bId+'"></div></div>';}
  else if(st.producing){ph='<div class="prog-wrap"><div class="prog-track"><div class="prog-bar" data-bar="'+bId+'"></div></div><div class="prog-text" data-text="'+bId+'"></div></div>';}
  const workerInfo=bl?('<div class="b-recipe" style="margin-top:4px;font-size:11px;opacity:0.85;">👷 '+nf.format(b.workers*st.level)+' '+t('workers_label')+' · 💵 '+money(b.wage*st.level)+'/'+(currentLang==='id'?'jam':'h')+'</div>'):'';
  return '<div class="card building-card"><div class="b-row1"><div class="b-emoji">'+b.emoji+'</div><div class="b-info"><div class="b-name">'+t(b.nameKey)+' '+(bl?'<span class="lvl-badge">Lv '+st.level+'</span>':'')+'</div><div class="b-desc">'+t(b.descKey)+'</div><div class="b-recipe">'+inputsText+' → <b>'+outQty+'× '+ITEMS[b.output.item].emoji+'</b> <span style="opacity:0.7">('+rate+'/s)</span></div>'+workerInfo+'</div><div>'+sh+'</div></div>'+ph+bh+'</div>';
}

function renderExchange(){
  let h='';
  h+=`<div class="mm-section"><div class="mm-header">🏛️ ${t('mm_title')}</div><div class="mm-grid">`;
  for(const entry of MARKET_MAKER){
    const def=ITEMS[entry.item];
    if(!def)continue;
    const cb=profile.cash>=entry.price;
    h+=`<button class="mm-item ${cb?'':'disabled'}" onclick="openMarketMakerModal('${entry.item}', ${entry.price})"><span class="mm-emoji">${def.emoji}</span><span class="mm-name">${t(def.nameKey)}</span><span class="mm-price">$${entry.price.toFixed(2)}</span></button>`;
  }
  h+=`</div></div>`;
  h+='<div class="ex-sell-bar"><button class="ex-sell-btn" onclick="openCreateOrderModal()">📢 '+t('ex_create_order')+'</button></div>';
  h+='<div class="ex-filters">';
  h+=`<div class="ex-chip ${marketFilter==='all'?'active':''}" onclick="setFilter('all')">${t('ex_all')}</div>`;
  for(const itemId of Object.keys(ITEMS)){const def=ITEMS[itemId];h+=`<div class="ex-chip ${marketFilter===itemId?'active':''}" onclick="setFilter('${itemId}')">${def.emoji} ${t(def.nameKey)}</div>`;}
  h+='</div>';
  if(myOrders.length>0){const f=marketFilter==='all'?myOrders:myOrders.filter(o=>o.item_id===marketFilter);if(f.length>0){h+=`<div class="ex-section"><div class="ex-section-header"><div class="ex-section-title">${t('ex_my_orders')}</div><div class="ex-section-count">${f.length}/${EXCHANGE_CONFIG.MAX_SELL_ORDERS}</div></div>`;for(const o of f)h+=renderOrderRow(o,true);h+='</div>';}}
  const fm=marketFilter==='all'?marketOrders:marketOrders.filter(o=>o.item_id===marketFilter);
  h+=`<div class="ex-section"><div class="ex-section-header"><div class="ex-section-title">${t('ex_global_market')}</div><div class="ex-section-count">${fm.length} ${t('ex_orders')}</div></div>`;
  if(fm.length===0)h+=`<div class="ex-empty"><span class="big">💱</span>${t('ex_empty')}</div>`;
  else for(const o of fm)h+=renderOrderRow(o,false);
  h+='</div>';
  return h;
}
function setFilter(f){marketFilter=f;render();}
function renderOrderRow(o,isMine){const def=ITEMS[o.item_id];if(!def)return '';const nm=t(def.nameKey);const p=parseFloat(o.price_per_unit);const t2=o.qty*p;const av=o.seller_avatar||'🏭';const tm=timeAgo(o.created_at);if(isMine)return `<div class="ex-order mine"><div class="ex-order-avatar">${avatarHtml(av)}</div><div class="ex-order-info"><div class="ex-order-seller">${t('ex_you')} · ${tm}</div><div class="ex-order-item">${def.emoji} ${nm}</div><div class="ex-order-meta">${nf.format(o.qty)} × $${p.toFixed(2)} = $${t2.toFixed(2)}</div></div><button class="ex-buy-btn" style="background:#e03e3e;" onclick="cancelOrder(${o.id})">✕</button></div>`;return `<div class="ex-order"><div class="ex-order-avatar">${avatarHtml(av)}</div><div class="ex-order-info"><div class="ex-order-seller">${o.seller_username}</div><div class="ex-order-item">${def.emoji} ${nm}</div><div class="ex-order-meta">${nf.format(o.qty)} × $${p.toFixed(2)} · ${tm}</div></div><div class="ex-order-price"><div class="p">$${p.toFixed(2)}</div><div class="q">/unit</div></div><button class="ex-buy-btn" onclick="openBuyModal(${o.id})">${t('ex_buy')}</button></div>`;}

function renderProfile(){
  const r=getRating();const v=getCompanyValue();const d=profile.company_description||'';const c=profile.country||'Indonesia';const e=fmtDate(profile.created_at);const ls=timeAgo(profile.last_seen);const lt=fmtTime();const bc=Object.values(buildings).filter(b=>b.level>0).length;
  const gb=isGuest?`<div class="card" style="border:1px solid rgba(230,149,0,0.4);background:linear-gradient(180deg,#fff5d9,#fff);padding:12px;"><div style="display:flex;align-items:center;gap:10px;"><div style="font-size:22px;">⚠️</div><div style="flex:1;"><div style="font-size:12.5px;font-weight:800;color:#8a6000;">${t('guest_banner')}</div></div><button class="btn btn-gold btn-sm" style="width:auto;padding:8px 12px;" onclick="openSaveModal()">${t('guest_banner_btn')}</button></div></div>`:'';
  return gb+`<div class="profile-hero"><div class="profile-hero-top"><div class="profile-logo">${avatarHtml(profile.avatar)}</div><div class="profile-hero-info"><div class="profile-status"><span class="dot"></span>${t('p_online')}</div><div class="profile-company-name">${profile.company_name}</div><div class="profile-company-type">${t('p_pt')} · @${profile.username}</div></div></div><div class="profile-actions"><button class="profile-btn" onclick="copyCompanyId()">${t('p_copy_id')}</button><button class="profile-btn" onclick="openEditProfileModal()">${t('p_edit_profile')}</button></div></div><div class="card"><div class="card-section-header">${t('p_rankings')}</div><div class="ranking-box"><div class="ranking-item"><div class="ranking-label">${t('p_company_value')}</div><div class="ranking-value gold">${money(v)}</div></div><div class="ranking-item"><div class="ranking-label">${t('p_eva')}</div><div class="ranking-value">${nf.format(profile.xp)}</div></div></div></div><div class="card"><div class="card-section-header">${t('p_info')}</div><div class="p-compact-list"><div class="info-row"><span class="info-key">${t('p_rating')}</span><span class="info-val"><span class="rating-badge ${r.cls}">${r.text}</span></span></div><div class="info-row"><span class="info-key">${t('p_level')}</span><span class="info-val">${profile.level}</span></div><div class="info-row"><span class="info-key">${t('p_xp')}</span><span class="info-val">${nf.format(profile.xp)}</span></div><div class="info-row"><span class="info-key">${t('p_buildings')}</span><span class="info-val">${bc} ${t('p_units')}</span></div><div class="info-row"><span class="info-key">${t('p_country')}</span><span class="info-val">🇮🇩 ${c}</span></div><div class="info-row"><span class="info-key">${t('p_established')}</span><span class="info-val">${e}</span></div><div class="info-row"><span class="info-key">${t('p_last_seen')}</span><span class="info-val">${ls}</span></div><div class="info-row"><span class="info-key">${t('p_local_time')}</span><span class="info-val">${lt}</span></div></div></div><div class="card"><div class="card-section-header">${t('p_description')}</div><textarea class="description-textarea" id="descInput" placeholder="${t('p_description_ph')}" maxlength="200">${d}</textarea><button class="btn btn-green btn-sm" style="margin-top:10px;" onclick="saveDescription()">${t('btn_save_desc')}</button></div><div class="card"><div class="card-section-header">${t('p_account')}</div><div class="account-menu"><div class="account-item" onclick="showLangPicker()"><div class="account-icon">🌐</div><div class="account-label">${t('p_language')}</div><div class="account-arrow" style="font-weight:700;color:var(--text-dim);font-size:12px;">${currentLang==='id'?'🇮🇩 ID':'🇬🇧 EN

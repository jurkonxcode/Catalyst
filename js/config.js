/* ============================================================
   SUPABASE
   ============================================================ */
const SUPABASE_URL = 'https://ugpgegvgfjbndamirmyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGdlZ3ZnZmpibmRhbWlybXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODkzMzQsImV4cCI6MjEwNjI2NTMzNH0.O-PTiJlC96r8bqbKSEZP9Tt5zAimyAHZd9YsEZSvnJc';

/* ============================================================
   CONFIG
   ============================================================ */
const CONFIG = { MAX_LEVEL: 10, PRICE_RECOVER: 1.008, MIN_PRICE: 0.4 };
const EXCHANGE_CONFIG = { MAX_SELL_ORDERS: 5, MIN_PRICE: 0.01, TICKER_ITEMS: ['water','wheat','coal','electricity','flour','bread','cake'] };

/* ============================================================
   ITEMS
   ============================================================ */
const ITEMS = {
  water:       { nameKey:'item_water',       emoji:'💧', categoryKey:'cat_raw',     basePrice:1 },
  wheat:       { nameKey:'item_wheat',       emoji:'🌾', categoryKey:'cat_raw',     basePrice:5 },
  coal:        { nameKey:'item_coal',        emoji:'⚫', categoryKey:'cat_raw',     basePrice:6 },
  electricity: { nameKey:'item_electricity', emoji:'⚡', categoryKey:'cat_energy',  basePrice:4 },
  flour:       { nameKey:'item_flour',       emoji:'🥣', categoryKey:'cat_product', basePrice:15 },
  bread:       { nameKey:'item_bread',       emoji:'🍞', categoryKey:'cat_product', basePrice:40 },
  cake:        { nameKey:'item_cake',        emoji:'🍰', categoryKey:'cat_product', basePrice:80 },
};

/* ============================================================
   BUILDINGS
   ============================================================ */
const BUILDINGS = {
  waterPump:{categoryKey:'cat_extraction',nameKey:'b_waterpump',emoji:'🚰',descKey:'b_waterpump_desc',baseCost:500,duration:3000,upgradeTime:15,inputs:{},output:{item:'water',qty:20}},
  farm:{categoryKey:'cat_extraction',nameKey:'b_farm',emoji:'🌱',descKey:'b_farm_desc',baseCost:2500,duration:5000,upgradeTime:25,inputs:{water:10},output:{item:'wheat',qty:15}},
  mine:{categoryKey:'cat_extraction',nameKey:'b_mine',emoji:'⛏️',descKey:'b_mine_desc',baseCost:6000,duration:7000,upgradeTime:45,inputs:{water:15},output:{item:'coal',qty:12}},
  powerPlant:{categoryKey:'cat_processing',nameKey:'b_powerplant',emoji:'🏭',descKey:'b_powerplant_desc',baseCost:10000,duration:8000,upgradeTime:60,inputs:{coal:10},output:{item:'electricity',qty:30}},
  mill:{categoryKey:'cat_processing',nameKey:'b_mill',emoji:'⚙️',descKey:'b_mill_desc',baseCost:12000,duration:7000,upgradeTime:60,inputs:{wheat:15},output:{item:'flour',qty:10}},
  bakery:{categoryKey:'cat_manufacturing',nameKey:'b_bakery',emoji:'🥖',descKey:'b_bakery_desc',baseCost:25000,duration:10000,upgradeTime:90,inputs:{flour:10,water:10},output:{item:'bread',qty:8}},
  cakeShop:{categoryKey:'cat_manufacturing',nameKey:'b_cakeshop',emoji:'🎂',descKey:'b_cakeshop_desc',baseCost:50000,duration:14000,upgradeTime:120,inputs:{flour:12,electricity:5,water:8},output:{item:'cake',qty:5}},
};

/* ============================================================
   I18N — Indonesia
   ============================================================ */
const I18N = {
  id: {
    login:'Masuk', register:'Daftar', email:'Email', password:'Password', username:'Username',
    ph_email:'nama@email.com', ph_password:'password kamu', ph_password_new:'min. 6 karakter', ph_username:'huruf/angka, tanpa spasi',
    btn_login:'🔐 Masuk', btn_register:'📝 Buat Akun',
    msg_logging:'⏳ Masuk...', msg_registering:'⏳ Mendaftar...', tagline:'Bangun kerajaan bisnismu',
    create_profile:'Buat Profil', create_profile_sub:'Kenalkan perusahaanmu ke dunia',
    choose_logo:'Pilih Logo', company_name_label:'Nama Perusahaan', company_name_ph:'cth: PT Cahaya Energi',
    btn_start:'🚀 Mulai Bermain', msg_saving:'⏳ Menyimpan...', msg_creating_company:'Membuat perusahaan...',
    company_sub:'Simulasi Bisnis', lv:'Lv',
    tab_buildings:'Bangunan', tab_storage:'Gudang', tab_market:'Pasar', tab_profile:'Profil', tab_exchange:'Exchange',
    status_not_built:'Belum', status_ready:'Siap', status_producing:'Produksi', status_upgrading:'Upgrade', status_auto:'Auto', status_low_input:'Kurang',
    btn_build:'Bangun', btn_produce:'⚡ Produksi', btn_producing:'⏳...', btn_upgrading:'⏳ Upgrading...',
    btn_max:'✓ Max', btn_auto:'Auto', btn_sell:'Jual', btn_save_desc:'💾 Simpan Deskripsi',
    cat_extraction:'EKSTRAKSI', cat_processing:'PENGOLAHAN', cat_manufacturing:'MANUFAKTUR',
    cat_raw:'Bahan Baku', cat_energy:'Energi', cat_product:'Produk',
    item_water:'Air', item_wheat:'Gandum', item_coal:'Batu Bara', item_electricity:'Listrik',
    item_flour:'Tepung', item_bread:'Roti', item_cake:'Kue',
    b_waterpump:'Water Pump', b_waterpump_desc:'Memompa air bersih dari tanah.',
    b_farm:'Farm', b_farm_desc:'Menanam gandum. Butuh air untuk irigasi.',
    b_mine:'Mine', b_mine_desc:'Menambang batu bara. Butuh air untuk pendingin.',
    b_powerplant:'Power Plant', b_powerplant_desc:'Membakar batu bara menjadi listrik.',
    b_mill:'Mill', b_mill_desc:'Menggiling gandum menjadi tepung.',
    b_bakery:'Bakery', b_bakery_desc:'Memanggang roti dari tepung & air.',
    b_cakeshop:'Cake Shop', b_cakeshop_desc:'Membuat kue premium dari tepung, listrik & air.',
    market_title:'Pasar', market_hint:'Tap untuk jual',
    sell_modal_title:'Jual', sell_qty:'Jumlah', sell_max:'MAX', sell_price_per:'Harga per unit',
    sell_total:'Total pendapatan', sell_confirm:'💰 Jual', sell_cancel:'Batal',
    ex_create_order:'Pasang Order Jual', ex_my_orders:'Order Saya', ex_global_market:'Pasar Global',
    ex_orders:'order', ex_all:'Semua', ex_empty:'Belum ada order. Pasang order jual untuk memulai!',
    ex_buy:'Beli', ex_you:'Kamu', ex_loading:'Memuat harga pasar...',
    p_rankings:'Rankings', p_company_value:'Company Value', p_eva:'EVA Score', p_info:'Info Perusahaan',
    p_rating:'Rating', p_level:'Level', p_xp:'Total XP', p_buildings:'Bangunan', p_country:'Negara',
    p_established:'Terdaftar', p_last_seen:'Terakhir dilihat', p_local_time:'Waktu lokal',
    p_description:'Deskripsi Publik', p_description_ph:'Ceritakan tentang perusahaanmu... (maks 200 karakter)',
    p_account:'Akun', p_language:'Bahasa', p_preferences:'Preferensi',
    p_change_password:'Ubah Password', p_logout:'Keluar', p_delete:'Hapus Akun',
    p_online:'Online', p_pt:'Perseroan Terbatas', p_copy_id:'📋 Copy ID', p_edit_profile:'✏️ Edit Profil', p_units:'unit',
    edit_profile_title:'Edit Profil', edit_company_name:'Nama Perusahaan', edit_avatar:'Pilih Logo',
    edit_country:'Negara', edit_save:'💾 Simpan Perubahan',
    t_copied:'📋 ID disalin', t_desc_saved:'✅ Deskripsi tersimpan', t_password_changed:'✅ Password diubah',
    t_logout_msg:'👋 Sampai jumpa!', t_coming_soon:'Segera hadir', t_not_enough_money:'Uang tidak cukup',
    t_insufficient_input:'Bahan kurang', t_max_level:'Max level', t_upgrade_started:'⬆️ Upgrade dimulai',
    t_welcome:'🎉 Selamat datang', t_building_done:'dibangun!', t_profile_saved:'✅ Profil tersimpan',
    /* Warehouse Sub-Nav */
    storage_rank:'Peringkat',
    storage_history:'Riwayat',
    storage_incoming:'Kontrak Masuk',
    storage_outgoing:'Kontrak Keluar',
    storage_buildings:'Bangunan',
    storage_research:'Research',
    rank_title:'Peringkat Perusahaan',
    rank_you:'KAMU',
    buildings_list_title:'Semua Bangunan',
    coming_soon_title:'Segera Hadir',
    coming_soon_desc:'Fitur ini sedang dikembangkan',
    loading_data:'Memuat data...',
  },
  en: {
    login:'Sign In', register:'Register', email:'Email', password:'Password', username:'Username',
    ph_email:'name@email.com', ph_password:'your password', ph_password_new:'min. 6 chars', ph_username:'letters/numbers, no spaces',
    btn_login:'🔐 Sign In', btn_register:'📝 Create Account',
    msg_logging:'⏳ Signing in...', msg_registering:'⏳ Registering...', tagline:'Build your business empire',
    create_profile:'Create Profile', create_profile_sub:'Introduce your company to the world',
    choose_logo:'Choose Logo', company_name_label:'Company Name', company_name_ph:'e.g: Alpha Industries',
    btn_start:'🚀 Start Playing', msg_saving:'⏳ Saving...', msg_creating_company:'Creating company...',
    company_sub:'Business Simulator', lv:'Lv',
    tab_buildings:'Buildings', tab_storage:'Storage', tab_market:'Market', tab_profile:'Profile', tab_exchange:'Exchange',
    status_not_built:'Not Built', status_ready:'Ready', status_producing:'Producing', status_upgrading:'Upgrading', status_auto:'Auto', status_low_input:'Low Input',
    btn_build:'Build', btn_produce:'⚡ Produce', btn_producing:'⏳...', btn_upgrading:'⏳ Upgrading...',
    btn_max:'✓ Max', btn_auto:'Auto', btn_sell:'Sell', btn_save_desc:'💾 Save Description',
    cat_extraction:'EXTRACTION', cat_processing:'PROCESSING', cat_manufacturing:'MANUFACTURING',
    cat_raw:'Raw Materials', cat_energy:'Energy', cat_product:'Products',
    item_water:'Water', item_wheat:'Wheat', item_coal:'Coal', item_electricity:'Electricity',
    item_flour:'Flour', item_bread:'Bread', item_cake:'Cake',
    b_waterpump:'Water Pump', b_waterpump_desc:'Pumps clean water from the ground.',
    b_farm:'Farm', b_farm_desc:'Grows wheat. Requires water for irrigation.',
    b_mine:'Mine', b_mine_desc:'Mines coal. Requires water for cooling.',
    b_powerplant:'Power Plant', b_powerplant_desc:'Burns coal into electricity.',
    b_mill:'Mill', b_mill_desc:'Grinds wheat into flour.',
    b_bakery:'Bakery', b_bakery_desc:'Bakes bread from flour & water.',
    b_cakeshop:'Cake Shop', b_cakeshop_desc:'Makes premium cakes from flour, electricity & water.',
    market_title:'Market', market_hint:'Tap to sell',
    sell_modal_title:'Sell', sell_qty:'Quantity', sell_max:'MAX', sell_price_per:'Price per unit',
    sell_total:'Total revenue', sell_confirm:'💰 Sell', sell_cancel:'Cancel',
    ex_create_order:'Create Sell Order', ex_my_orders:'My Orders', ex_global_market:'Global Market',
    ex_orders:'orders', ex_all:'All', ex_empty:'No orders yet. Post a sell order to start!',
    ex_buy:'Buy', ex_you:'You', ex_loading:'Loading market prices...',
    p_rankings:'Rankings', p_company_value:'Company Value', p_eva:'EVA Score', p_info:'Company Info',
    p_rating:'Rating', p_level:'Level', p_xp:'Total XP', p_buildings:'Buildings', p_country:'Country',
    p_established:'Established', p_last_seen:'Last seen', p_local_time:'Local time',
    p_description:'Public Description', p_description_ph:'Tell the world about your company... (max 200 chars)',
    p_account:'Account', p_language:'Language', p_preferences:'Preferences',
    p_change_password:'Change Password', p_logout:'Log Out', p_delete:'Delete Account',
    p_online:'Online', p_pt:'Limited Company', p_copy_id:'📋 Copy ID', p_edit_profile:'✏️ Edit Profile', p_units:'units',
    edit_profile_title:'Edit Profile', edit_company_name:'Company Name', edit_avatar:'Choose Logo',
    edit_country:'Country', edit_save:'💾 Save Changes',
    t_copied:'📋 ID copied', t_desc_saved:'✅ Description saved', t_password_changed:'✅ Password changed',
    t_logout_msg:'👋 See you!', t_coming_soon:'Coming soon', t_not_enough_money:'Not enough money',
    t_insufficient_input:'Insufficient input', t_max_level:'Max level', t_upgrade_started:'⬆️ Upgrade started',
    t_welcome:'🎉 Welcome', t_building_done:'built!', t_profile_saved:'✅ Profile saved',
    /* Warehouse Sub-Nav */
    storage_rank:'Rank',
    storage_history:'History',
    storage_incoming:'Incoming',
    storage_outgoing:'Outgoing',
    storage_buildings:'Buildings',
    storage_research:'Research',
    rank_title:'Company Rankings',
    rank_you:'YOU',
    buildings_list_title:'All Buildings',
    coming_soon_title:'Coming Soon',
    coming_soon_desc:'This feature is under development',
    loading_data:'Loading data...',
  }
};

/* ============================================================
   LANGUAGE
   ============================================================ */
let currentLang = (() => {
  const saved = localStorage.getItem('jc_lang');
  if (saved === 'id' || saved === 'en') return saved;
  const browser = (navigator.language || 'en').toLowerCase();
  return browser.startsWith('id') ? 'id' : 'en';
})();

function t(key){ return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en[key]) || key; }
function setLang(lang){
  currentLang = lang;
  localStorage.setItem('jc_lang', lang);
  document.documentElement.lang = lang;
  if (typeof updateStaticUI === 'function') updateStaticUI();
  if (typeof profile !== 'undefined' && profile && typeof render === 'function') render();
}

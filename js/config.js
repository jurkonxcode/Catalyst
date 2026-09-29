/* ============================================================
   KONFIGURASI SUPABASE
   ============================================================ */
const SUPABASE_URL = 'https://ugpgegvgfjbndamirmyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVncGdlZ3ZnZmpibmRhbWlybXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODkzMzQsImV4cCI6MjEwNjI2NTMzNH0.O-PTiJlC96r8bqbKSEZP9Tt5zAimyAHZd9YsEZSvnJc';

/* ============================================================
   KONFIGURASI GAME
   ============================================================ */
const CONFIG = {
  MAX_LEVEL: 10,
  PRICE_RECOVER: 1.008,
  MIN_PRICE: 0.4,
};

/* ============================================================
   ITEMS — 7 item, 3 kategori
   ============================================================ */
const ITEMS = {
  water:       { name:'Air',        emoji:'💧', category:'Bahan Baku', basePrice:1 },
  wheat:       { name:'Gandum',     emoji:'🌾', category:'Bahan Baku', basePrice:5 },
  coal:        { name:'Batu Bara',  emoji:'⚫', category:'Bahan Baku', basePrice:6 },
  electricity: { name:'Listrik',    emoji:'⚡', category:'Energi',     basePrice:4 },
  flour:       { name:'Tepung',     emoji:'🥣', category:'Produk',     basePrice:15 },
  bread:       { name:'Roti',       emoji:'🍞', category:'Produk',     basePrice:40 },
  cake:        { name:'Kue',        emoji:'🍰', category:'Produk',     basePrice:80 },
};

/* ============================================================
   BUILDINGS — 7 bangunan, 3 kategori
   ============================================================ */
const BUILDINGS = {
  waterPump: {
    category:'Ekstraksi', name:'Water Pump', emoji:'🚰',
    desc:'Memompa air bersih dari tanah.',
    baseCost: 500, duration: 3000,
    inputs: {},
    output: { item:'water', qty:20 },
  },
  farm: {
    category:'Ekstraksi', name:'Farm', emoji:'🌱',
    desc:'Menanam gandum. Butuh air untuk irigasi.',
    baseCost: 2500, duration: 5000,
    inputs: { water: 10 },
    output: { item:'wheat', qty:15 },
  },
  mine: {
    category:'Ekstraksi', name:'Mine', emoji:'⛏️',
    desc:'Menambang batu bara. Butuh air untuk pendingin.',
    baseCost: 6000, duration: 7000,
    inputs: { water: 15 },
    output: { item:'coal', qty:12 },
  },
  powerPlant: {
    category:'Pengolahan', name:'Power Plant', emoji:'🏭',
    desc:'Membakar batu bara menjadi listrik.',
    baseCost: 10000, duration: 8000,
    inputs: { coal: 10 },
    output: { item:'electricity', qty:30 },
  },
  mill: {
    category:'Pengolahan', name:'Mill', emoji:'⚙️',
    desc:'Menggiling gandum menjadi tepung.',
    baseCost: 12000, duration: 7000,
    inputs: { wheat: 15 },
    output: { item:'flour', qty:10 },
  },
  bakery: {
    category:'Manufaktur', name:'Bakery', emoji:'🥖',
    desc:'Memanggang roti dari tepung & air.',
    baseCost: 25000, duration: 10000,
    inputs: { flour: 10, water: 10 },
    output: { item:'bread', qty:8 },
  },
  cakeShop: {
    category:'Manufaktur', name:'Cake Shop', emoji:'🎂',
    desc:'Membuat kue premium dari tepung, listrik & air.',
    baseCost: 50000, duration: 14000,
    inputs: { flour: 12, electricity: 5, water: 8 },
    output: { item:'cake', qty:5 },
  },
};

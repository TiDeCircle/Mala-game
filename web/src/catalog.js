// Catalog of all Mala Shop ingredients, noodles, broths, and spice levels
// Node names match the exact exported .glb files in /export/

export const PRICE_PER_100G = 29; // ขีดละ 29 บาท

// Quick-focus camera views along the 4-tier chiller wall
export const CHILLER_VIEWS = [
  { id: 'all', label: 'ทั้งหมด (4 ชั้น)', icon: '🧊', x: 0.0, y: 1.68, z: 1.48, lookY: 1.15 },
  { id: 'veggies', label: 'ผักสด', icon: '🥬', x: 0.0, y: 1.72, z: 0.78, lookY: 1.46 },
  { id: 'mushrooms', label: 'เห็ด & เส้น', icon: '🍄', x: 0.0, y: 1.48, z: 0.78, lookY: 1.24 },
  { id: 'meats', label: 'เนื้อ & เต้าหู้', icon: '🥩', x: 0.0, y: 1.28, z: 0.78, lookY: 1.02 },
  { id: 'meatballs', label: 'ลูกชิ้น', icon: '🍡', x: 0.0, y: 1.2, z: 0.88, lookY: 0.82 },
];

export const GLB_PACKS = {
  props0: '/props/Phase0_Props.glb',
  propsPickPay: '/props/Phase4_Props_PickPay.glb',
  propsDining: '/props/Phase4_Props_DiningShop.glb',
  propsShopInterior: '/props/Shop_Interior_Furniture.glb',
  toppings: '/props/Phase5_Toppings.glb',
  ing0: '/ingredients/Phase0_Ingredients.glb',
  meatballsP1: '/ingredients/Phase2_Meatballs_P1.glb',
  meatMushroomsP1: '/ingredients/Phase2_MeatMushrooms_P1.glb',
  veggiesP1: '/ingredients/Phase2_Vegetables_P1.glb',
  noodlesP1: '/noodles/Phase3_Noodles_P1.glb',
  meatballsP2: '/ingredients/Phase2_Meatballs_P2P3.glb',
  remainingP2: '/ingredients/Phase2_Remaining_P2P3.glb',
  noodlesP2: '/noodles/Phase3_Noodles_P2P3.glb',
};

export const INGREDIENTS = [
  // === TIER 4 (Top): ผักสด ===
  { id: 'Bokchoy', name: 'กวางตุ้งฮ่องเต้', cn: '上海青', tier: 3, category: 'veggies', pack: 'remainingP2', weight: 24, pileCount: 14, scale: 1.75, upright: true },
  { id: 'NapaCabbage', name: 'ผักกาดขาว', cn: '白菜', tier: 3, category: 'veggies', pack: 'veggiesP1', weight: 24, pileCount: 14, scale: 1.75, upright: true },
  { id: 'Lettuce', name: 'ผักกาดแก้ว', cn: '生菜', tier: 3, category: 'veggies', pack: 'veggiesP1', weight: 20, pileCount: 14, scale: 1.7, upright: true },
  { id: 'Broccoli', name: 'บรอกโคลี', cn: '西兰花', tier: 3, category: 'veggies', pack: 'remainingP2', weight: 25, pileCount: 16, scale: 1.45, upright: true },
  { id: 'CornCob', name: 'ข้าวโพดหวาน', cn: '甜玉米', tier: 3, category: 'veggies', pack: 'veggiesP1', weight: 40, pileCount: 14, scale: 1.25 },
  { id: 'LotusRoot', name: 'รากบัว', cn: '莲藕', tier: 3, category: 'veggies', pack: 'veggiesP1', weight: 22, pileCount: 22, scale: 1.2 },
  { id: 'Potato', name: 'มันฝรั่งแผ่น', cn: '土豆片', tier: 3, category: 'veggies', pack: 'veggiesP1', weight: 26, pileCount: 22, scale: 1.2 },
  { id: 'Carrot', name: 'แครอทดอกไม้', cn: '胡萝卜', tier: 3, category: 'veggies', pack: 'veggiesP1', weight: 18, pileCount: 26, scale: 1.25 },
  { id: 'BabyCorn', name: 'ข้าวโพดอ่อน', cn: '玉米笋', tier: 3, category: 'veggies', pack: 'remainingP2', weight: 20, pileCount: 20, scale: 1.25 },

  // === TIER 3 (Upper-Mid): เห็ด & เส้น ===
  { id: 'Enoki', name: 'เห็ดเข็มทอง', cn: '金针菇', tier: 2, category: 'mushrooms', pack: 'meatMushroomsP1', weight: 25, pileCount: 16, scale: 1.45 },
  { id: 'KingOyster', name: 'เห็ดออรินจิ', cn: '杏鲍菇', tier: 2, category: 'mushrooms', pack: 'meatMushroomsP1', weight: 26, pileCount: 18, scale: 1.3 },
  { id: 'WhiteBeech', name: 'เห็ดชิเมจิ', cn: '白玉菇', tier: 2, category: 'mushrooms', pack: 'meatMushroomsP1', weight: 22, pileCount: 16, scale: 1.4 },
  { id: 'Shiitake', name: 'เห็ดหอม', cn: '香菇', tier: 2, category: 'mushrooms', pack: 'ing0', weight: 20, pileCount: 20, scale: 1.25 },
  { id: 'BlackFungus', name: 'เห็ดหูหนูดำ', cn: '黑木耳', tier: 2, category: 'mushrooms', pack: 'remainingP2', weight: 18, pileCount: 20, scale: 1.3 },
  { id: 'GlassNoodle', name: 'วุ้นเส้น', cn: '粉丝', tier: 2, category: 'noodles', pack: 'noodlesP1', isNoodle: true, weight: 45, pileCount: 10, scale: 1.3 },
  { id: 'InstantNoodle', name: 'มาม่า', cn: '方便面', tier: 2, category: 'noodles', pack: 'noodlesP1', isNoodle: true, weight: 55, pileCount: 8, scale: 1.15 },
  { id: 'KonjacNoodle', name: 'เส้นบุกมัดปม', cn: '魔芋结', tier: 2, category: 'noodles', pack: 'noodlesP1', isNoodle: true, weight: 50, pileCount: 14, scale: 1.2 },
  { id: 'EggNoodle', name: 'บะหมี่เหลือง', cn: '鸡蛋面', tier: 2, category: 'noodles', pack: 'noodlesP2', isNoodle: true, weight: 50, pileCount: 8, scale: 1.15 },

  // === TIER 2 (Lower-Mid): เนื้อสัตว์ / ทะเล / เต้าหู้ ===
  { id: 'PorkSlice', name: 'หมูสันคอสไลซ์', cn: '梅花肉', tier: 1, category: 'meats', pack: 'ing0', weight: 32, pileCount: 14, scale: 1.1 },
  { id: 'PorkBellySlice', name: 'หมูสามชั้น', cn: '五花肉', tier: 1, category: 'meats', pack: 'meatMushroomsP1', weight: 35, pileCount: 14, scale: 1.1 },
  { id: 'BeefSlice', name: 'เนื้อวัวสไลซ์', cn: '肥牛卷', tier: 1, category: 'meats', pack: 'remainingP2', weight: 35, pileCount: 14, scale: 1.1 },
  { id: 'Shrimp', name: 'กุ้งสด', cn: '鲜虾', tier: 1, category: 'meats', pack: 'remainingP2', weight: 28, pileCount: 14, scale: 1.15 },
  { id: 'Squid', name: 'ปลาหมึกบั้ง', cn: '鱿鱼花', tier: 1, category: 'meats', pack: 'remainingP2', weight: 30, pileCount: 16, scale: 1.1 },
  { id: 'FishCube', name: 'ปลาดอลลี่', cn: '巴沙鱼', tier: 1, category: 'meats', pack: 'remainingP2', weight: 32, pileCount: 16, scale: 1.1 },
  { id: 'FriedTofuSkinRoll', name: 'ฟองเต้าหู้ม้วน', cn: '响铃卷', tier: 1, category: 'meatballs', pack: 'meatballsP1', weight: 18, pileCount: 12, scale: 1.05 },
  { id: 'FishTofu', name: 'เต้าหู้ปลา', cn: '鱼豆腐', tier: 1, category: 'meatballs', pack: 'meatballsP1', weight: 26, pileCount: 16, scale: 1.05 },
  { id: 'RiceCake', name: 'ต๊อกบกกี', cn: '年糕', tier: 1, category: 'meatballs', pack: 'meatballsP2', weight: 25, pileCount: 20, scale: 1.05 },

  // === TIER 1 (Bottom Sloped Stainless Bed): ลูกชิ้น & ไส้กรอก ===
  { id: 'FishBall', name: 'ลูกชิ้นปลา', cn: '鱼丸', tier: 0, category: 'meatballs', pack: 'ing0', weight: 22, pileCount: 24, scale: 1.0 },
  { id: 'PorkBall', name: 'ลูกชิ้นหมู', cn: '猪肉丸', tier: 0, category: 'meatballs', pack: 'meatballsP1', weight: 24, pileCount: 24, scale: 1.0 },
  { id: 'FishBallCheese', name: 'ลูกชิ้นชีส', cn: '芝士丸', tier: 0, category: 'meatballs', pack: 'meatballsP2', weight: 28, pileCount: 22, scale: 1.0 },
  { id: 'FriedFishBall', name: 'ลูกชิ้นปลาทอด', cn: '炸鱼丸', tier: 0, category: 'meatballs', pack: 'meatballsP1', weight: 22, pileCount: 24, scale: 1.0 },
  { id: 'StripedFishBall', name: 'ลูกชิ้นลายส้ม', cn: '龙虾丸', tier: 0, category: 'meatballs', pack: 'meatballsP1', weight: 24, pileCount: 24, scale: 1.0 },
  { id: 'CrabStick', name: 'ปูอัด', cn: '蟹柳', tier: 0, category: 'meatballs', pack: 'meatballsP1', weight: 20, pileCount: 18, scale: 1.05 },
  { id: 'QuailEgg', name: 'ไข่นกกระทา', cn: '鹌鹑蛋', tier: 0, category: 'meatballs', pack: 'meatballsP2', weight: 14, pileCount: 30, scale: 1.05 },
  { id: 'Sausage', name: 'ไส้กรอกบั้ง', cn: '脆皮肠', tier: 0, category: 'meatballs', pack: 'meatballsP1', weight: 30, pileCount: 16, scale: 1.0 },
  { id: 'CuttlefishSausage', name: 'ไส้กรอกปลาหมึก', cn: '章鱼肠', tier: 0, category: 'meatballs', pack: 'meatballsP1', weight: 25, pileCount: 18, scale: 1.0 },
];

export const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map((item) => [item.id, item]));

export const BROTHS = [
  {
    id: 'mala_thick',
    name: 'ซุปหม่าล่าน้ำข้น (เผ็ด/ชาต้นตำรับ)',
    color: '#b83214',
    potColor: 0xa8280e,
    textureKey: 'mala',
    tint: 0xffffff,
    roughness: 0.16,
  },
  {
    id: 'mala_clear',
    name: 'ซุปหม่าล่าน้ำใส',
    color: '#c9491c',
    potColor: 0xb83e14,
    textureKey: 'mala_clear',
    tint: 0xffffff,
    roughness: 0.12,
    clearSoup: true,
  },
  {
    id: 'pork_bone',
    name: 'ซุปกระดูกหมู',
    color: '#e6c589',
    potColor: 0xdec088,
    textureKey: 'creamy',
    tint: 0xffffff,
    roughness: 0.24,
  },
  {
    id: 'black_soup',
    name: 'ซุปน้ำดำ',
    color: '#3b2416',
    potColor: 0x2e1a0e,
    textureKey: 'black',
    tint: 0xffffff,
    roughness: 0.14,
  },
  {
    id: 'tomato',
    name: 'ซุปมะเขือเทศ',
    color: '#d94b2b',
    potColor: 0xd14222,
    textureKey: 'tomato',
    tint: 0xffffff,
    roughness: 0.2,
  },
  {
    id: 'milk',
    name: 'ซุปนม / ซุปหม่าล่าขาว',
    color: '#f7eedc',
    potColor: 0xf2e7d0,
    textureKey: 'milk',
    tint: 0xffffff,
    roughness: 0.28,
  },
  {
    id: 'dry_mala',
    name: 'แบบผัดแห้ง (หม่าล่าผัดแห้ง)',
    color: '#9c230c',
    potColor: 0x8f1f0a,
    textureKey: 'mala',
    tint: 0xffffff,
    roughness: 0.18,
    isDry: true,
  },
];

export const SPICE_LEVELS = [
  { id: 0, label: 'ไม่เผ็ด / ไม่ชา (เด็กทานได้)', badge: '🌿', chili: 0 },
  { id: 1, label: 'เผ็ดน้อย / ชาน้อย', badge: '🌶️', chili: 1 },
  { id: 2, label: 'เผ็ดกลาง / ชากลาง', badge: '🌶️🌶️', chili: 2 },
  { id: 3, label: 'เผ็ดมาก / ชามาก', badge: '🔥🔥', chili: 3 },
];

export const TOPPINGS = [
  { id: 'Topping_ChiliFlake', label: 'พริกป่นหม่าล่า', icon: '🌶️' },
  { id: 'Topping_Sesame', label: 'งาขาวคั่ว', icon: '⚪' },
  { id: 'Topping_GreenOnion', label: 'ต้นหอมซอย', icon: '🧅' },
  { id: 'Topping_Cilantro', label: 'ผักชี', icon: '🌿' },
];

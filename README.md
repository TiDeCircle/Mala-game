# 🌶️ Cozy Mala Maker — ร้านหม่าล่าชั่งขีด (3D Web Game)

เกมเว็บ 3D แนว Cozy จำลองร้านหม่าล่าชั่งขีดแบบไทย สร้างด้วย **Three.js + Vite** พร้อมโมเดล 3D และฟิสิกส์กองวัตถุดิบจาก Blender

## ฟีเจอร์หลัก
- **ตู้แช่สแตนเลส 4 ชั้น (36 วัตถุดิบ)** — คีบของด้วยที่คีบ 3D (กดคลิกซ้ายค้างลากหย่อนลงชามใส) และเลื่อนดูตู้ด้วยการจ่อขอบจอซ้าย-ขวา
- **ตาชั่งดิจิทัล + ใบสั่งอาหารเขียนมือ** — ชั่งน้ำหนักจริงพร้อมหน้าจอ LED เรืองแสง และใบสั่งอาหารบนคลิปบอร์ดที่ลากเมาส์เขียนชื่อ/ติ๊กเลือกน้ำซุป 7 แบบ & ความเผ็ด 4 ระดับได้เอง
- **หม้อต้ม & ชามเสิร์ฟ** — ต้มหม่าล่าพร้อมไอน้ำและฟองเดือด จัดลงชามเซรามิกดำพร้อม Texture น้ำซุป PBR 6 แบบ + แบบผัดแห้ง โรยท็อปปิ้ง คีบเส้นโชว์ และถ่ายรูปพร้อมใบเสร็จ PNG

## วิธีรันในเครื่อง
```bash
cd web
npm install
npm run dev
```

## โครงสร้างโค้ด (`web/src/`)
| ไฟล์ | หน้าที่ |
|---|---|
| `main.js` | boot, สลับสเตจ, ส่งต่อ input, render loop |
| `core/context.js` | state กลาง, DOM refs, renderer/scene/camera |
| `core/quality.js` | โหมดภาพ HD / LITE |
| `stations/pick.js` | ตู้แช่ 4 ชั้น, ที่คีบ, ชามใส, การลาก/ปัด |
| `stations/weigh.js`, `stations/orderSlip.js` | ตาชั่งดิจิทัล, ใบสั่งเขียนมือ |
| `stations/cook.js` | หม้อต้ม, ฟอง, ตะกร้อ |
| `stations/dine.js` | ประกอบชามเสิร์ฟ, ท็อปปิ้ง, คีบเส้น, แตะกิน |
| `receipt.js` | ใบเสร็จ + รูปสำหรับแชร์ |
| `assetLoader.js`, `catalog.js` | โหลด GLB/texture, รายการวัตถุดิบ |

## Asset pipeline
`export/` คือไฟล์ต้นฉบับจาก Blender (ดู `AGENTS.md`) — เว็บไม่ได้ใช้ตรงๆ
หลัง export โมเดลใหม่ทุกครั้งให้รัน:
```bash
cd web
npm run optimize-assets   # export/ → web/public/ (texture เป็น WebP, ~37 MB → ~11 MB)
```
แล้ว commit `web/public/` ด้วย URL ของ asset มี `?v=<hash ของ public/>` ต่อท้ายอัตโนมัติ เบราว์เซอร์จึง cache ได้ยาวโดยไม่ค้างของเก่า

## Deploy
- **Self-host (ปัจจุบัน):** `cd web && npm run build` → pm2 app `mala-game` serve `web/dist` ที่ port 3060 → nginx `mala.madebytide.xyz` (ไม่ต้อง restart pm2 หลัง build)
- **Vercel:** ใช้ `vercel.json` ได้ทันที (Build Command: `cd web && npm install && npm run build`, Output Directory: `web/dist`)

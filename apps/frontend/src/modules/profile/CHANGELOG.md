# CHANGELOG — frontend/modules/profile

## 2026-10-15 — พื้นหลังเคลื่อนไหว Molten Gold (เฉพาะธีมมืด)
- เพิ่ม `<MoltenBackground />` (WebGL ล้วน · ริ้วทองเหลวเบนตามเมาส์ · ไม่มีแสงเรืองตามเมาส์ (ตัดออกตามที่ขอ) · ไม่มี click effect · render ครึ่งความละเอียด · `prefers-reduced-motion` = ภาพนิ่ง · ซ่อนแท็บ = หยุด · ธีมสว่าง = ไม่แสดง) ใส่เฉพาะหน้านี้ ห่อด้วย `fixed inset-0 -z-10` ให้อยู่หลังเนื้อหาและ footer
- route `/profile` มี `handle: { backdrop: true }` → `MainLayout` ใส่ `isolate` (แบบเดียวกับหน้าแรก) ให้พื้นหลัง -z-10 อยู่เหนือพื้นทึบของ Layout · header / BottomIsland เหมือนเดิม
- ธีมมืด: การ์ดโปร่งเล็กน้อย `colorBgContainer` = `rgba(23,21,32,0.82)` ผ่าน `ConfigProvider` ของหน้า (ไม่แตะ `colorBgElevated` → dropdown ของ Select ยังทึบ · ไม่ใช้ backdrop-filter) · ข้อความ `text-muted` บนจุดทองสว่างสุด contrast ≈ 4.6:1 (AA)
- ไฟล์: `page.tsx` · `ui/components/MoltenBackground.tsx` (ใหม่) · `layouts/main.tsx` · `router/index.tsx`

## 2026-10-10 — รองรับมือถือ (responsive)
- การ์ดหัวโปรไฟล์: ชื่อ/อีเมลไม่ล้นจอแคบ (`min-w-0` + `truncate` / `break-all`) · ปุ่ม "ออกจากระบบ" ลงบรรทัดใหม่เต็มความกว้างบนมือถือ
- ปุ่ม "ไปหน้าร้านของฉัน" / "บันทึก" / "เชื่อม LINE" เต็มความกว้างบนมือถือ (กดง่าย) · ระยะห่างการ์ดแคบลงบนจอเล็ก
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `updateProfile` (`PATCH /me/profile`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)

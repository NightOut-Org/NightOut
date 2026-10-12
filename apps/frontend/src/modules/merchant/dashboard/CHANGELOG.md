## 2026-10-12 — ย้ายพื้นหลังไปเป็น `EmbersBackdrop` ตัวกลาง (ตาม handoff aurora-embers)
- `ui/components/merchantAurora.tsx` → `ui/components/embersBackdrop.tsx` (ใช้ร่วมกับหน้าแรก) · ประกายทองหลบเมาส์ในรัศมี 8% ของจอ (ไม่ขยับ 4 วิ จุดหลบลอยวนเอง) · แสงด้านบนยังไม่ตามเมาส์
- ติดตั้งที่ `layouts/merchant.tsx` (ครอบทุกหน้าใต้ /merchant) และ `layouts/merchantOnboarding.tsx` (layout ใหม่ของ `/merchant/join` `/merchant/status`) แทน handle `merchantAurora` ใน `layouts/main.tsx` (เอาออกแล้ว)
- คลาสกระจก `merchant-aurora-scope` → `embers-glass` (`embersBackdrop.css`) · แถบบนมือถือโปร่ง 60% + เบลอในธีมมืด

## 2026-10-12 — พื้นหลัง Merchant Aurora (Golden Embers) ทุกหน้า /merchant
- ทุกหน้าใต้ `/merchant` (รวม `/merchant/join` และ `/merchant/status`) มีพื้นหลังตามดีไซน์ "Merchant Aurora" แบบ 10 Golden Embers: แสงม่วง/ทองจากขอบบน ม่วงอมชมพูที่ขอบล่าง และประกายทองลอยขึ้น ไม่ตามเมาส์ มีเกรนบาง ๆ ทับ · เฉพาะธีมมืด
- กระจก (glassmorphism): การ์ดชั้นนอก (`bg-card` / `bg-surface` / `ant-card`) โปร่ง ~55–62% + เบลอ 20px + ขอบและไฮไลต์ขอบบนสีขาวจาง ๆ · กล่องที่ซ้อนในการ์ดโปร่งอย่างเดียว ไม่เบลอซ้ำ · กลางวงแหวนทึบเสมอ (`merchant-solid` ใน `merchantUi.tsx`)
- ปุ่มแคปซูล/ชิปที่ยังไม่เลือก และป้ายสถานะร้านบนแถบเมนู (`merchant-glass-pill` ใน `layouts/merchant.tsx`) มีพื้นกระจกและตัวหนังสือสว่างขึ้น ไม่จมกับแสงด้านหลัง
- หยุดวาดเมื่อสลับแท็บ ถ้าตั้ง prefers-reduced-motion หรือโหมดประหยัดเน็ตจะเป็นภาพนิ่ง
- เปิดใช้ด้วย `handle.merchantAurora` ของ route → `layouts/main.tsx` · ไฟล์หลัก `ui/components/merchantAurora.tsx` + `.css` · `router/index.tsx`

## 2026-10-10 — Bento ตาม Merchant 1i Sitemap
- Desktop 4 คอลัมน์: ปกร้าน (รูปร้าน + ดาว) · คืนนี้ (วงแหวนเช็กอิน + ปุ่ม Scanner) · มาตามนัด 30 วัน (เทียบ 30 วันก่อนหน้า + ไม่มาตามนัด) · การจองวันนี้ (กดไปรายละเอียด) · มัดจำวันนี้ · รีวิวใหม่ (ลิงก์ "ดูรีวิว") · ทางลัด 4 ปุ่ม
- มือถือ 2 คอลัมน์: ปก · เช็กอิน (แถบ) · มาตามนัด · การจองวันนี้ 4 รายการ · ทางลัด
- ไฟล์หลัก: `page.tsx` · ชิ้นส่วนกลาง `ui/components/merchantUi.tsx`

## 2026-10-08 — Responsive Merchant

- KPI cards และตารางการจองแสดงบนจอแคบโดยไม่ดันทั้งหน้า

# NightOut — ทะเบียนโมดูล

ไฟล์นี้คือแหล่งความจริงว่าในโค้ดมีโมดูลอะไรบ้าง ทำอะไร และอยู่ในแผนช่วงไหน
- โครงโฟลเดอร์ภายในแอปและกติกาของแต่ละชั้น → [ARCHITECTURE.md](ARCHITECTURE.md) §3 / §4 · route และ navigation → [SITEMAP.md](SITEMAP.md)
- **เพิ่ม / ลบ / เปลี่ยนชื่อโมดูล ต้องแก้ไฟล์นี้ในงานเดียวกัน**
- ของที่ไม่อยู่ใน MVP หรือ roadmap (`docs/PROMPT.md` หัวข้อ "Development Phases" + "ไม่ทำใน MVP", `README.md` หัวข้อ Roadmap) ต้องถามเจ้าของ repo ก่อนเริ่ม · ตกลงแล้วให้ใส่ Phase เป็น `นอก MVP — อนุมัติ YYYY-MM-DD`

**ค่าในคอลัมน์ Phase:** `1A` ลูกค้า · `1B` ร้าน · `1C` Backoffice (ตาม PROMPT.md) · `กฎธุรกิจ` = ไม่ได้อยู่ในรายการ MVP ตรงๆ แต่ตกลงแล้วในหัวข้อ "กฎธุรกิจที่ตกลงแล้ว" ของ `CLAUDE.md` · `นอก MVP — …` = ของนอกแผน

## 1. apps/frontend — ลูกค้า (`src/modules/*`)

| โมดูล | ทำอะไร | route | โดเมน API | หน้าคู่ (admin) | Phase |
|---|---|---|---|---|---|
| `home` | หน้าแรก: Hero (ค้นหาตามงบ: คำค้น + ย่าน + งบต่อหัว + จำนวนคน → `/search`), หมวด "คืนนี้อยากได้ฟีลไหน", ร้านแนะนำ | `/` | `catalog` · `site-content` · `mini-ads` | `homeContent` · `miniAds` | 1A (เนื้อหาแก้ได้: นอก MVP — ยังไม่ระบุวันอนุมัติ) |
| `map` | แผนที่ร้านเต็มจอ (Leaflet + OpenFreeMap) | `/map` | `catalog` | — | กฎธุรกิจ |
| `login` | redirect `/login` → `/` แล้วเปิด modal เข้าสู่ระบบ (`ui/components/authModal.tsx`) | `/login` | Supabase Auth | — | 1A |
| `register` | สมัครสมาชิก | `/register` | Supabase Auth · `account` | — | 1A |
| `verifyEmail` | ยืนยันอีเมล | `/verify-email` | Supabase Auth | — | 1A |
| `oauthSignup` | สมัครด้วย Google / Facebook: ยืนยันอายุจากวันเกิดของบัญชี + ยอมรับ ToS/PDPA ก่อนสร้างบัญชี | `/signup/social` | `account` | — | 1A |
| `forgotPassword` | ขอลิงก์รีเซ็ตรหัสผ่าน (redirect → `/` + เปิด modal · ฟอร์มอยู่ `ui/components/authForgotForm.tsx`) | `/forgot-password` | Supabase Auth | — | 1A |
| `resetPassword` | ตั้งรหัสผ่านใหม่ | `/reset-password` | Supabase Auth | — | 1A |
| `acceptInvite` | รับคำเชิญเข้าทีมร้าน | `/accept-invite` | `bar-team` | — | 1B |
| `onboarding` | Age Gate / Consent / ความชอบ | `/onboarding` | `account` | — | 1A |
| `ranking` | จัดอันดับรายสัปดาห์/รายเดือนตามโหวต (GSAP) — ข้อมูลจริง `GET /public/ranking` (job ทุกคืน) | `/ranking` | `catalog` | `ranking` | 1A |
| `search` | ค้นหา / กรองร้าน (รวมกรอง PR · งบต่อหัว + จำนวนคนจาก `?budget=&people=` · กรองโซนที่จุได้ทั้งกลุ่ม) | `/search` | `catalog` · `mini-ads` | `styles` (ตัวกรองสไตล์) · `miniAds` | 1A |
| `barDetail` | หน้าร้าน: รูปปก + แกลเลอรี ข้อมูล Safety ความแน่น เมนู (มีรูป) ดีลวันนี้ · การเดินทาง (รถไฟฟ้าใกล้สุด · ที่จอดรถ · แผนที่) | `/bars/:slug` | `catalog` · `booking` · `pricing` | `bars` · `safety` · `barMedia` · `barLocations` | 1A |
| `barReviews` | รีวิวทั้งหมดของร้าน | `/bars/:slug/reviews` | `catalog` · `review` | `reviews` | 1A |
| `book` | จองโต๊ะ + เลือกโปร 1 อย่าง + Checkout (เบอร์ + ยอมรับเงื่อนไขมัดจำ) | `/bars/:slug/book` | `booking` · `pricing` | `bookings` | 1A |
| `bookings` | รายการจองของฉัน | `/bookings` | `booking` | `bookings` | 1A |
| `bookingDetail` | รายละเอียดการจอง + QR เช็กอิน | `/bookings/:id` | `booking` | `bookings` | 1A |
| `deposit` | ชำระ Table Fee: หน้าชำระเงินออนไลน์ (ตั้ง `PAYMENT_PROVIDER`) หรือโอน + แนบสลิป | `/bookings/:id/deposit` | `payment` · `deposit` · `storage` | `payments` · `deposits` | 1A |
| `payMock` | ระบบชำระเงินจำลอง: จ่ายสำเร็จ / ไม่สำเร็จ (เฉพาะ `PAYMENT_PROVIDER=mock`) | `/pay/mock/:intentId` | `payment` | `payments` | 1A (กฎธุรกิจ — ชำระผ่าน Payment Gateway · เครื่องมือ dev) |
| `share` | บัตรจองที่แชร์ให้แก๊ง | `/share/:token` | `booking` | — | 1A |
| `reviewNew` | เขียนรีวิว + แนบรูป/วิดีโอ ≤ 6 ไฟล์ | `/reviews/new` | `review` · `storage` | `reviews` | 1A |
| `myReviews` | รีวิวของฉัน | `/reviews` | `review` | `reviews` | 1A |
| `community` | ฟีดกระทู้ชุมชน: หมวด · ล่าสุด/ยอดนิยม/ยังไม่มีคำตอบ · ค้นหา · ปักหมุดส่วนตัว (ขึ้นบนสุดในฟีดของตัวเอง) · หมวด "ข่าวจากร้าน" + ป้าย "ทีมร้าน · <ร้าน>" · ร้านที่ถูกพูดถึงไม่นับกระทู้ที่ทีมร้านแท็กร้านตัวเอง | `/community` · `/community/c/:category` | `community` | `community` | นอก MVP — อนุมัติ 2026-10-10 |
| `communityThread` | อ่านกระทู้ + ความเห็น/ตอบกลับ (แนบรูป/วิดีโอ) · ถูกใจ · บันทึก · ปักหมุด · รายงาน · ร่างตอบบันทึกที่ backend · ป้าย "ทีม NightOut" / "ทีมร้าน · <ร้าน>" · ถูกใจของทีมร้านในกระทู้ร้านตัวเองไม่นับ | `/community/t/:id` | `community` · `storage` | `community` | นอก MVP — อนุมัติ 2026-10-10 |
| `communityCompose` | ตั้ง/แก้กระทู้ + รูป/วิดีโอ ≤ 6 + แท็กร้าน · ร่างบันทึกอัตโนมัติที่ backend (กู้ร่าง / เก็บหรือทิ้งร่างตอนออก) · ทีมร้านตั้งได้เฉพาะ "ข่าวจากร้าน" ของร้านตัวเอง ≤ 3/ร้าน/7 วัน (โควตาจาก `GET /me/community/team`) | `/community/new` · `/community/t/:id/edit` | `community` · `storage` | `community` | นอก MVP — อนุมัติ 2026-10-10 |
| `communityMe` | กระทู้ของฉัน · ที่บันทึกไว้ · ปักหมุด · ฉบับร่าง | `/community/me` | `community` | `community` | นอก MVP — อนุมัติ 2026-10-10 |
| `favorites` | ร้านโปรด | `/favorites` | `account` | — | 1A |
| `notifications` | แจ้งเตือน | `/notifications` | `account` | — | 1A |
| `profile` | โปรไฟล์ | `/profile` | `account` | `users` | 1A |
| `settings` | ตั้งค่าบัญชี / ลบบัญชี (PDPA) | `/settings` | `account` | `users` | 1A |
| `about` | เกี่ยวกับเรา / ติดต่อ + ทีมงาน NightOut | `/about` · `/contact` | `site-team` | `team` | นอก MVP — ยังไม่ระบุวันอนุมัติ |
| `static` | หน้าข้อความ terms / privacy / cookies | `/terms` · `/privacy` · `/cookies` | — | — | 1A (PDPA) |
| `notFound` | หน้า 404 | `*` | — | — | ระบบ |

## 2. apps/frontend — ร้าน (โฟลเดอร์ `merchant` → `src/modules/merchant/*`)

| โมดูล | ทำอะไร | route | โดเมน API | หน้าคู่ (admin) | Phase |
|---|---|---|---|---|---|
| `join` | สมัครลงร้าน 4 ขั้น: ข้อมูลร้าน → ตำแหน่งร้าน (ปักหมุด + ที่อยู่ ที่จอดรถ รถไฟฟ้าใกล้สุด · ตรวจพร้อมการอนุมัติร้าน) → เอกสาร → ส่งตรวจ | `/merchant/join` | `bar` | `merchants` | 1B |
| `status` | สถานะการสมัคร / รออนุมัติ | `/merchant/status` | `bar` | `merchants` | 1B |
| `dashboard` | ภาพรวมร้าน | `/merchant` | `bar` · `booking` | — | 1B |
| `tonight` | คืนนี้ + สแกน QR เช็กอินด้วยกล้อง (BarcodeDetector / jsQR) หรือพิมพ์รหัส → ขั้นยืนยันก่อนเช็กอิน (ไม่มียอดเงิน) + ความแน่น | `/merchant/tonight` | `booking` · `bar` | — | 1B |
| `floor` | ผังโต๊ะ: สถานะโต๊ะ ว่าง/จองแล้ว/กำลังใช้ + ไทม์ไลน์คืนนี้ + ลากย้ายโต๊ะ + ตั้งกำลังใช้/ว่าง (ทีมร้านทุกบทบาท · โพลทุก 10 วิ · ไม่มียอดเงิน) | `/merchant/floor` | `booking` | `tableBoard` | 1B |
| `bookings` | รายการ / ปฏิทินการจอง + ปุ่มรับ/ปฏิเสธ/เช็กอิน | `/merchant/bookings` | `booking` | `bookings` | 1B |
| `bookingDetail` | รายละเอียดการจอง + ย้ายโต๊ะ / ยืนยันคืนเงิน · ยกเลิก/คืนเงินต้องเลือกเหตุผล ("ร้านไม่มีโต๊ะให้ลูกค้า" = คืน Table Fee เต็ม + บันทึกประวัติร้าน) | `/merchant/bookings/:id` | `booking` · `deposit` | `bookings` | 1B |
| `deposits` | Table Fee ของร้าน / ยืนยันคืน (เจ้าของ/ผู้จัดการ) | `/merchant/deposits` | `deposit` | `deposits` | 1B |
| `store` | รูปร้าน (ปก + แกลเลอรี) ข้อมูลร้าน เวลาเปิด-ปิด สไตล์ ลิงก์ (ที่อยู่ดูอย่างเดียว → แก้ที่ `location`) | `/merchant/store` | `bar` · `storage` | `bars` · `barMedia` · `styles` | 1B |
| `location` | ปักหมุดร้าน + ที่อยู่ ที่จอดรถ รถไฟฟ้าใกล้สุด → ส่งแอดมินตรวจ (ร้านที่แสดงอยู่ · ระหว่างรอลูกค้าเห็นหมุดเดิม) · ยกเลิกคำขอ (ทีมร้านดูได้ · แก้: เจ้าของ/ผู้จัดการ) | `/merchant/location` | `bar` | `barLocations` · `merchants` | 1B |
| `menu` | เมนู ราคา และรูปเมนู | `/merchant/menu` | `bar` · `storage` | `barMedia` | 1B |
| `promotions` | โปรของร้าน (มี cutoff time) | `/merchant/promotions` | `bar` | `promotions` | 1B |
| `tables` | โซน / โต๊ะ | `/merchant/tables` | `bar` | — | 1B |
| `safety` | มาตรการ Safety + ผลลงพื้นที่ตรวจล่าสุด | `/merchant/safety` | `bar` | `safety` | 1B |
| `settings` | ตั้งค่าการจอง มัดจำ บัญชีรับเงิน จำนวน PR | `/merchant/settings` | `bar` | — | 1B |
| `promote` | ซื้อแพ็กเกจโปรโมทร้าน | `/merchant/promote` | `promotion` | `promotions` | 1B |
| `reviews` | รีวิวของร้าน | `/merchant/reviews` | `review` | `reviews` | 1B |
| `analytics` | สถิติร้าน + ยอดขายเฉลี่ย (ประมาณการ) | `/merchant/analytics` | `bar` · `booking` | — | 1B |
| `billing` | ค่าคอมของร้าน (route ปิดไว้ — โค้ดยังอยู่) | ~~`/merchant/billing`~~ | `billing` | `billing` | Phase 2 — ปิดไว้ 2026-10-13 |
| `staff` | ทีมร้าน: เชิญ / นำออก · QR พาพนักงานเข้า `/merchant/tonight` | `/merchant/staff` | `bar-team` | — | 1B |

## 3. apps/admin — Backoffice (`src/modules/*`)

| โมดูล | ทำอะไร | route | โดเมน API / view | หน้าคู่ (frontend) | Phase |
|---|---|---|---|---|---|
| `login` | เข้าสู่ระบบ + MFA | `/login` | Supabase Auth | — | 1C |
| `dashboard` | แดชบอร์ด | `/` | `backoffice` (`/admin/dashboard`) | — | 1C |
| `merchants` | ร้านรออนุมัติ + หมุดร้านใหม่ (ดู / ปักแทนร้าน · ยังไม่ปักหมุด = อนุมัติไม่ได้ · อนุมัติ = ตรวจหมุดไปพร้อมกัน) | `/merchants` | `bar` · `admin_bars` · `admin_bar_locations` | `merchant/join` · `merchant/status` | 1C |
| `bars` | จัดการร้าน / สวิตช์แสดง / ป้ายแนะนำ (ดูอย่างเดียว) · ป้าย Blacklist (ไม่มีสวิตช์) · แก้ข้อมูลร้าน + เมนู/ราคาแทนร้าน (Drawer `?edit=`) | `/bars` | `bar` · `admin_bars` · `admin_bar_blacklist` · `admin_bar_details` · `admin_styles` | `barDetail` · `merchant/store` | 1C |
| `barBlacklist` | ร้านไม่มีโต๊ะให้ลูกค้า (ประวัติอัตโนมัติ + บันทึกจากข้อร้องเรียน คืน Table Fee แทนร้าน) + Blacklist / ปลด | `/bar-blacklist` | `bar` · `admin_bar_blacklist` | `merchant/bookingDetail` | 1C |
| `barMedia` | รูปร้าน: ปก + แกลเลอรี + รูปเมนู ของทุกร้าน (ดู / ลบ / อัปโหลดแทนร้าน) | `/bar-media` | `bar` · `storage` · `admin_bar_media` | `merchant/store` · `merchant/menu` · `barDetail` | นอก MVP — อนุมัติ 2026-10-09 |
| `barLocations` | ตรวจตำแหน่งร้าน: คำขอรอตรวจ (อนุมัติ / ปรับหมุดแล้วอนุมัติ / ตีกลับพร้อมเหตุผล) · แก้หมุดแทนร้าน · ประวัติ | `/bar-locations` | `bar` · `admin_bar_locations` · `admin_bar_location_requests` | `merchant/location` · `merchant/join` · `barDetail` | 1C |
| `safety` | ยืนยัน Safety (จากหลักฐาน) + ลงพื้นที่ตรวจ (Inspector) + ประวัติการตรวจ | `/safety` | `bar` · `admin_safety_queue` · `admin_bar_safety` · `admin_safety_inspections` · `admin_bars` | `merchant/safety` · `barDetail` | 1C |
| `ranking` | ดาว / อันดับ — คะแนนรวม (รีวิว 50 · เช็กอิน 30 · Safety 20) · กรองประเภท/ย่าน · ปุ่มคำนวณใหม่ | `/ranking` | `catalog` · `admin_ranking` | `ranking` · `home` | 1C |
| `styles` | สไตล์ร้าน: เพิ่ม / เปลี่ยนชื่อ / ไอคอน / ซ่อน / เรียงลำดับ (ลบไม่ได้) | `/styles` | `catalog` · `admin_styles` · `admin_home_categories` | `merchant/store` · `search` · `onboarding` | 1C |
| `promotions` | ตรวจถ้อยคำโปร + คำสั่งซื้อโปรโมท | `/promotions` | `promotion` · `admin_bar_promotions` · `admin_promoted_listings` | `merchant/promotions` · `merchant/promote` | 1C |
| `users` | ผู้ใช้ ชั้นบัญชี แบน / ปลดแบนเองพร้อมเหตุผล (แบนเบอร์ได้) | `/users` | `account` · `admin_users` | `profile` · `settings` | 1C |
| `team` | ทีมงาน NightOut หน้า /about | `/team` | `site-team` · `admin_team_members` | `about` | นอก MVP — ยังไม่ระบุวันอนุมัติ |
| `homeContent` | แก้ Hero / ชื่อ section / การ์ดหมวดของหน้าแรก | `/home-content` | `site-content` · `admin_home_content` · `admin_home_categories` | `home` | นอก MVP — ยังไม่ระบุวันอนุมัติ |
| `miniAds` | โฆษณาแบนเนอร์เล็ก (Native Mini-Ads): เพิ่ม/แก้/ลบ · ยืนยันไม่ใช่แบรนด์แอลกอฮอล์ (+ เตือนคำแอลกอฮอล์) · ยอดเห็น/คลิก | `/mini-ads` | `mini-ads` · `admin_mini_ads` | `home` · `search` | 1C — ย้ายเข้า Phase 1 (2026-10-11) · หลังบ้านตัดสิน 2026-10-13 |
| `bookings` | ติดตามการจอง | `/bookings` | `backoffice` · `admin_bookings` | `bookings` · `merchant/bookings` | 1C |
| `tableBoard` | ผังโต๊ะร้าน (ดูอย่างเดียว): เลือกร้าน → ผังโต๊ะ / ไทม์ไลน์คืนนี้ ข้อมูลชุดเดียวกับหน้าร้าน · โพลทุก 10 วิ | `/table-board` | `booking` (`GET admin/bars/:barId/table-board`) · `admin_bars` | `merchant/floor` | 1C — เจ้าของอนุมัติ 2026-10-13 |
| `deposits` | ตรวจสลิป / ปฏิเสธพร้อมเหตุผล / รอคืนลูกค้า · ช่องทาง สลิป / ออนไลน์ | `/deposits` | `deposit` | `deposit` · `merchant/deposits` | 1C |
| `payments` | การชำระเงินออนไลน์: โหมดที่เปิด · ต้องคืนเงิน / ชำระแล้ว / รอชำระ / ไม่สำเร็จ / จับคู่ไม่ได้ · webhook ที่ได้รับ · บันทึกว่าคืนเงินแล้ว | `/payments` | `payment` · `admin_payment_intents` · `admin_payment_unmatched` | `deposit` · `payMock` | 1C |
| `reviews` | รีวิวที่ถูกรายงาน | `/reviews` | `review` | `barReviews` · `reviewNew` | 1C |
| `community` | กระทู้/ความเห็นที่ถูกรายงาน (ดูรูป/วิดีโอที่แนบ) · ซ่อน / ลบ / แสดงอีกครั้ง · แท็บ "โพสต์ทีมร้าน" · ป้ายทีมร้าน + ถูกใจที่ไม่นับ · ซ่อน/ลบต้องเลือกเหตุผล (`components/moderateModal.tsx`) | `/community` | `community` · `admin_community_threads` · `admin_community_comments` | `community` · `communityThread` | นอก MVP — อนุมัติ 2026-10-10 |
| `billing` | ค่าคอม (Billing Events · view เฉพาะ Super Admin · route ปิดไว้ — โค้ดยังอยู่) | ~~`/billing`~~ | `backoffice` · `admin_billing_events` | `merchant/billing` | Phase 2 — ปิดไว้ 2026-10-13 |
| `auditLogs` | Audit Log (แอดมินไม่เห็นงานของ Super Admin) | `/audit-logs` | `backoffice` · `admin_audit_logs` | — | 1C |
| `settings` | ดูค่าระบบ สไตล์ร้าน มาตรการ Safety (อ่านอย่างเดียว · แก้ผ่าน migration/seed · สไตล์ร้านจัดการที่ `styles`) | `/settings` | `backoffice` (`/admin/master/:table`) | — | 1C |

## 4. apps/backend — โดเมน (`src/domains/*`)

| โดเมน | ทำอะไร | controller | Phase |
|---|---|---|---|
| `catalog` | ข้อมูลตั้งต้นของเว็บ (ร้าน รีวิว ย่าน สไตล์ ตั้งค่า แพ็กเกจ) · อันดับร้าน (`/public/ranking`) · Backoffice จัดการสไตล์ร้าน + คำนวณดาว/อันดับใหม่ | public · admin | 1A / 1C |
| `booking` | จอง ยกเลิก สถานะ เช็กอิน (+ ดูการจองก่อนยืนยันเช็กอิน) ย้ายโต๊ะ โซนว่าง บัตรแชร์ · ร้านแจ้งไม่มีโต๊ะให้ลูกค้า · ผังโต๊ะ (ร้าน + Backoffice ดูอย่างเดียว) | public · me · merchant · admin | 1A / 1B / 1C |
| `deposit` | ส่งสลิป ตรวจสลิป ปิดยอด คืนมัดจำ สมุดมัดจำ | me · merchant · admin | 1A / 1B / 1C |
| `payment` | ชำระ Table Fee ผ่านผู้ให้บริการ (ไม่ผูกเจ้าใด · adapter `providers/` mock = dev · beam = stub): ช่องทางที่เปิด หน้าชำระเงิน webhook คืนเงินทำมือ — ไม่ตั้ง `PAYMENT_PROVIDER` = flow สลิปเดิม (ADR 0010) | public · me · admin | 1A / 1C |
| `review` | เขียน รายงาน จัดการรีวิว | me · admin | 1A / 1C |
| `community` | ชุมชน: กระทู้ ความเห็น ไฟล์แนบ (bucket `community-media`) ถูกใจ บันทึก ปักหมุดส่วนตัว ฉบับร่าง รายงาน · แอดมินซ่อน/ลบ · กติกาทีมร้าน (ป้ายทีมร้าน snapshot · ข่าวจากร้าน ≤ 3/ร้าน/7 วัน · ถูกใจของทีมร้านในกระทู้ร้านตัวเองไม่นับ · `my_community_team`) | public · me · admin | นอก MVP — อนุมัติ 2026-10-10 |
| `bar` | สมัครลงร้าน ข้อมูลร้าน เมนู โปร ค่าธรรมเนียม โซน Safety ตั้งค่า บัญชีรับเงิน ความแน่น อนุมัติ · ตำแหน่งร้าน/ตรวจหมุด · ค้นหาที่อยู่ (Nominatim ผ่าน backend `GET /geocode/*`) · Blacklist ร้าน / ปลด + บันทึกร้านไม่มีโต๊ะจากข้อร้องเรียน (แอดมิน) | me · merchant · admin | 1B / 1C |
| `bar-team` | ทีมร้าน: เชิญ นำออก คำเชิญของฉัน | me · merchant | 1B |
| `account` | โปรไฟล์ overview แจ้งเตือน ร้านโปรด ลบบัญชี · ผู้ใช้ ชั้นบัญชี แบน / ปลดแบนเองพร้อมเหตุผล | me · admin | 1A / 1C |
| `promotion` | โปรโมทร้าน: ซื้อแพ็กเกจ ตรวจคำสั่งซื้อ | merchant · admin | 1B / 1C |
| `billing` | ค่าคอมของร้าน (เจ้าของ/ผู้จัดการ · หน้าปิดไว้จนถึง Phase 2) | merchant | Phase 2 |
| `pricing` | ประเมินราคา (ไม่แตะ DB) | public | 1A |
| `storage` | URL อัปโหลด / URL ชั่วคราว | storage (controller เดียว) | 1A / 1B |
| `backoffice` | การอ่านของหน้าแอดมิน: แดชบอร์ด view `admin_*` ตาราง master | admin | 1C |
| `site-team` | ทีมงาน NightOut หน้า /about (อ่านสาธารณะ + จัดการ) | public · admin | นอก MVP — ยังไม่ระบุวันอนุมัติ |
| `site-content` | เนื้อหาหน้าแรก: Hero ชื่อ section การ์ดหมวด (อ่านสาธารณะ + แก้) | public · admin | นอก MVP — ยังไม่ระบุวันอนุมัติ |
| `mini-ads` | โฆษณาแบนเนอร์เล็ก: อ่านที่กำลังแสดง · นับเห็น/คลิก · แอดมินจัดการ (bucket `site-media/ads/`) | public · admin | 1C — ย้ายเข้า Phase 1 (2026-10-11) · หลังบ้านตัดสิน 2026-10-13 |

**ระบบ (นอก `domains/`):** `health` (เช็กสถานะ) · `jobs` (`/jobs/*` เรียกจาก pg_cron: auto-cancel / no-show, หมดเวลา pending, notification outbox, คำนวณดาว `/jobs/tier` ทุกคืน 00:05, เปิด/ปิดโปรโมท)

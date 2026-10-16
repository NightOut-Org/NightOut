# CHANGELOG — frontend/modules/profile

## 2026-10-17 — กดรูปโปรไฟล์ดูรูปเต็ม · ครอปรูปก่อนอัปโหลด
- กดรูปโปรไฟล์ที่หัวหน้า = เปิดดูรูปเต็ม (antd `Image` preview · ดูอย่างเดียว: ไม่มีแถบพลิก/หมุน/ซูม `actionsRender: () => null` · ลาก/ซูมไม่ได้) · ยังไม่มีรูป (ตัวย่อชื่อ) = กดไม่ได้ (`components/profileHeader.tsx`) · ซ่อนรูปเล็กของ `Image` ด้วย `style.display` เพราะ antd ส่ง `rootClassName` ต่อให้หน้าต่าง preview (ใช้ `!hidden` แล้วกดดูรูปไม่ขึ้น)
- เลือกรูปใหม่แล้วเปิดหน้าต่างครอปก่อนอัปโหลด: ลากเลื่อน (เมาส์/นิ้ว) · ซูม 1–4 เท่าด้วยแถบเลื่อน/ล้อเมาส์ · แป้นพิมพ์ ลูกศร = เลื่อน + / - = ซูม · กรอบวงกลมแสดงส่วนที่จะเป็นรูปโปรไฟล์ · กด "ใช้รูปนี้" แล้วค่อยย่อเป็น 400×400 และอัปโหลดเหมือนเดิม — เขียนเอง ไม่เพิ่มไลบรารี (`components/avatarCropModal.tsx` ใหม่)
- `utils/resizeAvatar.ts`: `resizeAvatar(file, crop?)` รับส่วนที่ครอป (`AvatarCrop` พิกัดพิกเซลของรูปต้นฉบับ) · ไม่ส่ง = จัตุรัสกลางรูปเหมือนเดิม · ตัวอย่างระหว่างอัปโหลดใช้รูปที่ครอปแล้ว

## 2026-10-17 — การ์ด "ชื่อที่แสดง" มืดลง เป็นกระจกหยดน้ำ
- ลดความสว่าง: พื้นม่วงโปร่งเข้มขึ้น · ขอบ/แสงเรืองรอบการ์ดจางลง · `backdrop-filter` เพิ่ม `brightness(0.85)` และเบลอหนาขึ้น (24px)
- ลุคกระจกหยดน้ำ: ขอบสะท้อนแสงด้านบน + แสงหักเหขอบล่าง (inset shadow) + ประกายโค้งมุมซ้ายบน/แสงม่วงจางมุมขวาล่าง (`::before`) · มุมโค้งขึ้นเป็น 1.25rem · ธีมสว่างปรับตาม · ไม่มี motion (`components/preferencesView.css`)

## 2026-10-17 — เอา footer ออกจากหน้า /profile
- หน้าโปรไฟล์ไม่แสดง `SiteFooter` แล้ว: ใส่ `hideFooter: true` ใน handle ของ route `profile` (`router/index.tsx`) · แถบเมนูล่างมือถือยังอยู่เหมือนเดิม

## 2026-10-17 — สีของชั้นบัญชีมาจาก API (นอก MVP — อนุมัติ 2026-10-17)
- สีของชั้นบัญชีเลิกตายตัวในโค้ด: อ่านจาก `GET /me/roles` ผ่าน `hooks/useRoles` (cache localStorage `nightout-roles` · โหลดไม่ได้ = `ROLE_DEFAULT_COLORS`) แล้วแปลงเป็นชุดสีด้วย `roleTone()` (สีหลัก · ตัวหนังสือที่เข้มขึ้นในธีมสว่างผ่าน `--role-ink` · ตัวหนังสือบนป้ายทึบดำ/ขาวตามความสว่าง · พื้นจาง)
- ใช้ทุกที่: แสงเรืองพื้นหลังหน้า (`page.tsx`) · วงรอบรูป + ป้ายใต้ชื่อ (`components/profileHeader.tsx`) · รายการชั้นบัญชี ชื่อชั้นอื่นมาจาก API ด้วย (`components/roleList.tsx`) · ปุ่ม/เมนูบัญชีบน navbar (`ui/components/accountMenu.tsx`)
- ของกลาง: `configs/roles.ts` (เอา `color` / `rgb` / `roleTint` ออก · เพิ่ม `ROLE_DEFAULT_COLORS` · `roleTone`) · `hooks/useRoles.ts` · `services/api/roles.ts` (ใหม่) · `styles/index.css` (`--role-staff` → `--role-ink`)

## 2026-10-17 — การ์ดชื่อเป็นกระจกม่วง · สไตล์ร้านเป็นการ์ดพื้นเข้ม
- การ์ด "ชื่อที่แสดง" เป็น glassmorphism ม่วง (ไล่สีโปร่ง + ขอบเรืองแสง + blur · ไม่มีจุดแสง/เส้นเฉียง) ปุ่ม "แก้ไขข้อมูล" พื้นโปร่งเข้ากับกระจก · ธีมมืดเป็นค่าตั้งต้น ธีมสว่างใช้ `.light`
- กล่อง "สไตล์ร้านที่ชอบ" ใช้การ์ดแบบเดียวกับกล่องอื่น (`bg-card` + `border-border`) หัวข้อสีเทา ชิปขอบเทาแบบเดียวกับชิปย่าน
- ไฟล์: `components/preferencesView.tsx` · `components/preferencesView.css` (ใหม่)

## 2026-10-17 — แท็บ "ข้อมูลและความชอบ" เป็น Bento (ดีไซน์ 3c)
- โหมดดูเปลี่ยนจากการ์ดใบเดียวเป็นกล่อง Bento: ชื่อ (กว้าง 3 + ปุ่ม "แก้ไขข้อมูล") · งบต่อหัวเป็นการ์ดทองสูง 2 แถว (ไม่มีงบ = "—" + "ตั้งงบ") · สไตล์ร้านที่ชอบเป็นกล่องม่วง ชิปมีไอคอนของสไตล์ · จำนวนคน · ย่านเต็มแถว · มือถือ 2 คอลัมน์ · ค่าว่าง = "ยังไม่ได้ระบุ" + "เพิ่ม" · ไล่ขึ้นทีละกล่อง 40ms (ลดการเคลื่อนไหว = จางอย่างเดียว)
- โหมดแก้ = การ์ดฟอร์มใบเดียว หัว "แก้ไขข้อมูลและความชอบ" + "ยกเลิก" (ฟอร์มเดิม · useUnsavedGuard เดิม)
- ไอคอนสไตล์ใช้ค่าที่แอดมินตั้งที่ Backoffice /styles (`utils/styleIcon.tsx` · ไม่รู้จัก = Sparkle)
- ลบ `components/preferencesCard.css` (การ์ดเดิม) · ไฟล์: `components/preferencesView.tsx` · `components/preferencesCard.tsx` · `utils/styleIcon.tsx` · `services/sync.ts` (`StyleOpt.icon`)

## 2026-10-16 — ปุ่มบัญชียังล้น 1–2 เฟรมตอน navbar หด
- ดูจากวิดีโอทีละเฟรม: navbar หดแล้ว (เฟรม 1.238s) แต่ chip ยังเต็มอยู่ 1–2 เฟรมก่อนย่อ (1.272s) — เพราะเดิมตัดสินใจย่อใน callback ของ ResizeObserver แล้ว React render ทีหลัง browser paint
- แก้ `hooks/useCompactOnOverflow.ts`: รับ `layoutKey` (navbar ส่ง `scrolled`) → ตรวจใน `useLayoutEffect` ของ commit เดียวกับที่ navbar หด = ย่อก่อน paint · ทาง ResizeObserver (ย่อหน้าต่าง/ฟอนต์โหลด) ใช้ `flushSync` ให้ย่อก่อน paint เช่นกัน
- ไฟล์: `hooks/useCompactOnOverflow.ts` · `ui/components/navbar.tsx`

## 2026-10-16 — ปุ่มบัญชีบน navbar ล้นตอนเลื่อนแล้ว island หด
- สาเหตุ: เลื่อนแล้ว island หดเหลือ `max-w-3xl` (766px) แต่โลโก้ + เมนู 6 อัน + ธีม + กระดิ่ง + chip เต็ม ต้องการ ~887px → chip ล้นขอบขวา (วัดจริงในเบราว์เซอร์ที่ 1280px · ยังไม่เลื่อน 894px พอดี)
- แก้: hook ใหม่ `hooks/useCompactOnOverflow.ts` วัด scrollWidth/clientWidth ของ island (ResizeObserver บน island + ลูก) → ไม่พอ = chip เหลือรูป + จุดไอคอนชั้นบัญชี (แบบมือถือ) · จำความกว้างแบบเต็มไว้ กลับเป็นแบบเต็มเมื่อกว้างพอเท่านั้น (ไม่สลับไปมา) · วัดใหม่เมื่อชื่อเมนู/ชื่อผู้ใช้/ชื่อชั้นเปลี่ยน · วัดจาก layout ไม่ใช่ getBoundingClientRect (ไม่เพี้ยนตอน motion layout animation)
- ครอบคลุมเคสอื่นด้วย: จอกว้างปานกลาง (768–1000px) ที่ยังไม่เลื่อน · ชื่อเมนูที่แอดมินตั้งยาวที่ `/home-content` · ชื่อผู้ใช้ยาว · บัญชีร้านที่เห็น "ร้านของฉัน" · หน้า Auth (`minimal` ไม่มี chip — ไม่กระทบ) · มือถือ (< md) เหมือนเดิม
- ไฟล์: `hooks/useCompactOnOverflow.ts` (ใหม่) · `ui/components/navbar.tsx` · `ui/components/accountMenu.tsx` (prop `compact`)

## 2026-10-16 — แก้แถบเลื่อนเล็ก ▲○▼ ที่แถวแท็บ + ระยะกระดิ่งกับปุ่มบัญชี
- แถวแท็บ `overflow-x-auto` + ปุ่มแท็บ `-mb-px` ล้นแนวตั้ง 1px → Windows โชว์ scrollbar แนวตั้งจิ๋ว · ตอนนี้ `overflow-y-hidden` + ซ่อน scrollbar (ยังปัดแท็บแนวนอนได้บนจอแคบ) · เส้นใต้แถววาดด้วย inset shadow แทน border เส้นทองของแท็บที่เลือกจึงไม่ถูกตัด
- navbar: ปุ่มบัญชีเว้นจากกระดิ่ง `ml-3` (เดิม `ml-1`) ตัวเลขแจ้งเตือนจึงไม่ทับ chip — `ui/components/accountMenu.tsx`
- ไฟล์: `page.tsx` · `ui/components/accountMenu.tsx`

## 2026-10-16 — หน้าโปรไฟล์ใหม่ตามดีไซน์ 2a + รูปโปรไฟล์ (นอก MVP — อนุมัติ 2026-10-16)
- หัวโปรไฟล์: รูปใหญ่ 136px ขอบสีชั้นบัญชี + ปุ่ม "แก้ไขรูป" (อัปโหลดรูปใหม่ / ลบรูป — ถามยืนยันก่อน) · ชื่อ Playfair · ป้ายชั้นบัญชีทึบ + ขอบเขต (ร้าน · บทบาท / ทีม NightOut) · แสงเรืองสีชั้นบัญชีหลังหัว (พื้น Molten เดิมยังอยู่)
- รูป: ตรวจชนิด JPG/PNG/WebP + ≤ 5MB → ครอปกลางย่อ 400×400 WebP (canvas) → โชว์รูปตัวอย่างทันที + spinner → อัปโหลด bucket `avatars` → `PUT /me/avatar` → `reload()` (navbar อัปเดต) · พลาด = กลับรูปเดิม + แจ้งเหตุผล · เปลี่ยนรูป cross-fade 0.25s (เคารพ reduced motion)
- แท็บ sync กับ `?tab=`: ข้อมูลและความชอบ (ค่าเริ่มต้น) · บัญชีและสิทธิ์ · ช่องทางแจ้งเตือน (การ์ด LINE เดิม ข้อความเดิม)
- "ข้อมูลและความชอบ": การ์ดพื้นทองหรู โหมดดู (ชื่อ · งบต่อหัว · ไปกันปกติ · ย่าน · สไตล์ · ค่าว่าง = "ยังไม่ได้ระบุ เพิ่ม") ↔ โหมดแก้ (ฟอร์มเดิม) · บันทึก = กลับโหมดดู · มีการแก้ค้าง = กันออกจากหน้า (`useUnsavedGuard`) · โหมดสว่างลดความเข้มทองลง
- "บัญชีและสิทธิ์": แสดงเฉพาะชั้นของตัวเอง (ไฮไลต์ + เครื่องหมายถูก) และชั้นที่ต่ำกว่า · ไม่โชว์ชั้นที่สูงกว่า
- เอาออก: PageHeader "โปรไฟล์" · การ์ดหัวเดิม (อีเมล + ปุ่มไปหน้าร้าน — ปุ่มลัดย้ายไปเมนูบัญชีบน navbar) · ConfigProvider การ์ดโปร่ง · มือถือมีปุ่มออกจากระบบเต็มกว้างท้ายหน้า
- ไฟล์: `page.tsx` · `api.ts` (`setAvatar` · `removeAvatar`) · `components/{profileHeader,preferencesCard,preferencesView,preferencesForm,roleList}.tsx` · `components/preferencesCard.css` · `utils/resizeAvatar.ts` · ของกลาง: `configs/roles.ts` · `ui/components/{accountMenu,userAvatar}.tsx` · `ui/components/navbar.tsx` (ปุ่มบัญชีแบบ chip) · `services/auth.tsx` (`avatarUrl`) · `services/api/storage.ts` (`uploadAvatar`) · `styles/index.css` (`--role-staff`)
- endpoint: `PUT /me/avatar` · `DELETE /me/avatar` · migration `20261016000100_account_avatar`

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

# home — ประวัติการแก้ไข

## 2026-10-17 — ค้นหาจาก "ตำแหน่งปัจจุบัน" ได้จริง
- เดิมตัวเลือก "ตำแหน่งปัจจุบัน" ใน Hero แค่ไม่กรองย่าน → ตอนนี้ส่ง `sort=distance` ไปหน้า /search ให้เรียงร้านใกล้ผู้ใช้ก่อน (ไฟล์: `components/hero.tsx`)

## 2026-10-16 — แผงแนะนำ Hero ค้นร้านจากทุกร้าน
- เดิมพิมพ์ชื่อร้านแล้วแผงไม่เจอ (เช่น "Somsage Bar") เพราะกรองแค่ร้านยอดนิยม 4 ร้านแรก ทั้งที่หน้า `/search` เจอ
- พิมพ์แล้ว: กลุ่ม "ร้านยอดนิยม" เปลี่ยนเป็น "ร้าน" ค้นจากทุกร้านใน catalog ด้วย `listBars({ q })` ตัวเดียวกับ `/search` (แผงแสดงร้านที่ชื่อ/ย่านตรงคำค้น) สูงสุด 6 ร้าน → หน้าร้าน · ยังไม่พิมพ์ = แผงเหมือนเดิม
- ไฟล์: `components/heroSuggest.tsx`

## 2026-10-16 — แผงแนะนำตัวกรองใต้ช่องค้นหา Hero
- ช่องพิมพ์ค้นหาใน Hero มีแผงแนะนำ (ดีไซน์ 2a "Home Search Variations"): hover ค้าง 150ms / focus / แตะ = เปิด · เมาส์ออกจากช่องและแผง 250ms = ปิด (ยกเว้นช่องยัง focus → ปิดเมื่อ blur / Esc) · พิมพ์ = กรองตามชื่อ/คำโปรย · ไม่เหลือรายการ = บอกให้กด "ค้นหา"
- 3 กลุ่ม: **ประเภทร้าน** และ **สไตล์** มาจากการ์ดหมวดหน้าแรกตัวเดียวกับ `categoryGrid` (การ์ดที่ลิงก์ `?category=` / `?style=` · ชื่อ คำโปรย ลิงก์ตาม DB ไม่ hardcode — ยังไม่มีร้านเงียบ/ห้องส่วนตัวเพราะไม่มีการ์ด) · **ร้านยอดนิยม** 4 ร้านแรกจาก `utils/popularBars.ts` (คำโปรย = ย่าน) → หน้าร้าน
- เลือกประเภท/สไตล์ = ลิงก์ของการ์ด + ย่าน/งบ/คนที่เลือกไว้ (`budgetSearchQuery`) · ↑/↓ เลื่อน · Enter เลือก (ไม่มี highlight = submit ฟอร์มเดิม) · a11y combobox/listbox · แผงอยู่ใน portal (Hero เป็น `overflow-hidden`) · Motion fade + y 4px 150ms เคารพ `prefers-reduced-motion`
- ไม่แตะ dropdown ย่าน/งบ/คน และ URL ที่ submit ฟอร์มส่งไปเหมือนเดิม
- ไฟล์: `components/heroSuggest.tsx` (ใหม่) · `utils/useHoverIntent.ts` (ใหม่) · `components/hero.tsx` · `page.tsx`

## 2026-10-16 — การ์ดฟีลเป็นวงกลมแบบ Story
- การ์ด 'คืนนี้อยากได้ฟีลไหน' เปลี่ยนจาก bento เป็นวงกลมแบบ Story 8 ช่องเท่ากัน · ร้านยอดนิยมขอบทอง · มือถือเลื่อนแนวนอน · ไฟล์: `components/categoryGrid.tsx`

## 2026-10-13 — ป้ายดีลวันนี้
- การ์ดร้านยอดนิยมแสดงป้าย "ดีลวันนี้" เมื่อร้านมีโปรที่ใช้ได้วันนี้ · ไฟล์: `components/popularGrid.tsx`

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- ช่องโฆษณาแบนเนอร์เล็ก 1 ชิ้น ใต้ "ร้านยอดนิยม" ก่อนข่าวสาร (ป้าย "โฆษณา" · กด × ซ่อน 24 ชม.) — ไม่มีโฆษณา/โหลดไม่ได้ = ไม่แสดง · ไม่กระทบร้านยอดนิยม/อันดับ
- คอมโพเนนต์กลาง `ui/components/miniAdSlot.tsx` (`GET /public/mini-ads` · นับเห็นเมื่อโผล่ ≥ 50% ครั้งเดียวต่อการเปิดเว็บ · นับคลิก) · `services/sync.ts` เพิ่ม `/public/mini-ads/` ใน `NO_REFRESH` (นับแล้วไม่โหลด store ใหม่)
- ไฟล์: `page.tsx` · `ui/components/miniAdSlot.tsx` · `services/sync.ts`

## 2026-10-13 — อันดับประจำสัปดาห์จากข้อมูลจริง
- `api.ts` + `useWeeklyTop3()` → `GET /public/ranking` (`period=WEEKLY`, `limit=3` · ประกาศซ้ำตาม ADR 0007) · `page.tsx` ใช้ `toRankedBars()` (`ui/utils/ranking.ts`) แทน mock `rankingByPeriod('WEEK')` · ยังไม่มีข้อมูล = ไม่แสดงส่วนนี้
- ไฟล์: `api.ts`, `page.tsx`

## 2026-10-13 — Hero ค้นหาตามงบ
- ช่องค้นหาใน Hero เพิ่มปุ่มเลือก **งบต่อหัว** (ไม่จำกัด / ไม่เกิน ฿200 … ฿1,500 ต่อคน) และ **จำนวนคน** (1–12) ข้างย่าน → `/search?q=&district=&budget=&people=` (`budgetSearchQuery` จาก `@nightout/utils`) · เลือกทั้งงบและคนแล้วบอกงบรวมของกลุ่ม เช่น "8 คน · ไม่เกินคนละ ฿400 · รวมประมาณ ฿3,200" (requirement "ค้นหาตามงบ")
- มือถือ: แถวล่าง 3 ช่อง (ย่าน · งบ · คน) ปุ่มสูง ≥ 44px · เมนูยาวเลื่อนในตัว · ไม่เลือกอะไร = ทำงานเหมือนเดิม
- ไฟล์: `components/hero.tsx`

## 2026-10-12 — พื้นหลังใต้ Hero เป็น Golden Embers (แทน AuroraBackdrop)
- ลบ `components/auroraBackdrop.tsx` + `.css` (ม่านแสงนิ่ง) → ใช้ `<EmbersBackdrop />` ตัวกลาง (`ui/components/embersBackdrop.tsx`) แบบเดียวกับหน้าร้าน: canvas แสงม่วง/ทอง + ประกายทองลอยขึ้น หลบเมาส์ · ธีมมืดเท่านั้น
- Hero ทึบ: เพิ่มแถบไล่ `#07070d` สูง 160px ที่ขอบล่าง (ธีมมืด) · `<EmbersBackdrop />` อยู่ชั้นล่างสุดของหน้า (`layouts/main.tsx` ให้ Layout หน้าแรกเป็น `isolate`) Hero บังไว้ แสงไม่ล้นเข้า Hero · แถบไล่ `#07070d → ใส` 280px เริ่มที่ขอบล่าง Hero ให้แสงค่อย ๆ โผล่ ไม่มีรอยตัด
- ฟุตเตอร์ (`ui/components/siteFooter.tsx`) ธีมมืด: ภาพเมืองไล่จากใส (mask 0 → 55%) แทนแถบไล่สีพื้นทึบ — เห็นประกายทอง/แสงม่วงต่อลงมาหลังการ์ดฟุตเตอร์ตามดีไซน์ · ธีมสว่างเหมือนเดิม
- ย้าย `utils/prefersLightweight.ts` → `ui/utils/prefersLightweight.ts` (ใช้ร่วมกับพื้นหลังตัวกลาง) · แก้ import ใน `skyBackdrop.tsx` `weeklySpotlight.tsx`
- ไฟล์หลัก: `page.tsx` · `components/hero.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `prefetchSiteHome` · `useSiteHome` (`GET /public/home`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)

## 2026-10-08 — ตัดป้าย "ทีมงานเลือก"
- การ์ดกริดร้านยอดนิยมไม่มีป้าย "ทีมงานเลือก" (Editor's Pick) แล้ว เหลือ "แนะนำ" (โฆษณา) และ "ร้านใหม่"
- ไฟล์: `components/popularGrid.tsx`

## 2026-10-08 — ร้านยอดนิยมตามที่แอดมินปัก
- กริด "ร้านยอดนิยม" ใช้ร้านที่แอดมินปักไว้ก่อน (`popular_bar_ids` จาก `GET /public/home`) แล้วเติมช่องที่เหลือด้วยร้านคะแนนรีวิวสูงสุดที่ไม่ซ้ำจนครบ 8 (`utils/popularBars.ts`)
- หัวข้อ/บรรทัดเล็กของ section มาจาก API (ระหว่างรอใช้ข้อความเดิม เพราะ section อยู่พ้นจอแรก)
- cache หน้าแรกใน localStorage ขึ้นเป็น `nightout-site-home:v2` (รูปแบบข้อมูลเปลี่ยน)
- ไฟล์: `page.tsx`, `components/popularGrid.tsx`, `utils/useHomeContent.ts`, `utils/popularBars.ts` (ใหม่), `services/queries/site-content.ts`

## 2026-10-08 — เลิกใช้ค่าตั้งต้นของ Hero/การ์ดหมวด ใช้ skeleton แทน
- เนื้อหา Hero + การ์ด "คืนนี้อยากได้ฟีลไหน" มาจาก `GET /public/home` อย่างเดียว ไม่มีค่าตั้งต้นในหน้าเว็บแล้ว (ลบ `utils/categories.ts`) — กันเห็นข้อความตั้งต้นแวบก่อนเปลี่ยนเป็นของที่แอดมินแก้
- ระหว่างรอ: Hero แสดงพื้นสีกลางคืน + skeleton แทนหัวข้อ (ช่องค้นหาใช้ได้เลย) · กริดหมวดแสดง skeleton ตามช่อง bento เดิม
- โหลดไม่สำเร็จ (หลัง TanStack ลองซ้ำครบ): Hero แสดงข้อความ + ปุ่ม "ลองใหม่" และซ่อนกริดหมวด · เอาการรอภาพ Hero 1.5 วิออก (ภาพโหลดเมื่อรู้เนื้อหาแล้วเท่านั้น)
- ไฟล์: `utils/useHomeContent.ts`, `components/hero.tsx`, `components/categoryGrid.tsx`, `page.tsx`, `type/category.ts`

## 2026-10-08 — เอาไอคอนมุมซ้ายบนของการ์ดหมวดออก
- การ์ด "คืนนี้อยากได้ฟีลไหน" ไม่แสดงไอคอนหมวดมุมซ้ายบนแล้ว ให้เห็นภาพเต็มขึ้น · เนื้อหาการ์ดชิดล่างด้วย `justify-end`
- ตัด `icon` ออกจาก `HomeCategory` และไม่แปลง `homeCategoryIcon()` ใน `useHomeContent` อีก · ค่าตั้งต้นใน `utils/categories.ts` ไม่มี `icon` แล้ว (ลบคอลัมน์ใน DB ด้วย — migration `20261008000100_site_content_drop_category_icon`)
- ไฟล์: `components/categoryGrid.tsx`, `type/category.ts`, `utils/useHomeContent.ts`, `utils/categories.ts`

## 2026-10-07 — กันภาพ Hero โหลดซ้ำ + cache เนื้อหาหน้าแรกผิดรูป
- เปิดเว็บครั้งแรก (ยังไม่มี cache) ไม่โหลดภาพ Hero ตั้งต้นทิ้งก่อนรู้ว่าแอดมินตั้งภาพไว้ไหม: ระหว่างรอแสดงพื้นสีกลางคืน รอไม่เกิน 1.5 วิ และเลิกรอทันทีถ้า API ล้ม (ใช้ภาพตั้งต้น)
- ยิง `GET /public/home` ตั้งแต่ boot คู่กับ catalog (`prefetchSiteHome()` ใน `main.tsx`) ให้ render แรกได้ข้อมูลเร็วขึ้น
- cache ในเครื่องเปลี่ยนเป็น `nightout-site-home:v1` + ตรวจรูปแบบก่อนใช้ (ผิดรูป = ทิ้ง · ลบ key เก่า) และอ่าน localStorage ครั้งเดียว — กันหน้าแรกพังเมื่อสัญญา `PublicHomeResult` เปลี่ยน
- ไฟล์: `utils/useHomeContent.ts`, `components/hero.tsx`, `components/skyBackdrop.tsx`, `page.tsx`, `services/queries/site-content.ts`, `main.tsx`

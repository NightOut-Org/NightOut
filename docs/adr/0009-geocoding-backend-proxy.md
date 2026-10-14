# ADR 0009: ค้นหาที่อยู่ (geocoding) ผ่าน backend เป็นตัวกลางไป OpenStreetMap Nominatim

- **สถานะ:** Accepted
- **วันที่:** 2026-10-13

## Context
ร้านต้องปักหมุดตำแหน่งร้านเองที่ `/merchant/location` และตอนสมัคร `/merchant/join` ส่วนแอดมินต้องตรวจและแก้หมุดแทนร้านใน Backoffice `/bar-locations` · `/merchants` (เจ้าของตัดสิน 2026-10-13) การลากหมุดอย่างเดียวช่วยได้ไม่พอ ผู้ใช้ต้องค้นชื่อสถานที่ ถนน หรือซอยเพื่อพาแผนที่ไปถึงจุดนั้น และต้องแปลงหมุดเป็นที่อยู่เพื่อเติมช่องที่อยู่ให้ได้

ข้อจำกัดของเรื่องนี้มี 3 ข้อ
- ไม่อยากใช้บริการที่ต้องจ่ายเงินหรือต้องมี key (Google Maps API ไม่ใช้อยู่แล้วตามกฎแผนที่ใน `CLAUDE.md`)
- หน้าเว็บต้องไม่ส่งข้อมูลของผู้ใช้ไปบริการภายนอกเอง (สิ่งที่พิมพ์ค้นหาและพิกัดหมุด) และต้องไม่เรียก API ภายนอกตรง ตาม ADR 0002
- OSM Nominatim instance สาธารณะมีนโยบายการใช้งาน: เรียกได้ไม่เกิน 1 ครั้ง/วินาที ต้องระบุตัวตนแอปใน User-Agent ห้ามใช้ทำ autocomplete และควร cache ผลไว้

## Decision
NestJS เป็นตัวกลางเพียงทางเดียว ผ่าน `GET /geocode/search` และ `GET /geocode/reverse` ใน `apps/backend/src/domains/bar/bar.me.controller.ts` ที่เรียก `GeocodeService` (`geocode.service.ts`) ทั้งสองเส้นต้องล็อกอิน (`SupabaseJwtGuard`)

- **เฉพาะไทย:** ส่ง `countrycodes=th` กับ `viewbox` ที่เป็นกรอบประเทศไทยพร้อม `bounded=1` และตัดผลที่อยู่นอก `THAILAND_BOUNDS` (`@nightout/utils`) ทิ้งอีกชั้น ส่วน reverse รับเฉพาะพิกัดที่อยู่ในไทย
- **ตามนโยบาย Nominatim:**
  - ส่ง `User-Agent` จาก `GEOCODER_USER_AGENT` และส่ง `email=` เมื่อตั้ง `GEOCODER_EMAIL`
  - เรียกทีละครั้งและเว้นห่างกันอย่างน้อย `GEOCODER_MIN_INTERVAL_MS` (ค่าเริ่มต้น 1100 ms)
  - คิวรอมีความยาวจำกัด ถ้าคิวยาวเกินประมาณ 5 วินาทีจะตอบ `GEOCODER_BUSY` ทันทีโดยไม่เข้าคิว
  - cache ผลในหน่วยความจำ 24 ชม. เก็บได้สูงสุด 500 รายการ (ผลที่มาจาก cache ไม่ต้องเข้าคิว)
- **ค้นหาเมื่อผู้ใช้กดเท่านั้น:** หน้าเว็บใช้ `Input.Search` ที่ค้นเมื่อกด Enter หรือปุ่ม "ค้นหา" ไม่มี autocomplete ไม่มี debounce และไม่ค้นระหว่างพิมพ์ ทั้งใน `apps/frontend` (`ui/components/locationPicker.tsx`) และ `apps/admin` (`ui/components/BarLocationEditor.tsx`)
- **จำกัดต่อผู้เรียก:** 30 ครั้ง/นาที/IP (`@Throttle`) แยกจาก throttler กลางของระบบ
- **error:** ต้นทางล่ม หมดเวลา 8 วินาที หรือตอบผิดรูป → 503 `GEOCODER_UNAVAILABLE` · ต้นทางตอบ 429 หรือคิวเต็ม → 503 `GEOCODER_BUSY` ทั้งสองกรณีใช้ 503 ไม่ใช้ 429 เพราะ `ApiExceptionFilter` แปลง 429 ทุกตัวเป็น `TOO_MANY_REQUESTS` (ADR 0008) · หน้าเว็บแสดงข้อความไทยและให้ลากหมุดหรือวางพิกัดเองแทนได้
- **เปลี่ยนผู้ให้บริการได้ด้วย env:** `GEOCODER_URL` (ค่าเริ่มต้น `https://nominatim.openstreetmap.org`) ชี้ไป instance ที่ self-host หรือผู้ให้บริการที่เสียเงินซึ่งใช้ API แบบ Nominatim ได้ โดยไม่ต้องแก้หน้าเว็บ
- URL ไปต้นทางสร้างด้วย `URL` + `searchParams` เท่านั้น ห้ามต่อสตริงคำค้นเข้าไปตรง ๆ

## Consequences
- **ได้:**
  - ไม่ต้องมี key และไม่มีค่าใช้จ่าย
  - หน้าเว็บไม่ส่งคำค้นหรือพิกัดไปบุคคลที่สามเอง และ backend คุมนโยบายการใช้งานได้ที่จุดเดียว
  - เปลี่ยนผู้ให้บริการได้ด้วย env ตัวเดียว
- **เสีย:**
  - instance สาธารณะมีข้อจำกัด: ช่วงที่คนใช้พร้อมกันเยอะจะเจอ `GEOCODER_BUSY` บ่อย และคุณภาพที่อยู่ภาษาไทยในบางพื้นที่ยังไม่ครบ ผู้ใช้จึงต้องตรวจเลขที่และซอยเอง
  - throttle กับ cache เป็นของแต่ละ instance ของ backend: ถ้ารันหลาย instance อัตราที่ยิงไปต้นทางจะคูณตามจำนวน instance และ cache ไม่แชร์กัน → **เมื่อ traffic โตหรือรันหลาย instance ให้เปลี่ยน `GEOCODER_URL` เป็น instance ที่ self-host หรือผู้ให้บริการที่เสียเงิน** (หรือย้าย throttle/cache ไปไว้ที่กลาง เช่น Redis)
  - ไม่มี autocomplete จึงต้องกดค้นหาเองทุกครั้ง ซึ่งเป็นสิ่งที่ตั้งใจไว้ตามนโยบาย Nominatim

---
name: sync-requirements
description: ดึง requirement ล่าสุดจาก Google Doc "Nightout_2.day" มาอัปเดต docs/REQUIREMENTS.md และกฎใน CLAUDE.md ให้ตรงกัน ใช้เองอัตโนมัติตอนต้น session และก่อนเริ่มงานแก้โค้ดทุกครั้ง (ไม่ต้องรอผู้ใช้สั่ง) หรือเมื่อผู้ใช้บอกว่าแก้เอกสาร requirement แล้ว
---

# Sync Requirements (Google Doc → repo)

แหล่งจริง: Google Doc `Nightout_2.day`
- id: `1GQ3ilsu_y_dzTulZS9_UEtNH7ygOLkaM-YkqdFm3UUI`
- ลิงก์: https://docs.google.com/document/d/1GQ3ilsu_y_dzTulZS9_UEtNH7ygOLkaM-YkqdFm3UUI/edit

ไฟล์ใน repo:
- `docs/requirements/nightout-2-day.md` — dump ทุกแท็บ สร้างด้วยสคริปต์ **ห้ามแก้มือ** (หัวไฟล์มี `revisionId`)
- `docs/REQUIREMENTS.md` — ฉบับเรียบเรียงที่ agent อ่าน (มีข้อ 0 "ข้อตัดสินของเจ้าของ" ที่ทับเอกสาร + สถานะเทียบโค้ด)

## ขั้นตอน

1. **ดึงเอกสาร** — เรียก Google Docs connector `read_doc` ด้วย id ข้างบน
   - ผลใหญ่เกิน → ระบบเซฟเป็นไฟล์ JSON ให้ ใช้ path นั้น (อย่าอ่านทั้งไฟล์เข้า context)
   - ไม่มี connector / เรียกไม่ได้ → บอกผู้ใช้ 1 บรรทัดว่า "ใช้ snapshot ใน repo (sync ล่าสุด <วันที่ในหัว REQUIREMENTS.md>)" แล้วทำงานที่สั่งต่อ ไม่ต้องหยุด
2. **เทียบเวอร์ชัน** — อ่าน `revisionId` จาก JSON (`content.revisionId`) เทียบกับบรรทัด `<!-- revisionId: … -->` ใน dump
   - ตรงกัน → จบ ไม่ต้องรายงานอะไร (หรือบอกสั้นๆ "requirement ล่าสุดแล้ว")
3. **เขียน dump ใหม่** — `node scripts/gdoc-to-md.mjs <json> docs/requirements/nightout-2-day.md` แล้ว `git diff --stat docs/requirements` + `git diff -U0 docs/requirements/nightout-2-day.md` ดูเฉพาะส่วนที่เปลี่ยน
4. **อัปเดต `docs/REQUIREMENTS.md`** ตาม diff
   - เรื่องที่มีอยู่แล้ว → **replace** ให้ตรงเอกสาร · ฟีเจอร์ใหม่ → **เพิ่ม** ใน Phase ที่ระบุ + ใส่สถานะโค้ด (✅/🔧/🆕/⛔) โดย grep โค้ด + `docs/SITEMAP.md` + `docs/STRUCTURE.md`
   - ข้อ 0 "ข้อตัดสินของเจ้าของ" ชนะเนื้อหาเอกสาร — ถ้าเอกสารใหม่เขียนขัดข้อ 0 ห้ามทับเอง ให้ลงตาราง ❓ แล้วถามผู้ใช้
   - ข้อที่เอกสารตอบ "ตัดสินแล้ว" → ย้ายออกจากตาราง ❓
   - อัปเดต revisionId + วันที่ sync ที่หัวไฟล์
5. **propagate** ไปไฟล์ที่ agent อ่าน ถ้ากระทบ:
   - `CLAUDE.md` หัวข้อ "กฎธุรกิจที่ตกลงแล้ว" (ข้อที่โค้ดยังไม่ทำ ติด `ยังไม่ทำในโค้ด`)
   - `docs/PROMPT.md` (ข้อที่ขัด) · `docs/PARTY_SET.md` · `README.md` หัวข้อ Roadmap
6. **รายงานผู้ใช้** (ภาษาไทย สั้น):
   - อะไรเปลี่ยนในเอกสาร (bullet)
   - กฎ/ฟีเจอร์ไหนขัดกับโค้ดตอนนี้
   - ข้อ ❓ ใหม่ที่ต้องตัดสิน (ใช้ `AskUserQuestion` ถ้าข้อนั้นกระทบงานที่กำลังจะทำ)
   - ร่างข้อความ commit: `docs: sync requirements (rev <8 ตัวแรกของ revisionId>)`
7. ถ้างานที่ผู้ใช้สั่งอยู่ ชนกับสิ่งที่เพิ่งเปลี่ยน → ถามก่อนลงมือ

## ข้อห้าม
- ห้าม `git commit` / `push` / `merge` (กฎ repo) — ร่างข้อความให้อย่างเดียว
- ห้ามแก้โค้ดในขั้นตอน sync — sync แค่เอกสาร งานโค้ดค่อยทำตามคำสั่งผู้ใช้
- ห้ามใช้เอกสาร Draft1 (`1Oa1drXS…`) — เลิกใช้แล้ว

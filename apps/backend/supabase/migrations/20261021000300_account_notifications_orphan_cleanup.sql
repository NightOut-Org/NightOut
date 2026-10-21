-- NightOut · ล้างแจ้งเตือนที่ค้างจากร้าน/การจองที่ถูกลบไปแล้ว
-- notifications.bar_id / booking_id เป็น FK `on delete set null` → ลบร้าน/การจอง (เช่น ร้านเดโม …20261020000100) แล้วแถวยังอยู่ในกระดิ่ง
-- พร้อมลิงก์ที่เปิดไม่ได้ · ลบเฉพาะแถวที่รู้แน่ว่าสิ่งที่ลิงก์ชี้ไม่มีแล้ว — แจ้งเตือนที่ไม่เคยผูกร้าน/การจอง (แบนบัญชี ชุมชน …) ไม่ถูกแตะ
-- รันครั้งเดียว · ต่อจากนี้ FK เป็น cascade แล้ว (…20261021000400) ลบร้าน/การจองแล้วแจ้งเตือนหายตาม

delete from public.notifications n
where
  -- แจ้งเตือนทีมร้าน: ทุกเส้นส่งผ่าน app_notify_team / app_notify พร้อม bar_id เสมอ → bar_id ว่าง = ร้านถูกลบ
  -- (หน้าเว็บซ่อนแถวนี้อยู่แล้ว — โหมดร้านกรองด้วย bar_id · โหมดลูกค้าไม่แสดงลิงก์ /merchant)
  (n.bar_id is null and (n.payload ->> 'link' = '/merchant' or n.payload ->> 'link' like '/merchant/%'))
  -- ลิงก์ไปการจองที่ไม่มีแล้ว: /bookings/<id>… · /merchant/bookings/<id> · /reviews/new?booking=<id>
  or (n.booking_id is null
      and substring(n.payload ->> 'link' from '(?:/bookings/|[?&]booking=)([0-9a-f-]{36})') is not null
      and not exists (select 1 from public.bookings b
                       where b.id::text = substring(n.payload ->> 'link' from '(?:/bookings/|[?&]booking=)([0-9a-f-]{36})')))
  -- ลิงก์แชร์ของการจองที่ไม่มีแล้ว (แจ้งเตือนเพื่อนที่กด "ไปด้วย")
  or (n.payload ->> 'link' like '/share/%'
      and not exists (select 1 from public.booking_shares s
                       where s.share_token = substring(n.payload ->> 'link' from '^/share/([^/?#]+)')))
  -- แจ้งเตือนแอดมินที่ลิงก์ไปร้านที่ไม่มีแล้ว: /bar-locations?bar=<id> · /bar-blacklist?bar=<id>
  or (n.bar_id is null
      and substring(n.payload ->> 'link' from '[?&]bar=([0-9a-f-]{36})') is not null
      and not exists (select 1 from public.bars b
                       where b.id::text = substring(n.payload ->> 'link' from '[?&]bar=([0-9a-f-]{36})')));

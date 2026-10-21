-- NightOut · แจ้งเตือนถูกลบตามเมื่อลบร้านหรือการจอง
-- เดิม FK notifications.bar_id / booking_id เป็น `on delete set null` → ลบร้าน/การจองแล้วแจ้งเตือนค้างในกระดิ่งพร้อมลิงก์ที่เปิดไม่ได้
-- (ต้องตามล้างเองแบบ …20261021000300) · เปลี่ยนเป็น `on delete cascade` · notification_deliveries หายตามอยู่แล้ว (cascade จาก notifications)

alter table public.notifications
  drop constraint notifications_bar_fk,
  add constraint notifications_bar_fk foreign key (bar_id) references public.bars(id) on delete cascade;

alter table public.notifications
  drop constraint notifications_booking_fk,
  add constraint notifications_booking_fk foreign key (booking_id) references public.bookings(id) on delete cascade;

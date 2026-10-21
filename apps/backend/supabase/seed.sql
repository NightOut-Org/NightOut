-- =====================================================================
-- Seed: master data เท่านั้น (styles, safety_features, platform_settings, legal_documents, promotion_packages)
-- ไม่มีร้านเดโมแล้ว — ร้านจริงมาจากผู้ประกอบการ/ทีม NightOut ผ่านแอป (ร้านเดโมเดิมลบด้วย migration 20261020000100)
-- จังหวัด/อำเภอ/ตำบล + ย่าน อยู่ใน migration 20261020000400 (ใช้ทั้ง local และ production)
-- ใช้กับ: supabase db reset (local) หรือ supabase db reset --linked
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- master data
-- ---------------------------------------------------------------------
insert into styles (key, name_th, icon, sort_order) values
  ('LIVE_MUSIC','Live Music','MusicNotes',1), ('CHILL','Chill','Coffee',2), ('PUB_DANCE','Pub/Dance','Disc',3),
  ('ROOFTOP','Rooftop','BuildingOffice',4), ('FOOD_FOCUSED','Food-focused','ForkKnife',5), ('QUIET','Quiet','SpeakerSimpleNone',6),
  ('OUTDOOR','Outdoor','Tree',7), ('PRIVATE_ROOM','Private Room','Door',8), ('BUFFET','Buffet','BowlFood',9);

-- checklist 9 ข้อตามหน้าเว็บ (weight รวม 100)
insert into safety_features (key, name_th, icon, weight, sort_order) values
  ('SECURITY','รปภ. / การ์ด','ShieldCheck',12,1), ('CCTV','กล้อง CCTV','VideoCamera',11,2),
  ('FIRE_EXIT','ทางหนีไฟ + ถังดับเพลิง','FireExtinguisher',11,3), ('FIRST_AID','ชุดปฐมพยาบาล','FirstAidKit',11,4),
  ('ID_CHECK','ตรวจบัตร 20+','IdentificationCard',11,5), ('PARKING_RIDE','ที่จอดรถ / เรียกรถกลับบ้าน','Car',11,6),
  ('FEMALE_STAFF','พนักงานหญิงช่วยดูแล','GenderFemale',11,7), ('LIGHTING','ทางเข้า/ที่จอดสว่าง','Lightbulb',11,8),
  ('EMERGENCY_CONTACT','ช่องทางแจ้งเหตุฉุกเฉิน','Phone',11,9);

-- ⚠️ แก้ PromptPay เป็นของจริงใน Table Editor ก่อนเปิดรับเงิน (และรอคำตอบข้อ 10.3)
insert into platform_settings (key, value) values
  ('deposit_promptpay',            '{"name":"NightOut Co., Ltd.","promptpay_id":"0812345678"}'),
  ('promotion_promptpay',          '{"name":"NightOut Co., Ltd.","promptpay_id":"0812345678"}'),
  ('slip_retention_days',          '90'),
  ('account_retention_days',       '30'),
  ('contact_phone_retention_days', '90'),
  ('min_safety_score_for_promo',   '50');

insert into legal_documents (doc_type, version, content_url, is_current) values
  ('TERMS','v1','/terms',true), ('PRIVACY','v1','/privacy',true), ('COOKIE','v1','/privacy#cookie',true),
  ('AGE_CONFIRMATION','v1','/terms#age',true);

insert into promotion_packages (name, placement, duration_days, price) values
  ('ร้านแนะนำหน้าแรก','HOME_RECOMMENDED',7,1590), ('ร้านแนะนำหน้าแรก','HOME_RECOMMENDED',14,2900),
  ('Home Banner','HOME_BANNER',7,3500), ('อันดับต้นในผลค้นหา','SEARCH_TOP',7,1500), ('อันดับต้นในผลค้นหา','SEARCH_TOP',30,4900);

commit;

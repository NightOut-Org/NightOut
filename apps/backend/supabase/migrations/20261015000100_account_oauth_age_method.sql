-- =====================================================================
-- account · วิธียืนยันอายุจากบัญชี Google / Facebook (Phase 1 MVP)
-- ค่าใหม่ของ enum ต้องอยู่คนละ migration กับที่ใช้ (…20261015000200_account_oauth_signup)
-- =====================================================================
alter type public.age_verification_method add value if not exists 'GOOGLE';
alter type public.age_verification_method add value if not exists 'FACEBOOK';

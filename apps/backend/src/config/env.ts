import { z } from 'zod';

/** ค่าว่างใน .env (`KEY=`) = ไม่ได้ตั้ง */
const blank = (v: unknown) => (v === '' ? undefined : v);

/** ตรวจ environment variables ตอนเริ่มแอป */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  SUPABASE_URL: z.url().default('http://127.0.0.1:54321'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Publishable (anon) key — ใช้อ่านข้อมูลแทนหน้าเว็บโดยให้ RLS ทำงานตามสิทธิ์ของผู้เรียก (ว่าง = ใช้ VITE_SUPABASE_ANON_KEY) */
  SUPABASE_ANON_KEY: z.string().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  JOB_SECRET: z.string().min(8).default('change-me-local'),
  QR_SIGNING_KEY: z.string().optional(),
  /** เข้ารหัสเลขบัญชีร้าน (AES-256-GCM) — ห้ามเปลี่ยนหลังมีข้อมูลแล้ว */
  PAYOUT_ENCRYPTION_KEY: z.string().min(16).optional(),
  /** dev: รัน job หมดเวลา/ไม่มาตามนัด ทุกกี่ ms ในเครื่อง · ค่าเริ่มต้น 0 = ปิด (DB จริงมี pg_cron รันให้แล้ว — เปิดเฉพาะ DB ในเครื่องที่ไม่มี pg_cron · ต่อ DB จริงแล้วเปิด = ยิงซ้ำ + กิน API log) */
  JOBS_LOCAL_INTERVAL_MS: z.coerce.number().int().min(0).default(0),
  /** ค้นหาที่อยู่/หาที่อยู่จากหมุด (GET /geocode/*) — OSM Nominatim · instance สาธารณะต้อง ≤ 1 ครั้ง/วินาที · traffic เยอะ = เปลี่ยนเป็น self-host / เสียเงิน */
  GEOCODER_URL: z.url().default('https://nominatim.openstreetmap.org'),
  /** นโยบาย Nominatim: ต้องระบุตัวตนแอป */
  GEOCODER_USER_AGENT: z.string().min(3).default('NightOut/1.0 (+https://nightout.day)'),
  /** อีเมลติดต่อ (พารามิเตอร์ email= ของ Nominatim) · ว่าง = ไม่ส่ง */
  GEOCODER_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.email().optional()),
  /** เว้นระยะระหว่างการเรียก Nominatim (ms · ต่อ instance ของ backend) */
  GEOCODER_MIN_INTERVAL_MS: z.coerce.number().int().min(0).default(1100),
  /** ผู้ให้บริการชำระเงิน — ว่าง = โอน + แนบสลิปเดิม · mock = หน้าชำระเงินจำลอง (dev) · beam = โครงรอเชื่อม (ยังไม่พร้อม → ใช้สลิปต่อ) */
  PAYMENT_PROVIDER: z.preprocess(blank, z.enum(['mock', 'beam']).optional()),
  /** ลับตรวจลายเซ็น webhook (≥ 16 ตัว) · ว่าง = ค่า dev ของ mock (ใช้ไม่ได้บน deploy) */
  PAYMENT_WEBHOOK_SECRET: z.preprocess(blank, z.string().min(16).optional()),
  /** เปิด mock บน deploy (เดโมเท่านั้น — ใครก็กดจ่ายผ่านได้โดยไม่เสียเงิน) */
  PAYMENT_ALLOW_MOCK_IN_PRODUCTION: z.preprocess(blank, z.enum(['true', 'false']).default('false')),
  /** origin ของเว็บลูกค้า ใช้สร้างลิงก์กลับหลังชำระ (ว่าง = Origin ของ request ถ้าอยู่ใน CORS_ORIGINS) */
  WEB_APP_URL: z.preprocess(blank, z.url().optional()),
});
export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

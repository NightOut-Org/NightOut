/**
 * ลบไฟล์รูป/วิดีโอรีวิวที่ทำทดสอบบนร้านเดโม 16 ร้าน ออกจาก bucket `review-media` (ใช้ Secret key — รันในเครื่องทีมเท่านั้น)
 * ต้องรัน **ก่อน** `supabase db push` migration `20261020000100_demo_bars_cleanup` — หลัง push แถวรีวิวที่เก็บ path จะหายไป
 *
 *   pnpm --filter @nightout/backend demo:media-cleanup            # ดูรายการไฟล์ที่จะลบ (ไม่ลบจริง)
 *   pnpm --filter @nightout/backend demo:media-cleanup --apply    # ลบจริง (กู้คืนไม่ได้)
 *
 * หาไฟล์ 2 ทาง: path ใน `review_media` (รวมรีวิวที่ซ่อน/รอตรวจ) + ไฟล์ทั้งหมดใต้โฟลเดอร์ `<user_id>/<review_id>/` ของรีวิวนั้น
 * อ่าน SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY จาก .env ที่ root
 */
import { parseArgs } from 'node:util';

const BUCKET = 'review-media';
/** id ร้านเดโม — ต้องตรงกับ migration 20261020000100_demo_bars_cleanup */
const DEMO_BAR_IDS = [
  '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d', '0cccc294-d9b5-501e-bf33-a900f1188f90',
  'fdbadfd4-d389-5cef-aee5-e622cc607bdf', 'f19f3694-3757-500b-a54a-71bd7bd1d616',
  'ca9df1a8-3a56-5dc6-849e-ea71be97f004', '98fd3a61-0a2d-5fea-85d3-8c305d39e6b4',
  '2c455e74-6029-52ae-b878-4df21dfc9c16', '772f1a13-43d3-520b-9812-8e9bda5a9b07',
  'e3a93acf-3717-55d8-a6b4-76d56644db42', '072a70ba-33a2-567f-b2c4-013b61da514f',
  '287feeb2-dd55-5c27-9ba4-9909a6e80247', 'bf05155c-d15b-54ae-a9b3-52b5efb784e9',
  '5746aa2f-136a-52ad-87dd-eb8ff90fb5e7', '5bcdb1a4-bb22-5884-8fb1-bc0a0266cde3',
  '26924211-46cf-50a1-8642-65323dc4c0b3', '2238849e-de7d-56f9-b430-273d0b9b82f6',
];

const { values: args } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail('ไม่พบ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน .env ที่ root ของโปรเจกต์');

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? text;
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${msg}`);
  }
  return body as T;
}

interface ReviewRow {
  id: string;
  user_id: string;
  review_media: { storage_path: string; thumb_path: string | null }[];
}

/** ไฟล์ทั้งหมดใต้ prefix (โฟลเดอร์ของรีวิวไม่มีโฟลเดอร์ย่อย) */
async function listFolder(prefix: string): Promise<string[]> {
  const items = await api<{ name: string; id: string | null }[]>(`/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  return items.filter((i) => i.id).map((i) => `${prefix}/${i.name}`);
}

async function main() {
  const reviews = await api<ReviewRow[]>(
    `/rest/v1/reviews?select=id,user_id,review_media(storage_path,thumb_path)&bar_id=in.(${DEMO_BAR_IDS.join(',')})`,
  );
  const paths = new Set<string>();
  for (const r of reviews) {
    for (const m of r.review_media) {
      paths.add(m.storage_path);
      if (m.thumb_path) paths.add(m.thumb_path);
    }
    for (const p of await listFolder(`${r.user_id}/${r.id}`)) paths.add(p);
  }

  console.log(`รีวิวบนร้านเดโม ${reviews.length} รายการ · ไฟล์ใน ${BUCKET} ${paths.size} ไฟล์`);
  for (const p of paths) console.log(`  ${p}`);
  if (!paths.size) return;
  if (!args.apply) {
    console.log('\n(ยังไม่ลบ — รันซ้ำพร้อม --apply เพื่อลบจริง)');
    return;
  }

  const removed = await api<{ name: string }[]>(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    body: JSON.stringify({ prefixes: [...paths] }),
  });
  console.log(`✔ ลบแล้ว ${removed.length} ไฟล์`);
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));

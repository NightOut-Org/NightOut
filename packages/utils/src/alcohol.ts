/**
 * คำที่อาจเกี่ยวกับเครื่องดื่มแอลกอฮอล์ — ใช้ "เตือน" ตอนพิมพ์ (โปรร้าน · โฆษณา Mini-Ads · ข่าวร้านในชุมชน) **ไม่บล็อกการบันทึก**
 * (คอมเมนต์ #87 · พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.30 ห้ามลด/แถม · ม.32 ห้ามโฆษณา) — แอดมินยังตรวจเหมือนเดิม
 * คำไทยจับแบบ substring (ภาษาไทยไม่มีช่องว่างคั่นคำ) · คำอังกฤษจับไม่สนตัวพิมพ์และต้องเป็นทั้งคำ ("Beer" ใช่ · "Beerus" ไม่ใช่)
 * เลี่ยงคำไทยสั้นๆ ที่ชนคำอื่นบ่อย (เช่น "จิน" "รัม") — เตือนผิดได้บ้าง แต่ควรน้อย
 */
export const ALCOHOL_WORDS: readonly string[] = [
  // คำไทย
  'เหล้า', 'เบียร์', 'ไวน์', 'วิสกี้', 'วิสกี', 'ค็อกเทล', 'ค๊อกเทล', 'โซจู', 'สาเก', 'เตกีล่า', 'วอดก้า', 'บรั่นดี', 'แชมเปญ',
  'สปาย', 'ยาดอง', 'ทาวเวอร์เบียร์', 'แอลกอฮอล์', 'แอลกอฮอล',
  // คำอังกฤษ (ทั้งคำ)
  'beer', 'wine', 'whisky', 'whiskey', 'cocktail', 'soju', 'sake', 'tequila', 'vodka', 'brandy', 'champagne', 'alcohol', 'liquor',
  'shot', 'shots',
  // ยี่ห้อ
  'leo', 'singha', 'chang', 'heineken', 'hoegaarden', 'asahi', 'corona', 'carlsberg', 'tiger', 'johnnie walker', 'smirnoff',
  'absolut', 'jameson', 'hennessy', 'regency', 'sangsom', 'แสงโสม', 'หงส์ทอง', 'รีเจนซี่', 'ลีโอ', 'สิงห์', 'ช้าง', 'ไฮเนเก้น',
  // วลีโปร
  'ฟรีเหล้า', 'ลดเหล้า', 'เหล้าฟรี', 'เบียร์ฟรี', 'ซื้อ 1 แถม 1 เบียร์', 'happy hour', 'ฮัปปี้อาวร์',
];

/** ข้อความเตือน (antd Alert type="warning") เมื่อ alcoholWordsIn() เจอคำ */
export const ALCOHOL_WARNING_TEXT =
  'ข้อความนี้อาจเกี่ยวกับเครื่องดื่มแอลกอฮอล์ — ห้ามโปรลด/แถม/ขายแอลกอฮอล์ (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.30/32) ใช้โปรอาหาร มิกเซอร์ น้ำแข็ง แทน';

const LATIN = /^[a-z0-9 ]+$/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = ALCOHOL_WORDS.map((word) => ({
  word,
  re: LATIN.test(word)
    ? new RegExp(`(?<![a-z0-9])${escapeRe(word)}(?![a-z0-9])`, 'g')
    : new RegExp(escapeRe(word), 'g'),
}));

/**
 * คำในรายการ ALCOHOL_WORDS ที่พบในข้อความ (ไม่ซ้ำ · เรียงตามที่เจอก่อน · คำอังกฤษคืนเป็นตัวพิมพ์เล็ก)
 * คำที่อยู่ในคำที่ยาวกว่าที่ตำแหน่งเดียวกันไม่นับซ้ำ (เช่น "แอลกอฮอล์" ไม่คืน "แอลกอฮอล" ด้วย) · ว่าง/null = []
 */
export function alcoholWordsIn(text: string | null | undefined): string[] {
  if (!text) return [];
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  const hits: { word: string; start: number; end: number }[] = [];
  for (const { word, re } of PATTERNS) {
    for (const m of t.matchAll(re)) hits.push({ word, start: m.index, end: m.index + m[0].length });
  }
  const kept = hits.filter(
    (h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start),
  );
  kept.sort((a, b) => a.start - b.start || b.end - a.end);
  return [...new Set(kept.map((h) => h.word))];
}

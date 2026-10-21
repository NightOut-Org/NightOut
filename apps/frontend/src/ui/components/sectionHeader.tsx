import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * หัวข้อ section (Figma: Main) — ชื่อตัวหนาซ้าย + ปุ่มขอบ "ดูทั้งหมด" ขวา (ไม่ใช้ลิงก์ข้อความ + ลูกศร)
 * `eyebrow` = บรรทัดเล็กสีม่วงเหนือชื่อ (ไม่ใส่ก็ได้)
 * ใส่ `id` แล้วให้ <section aria-labelledby={id}> อ้างถึง
 */
export function SectionHeader({
  id,
  title,
  eyebrow,
  to,
  linkLabel = 'ดูทั้งหมด',
  extra,
  className = '',
}: {
  id?: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  to?: string;
  linkLabel?: string;
  /** ของด้านขวาแทนลิงก์ เช่น ปุ่ม */
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-medium text-link">{eyebrow}</p>}
        <h2 id={id} className="text-2xl font-bold md:text-3xl">
          {title}
        </h2>
      </div>
      {extra ??
        (to && (
          <Link
            to={to}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-border px-4 text-sm font-medium !text-text transition-colors hover:border-purple hover:!text-purple"
          >
            {linkLabel}
          </Link>
        ))}
    </div>
  );
}

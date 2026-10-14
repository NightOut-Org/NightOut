import { ArrowUpRight, X } from '@phosphor-icons/react';
import { colors } from '@nightout/ui';
import { MINI_AD_LABEL } from '@nightout/utils';
import { Typography } from 'antd';

/** สีธีมมืด (ค่าเริ่มต้นของเว็บลูกค้า) จาก tokens — แอดมินเห็นการ์ดแบบเดียวกับที่ลูกค้าเห็น ไม่ว่า Backoffice ใช้ธีมไหน */
const c = colors.dark;

/**
 * ตัวอย่างการ์ดโฆษณาบนเว็บลูกค้า (เลย์เอาต์เดียวกับ MiniAdSlot ใน apps/frontend) — ภาพนิ่ง กดไม่ได้
 * image = blob URL ของภาพที่เพิ่งเลือก หรือ webSrc(url) ของภาพที่บันทึกแล้ว
 */
export function MiniAdPreview({
  advertiser_name,
  title,
  description,
  cta_label,
  image,
}: {
  advertiser_name?: string;
  title?: string;
  description?: string;
  cta_label?: string;
  image?: string;
}) {
  return (
    <figure className="m-0">
      <div
        aria-hidden
        className="relative flex items-center gap-3 rounded-2xl border p-2.5 pr-11"
        style={{ background: c.card, borderColor: c.border, color: c.text }}
      >
        <div
          className="aspect-video w-28 shrink-0 rounded-xl bg-cover bg-center sm:w-40"
          style={{
            backgroundColor: c.surface,
            backgroundImage: image ? `url("${image}")` : undefined,
          }}
        />
        <div className="min-w-0 flex-1">
          <p
            className="m-0 flex min-w-0 items-center gap-1.5 text-[11px] leading-4"
            style={{ color: c.muted }}
          >
            <span
              className="shrink-0 rounded border px-1.5 font-semibold"
              style={{ borderColor: c.border }}
            >
              {MINI_AD_LABEL}
            </span>
            <span className="truncate">{advertiser_name?.trim() || 'ชื่อผู้ลงโฆษณา'}</span>
          </p>
          <p className="m-0 mt-1 line-clamp-1 text-sm font-semibold">
            {title?.trim() || 'หัวข้อโฆษณา'}
          </p>
          {description?.trim() && (
            <p className="m-0 mt-0.5 line-clamp-2 text-xs" style={{ color: c.muted }}>
              {description}
            </p>
          )}
          <span
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: c.goldText }}
          >
            {cta_label?.trim() || 'ดูเพิ่มเติม'}
            <ArrowUpRight size={14} />
          </span>
        </div>
        <span
          className="absolute right-1.5 top-1.5 grid size-9 place-items-center"
          style={{ color: c.muted }}
        >
          <X size={14} weight="bold" />
        </span>
      </div>
      <Typography.Text type="secondary" className="mt-1 block text-xs">
        ตัวอย่างบนเว็บ (ธีมมืด) — แสดงเล็ก ๆ 1 ชิ้นต่อหน้า
      </Typography.Text>
    </figure>
  );
}

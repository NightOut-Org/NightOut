import { MINI_AD_LABEL } from '@nightout/utils';

/**
 * ป้ายร้านโปรโมท 2 ช่อง: "แนะนำ" | "โฆษณา" — บอกผู้ใช้ชัดว่าเป็นโฆษณาเสมอ
 * `overlay` = บนรูป (พื้นมืดโปร่ง) · `outline` = ข้างชื่อร้าน
 */
export function AdBadge({ variant = 'outline', className = '' }: { variant?: 'overlay' | 'outline'; className?: string }) {
  const look =
    variant === 'overlay'
      ? 'border-gold/50 bg-black/60 text-gold-highlight backdrop-blur'
      : 'border-gold/45 text-gold-text';
  return (
    <span
      title="ร้านจ่ายเงินโปรโมท (โฆษณา)"
      className={`inline-flex shrink-0 items-stretch overflow-hidden rounded-full border text-xs leading-5 ${look} ${className}`}
    >
      <span className="px-2 font-semibold">แนะนำ</span>
      <span className="border-l border-current/30 px-2 opacity-80">{MINI_AD_LABEL}</span>
    </span>
  );
}

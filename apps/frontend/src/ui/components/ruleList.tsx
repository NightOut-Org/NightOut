import type { ReactNode } from 'react';

type RuleTone = 'info' | 'check' | 'warn';

export interface Rule {
  text: ReactNode;
  /** เก็บไว้ให้โค้ดเดิมคอมไพล์ได้ — หน้าตาเป็นสีเดียว ไม่แยกตามชนิดแล้ว */
  tone?: RuleTone;
}

/**
 * กติกา / คำอธิบายหลายข้อ — 1 ข้อ 1 บรรทัด ใช้จุดนำหน้าสีเดียวทุกข้อ (ไม่แยกสี/ไอคอนตามชนิด)
 * `boxed` = อยู่ในกล่องโน้ตพื้น surface (ใต้หัวหน้า / ข้างฟอร์ม) · ไม่ใส่ = รายการเปล่าสำหรับวางในกล่องอื่น
 */
export function RuleList({
  rules,
  title,
  boxed = false,
  className = '',
}: {
  rules: (Rule | ReactNode)[];
  /** ไม่ใช้แล้ว — เก็บไว้ให้โค้ดเดิมคอมไพล์ได้ */
  tone?: RuleTone;
  title?: ReactNode;
  boxed?: boolean;
  className?: string;
}) {
  const list = (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {rules.map((r, i) => {
        const rule = typeof r === 'object' && r !== null && 'text' in r ? (r as Rule) : { text: r };
        return (
          <li key={i} className="flex items-start gap-2.5">
            <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-current opacity-50" />
            <span className="min-w-0 text-pretty">{rule.text}</span>
          </li>
        );
      })}
    </ul>
  );
  if (!boxed && !title) return <div className={className}>{list}</div>;
  return (
    <div
      className={`${boxed ? 'rounded-2xl border border-border bg-surface px-4 py-3' : ''} text-sm text-muted ${className}`}
    >
      {title && <p className="m-0 mb-1.5 text-[13px] font-semibold text-text">{title}</p>}
      {list}
    </div>
  );
}

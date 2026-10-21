import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

type RuleTone = 'info' | 'check' | 'warn';

const ICON: Record<RuleTone, ReactNode> = {
  info: <Info weight="fill" className="text-link" />,
  check: <CheckCircle weight="fill" className="text-(--crowd-available)" />,
  warn: <WarningCircle weight="fill" className="text-(--crowd-almost-full)" />,
};

export interface Rule {
  text: ReactNode;
  tone?: RuleTone;
}

/**
 * กติกา / คำอธิบายหลายข้อ — 1 ข้อ 1 บรรทัด มีไอคอนบอกชนิด (ข้อมูล / ทำได้ / ข้อห้าม)
 * `boxed` = อยู่ในกล่องโน้ตพื้น surface (ใต้หัวหน้า / ข้างฟอร์ม) · ไม่ใส่ = รายการเปล่าสำหรับวางในกล่องอื่น
 */
export function RuleList({
  rules,
  tone = 'info',
  title,
  boxed = false,
  className = '',
}: {
  rules: (Rule | ReactNode)[];
  tone?: RuleTone;
  title?: ReactNode;
  boxed?: boolean;
  className?: string;
}) {
  const list = (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {rules.map((r, i) => {
        const rule = typeof r === 'object' && r !== null && 'text' in r ? (r as Rule) : { text: r };
        return (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden className="mt-[0.2em] inline-flex shrink-0 [&>svg]:size-[1.05em]">
              {ICON[rule.tone ?? tone]}
            </span>
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

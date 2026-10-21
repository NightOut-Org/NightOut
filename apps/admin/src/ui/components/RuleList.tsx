import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export type RuleTone = 'info' | 'check' | 'warn';
export interface Rule {
  text: ReactNode;
  tone?: RuleTone;
}

const ICON: Record<RuleTone, ReactNode> = {
  info: <Info weight="fill" className="text-(--ant-color-text-tertiary)" />,
  check: <CheckCircle weight="fill" className="text-(--ant-color-success)" />,
  warn: <WarningCircle weight="fill" className="text-(--ant-color-warning)" />,
};

/**
 * กติกา/คำอธิบายหลายข้อ 1 ข้อ 1 บรรทัด (กฎข้อความ UI ใน CLAUDE.md — ห้ามต่อประโยคยาวเป็นพืด)
 * ใช้ใน PageContainer `content` · Alert `description` · Modal / Drawer · คู่กับ `ui/components/ruleList.tsx` ของเว็บลูกค้า
 */
export function RuleList({
  rules,
  tone = 'info',
  className = '',
}: {
  rules: (Rule | ReactNode)[];
  /** ไอคอนของข้อที่ไม่ได้ระบุ tone เอง */
  tone?: RuleTone;
  className?: string;
}) {
  const items = rules
    .filter(Boolean)
    .map((r) =>
      r && typeof r === 'object' && 'text' in r ? (r as Rule) : { text: r as ReactNode },
    );
  return (
    <ul className={`m-0 flex list-none flex-col gap-1.5 p-0 ${className}`}>
      {items.map((r, i) => (
        <li key={i} className="flex items-start gap-2 leading-relaxed">
          <span className="mt-[0.2em] shrink-0 text-[1.05em] leading-none" aria-hidden>
            {ICON[r.tone ?? tone]}
          </span>
          <span className="min-w-0">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

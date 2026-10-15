import { StatisticCard } from '@ant-design/pro-components';
import { ArrowCounterClockwise, CheckCircle, HourglassMedium, LinkBreak } from '@phosphor-icons/react';
import { theme } from 'antd';
import type { ReactNode } from 'react';

export interface SummaryItem<K extends string> {
  key: K;
  title: string;
  value: number;
  icon: ReactNode;
  /** มีงานค้างที่ต้องทำ → ขอบ/ตัวเลขสีเตือน */
  urgent?: boolean;
}

/** การ์ดจำนวนรายการด้านบน (ไม่มียอดเงินรวม) — กดแล้วไปแท็บของการ์ดนั้น */
export function SummaryCards<K extends string>({
  items,
  active,
  onSelect,
  loading,
}: {
  items: SummaryItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  loading?: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((c) => {
        const tone = c.urgent ? token.colorError : active === c.key ? token.colorPrimary : undefined;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active === c.key}
            onClick={() => onSelect(c.key)}
            className="cursor-pointer rounded-lg border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: token.colorPrimary }}
          >
            <StatisticCard
              loading={loading}
              style={{
                height: '100%',
                borderColor: tone ?? token.colorBorderSecondary,
                borderWidth: 1,
                borderStyle: 'solid',
              }}
              statistic={{
                title: c.title,
                value: c.value,
                suffix: <span className="text-sm opacity-60">รายการ</span>,
                icon: (
                  <span className="hidden sm:inline-flex" style={{ color: tone ?? token.colorTextTertiary, fontSize: 28 }}>
                    {c.icon}
                  </span>
                ),
                valueStyle: c.urgent ? { color: token.colorError } : undefined,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

export const SUMMARY_ICONS = {
  refund: <ArrowCounterClockwise weight="duotone" />,
  pending: <HourglassMedium weight="duotone" />,
  paid: <CheckCircle weight="duotone" />,
  unmatched: <LinkBreak weight="duotone" />,
};

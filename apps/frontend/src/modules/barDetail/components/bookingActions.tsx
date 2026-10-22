import { Calculator, CalendarPlus } from '@phosphor-icons/react';
import { Button, Card } from 'antd';
import { baht } from '@/ui/utils/format';

interface Props {
  avgPerPerson: number;
  onEstimate: () => void;
  onBook: () => void;
}

/** การ์ดจองโต๊ะด้านขวา (จอใหญ่) */
export function BookingCard({ avgPerPerson, onEstimate, onBook }: Props) {
  return (
    <Card className="sticky top-24" title="จองโต๊ะ">
      <p className="text-sm text-muted">ประมาณ {baht(avgPerPerson)} / คน</p>
      <Button block className="mt-4" icon={<Calculator />} onClick={onEstimate}>
        ประเมินราคา
      </Button>
      <Button block type="primary" className="mt-3" icon={<CalendarPlus />} onClick={onBook}>
        จองเลย
      </Button>
    </Card>
  );
}

/** แถบปุ่มติดล่างจอ (มือถือ) — อยู่เหนือเมนูล่าง */
export function BookingBar({ onEstimate, onBook }: Omit<Props, 'avgPerPerson'>) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+76px)] z-20 flex gap-3 border-t border-border bg-surface/95 p-3 backdrop-blur lg:hidden">
      <Button block icon={<Calculator />} onClick={onEstimate}>
        ประเมินราคา
      </Button>
      <Button block type="primary" icon={<CalendarPlus />} onClick={onBook}>
        จองเลย
      </Button>
    </div>
  );
}

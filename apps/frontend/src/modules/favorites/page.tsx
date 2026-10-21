import { MagnifyingGlass } from '@phosphor-icons/react';
import { favorites, getBar } from '@/services/data';
import { Empty } from 'antd';
import { Link } from 'react-router';
import { BarCard } from '@/ui/components/barCard';
import { PageHeader } from '@/ui/components/pageHeader';
import { EMPTY_CTA_CLASS } from '@/ui/utils/buttonClasses';
import { useDemo } from '@/hooks/useDemo';

export function FavoritesPage() {
  useDemo();
  const bars = favorites()
    .map(getBar)
    .filter((b) => b !== null);
  return (
    <div>
      <PageHeader title="ร้านโปรด" />
      {bars.length === 0 ? (
        <Empty description="ยังไม่มีร้านโปรด">
          <Link to="/search" className={EMPTY_CTA_CLASS}>
            <MagnifyingGlass size={16} weight="bold" aria-hidden /> หาร้าน
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bars.map((b) => (
            <BarCard key={b.id} bar={b} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Car, MapPin, NavigationArrow, Train } from '@phosphor-icons/react';
import { formatTransit } from '@nightout/utils';
import { Button } from 'antd';
import type { BarWithTier } from '@/services/data';
import { BarMap, directionsUrl } from '@/ui/components/barMap';
import { InfoSection } from '@/ui/components/infoSection';

/** การเดินทาง: รถไฟฟ้าใกล้สุด · ที่จอดรถ (แสดงเฉพาะที่ร้านกรอก) + แผนที่ร้าน + ปุ่มนำทาง */
export function LocationSection({ bar }: { bar: BarWithTier }) {
  const transit = formatTransit(bar.transit);
  return (
    <InfoSection
      icon={<MapPin />}
      title="การเดินทาง"
      extra={
        <a href={directionsUrl(bar.lat, bar.lng)} target="_blank" rel="noreferrer noopener">
          <Button icon={<NavigationArrow />}>นำทาง</Button>
        </a>
      }
    >
      {(transit || bar.parkingNote) && (
        <ul className="m-0 mb-3 grid list-none gap-1.5 p-0 text-sm">
          {transit && (
            <li className="flex items-start gap-2">
              <Train size={18} className="mt-0.5 shrink-0 text-gold-text" aria-hidden="true" />
              <span className="min-w-0">{transit}</span>
            </li>
          )}
          {bar.parkingNote && (
            <li className="flex items-start gap-2">
              <Car size={18} className="mt-0.5 shrink-0 text-gold-text" aria-hidden="true" />
              <span className="min-w-0 break-words">ที่จอดรถ: {bar.parkingNote}</span>
            </li>
          )}
        </ul>
      )}
      <BarMap bars={[bar]} className="h-64" />
    </InfoSection>
  );
}

import type { BarWithTier } from '@/services/data';
import { divIcon } from 'leaflet';
import { barImage } from '@/ui/utils/barImage';
import { baht } from '@/ui/utils/format';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const PIN_W = 82;
const PIN_H = 30;

/**
 * หมุดแคปซูลทอง (ดีไซน์ Search Combined · แผนที่จาก 01 Gold Lounge): รูปร้านวงกลม + ราคาต่อหัว
 * active = ร้านที่เลือก/ชี้อยู่ในรายการ → พื้นทอง · สไตล์อยู่ search.css (`.nl-price-pin`)
 */
export function pricePin(bar: BarWithTier, active: boolean) {
  const price = bar.avgPerPerson > 0 ? baht(bar.avgPerPerson) : '—';
  return divIcon({
    className: '',
    html: `<div class="nl-price-pin${active ? ' is-active' : ''}">
      <span class="nl-price-pin__img" style="background-image:url('${esc(barImage(bar))}')"></span>${esc(price)}
    </div>`,
    iconSize: [PIN_W, PIN_H],
    iconAnchor: [PIN_W / 2, PIN_H / 2],
  });
}

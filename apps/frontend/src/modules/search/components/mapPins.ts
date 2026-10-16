import type { BarWithTier } from '@/services/data';
import { divIcon } from 'leaflet';
import { barImage } from '@/ui/utils/barImage';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** หมุดรูป 44px + หางสามเหลี่ยม 10px — ปลายหางคือพิกัดร้าน */
const PIN = 44;
const TAIL = 8;
/** กว้างพอให้ป้ายชื่อ (≤ 120px) อยู่กึ่งกลางหมุด */
const BOX_W = 120;

/** ซูมถึงระดับนี้แล้วแสดงชื่อร้านใต้หมุด (ซูมออก = แสดงแต่รูป ไม่ให้ชื่อทับกัน) */
export const PIN_LABEL_ZOOM = 15;

/**
 * หมุดรูปร้าน (ดีไซน์ Search Combined v2): วงกลมรูปร้าน ขอบทอง + หางชี้พิกัด · ซูมใกล้ = ป้ายชื่อร้านใต้หมุด
 * active = ร้านที่เลือก/ชี้อยู่ในรายการ → ขอบขาว + ป้ายพื้นทอง · สไตล์อยู่ search.css (`.nl-photo-pin`)
 */
export function photoPin(bar: BarWithTier, active: boolean, showLabel: boolean) {
  return divIcon({
    className: '',
    html: `<div class="nl-photo-pin${active ? ' is-active' : ''}">
      <span class="nl-photo-pin__img" style="background-image:url('${esc(barImage(bar))}')"></span>
      <span class="nl-photo-pin__tail"></span>
      ${showLabel ? `<span class="nl-photo-pin__label">${esc(bar.name)}</span>` : ''}
    </div>`,
    iconSize: [BOX_W, PIN + TAIL],
    iconAnchor: [BOX_W / 2, PIN + TAIL],
  });
}

/** จุดฟ้า "ตำแหน่งของฉัน" — สไตล์ `.nl-me-dot` อยู่ styles/index.css (ใช้ร่วมกับ /map) */
export const meIcon = divIcon({
  className: '',
  html: '<div class="nl-me-dot"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

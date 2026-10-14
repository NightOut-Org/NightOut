import { MAP_DEFAULT_CENTER, THAILAND_BOUNDS, distanceMeters, roundCoord } from '@nightout/utils';
import { divIcon, latLngBounds, type LatLngBoundsExpression, type LatLngExpression, type Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/ui/utils/location';

/**
 * แผนที่ตรวจหมุดร้าน (Leaflet + OSM raster — Backoffice ไม่ใช้ vector tiles)
 * `current` = หมุดที่ลูกค้าเห็นตอนนี้ (วงกลมเทา) · `value` = หมุดใหม่ (หมุดทอง) · เส้นประทองเชื่อมเมื่อหมุดย้าย
 * `editable` = แตะแผนที่ / ลากหมุดทองเพื่อย้าย (ใช้เป็น control ของ Form.Item ได้: value + onChange)
 * แผนที่สร้างเมื่อกล่องมีขนาดจริงแล้ว (ใน Drawer ที่ยังเลื่อนเข้ามา) และ invalidateSize ทุกครั้งที่กล่องเปลี่ยนขนาด
 */

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/** กรอบไทย + เผื่อขอบ 0.5° — ลากแผนที่ออกนอกไทยไม่ได้ */
const MAX_BOUNDS: LatLngBoundsExpression = [
  [THAILAND_BOUNDS.south - 0.5, THAILAND_BOUNDS.west - 0.5],
  [THAILAND_BOUNDS.north + 0.5, THAILAND_BOUNDS.east + 0.5],
];
const PIN_ZOOM = 17;
/** ใกล้กันกว่านี้ถือว่าหมุดเดียวกัน (ไม่วาดเส้น/ไม่ fit 2 จุด) */
const SAME_SPOT_METERS = 2;

/** หมุดใหม่: หยดน้ำสีทอง ปลายแหลมชี้ตำแหน่ง */
const NEW_PIN = divIcon({
  className: '',
  html:
    '<span class="relative block size-7">' +
    '<span class="absolute inset-0 -rotate-45 rounded-full rounded-bl-none border-2 border-white bg-gold shadow-[0_2px_6px_rgb(0_0_0/0.45)]"></span>' +
    '<span class="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-gold"></span>' +
    '</span>',
  iconSize: [28, 28],
  // ปลายหยดน้ำอยู่ใต้จุดกลาง ≈ 0.707 × 28px
  iconAnchor: [14, 34],
  tooltipAnchor: [0, -30],
});

/** หมุดเดิม: วงกลมเทา (คนละรูปทรงกับหมุดใหม่ — ไม่ต้องพึ่งสีอย่างเดียว) */
const OLD_PIN = divIcon({
  className: '',
  html: '<span class="block size-[18px] rounded-full border-2 border-white bg-zinc-500 shadow-[0_1px_4px_rgb(0_0_0/0.45)]"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  tooltipAnchor: [0, -10],
});

const keyOf = (p: LatLng | null | undefined) => (p ? `${p.lat},${p.lng}` : '');
const toLatLng = (p: LatLng): LatLngExpression => [p.lat, p.lng];
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** จัดมุมมองให้เห็นทุกหมุด — ยกเว้นตอนผู้ใช้เพิ่งแตะ/ลากเอง (ไม่กระตุกแผนที่ใต้มือ) */
function FitPins({
  current,
  value,
  movedByMap,
}: {
  current: LatLng | null;
  value: LatLng | null;
  movedByMap: RefObject<string | null>;
}) {
  const map = useMap();
  const first = useRef(true);
  const currentKey = keyOf(current);
  const valueKey = keyOf(value);

  useEffect(() => {
    const animate = !first.current && !reducedMotion();
    first.current = false;
    if (valueKey && movedByMap.current === valueKey) return;
    const pins = [current, value].filter((p): p is LatLng => !!p);
    if (!pins.length) return;
    const [a, b] = pins;
    if (!b || distanceMeters(a!, b) < SAME_SPOT_METERS) {
      map.setView(toLatLng(value ?? a!), Math.max(map.getZoom(), PIN_ZOOM - 1), { animate });
    } else {
      map.fitBounds(latLngBounds([toLatLng(a!), toLatLng(b)]), { padding: [40, 40], maxZoom: PIN_ZOOM, animate });
    }
    // current / value เปลี่ยนเมื่อ key เปลี่ยนเท่านั้น
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, currentKey, valueKey, movedByMap]);
  return null;
}

/** กล่องเปลี่ยนขนาด (เปิด Drawer / สลับโหมด) → ให้ Leaflet วัดใหม่ · ล้อเมาส์ซูมได้เมื่อคลิกแผนที่แล้วเท่านั้น (ไม่แย่ง scroll ของหน้า) */
function MapBehaviour({ editable, onPick }: { editable: boolean; onPick: (p: LatLng) => void }) {
  const map = useMap();
  useMapEvents({
    click: (e) => {
      if (!editable) return;
      onPick(e.latlng);
      // แตะตอนซูมไกล = ปักคร่าว ๆ → ซูมเข้าให้ขยับต่อได้แม่นขึ้น
      if (map.getZoom() < PIN_ZOOM - 2) map.setView(e.latlng, PIN_ZOOM - 1, { animate: !reducedMotion() });
    },
  });
  useEffect(() => {
    const el = map.getContainer();
    const wheelOn = () => map.scrollWheelZoom.enable();
    const wheelOff = () => map.scrollWheelZoom.disable();
    el.addEventListener('focus', wheelOn);
    el.addEventListener('blur', wheelOff);
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    });
    observer.observe(el);
    return () => {
      el.removeEventListener('focus', wheelOn);
      el.removeEventListener('blur', wheelOff);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}

export function PinMap({
  current = null,
  value = null,
  editable = false,
  onChange,
  className = 'h-80',
  id,
}: {
  /** หมุดที่ลูกค้าเห็นตอนนี้ (null = ยังไม่มี / หมุดค่าเริ่มต้นเดิม) */
  current?: LatLng | null;
  /** หมุดใหม่ (ค่าของ Form.Item) */
  value?: LatLng | null;
  editable?: boolean;
  onChange?: (v: LatLng) => void;
  className?: string;
  /** Form.Item ส่ง id มาให้ label ชี้ถึง */
  id?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const movedByMap = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  // สร้างแผนที่เมื่อกล่องมีขนาดแล้ว (Drawer ที่กำลังเปิด / แท็บที่ซ่อนอยู่) — Leaflet วัดขนาดตอนสร้าง
  useEffect(() => {
    const el = box.current;
    if (!el || ready) return;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setReady(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  const pick = (p: LatLng) => {
    const next = { lat: roundCoord(p.lat), lng: roundCoord(p.lng) };
    movedByMap.current = keyOf(next);
    onChange?.(next);
  };

  const start = value ?? current;
  const moved = !!current && !!value && distanceMeters(current, value) >= SAME_SPOT_METERS;

  return (
    <div
      ref={box}
      id={id}
      role="region"
      aria-label={editable ? 'แผนที่ปักหมุดร้าน — แตะแผนที่หรือลากหมุดทองเพื่อย้าย' : 'แผนที่หมุดร้าน'}
      className={`relative isolate overflow-hidden rounded-lg border border-border bg-surface ${className}`}
    >
      {ready && (
        <MapContainer
          center={toLatLng(start ?? MAP_DEFAULT_CENTER)}
          zoom={start ? PIN_ZOOM : 11}
          minZoom={5}
          maxBounds={MAX_BOUNDS}
          maxBoundsViscosity={1}
          scrollWheelZoom={false}
          className={`size-full ${editable ? 'cursor-crosshair' : ''}`}
        >
          <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
          <MapBehaviour editable={editable} onPick={pick} />
          <FitPins current={current} value={value} movedByMap={movedByMap} />
          {moved && (
            <>
              {/* ขอบเข้มใต้เส้นประ — มองเห็นได้ทั้งบนแผนที่สว่าง/มืด */}
              <Polyline
                positions={[toLatLng(current), toLatLng(value)]}
                interactive={false}
                pathOptions={{ color: '#000', opacity: 0.35, weight: 5 }}
              />
              <Polyline
                positions={[toLatLng(current), toLatLng(value)]}
                // className / interactive ต้องส่งตอนสร้าง (pathOptions ใช้ setStyle ซึ่งไม่รับ 2 ค่านี้)
                className="stroke-gold"
                interactive={false}
                pathOptions={{ weight: 3, opacity: 1, dashArray: '6 6' }}
              />
            </>
          )}
          {current && (moved || !value) && (
            <Marker position={toLatLng(current)} icon={OLD_PIN} keyboard={false}>
              <Tooltip direction="top">หมุดเดิม</Tooltip>
            </Marker>
          )}
          {value && (
            <Marker
              position={toLatLng(value)}
              icon={NEW_PIN}
              draggable={editable}
              autoPan={editable}
              eventHandlers={{ dragend: (e) => pick((e.target as LeafletMarker).getLatLng()) }}
            >
              <Tooltip direction="top">{current ? 'หมุดใหม่' : 'หมุดร้าน'}</Tooltip>
            </Marker>
          )}
        </MapContainer>
      )}
    </div>
  );
}

/** คำอธิบายสัญลักษณ์ใต้แผนที่ (แสดงเมื่อมีทั้งหมุดเดิมและหมุดใหม่) */
export function PinLegend({ oldLabel = 'หมุดเดิม (ลูกค้าเห็นตอนนี้)', newLabel = 'หมุดใหม่' }: { oldLabel?: string; newLabel?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full border border-white bg-zinc-500" />
        {oldLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 -rotate-45 rounded-full rounded-bl-none bg-gold" />
        {newLabel}
      </span>
    </span>
  );
}

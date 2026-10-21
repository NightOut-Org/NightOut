import type * as C from '@nightout/contracts';
import { ClipboardText, Crosshair, MapPin } from '@phosphor-icons/react';
import { useThemeMode } from '@nightout/ui';
import {
  MAP_DEFAULT_CENTER,
  THAILAND_BOUNDS,
  distanceMeters,
  formatDistance,
  isInThailand,
  parseLatLng,
  roundCoord,
} from '@nightout/utils';
import { App, Button, Input, Popover } from 'antd';
import {
  divIcon,
  latLngBounds,
  type LatLng,
  type Map as LeafletMap,
  type Marker as LeafletMarker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Tooltip, useMapEvents } from 'react-leaflet';
import { MapBaseLayer } from './mapBaseLayer';

export interface LatLngValue {
  lat: number;
  lng: number;
}

/** เลื่อนแผนที่ได้แค่รอบประเทศไทย (เผื่อขอบ 0.5°) */
const MAX_BOUNDS = latLngBounds(
  [THAILAND_BOUNDS.south - 0.5, THAILAND_BOUNDS.west - 0.5],
  [THAILAND_BOUNDS.north + 0.5, THAILAND_BOUNDS.east + 0.5],
);
const PIN_ZOOM = 17;
const NO_PIN_ZOOM = 11;
/** หมุดใหม่ห่างหมุดเดิมไม่ถึงเท่านี้ (เมตร) = ถือว่าที่เดิม — ไม่วาดหมุดเดิมซ้อน */
const SAME_SPOT_M = 2;

const escapeAttribute = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/** หมุดทอง (.nl-pin) — รูปร้าน หรือจุดทองเมื่อไม่มีรูป · ghost = หมุดเดิมที่ลูกค้าเห็นอยู่ (เทาจาง) */
const pinIcon = (image: string | undefined, ghost: boolean) => {
  const tone = ghost ? ' opacity-50 grayscale' : '';
  return divIcon({
    className: '',
    html: image
      ? `<div class="nl-pin${tone}"><img src="${escapeAttribute(image)}" alt="" /></div>`
      : `<div class="nl-pin bg-gold${tone}"></div>`,
    iconSize: [36, 45],
    iconAnchor: [18, 45],
    tooltipAnchor: [0, -42],
  });
};

/** แตะ/คลิกบนแผนที่ = ย้ายหมุดมาตรงนั้น */
function TapToPin({ onTap }: { onTap: (ll: LatLng) => void }) {
  useMapEvents({ click: (e) => onTap(e.latlng) });
  return null;
}

/**
 * ปักหมุดร้านบนแผนที่ — control ของ antd Form (`value` / `onChange` = { lat, lng } | null)
 * ย้ายหมุด: แตะแผนที่ · ลากหมุด · ค้นหาที่อยู่ (กดค้นหาเท่านั้น — นโยบาย Nominatim ห้าม autocomplete) · ตำแหน่งของฉัน · วางพิกัด/ลิงก์ Google Maps
 * `current` = หมุดที่ลูกค้าเห็นตอนนี้ (วาดเป็นหมุดเทา · ป้าย `currentLabel`) · `readOnly` = ดูอย่างเดียว (ซ่อนเครื่องมือ)
 * `disabled` = ชั่วคราวระหว่างบันทึก — เครื่องมือยังอยู่แต่กดไม่ได้ ย้ายหมุดไม่ได้ (Form `disabled` ของ antd ไม่ถึงแผนที่/ปุ่ม HTML)
 */
export function LocationPicker({
  id,
  value,
  onChange,
  current = null,
  currentLabel = 'หมุดเดิม (ลูกค้าเห็นตอนนี้)',
  readOnly = false,
  disabled = false,
  search,
  onPickPlace,
  image,
  className = 'h-72 lg:h-[420px]',
}: {
  id?: string;
  value?: LatLngValue | null;
  onChange?: (v: LatLngValue) => void;
  current?: LatLngValue | null;
  currentLabel?: string;
  readOnly?: boolean;
  disabled?: boolean;
  search?: (q: string) => Promise<C.GeocodePlace[]>;
  onPickPlace?: (p: C.GeocodePlace) => void;
  image?: string;
  className?: string;
}) {
  const { message } = App.useApp();
  const { resolved } = useThemeMode();
  const reduce = useReducedMotion();
  const [map, setMap] = useState<LeafletMap | null>(null);
  const pin = value ?? null;
  // จุดที่สั่ง flyTo ล่าสุด — ไม่ให้ effect ด้านล่าง panTo ทับระหว่างบิน
  const flownTo = useRef<LatLngValue | null>(null);
  const [initialView] = useState(() => {
    const c = pin ?? current ?? MAP_DEFAULT_CENTER;
    return {
      center: [c.lat, c.lng] as [number, number],
      zoom: pin || current ? PIN_ZOOM : NO_PIN_ZOOM,
    };
  });
  const pinMarker = useMemo(() => pinIcon(image, false), [image]);
  const ghostMarker = useMemo(() => pinIcon(image, true), [image]);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<C.GeocodePlace[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const [locating, setLocating] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  /** ย้ายหมุดไม่ได้ (ดูอย่างเดียว / กำลังบันทึก) */
  const locked = readOnly || disabled;

  /** ตั้งหมุด (ปัด 6 ตำแหน่ง) · นอกไทย = ไม่รับ · fly = ซูมไปที่หมุด (ค้นหา / วางพิกัด / ตำแหน่งของฉัน) */
  const place = (ll: LatLngValue, fly: boolean) => {
    // ผลค้นหา/ตำแหน่งของฉันที่ตอบกลับมาระหว่างบันทึก → ไม่ย้ายหมุด
    if (locked) return false;
    const next = { lat: roundCoord(ll.lat), lng: roundCoord(ll.lng) };
    if (!isInThailand(next.lat, next.lng)) {
      void message.warning('หมุดต้องอยู่ในประเทศไทย');
      return false;
    }
    onChange?.(next);
    if (fly && map) {
      flownTo.current = next;
      if (reduce) map.setView([next.lat, next.lng], PIN_ZOOM);
      else map.flyTo([next.lat, next.lng], PIN_ZOOM, { duration: 0.8 });
    }
    return true;
  };

  // หมุดเปลี่ยนจากข้างนอก (คืนค่าฟอร์ม / โหลดค่าใหม่) แล้วอยู่นอกจอ → เลื่อนแผนที่ไปหา
  const lat = pin?.lat;
  const lng = pin?.lng;
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    if (flownTo.current?.lat === lat && flownTo.current.lng === lng) return;
    if (!map.getBounds().contains([lat, lng])) map.panTo([lat, lng], { animate: !reduce });
  }, [map, lat, lng, reduce]);

  const runSearch = async (raw: string) => {
    if (!search) return;
    const q = raw.trim();
    const coords = parseLatLng(q);
    if (coords) {
      // พิมพ์/วางพิกัดในช่องค้นหา → ปักเลยไม่ต้องเรียก API
      setResults(null);
      setSearchError(null);
      place(coords, true);
      return;
    }
    if (q.length < 2) {
      setResults(null);
      setSearchError('พิมพ์อย่างน้อย 2 ตัวอักษร');
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await search(q);
      if (seq === searchSeq.current) setResults(found);
    } catch (e) {
      if (seq === searchSeq.current) {
        setResults(null);
        setSearchError((e as Error).message);
      }
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  const choose = (p: C.GeocodePlace) => {
    if (!place({ lat: p.lat, lng: p.lng }, true)) return;
    onPickPlace?.(p);
    setResults(null);
  };

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isInThailand(ll.lat, ll.lng)) {
          void message.warning('ตำแหน่งปัจจุบันอยู่นอกประเทศไทย');
          return;
        }
        place(ll, true);
      },
      (err) => {
        setLocating(false);
        void message.warning(
          err.code === err.PERMISSION_DENIED
            ? 'เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน'
            : 'หาตำแหน่งปัจจุบันไม่ได้ — ลองใหม่ หรือลากหมุดเอง',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const applyPaste = () => {
    const ll = parseLatLng(pasteText);
    if (!ll) {
      setPasteError('อ่านพิกัดไม่ออก — วางแบบ 13.7563, 100.5018 หรือลิงก์ Google Maps');
      return;
    }
    if (!place(ll, true)) return;
    setPasteOpen(false);
    setPasteText('');
    setPasteError(null);
  };

  const moved = current && pin ? distanceMeters(current, pin) : null;
  const showGhost = !!current && (moved === null || moved >= SAME_SPOT_M);
  const statusText = pin
    ? `พิกัด ${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}${
        moved !== null && moved >= SAME_SPOT_M ? ` (ห่างจากหมุดเดิม ${formatDistance(moved)})` : ''
      }`
    : readOnly
      ? 'ยังไม่ได้ปักหมุด'
      : 'แตะแผนที่ ลากหมุด หรือค้นหาที่อยู่ เพื่อปักหมุดร้าน';

  return (
    <div id={id} className="flex min-w-0 flex-col gap-2">
      {!readOnly && search && (
        <div className="flex flex-col gap-1.5">
          <Input.Search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSearch={(q, _e, info) => {
              if (info?.source === 'clear') {
                setResults(null);
                setSearchError(null);
                return;
              }
              void runSearch(q);
            }}
            // Enter ในฟอร์ม = ค้นหาเท่านั้น (ไม่ส่งฟอร์ม)
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            enterButton="ค้นหา"
            loading={searching}
            disabled={disabled}
            allowClear
            enterKeyHint="search"
            placeholder="ค้นหาชื่อสถานที่ ถนน หรือซอย"
            aria-label="ค้นหาที่อยู่เพื่อปักหมุด"
          />
          <div aria-live="polite" className="empty:hidden">
            {searchError && <p className="m-0 text-[13px] text-(--crowd-full)">{searchError}</p>}
            {results && results.length === 0 && (
              <p className="m-0 text-[13px] text-muted">
                ไม่พบสถานที่นี้ — ลองชื่อถนน/ซอย หรือลากหมุดเอง
              </p>
            )}
            {results && results.length > 0 && (
              <ul className="m-0 grid list-none gap-0.5 rounded-xl border border-border bg-surface p-1">
                {results.map((p) => (
                  <li key={`${p.lat},${p.lng},${p.label}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => choose(p)}
                      className="flex min-h-11 w-full touch-manipulation select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-text hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-gold active:bg-gold/15 disabled:opacity-60"
                    >
                      <MapPin className="shrink-0 text-gold" aria-hidden="true" />
                      <span className="line-clamp-2 min-w-0">{p.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div
        role="region"
        aria-label="แผนที่ปักหมุดร้าน"
        className={`relative overflow-hidden rounded-2xl border border-border ${className}`}
      >
        <MapContainer
          center={initialView.center}
          zoom={initialView.zoom}
          minZoom={5}
          maxBounds={MAX_BOUNDS}
          maxBoundsViscosity={1}
          // ไม่ดักล้อเมาส์ — เลื่อนหน้าได้ตามปกติ (ซูมด้วยปุ่ม +/−)
          scrollWheelZoom={false}
          dragging={!readOnly}
          ref={setMap}
          className="size-full"
        >
          <MapBaseLayer theme={resolved} />
          {!locked && <TapToPin onTap={(ll) => place(ll, false)} />}
          {showGhost && current && (
            <Marker
              position={[current.lat, current.lng]}
              icon={ghostMarker}
              keyboard={false}
              zIndexOffset={-100}
            >
              <Tooltip direction="top">{currentLabel}</Tooltip>
            </Marker>
          )}
          {pin && (
            <Marker
              position={[pin.lat, pin.lng]}
              icon={pinMarker}
              draggable={!locked}
              keyboard={false}
              zIndexOffset={100}
              title={readOnly ? 'หมุดร้าน' : 'ลากเพื่อย้ายหมุด'}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target as LeafletMarker;
                  // นอกไทย → หมุดเด้งกลับที่เดิม
                  if (!place(marker.getLatLng(), false)) marker.setLatLng([pin.lat, pin.lng]);
                },
              }}
            />
          )}
        </MapContainer>
        {!readOnly && canLocate && (
          <button
            type="button"
            aria-label="ใช้ตำแหน่งของฉัน"
            aria-busy={locating}
            disabled={locating || disabled}
            onClick={locate}
            className="absolute right-3 top-3 z-[500] grid size-11 touch-manipulation select-none place-items-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-gold active:bg-black/85 disabled:opacity-70"
          >
            <Crosshair
              size={22}
              aria-hidden="true"
              className={locating ? 'motion-safe:animate-pulse' : ''}
            />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span
          className={`min-w-0 text-[13px] ${pin ? 'text-muted tabular-nums' : 'text-gold-text'}`}
        >
          {statusText}
        </span>
        {!readOnly && (
          <Popover
            trigger="click"
            placement="bottomRight"
            open={pasteOpen}
            onOpenChange={(open) => {
              setPasteOpen(open);
              if (!open) setPasteError(null);
            }}
            title="วางพิกัด"
            content={
              <div className="flex w-72 max-w-[calc(100vw-48px)] flex-col gap-2">
                <Input
                  size="large"
                  autoFocus
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    setPasteError(null);
                  }}
                  onPressEnter={applyPaste}
                  status={pasteError ? 'error' : undefined}
                  placeholder="13.7563, 100.5018 หรือลิงก์ Google Maps"
                  aria-label="พิกัดหรือลิงก์ Google Maps"
                  autoComplete="off"
                />
                {pasteError && (
                  <p role="alert" className="m-0 text-[13px] text-(--crowd-full)">
                    {pasteError}
                  </p>
                )}
                <Button type="primary" onClick={applyPaste}>
                  ใช้พิกัดนี้
                </Button>
              </div>
            }
          >
            <Button
              type="link"
              disabled={disabled}
              icon={<ClipboardText aria-hidden="true" />}
              className="!h-11 !px-0 lg:!h-8"
            >
              วางพิกัด
            </Button>
          </Popover>
        )}
      </div>
    </div>
  );
}

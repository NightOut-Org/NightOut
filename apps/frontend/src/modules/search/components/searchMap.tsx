import {
  CircleNotch,
  CornersIn,
  CornersOut,
  Crosshair,
  MagnifyingGlassPlus,
  Minus,
  Plus,
  X,
} from '@phosphor-icons/react';
import type { BarWithTier } from '@/services/data';
import { useThemeMode } from '@nightout/ui';
import { App } from 'antd';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router';
import { CrowdBadge } from '@/ui/components/crowdBadge';
import { MapBaseLayer } from '@/ui/components/mapBaseLayer';
import { barImage } from '@/ui/utils/barImage';
import { baht } from '@/ui/utils/format';
import { meIcon, photoPin, PIN_LABEL_ZOOM } from './mapPins';
import '../search.css';

const BANGKOK: [number, number] = [13.745, 100.56];
/** ความสูงการ์ดร้านโดยประมาณ (รูป 116 + เนื้อหา) — ใช้วางการ์ดข้างหมุดไม่ให้ล้นกรอบ */
const CARD_H = 250;
const CARD_W = 280;
/** หมุด 44 + หาง 8 → กึ่งกลางรูปอยู่เหนือพิกัด ~30px */
const PIN_CENTER_DY = 30;

export type LatLng = [number, number];

/** fit ให้เห็นทุกหมุดเมื่อชุดร้านเปลี่ยน (ไม่ fit ซ้ำตอนแค่เลือก/ชี้ร้าน) */
function FitBounds({ bars }: { bars: BarWithTier[] }) {
  const map = useMap();
  const key = bars.map((b) => b.id).join(',');
  useEffect(() => {
    if (bars.length === 1) map.setView([bars[0]!.lat, bars[0]!.lng], 15);
    else if (bars.length > 1)
      map.fitBounds(bars.map((b) => [b.lat, b.lng]) as LatLngBoundsExpression, {
        padding: [56, 56],
        maxZoom: 15,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** พาไปหาร้านที่เลือกจากรายการ ถ้าหมุดอยู่นอกกรอบ */
function PanToSelected({ bar }: { bar: BarWithTier | null }) {
  const map = useMap();
  useEffect(() => {
    if (bar && !map.getBounds().pad(-0.15).contains([bar.lat, bar.lng]))
      map.panTo([bar.lat, bar.lng]);
  }, [map, bar]);
  return null;
}

/** แตะพื้นแผนที่ = ปิดการ์ด · ซูม/ย่อขยายกรอบ = อ่านขนาดใหม่ · ขยับแผนที่ = วางการ์ดใหม่ (onMove) */
function MapEvents({
  onClose,
  onView,
  onMove,
}: {
  onClose: () => void;
  onView: (map: LeafletMap) => void;
  onMove: () => void;
}) {
  const map = useMapEvents({
    click: onClose,
    move: onMove,
    zoomend: () => onView(map),
    resize: () => onView(map),
  });
  return null;
}

const mapButton =
  'grid size-11 touch-manipulation place-items-center rounded-full border border-border bg-surface/95 text-text shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur transition-colors hover:border-gold hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60';
const zoomButton =
  'grid size-11 touch-manipulation place-items-center text-text transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold';

/** ปุ่ม "ตำแหน่งของฉัน" — ขอพิกัดตอนกดเท่านั้น (ไม่ขอสิทธิ์ตอนเปิดหน้า) แล้วบินไปที่จุดนั้น */
function useMyLocation(map: LeafletMap | null, onLocate: (ll: LatLng) => void) {
  const { message } = App.useApp();
  const reduce = useReducedMotion();
  const [locating, setLocating] = useState(false);
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const ll: LatLng = [pos.coords.latitude, pos.coords.longitude];
        onLocate(ll);
        map?.flyTo(ll, Math.max(map.getZoom(), 14), { duration: reduce ? 0 : 0.8 });
      },
      (err) => {
        setLocating(false);
        void message.warning(
          err.code === err.PERMISSION_DENIED
            ? 'เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน'
            : 'หาตำแหน่งปัจจุบันไม่ได้ — ลองใหม่อีกครั้ง',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  return { locating, canLocate, locate };
}

/**
 * ขยายแผนที่เต็มจอด้วย CSS (ใช้แผนที่ตัวเดิม หมุด/การ์ดไม่หาย · iPhone ไม่รองรับ Fullscreen API) · Esc = ย่อ
 * ระหว่างเต็มจอ หน้าค้นหาปิด `isolate` ของตัวเอง (`data-map-fullscreen`) ให้แผนที่อยู่เหนือ navbar
 */
function useMapFullscreen(map: LeafletMap | null) {
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    map?.invalidateSize();
    if (!fullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [map, fullscreen]);
  return { fullscreen, toggle: () => setFullscreen((v) => !v) };
}

interface View {
  zoom: number;
  w: number;
  h: number;
}

/**
 * ตำแหน่งการ์ดร้าน (ดีไซน์ v2): กรอบกว้างพอ = การ์ด 280px ข้างหมุด (หมุดอยู่ครึ่งขวา → การ์ดไปทางซ้าย) ไม่ล้นบน/ล่าง
 * กรอบแคบ/เตี้ย = การ์ดเต็มความกว้างชิดล่าง
 */
function cardStyle(map: LeafletMap, bar: BarWithTier, view: View): CSSProperties | null {
  if (view.w < 520 || view.h < CARD_H + 24) return null;
  const p = map.latLngToContainerPoint([bar.lat, bar.lng]);
  const top = Math.max(12, Math.min(view.h - CARD_H - 12, p.y - PIN_CENTER_DY - CARD_H / 2));
  const toLeft = p.x > view.w * 0.55;
  return { top, left: toLeft ? p.x - CARD_W - 32 : p.x + 32, width: CARD_W };
}

/**
 * แผนที่หน้าค้นหา (ดีไซน์ Search Combined v2) — ใช้แผนที่จริงของเว็บ (Leaflet + MapBaseLayer)
 * - หมุดรูปร้านวงกลมขอบทอง · ซูมถึง PIN_LABEL_ZOOM = ชื่อร้านใต้หมุด (ซูมออก = ป้ายบอกให้ซูม)
 * - กดหมุด → การ์ดร้านข้างหมุด (จอแคบ: ชิดล่าง) ปิดด้วย × หรือแตะพื้นแผนที่
 * - ขวาบน: ขยายเต็มจอ / ย่อ · ตำแหน่งของฉัน (จุดฟ้า → ระยะทางในรายการ) · ซูมเข้า/ออก
 */
export function SearchMap({
  bars,
  activeId,
  cardOpen,
  me,
  distanceKm,
  onSelect,
  onCloseCard,
  onLocate,
  className = '',
}: {
  bars: BarWithTier[];
  /** ร้านที่ไฮไลต์ (กดหมุด หรือชี้แถวในรายการ) */
  activeId: string | null;
  cardOpen: boolean;
  me: LatLng | null;
  distanceKm: (bar: BarWithTier) => number | undefined;
  onSelect: (id: string) => void;
  onCloseCard: () => void;
  onLocate: (ll: LatLng) => void;
  className?: string;
}) {
  const { resolved } = useThemeMode();
  const active = useMemo(() => bars.find((b) => b.id === activeId) ?? null, [bars, activeId]);
  const card = cardOpen ? active : null;
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [view, setView] = useState<View>({ zoom: 12, w: 0, h: 0 });
  const { locating, canLocate, locate } = useMyLocation(map, onLocate);
  const { fullscreen, toggle } = useMapFullscreen(map);

  // ขยับแผนที่ทุกเฟรม = render ใหม่เฉพาะตอนมีการ์ดลอยข้างหมุด (หมุดใช้ icon ที่ memo ไว้)
  const [, setMoveTick] = useState(0);
  const syncView = useCallback((m: LeafletMap) => {
    const size = m.getSize();
    const next = { zoom: m.getZoom(), w: size.x, h: size.y };
    setView((prev) =>
      prev.zoom === next.zoom && prev.w === next.w && prev.h === next.h ? prev : next,
    );
  }, []);
  // ขนาดตอนเริ่ม: อ่านตอนได้ map · เปลี่ยนภายหลัง (เต็มจอ/หมุนจอ) มาทาง event resize ของ Leaflet
  const attachMap = useCallback(
    (m: LeafletMap | null) => {
      setMap(m);
      if (m) syncView(m);
    },
    [syncView],
  );

  const showLabels = view.zoom >= PIN_LABEL_ZOOM;
  const markers = useMemo(
    () =>
      bars.map((b) => (
        <Marker
          key={b.id}
          position={[b.lat, b.lng]}
          icon={photoPin(b, b.id === activeId, showLabels)}
          zIndexOffset={b.id === activeId ? 1000 : b.promoted ? 100 : 0}
          eventHandlers={{ click: () => onSelect(b.id) }}
          title={b.name}
          alt={b.name}
        />
      )),
    [bars, activeId, showLabels, onSelect],
  );
  const floating = map && card ? cardStyle(map, card, view) : null;
  const dist = card ? distanceKm(card) : undefined;

  return (
    <div
      data-map-fullscreen={fullscreen || undefined}
      className={`isolate overflow-hidden bg-card ${
        fullscreen
          ? 'fixed inset-0 z-[1000] h-dvh w-full'
          : `relative rounded-3xl border border-border ${className}`
      }`}
    >
      <MapContainer
        center={BANGKOK}
        zoom={12}
        zoomControl={false}
        className="size-full"
        attributionControl
        ref={attachMap}
      >
        <MapBaseLayer theme={resolved} />
        <FitBounds bars={bars} />
        <PanToSelected bar={card} />
        <MapEvents
          onClose={onCloseCard}
          onView={syncView}
          onMove={() => card && setMoveTick((t) => t + 1)}
        />
        {markers}
        {me && <Marker position={me} icon={meIcon} interactive={false} zIndexOffset={-100} />}
      </MapContainer>

      <div className="absolute right-3 top-3 z-[600] flex flex-col items-end gap-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          aria-label={fullscreen ? 'ย่อแผนที่' : 'ขยายแผนที่เต็มจอ'}
          aria-pressed={fullscreen}
          title={fullscreen ? 'ย่อแผนที่ (Esc)' : 'ขยายแผนที่เต็มจอ'}
          onClick={toggle}
          className={mapButton}
        >
          {fullscreen ? (
            <CornersIn size={20} weight="bold" />
          ) : (
            <CornersOut size={20} weight="bold" />
          )}
        </button>
        {canLocate && (
          <button
            type="button"
            aria-label="ตำแหน่งของฉัน"
            title="ตำแหน่งของฉัน"
            onClick={locate}
            disabled={locating}
            className={mapButton}
          >
            {locating ? (
              <CircleNotch
                size={20}
                weight="bold"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Crosshair size={20} weight="bold" className={me ? 'text-sky-400' : ''} />
            )}
          </button>
        )}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface/95 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur">
          <button
            type="button"
            aria-label="ซูมเข้า"
            onClick={() => map?.zoomIn()}
            className={`${zoomButton} border-b border-border`}
          >
            <Plus size={16} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="ซูมออก"
            onClick={() => map?.zoomOut()}
            className={zoomButton}
          >
            <Minus size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* มุมซ้ายบน — มุมล่างมีแถบ attribution ของแผนที่ */}
      {!showLabels && (
        <p className="pointer-events-none absolute left-3 top-3 z-[500] mt-[env(safe-area-inset-top)] flex items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2.5 py-1.5 text-xs text-muted">
          <MagnifyingGlassPlus size={14} aria-hidden />
          ซูมเข้าเพื่อดูชื่อร้าน
        </p>
      )}

      {card && (
        <div
          style={floating ?? undefined}
          className={`absolute z-[600] overflow-hidden rounded-2xl border border-gold bg-surface/95 shadow-[0_14px_40px_rgba(0,0,0,0.55)] backdrop-blur-md ${
            // กรอบแคบ: การ์ดแนวนอนชิดล่าง (เหนือแถบ attribution) ไม่บังแผนที่ทั้งกรอบ
            floating ? '' : 'inset-x-3 bottom-12 flex items-stretch'
          }`}
        >
          <div className={floating ? 'relative' : 'shrink-0 p-2 pr-0'}>
            <img
              src={barImage(card)}
              alt=""
              className={`block object-cover ${floating ? 'h-[116px] w-full' : 'size-[76px] rounded-[10px]'}`}
            />
            <button
              type="button"
              aria-label="ปิดการ์ดร้าน"
              onClick={onCloseCard}
              className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-gold"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
          <div
            className={`flex min-w-0 flex-1 flex-col gap-1.5 leading-snug ${floating ? 'px-3.5 pb-3.5 pt-3' : 'py-2 pl-3 pr-11'}`}
          >
            <div className="flex items-baseline justify-between gap-2.5">
              <p className="min-w-0 truncate font-display text-[17px]">{card.name}</p>
              <span className="shrink-0 text-[13px] text-gold-text">
                {card.isNew ? 'ร้านใหม่' : `★ ${card.rating.toFixed(1)}`}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted [&_.text-sm]:text-xs">
              <span>{card.district}</span>
              {dist !== undefined && (
                <>
                  <span aria-hidden className="size-[3px] rounded-full bg-muted" />
                  <span>{dist.toFixed(1)} กม.</span>
                </>
              )}
              <span aria-hidden className="size-[3px] rounded-full bg-muted" />
              <CrowdBadge crowd={card.crowd} updatedAt={card.crowdUpdatedAt} />
            </p>
            <div
              className={`flex items-center justify-between gap-2 border-t border-border ${floating ? 'mt-1 pt-2.5' : 'pt-1.5'}`}
            >
              <p className="text-xs text-muted">
                {card.avgPerPerson > 0 ? (
                  <>
                    <b className="text-base text-gold-text dark:text-gold-highlight">
                      {baht(card.avgPerPerson)}
                    </b>{' '}
                    /คน
                  </>
                ) : (
                  'ร้านยังไม่ระบุราคา'
                )}
              </p>
              <Link to={`/bars/${card.slug}`} className="text-[13px] font-semibold">
                ดูรายละเอียด →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

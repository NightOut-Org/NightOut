import { CircleNotch, CornersIn, CornersOut, Crosshair, X } from '@phosphor-icons/react';
import { safetyScore, type BarWithTier } from '@/services/data';
import { useThemeMode } from '@nightout/ui';
import { App } from 'antd';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router';
import { BarRating } from '@/ui/components/barRating';
import { CrowdBadge } from '@/ui/components/crowdBadge';
import { MapBaseLayer } from '@/ui/components/mapBaseLayer';
import { barImage } from '@/ui/utils/barImage';
import { baht } from '@/ui/utils/format';
import { meIcon, pricePin } from './pricePin';
import '../search.css';

const BANGKOK: [number, number] = [13.745, 100.56];

/** fit ให้เห็นทุกหมุดเมื่อชุดร้านเปลี่ยน (ไม่ fit ซ้ำตอนแค่เลือก/ชี้ร้าน) */
function FitBounds({ bars }: { bars: BarWithTier[] }) {
  const map = useMap();
  const key = bars.map((b) => b.id).join(',');
  useEffect(() => {
    if (bars.length === 1) map.setView([bars[0]!.lat, bars[0]!.lng], 15);
    else if (bars.length > 1)
      map.fitBounds(bars.map((b) => [b.lat, b.lng]) as LatLngBoundsExpression, { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** พาไปหาร้านที่เลือกจากรายการ ถ้าหมุดอยู่นอกกรอบ */
function PanToSelected({ bar }: { bar: BarWithTier | null }) {
  const map = useMap();
  useEffect(() => {
    if (bar && !map.getBounds().pad(-0.1).contains([bar.lat, bar.lng])) map.panTo([bar.lat, bar.lng]);
  }, [map, bar]);
  return null;
}

const mapButton =
  'grid size-11 touch-manipulation place-items-center rounded-full border border-border bg-surface/95 text-text shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur transition-colors hover:border-gold hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:opacity-60';

/** ปุ่ม "ตำแหน่งของฉัน" — ขอพิกัดตอนกดเท่านั้น (ไม่ขอสิทธิ์ตอนเปิดหน้า) แล้วบินไปที่จุดนั้น */
function useMyLocation(map: LeafletMap | null) {
  const { message } = App.useApp();
  const reduce = useReducedMotion();
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const canLocate = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMe(ll);
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
  return { me, locating, canLocate, locate };
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

function CloseOnMapClick({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: onClose });
  return null;
}

/**
 * แผนที่หน้าค้นหา (ดีไซน์ Search Combined · แผนที่จาก 01) — ใช้แผนที่จริงของเว็บ (Leaflet + MapBaseLayer)
 * - หมุดแคปซูลทอง รูปร้าน + ราคาต่อหัว · ร้านที่เลือก/ชี้ในรายการ = หมุดพื้นทองลอยเหนือหมุดอื่น
 * - กดหมุด → การ์ดเล็กมุมขวาล่าง (ปิดด้วย × หรือแตะพื้นแผนที่) · ไม่บังหมุดทั้งแผนที่
 * - ขวาบน: ขยายเต็มจอ / ย่อ · ตำแหน่งของฉัน (จุดฟ้า)
 */
export function SearchMap({
  bars,
  activeId,
  cardOpen,
  onSelect,
  onCloseCard,
  className = '',
}: {
  bars: BarWithTier[];
  /** ร้านที่ไฮไลต์ (กดหมุด หรือชี้แถวในรายการ) */
  activeId: string | null;
  cardOpen: boolean;
  onSelect: (id: string) => void;
  onCloseCard: () => void;
  className?: string;
}) {
  const { resolved } = useThemeMode();
  const active = useMemo(() => bars.find((b) => b.id === activeId) ?? null, [bars, activeId]);
  const card = cardOpen ? active : null;
  const [map, setMap] = useState<LeafletMap | null>(null);
  const { me, locating, canLocate, locate } = useMyLocation(map);
  const { fullscreen, toggle } = useMapFullscreen(map);

  return (
    <div
      data-map-fullscreen={fullscreen || undefined}
      className={`isolate overflow-hidden bg-card ${
        fullscreen ? 'fixed inset-0 z-[1000] h-dvh w-full' : `relative rounded-3xl border border-border ${className}`
      }`}
    >
      <MapContainer center={BANGKOK} zoom={12} className="size-full" attributionControl ref={setMap}>
        <MapBaseLayer theme={resolved} />
        <FitBounds bars={bars} />
        <PanToSelected bar={card} />
        <CloseOnMapClick onClose={onCloseCard} />
        {bars.map((b) => (
          <Marker
            key={b.id}
            position={[b.lat, b.lng]}
            icon={pricePin(b, b.id === activeId)}
            zIndexOffset={b.id === activeId ? 1000 : b.promoted ? 100 : 0}
            eventHandlers={{ click: () => onSelect(b.id) }}
            title={b.name}
            alt={b.name}
          />
        ))}
        {me && <Marker position={me} icon={meIcon} interactive={false} zIndexOffset={-100} />}
      </MapContainer>

      <div className="absolute right-3 top-3 z-[600] flex flex-col gap-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          aria-label={fullscreen ? 'ย่อแผนที่' : 'ขยายแผนที่เต็มจอ'}
          aria-pressed={fullscreen}
          title={fullscreen ? 'ย่อแผนที่ (Esc)' : 'ขยายแผนที่เต็มจอ'}
          onClick={toggle}
          className={mapButton}
        >
          {fullscreen ? <CornersIn size={20} weight="bold" /> : <CornersOut size={20} weight="bold" />}
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
              <CircleNotch size={20} weight="bold" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Crosshair size={20} weight="bold" className={me ? 'text-sky-400' : ''} />
            )}
          </button>
        )}
      </div>

      {card && (
        <div className="absolute inset-x-3 bottom-3 z-[600] ml-auto flex max-w-[420px] items-center gap-3 rounded-2xl border border-gold bg-surface/95 p-2 pr-10 shadow-[0_14px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <img src={barImage(card)} alt="" className="size-16 shrink-0 rounded-[10px] object-cover" />
          <div className="min-w-0 leading-snug">
            <p className="truncate font-display text-[17px] font-semibold">{card.name}</p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
              <BarRating bar={card} compact />
              <span aria-hidden>·</span>
              {card.district}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
              <CrowdBadge crowd={card.crowd} updatedAt={card.crowdUpdatedAt} />
              <span>Safety {safetyScore(card)}</span>
            </p>
            <p className="text-xs">
              {card.avgPerPerson > 0 && (
                <>
                  <b className="text-gold-text">{baht(card.avgPerPerson)}</b>
                  <span className="text-muted">/คน · </span>
                </>
              )}
              <Link to={`/bars/${card.slug}`}>ดูรายละเอียด →</Link>
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิดการ์ดร้าน"
            onClick={onCloseCard}
            className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-gold"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

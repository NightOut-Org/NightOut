import { X } from '@phosphor-icons/react';
import { safetyScore, type BarWithTier } from '@/services/data';
import { useThemeMode } from '@nightout/ui';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router';
import { BarRating } from '@/ui/components/barRating';
import { CrowdBadge } from '@/ui/components/crowdBadge';
import { MapBaseLayer } from '@/ui/components/mapBaseLayer';
import { barImage } from '@/ui/utils/barImage';
import { baht } from '@/ui/utils/format';
import { pricePin } from './pricePin';
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

function CloseOnMapClick({ onClose }: { onClose: () => void }) {
  useMapEvents({ click: onClose });
  return null;
}

/**
 * แผนที่หน้าค้นหา (ดีไซน์ Search Combined · แผนที่จาก 01) — ใช้แผนที่จริงของเว็บ (Leaflet + MapBaseLayer)
 * - หมุดแคปซูลทอง รูปร้าน + ราคาต่อหัว · ร้านที่เลือก/ชี้ในรายการ = หมุดพื้นทองลอยเหนือหมุดอื่น
 * - กดหมุด → การ์ดเล็กมุมขวาล่าง (ปิดด้วย × หรือแตะพื้นแผนที่) · ไม่บังหมุดทั้งแผนที่
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

  return (
    <div className={`relative isolate overflow-hidden rounded-3xl border border-border bg-card ${className}`}>
      <MapContainer center={BANGKOK} zoom={12} className="size-full" attributionControl>
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
      </MapContainer>

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

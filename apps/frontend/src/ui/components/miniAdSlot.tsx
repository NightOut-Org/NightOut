import { ArrowUpRight, X } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import { MINI_AD_LABEL } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

/**
 * Native Mini-Ads — แบนเนอร์เล็กป้าย "โฆษณา" ที่ Backoffice จัดการ (/mini-ads) · backend: domains/mini-ads
 * แสดงได้ 1 ชิ้นต่อตำแหน่งต่อการเปิดหน้า · ไม่กระทบผลค้นหา/อันดับ · โหลดไม่ได้ = ไม่แสดงอะไร (ห้ามทำหน้าพัง)
 */

/** GET /public/mini-ads?placement= — โฆษณาที่กำลังแสดง (สุ่มลำดับจาก server · สูงสุด 10) */
const fetchMiniAds = (placement: C.MiniAdPlacement) =>
  Rest.get<C.PublicMiniAd[]>('/public/mini-ads', { params: { placement } satisfies C.MiniAdsQuery });

const useMiniAds = (placement: C.MiniAdPlacement) =>
  useQuery({
    queryKey: ['mini-ads', placement],
    queryFn: () => fetchMiniAds(placement),
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

/** POST /public/mini-ads/:id/track — นับเห็น/คลิก (ไม่เก็บข้อมูลส่วนตัว) · ยิงแล้วลืม ไม่แจ้ง error */
const trackMiniAd = (id: string, body: C.TrackMiniAdBody) =>
  Rest.post<C.TrackMiniAdResult>(`/public/mini-ads/${id}/track`, body).catch(() => undefined);

/** หน้าค้นหาแทรกโฆษณาหลังร้านลำดับที่ 6 (น้อยกว่านั้น = หลังร้านสุดท้าย) */
export const MINI_AD_SEARCH_AFTER = 6;

const HIDE_MS = 24 * 3_600_000;
/** localStorage `{ [adId]: ซ่อนถึง epoch ms }` — ปุ่ม × ซ่อนโฆษณานั้น 24 ชม. บนเครื่องนี้ */
const HIDDEN_KEY = 'nightout-mini-ads-hidden';

/** `${placement}:${id}` ที่นับเห็นแล้วในการเปิดหน้านี้ — slot remount ตอนเปลี่ยนตัวกรองก็ไม่นับซ้ำ */
const counted = new Set<string>();
/** ตำแหน่งที่ผู้ใช้กด × ในการเปิดหน้านี้ — ปิดค้างแม้ storage ใช้ไม่ได้ (โหมดส่วนตัว) และ slot remount */
const dismissed = new Set<C.MiniAdPlacement>();

function readHidden(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const live: Record<string, number> = {};
    for (const [id, until] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof until === 'number' && until > now) live[id] = until;
    }
    // ตัดรายการหมดอายุทิ้ง
    if (Object.keys(live).length !== Object.keys(parsed).length) localStorage.setItem(HIDDEN_KEY, JSON.stringify(live));
    return live;
  } catch {
    return {};
  }
}

function writeHidden(hidden: Record<string, number>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
  } catch {
    // storage ถูกบล็อก — ใช้ `dismissed` ในหน่วยความจำแทน
  }
}

export function MiniAdSlot({ placement, className = '' }: { placement: C.MiniAdPlacement; className?: string }) {
  const { data } = useMiniAds(placement);
  const [hidden, setHidden] = useState(readHidden);
  const [closed, setClosed] = useState(() => dismissed.has(placement));
  const ref = useRef<HTMLElement>(null);
  const ad = closed ? undefined : data?.find((a) => !hidden[a.id]);
  const adId = ad?.id;

  // นับเห็นเมื่อการ์ดโผล่ ≥ 50% ครั้งเดียวต่อโฆษณาต่อตำแหน่งต่อการเปิดหน้า
  useEffect(() => {
    const el = ref.current;
    if (!adId || !el) return;
    const key = `${placement}:${adId}`;
    const count = () => {
      if (counted.has(key)) return;
      counted.add(key);
      void trackMiniAd(adId, { event: 'IMPRESSION', placement });
    };
    if (typeof IntersectionObserver === 'undefined') {
      count();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          count();
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [adId, placement]);

  if (!ad) return null;

  const onClick = () => void trackMiniAd(ad.id, { event: 'CLICK', placement });
  const hide = () => {
    const next = { ...hidden, [ad.id]: Date.now() + HIDE_MS };
    writeHidden(next);
    setHidden(next);
    dismissed.add(placement);
    setClosed(true);
  };

  const cardClass =
    'group flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 pr-11 !text-text transition-colors hover:border-purple/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [touch-action:manipulation] sm:gap-4 sm:p-3 sm:pr-12';
  const body = (
    <>
      <img
        src={ad.image_url}
        alt=""
        width={192}
        height={108}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="aspect-video w-28 shrink-0 rounded-xl bg-black/20 object-cover sm:w-40 md:w-48"
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted">
          <span className="shrink-0 rounded border border-border px-1.5 font-semibold">{MINI_AD_LABEL}</span>
          <span className="truncate">{ad.advertiser_name}</span>
        </p>
        <p className="mt-1 line-clamp-1 text-sm font-semibold sm:text-[15px]">{ad.title}</p>
        {ad.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted sm:text-sm">{ad.description}</p>}
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold-text sm:text-sm">
          {ad.cta_label}
          <ArrowUpRight size={14} aria-hidden />
        </span>
      </div>
    </>
  );

  return (
    <div className={className}>
      <aside ref={ref} aria-label={MINI_AD_LABEL} className="relative">
        {ad.link_url.startsWith('/') ? (
          <Link to={ad.link_url} onClick={onClick} className={cardClass}>
            {body}
          </Link>
        ) : (
          <a href={ad.link_url} target="_blank" rel="sponsored noopener noreferrer" onClick={onClick} className={cardClass}>
            {body}
            <span className="sr-only"> (เปิดแท็บใหม่)</span>
          </a>
        )}
        <button
          type="button"
          aria-label="ซ่อนโฆษณานี้"
          onClick={hide}
          className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-gold [touch-action:manipulation]"
        >
          <X size={14} weight="bold" aria-hidden />
        </button>
      </aside>
    </div>
  );
}

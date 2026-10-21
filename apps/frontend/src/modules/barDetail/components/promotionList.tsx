import { Tag as PromoIcon } from '@phosphor-icons/react';
import { useNow } from '@/hooks/useNow';
import type { Bar } from '@/services/data';
import { InfoSection } from '@/ui/components/infoSection';
import { barDealsToday, promoNote } from '@/ui/utils/promotion';

const PICK_DATE_HINT = 'เลือกวันที่ตอนจองเพื่อดูโปรที่ใช้ได้';

/**
 * ดีลวันนี้ (เวลากรุงเทพ · เลือกได้ตอนจอง) — แสดงเฉพาะโปรของวันนี้ · เลย cutoff = จางลง "หมดเวลาวันนี้"
 * โปรวันอื่นบอกแค่จำนวน (ไม่แสดงชื่อ) · ไม่มีโปรที่ลูกค้าเห็นได้เลย = ไม่แสดง
 */
export function PromotionList({ bar }: { bar: Pick<Bar, 'promotions' | 'hours'> }) {
  const now = useNow(60_000);
  const { live, ended, otherDays, closedToday } = barDealsToday(bar, now);
  if (!live.length && !ended.length && !otherDays.length) return null;
  const today = live.length + ended.length > 0;
  return (
    <InfoSection icon={<PromoIcon />} title="ดีลวันนี้ (เลือกได้ตอนจอง)">
      {today ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {live.map((p) => (
              <div key={p.id} className="rounded-xl border border-gold/40 bg-gold/5 p-3">
                <p className="font-semibold">{p.title}</p>
                <p className="text-xs text-muted">{promoNote(p)}</p>
              </div>
            ))}
            {ended.map((p) => (
              <div key={p.id} className="rounded-xl border border-border p-3 opacity-60">
                <p className="font-semibold">{p.title}</p>
                <p className="text-xs text-muted">
                  หมดเวลาวันนี้ (ต้องเช็กอินก่อน {p.cutoffTime} น.)
                </p>
              </div>
            ))}
          </div>
          {otherDays.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              โปรวันอื่นอีก {otherDays.length} รายการ — {PICK_DATE_HINT}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          {closedToday ? 'วันนี้ร้านปิด' : 'วันนี้ไม่มีดีล'} — มีโปรวันอื่นอีก {otherDays.length}{' '}
          รายการ {PICK_DATE_HINT}
        </p>
      )}
    </InfoSection>
  );
}

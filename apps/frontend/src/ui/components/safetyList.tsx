import { CheckCircle, ClipboardText, FileMagnifyingGlass, Question, XCircle } from '@phosphor-icons/react';
import { safetyVerifyLabel } from '@nightout/utils';
import type { SafetyVerifyMethod } from '@nightout/types';
import { SAFETY_LABELS, safetyScore, type Bar } from '@/services/data';
import { Progress, Tooltip } from 'antd';

/**
 * ข้อความตามข้อกฎหมาย (requirement "ป้าย Safety"): ข้อมูลเป็นของร้านแจ้งเอง + วันที่ตรวจล่าสุด + ปฏิเสธความรับผิด
 * ห้ามใช้คำว่า "Safety Verified" / "ยืนยันโดย NightOut"
 * ข้อที่ทีมงานตรวจแล้วแยก 2 วิธี (verifyMethod): "ตรวจหลักฐานแล้ว" (EVIDENCE · ไม่ได้ลงพื้นที่) / "ทีมงานลงพื้นที่ตรวจ" (ON_SITE)
 * ไม่รู้วิธี (cache เก่า) = ตรวจหลักฐาน — ห้ามอ้างว่าลงพื้นที่
 */
const SAFETY_SOURCE_LABEL = 'ข้อมูลอ้างอิงจากร้านค้า (Merchant Declared)';
const SAFETY_DISCLAIMER =
  'ร้านค้าเป็นผู้แจ้งและรับรองข้อมูลนี้เอง NightOut ไม่รับประกันความถูกต้อง และไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้ข้อมูลนี้ สภาพจริงของร้านอาจเปลี่ยนไปหลังวันที่ตรวจ';

const thaiDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

const methodOf = (s: Bar['safety'][number]): SafetyVerifyMethod => s.verifyMethod ?? 'EVIDENCE';

/** วันที่ทีมงานตรวจล่าสุดด้วยวิธีนั้น (null = ยังไม่เคยตรวจด้วยวิธีนี้) */
function lastVerifiedAt(bar: Bar, method: SafetyVerifyMethod): string | null {
  const dates = bar.safety.flatMap((s) =>
    s.source === 'ADMIN_VERIFIED' && s.verifiedAt && methodOf(s) === method ? [s.verifiedAt] : [],
  );
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

/** checklist ความปลอดภัย: แสดงสถานะเดียวต่อรายการ ✅ / ❌ / ⚪ + ข้อที่ทีมงานตรวจแล้วบอกวิธี (ตรวจหลักฐาน / ลงพื้นที่) + วันที่ */
export function SafetyList({ bar }: { bar: Bar }) {
  const score = safetyScore(bar);
  const onSiteAt = lastVerifiedAt(bar, 'ON_SITE');
  const evidenceAt = lastVerifiedAt(bar, 'EVIDENCE');
  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <Progress
          type="circle"
          percent={score}
          size={64}
          strokeColor="var(--gold)"
          format={(p) => `${p}`}
        />
        <div>
          <p className="font-semibold">Safety Score</p>
          <p className="text-sm text-muted">{SAFETY_SOURCE_LABEL}</p>
          <p className="text-xs text-muted">
            {onSiteAt ? `ทีมงานลงพื้นที่ตรวจล่าสุด ${thaiDate(onSiteAt)}` : 'ยังไม่มีการลงพื้นที่ตรวจ'}
          </p>
          {evidenceAt && (
            <p className="text-xs text-muted">{`ตรวจหลักฐานแล้วล่าสุด ${thaiDate(evidenceAt)}`}</p>
          )}
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {bar.safety.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
          >
            {s.value === 'YES' ? (
              <CheckCircle
                weight="fill"
                className="shrink-0 text-(--crowd-available)"
                aria-label="มี"
              />
            ) : s.value === 'NO' ? (
              <XCircle weight="fill" className="shrink-0 text-(--crowd-full)" aria-label="ไม่มี" />
            ) : (
              <Question weight="fill" className="shrink-0 text-muted" aria-label="ยังไม่มีข้อมูล" />
            )}
            <span className="flex-1 text-sm">{SAFETY_LABELS[s.key]}</span>
            {s.source === 'ADMIN_VERIFIED' ? (
              <VerifiedTag method={methodOf(s)} at={s.verifiedAt ?? null} />
            ) : (
              <span className="shrink-0 text-xs text-muted">ร้านแจ้ง</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted">{SAFETY_DISCLAIMER}</p>
    </div>
  );
}

/** ป้ายข้อที่ทีมงานตรวจแล้ว — "ทีมงานลงพื้นที่ตรวจ <วันที่>" (ทอง) / "ตรวจหลักฐานแล้ว <วันที่>" (ไม่ได้ลงพื้นที่) */
function VerifiedTag({ method, at }: { method: SafetyVerifyMethod; at: string | null }) {
  const label = at ? `${safetyVerifyLabel(method)} ${thaiDate(at)}` : safetyVerifyLabel(method);
  const tip =
    method === 'ON_SITE'
      ? 'ทีมงาน NightOut ลงพื้นที่ตรวจที่ร้าน'
      : 'ทีมงาน NightOut ตรวจจากหลักฐานที่ร้านแนบ (ไม่ได้ลงพื้นที่)';
  const Icon = method === 'ON_SITE' ? ClipboardText : FileMagnifyingGlass;
  return (
    <Tooltip title={tip}>
      <span
        className={`inline-flex shrink-0 items-center gap-1 text-right text-xs ${method === 'ON_SITE' ? 'text-gold-text' : 'text-muted'}`}
      >
        <Icon weight="fill" aria-hidden className="shrink-0" />
        {label}
      </span>
    </Tooltip>
  );
}

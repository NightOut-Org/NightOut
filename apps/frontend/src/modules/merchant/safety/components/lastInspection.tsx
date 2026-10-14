import type * as C from '@nightout/contracts';
import type { SafetyVerifyMethod } from '@nightout/types';
import { SAFETY_CHECK_LABELS, SAFETY_VERIFY_METHOD_LABELS } from '@nightout/utils';
import { ClipboardText } from '@phosphor-icons/react';
import { Image, Skeleton } from 'antd';
import type { Bar } from '@/services/data';
import { Tile } from '@/ui/components/merchantUi';
import { dateTime } from '@/ui/utils/format';

type SafetyRow = Bar['safety'][number];

/** วันที่สั้น เช่น "13 ต.ค. 69" — รูปแบบเดียวกับป้าย Safety หน้าบ้าน (ui/components/safetyList.tsx) */
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

/** ข้อนี้ในการลงพื้นที่ครั้งล่าสุด — เฉพาะผล ผ่าน/ไม่พบ (ไม่ได้ตรวจ = ไม่แสดง) */
export const inspectionItemOf = (inspection: C.SafetyInspectionSummary | null | undefined, key: string) =>
  inspection?.items.find((i) => i.feature_key === key && i.result !== 'NA');

/**
 * วิธีที่ทีมงานตรวจข้อ ADMIN_VERIFIED — EVIDENCE ตรวจหลักฐาน · ON_SITE ลงพื้นที่ · null = ไม่ได้ตรวจ (ร้านแจ้งเอง)
 * มาจาก bar_safety_features.verify_method (my_bar_detail) · ไม่รู้วิธี (cache เก่า) = EVIDENCE — ไม่อ้างว่าลงพื้นที่
 */
export const verifyMethodOf = (s: SafetyRow): SafetyVerifyMethod | null =>
  s.source === 'ADMIN_VERIFIED' ? (s.verifyMethod ?? 'EVIDENCE') : null;

/** วิธี + ผู้ตรวจ ที่ร้านเห็น (ไม่บอกชื่อแอดมิน) — ต่อท้ายด้วยวันที่ */
export const VERIFIED_BY_LABEL: Record<SafetyVerifyMethod, string> = {
  EVIDENCE: `ทีมงาน NightOut ${SAFETY_VERIFY_METHOD_LABELS.EVIDENCE}`,
  ON_SITE: 'ทีมงาน NightOut ลงพื้นที่ตรวจ',
};

/** รูปจากการลงพื้นที่ — 40px กดดูเต็มจอ · ยังไม่ได้ URL = กล่องว่าง */
export function InspectionPhotos({ paths, urls }: { paths: string[]; urls: Record<string, string> | undefined }) {
  if (!paths.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5 pt-1">
      <Image.PreviewGroup>
        {paths.map((p) =>
          urls?.[p] ? (
            <Image
              key={p}
              src={urls[p]}
              alt="รูปจากการลงพื้นที่ตรวจ"
              width={40}
              height={40}
              className="object-cover"
              rootClassName="overflow-hidden rounded-lg border border-border"
            />
          ) : (
            <span key={p} aria-hidden className="block size-10 rounded-lg border border-border bg-surface" />
          ),
        )}
      </Image.PreviewGroup>
    </span>
  );
}

function Chip({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>
      {label} <b>{n}</b>
    </span>
  );
}

/**
 * การ์ด "ลงพื้นที่ตรวจล่าสุด" ใต้ Safety Score — วันที่ · ผ่าน/ไม่พบ/ไม่ได้ตรวจ · หมายเหตุ (ไม่แสดงชื่อผู้ตรวจ)
 * ยังไม่เคยลงพื้นที่: บอกข้อที่ทีมงานตรวจหลักฐานแล้ว (ถ้ามี) แยกจากการลงพื้นที่
 */
export function LastInspectionTile({
  bar,
  inspection,
  loading,
  error,
}: {
  bar: Bar;
  inspection: C.SafetyInspectionSummary | null | undefined;
  loading: boolean;
  error?: boolean;
}) {
  const latest = (rows: SafetyRow[]) =>
    rows.reduce<string | null>((max, s) => (s.verifiedAt && (!max || s.verifiedAt > max) ? s.verifiedAt : max), null);

  let body;
  if (loading) {
    body = <Skeleton active title={false} paragraph={{ rows: 2 }} />;
  } else if (error) {
    body = <p className="m-0 text-muted">โหลดผลตรวจไม่สำเร็จ</p>;
  } else if (inspection) {
    body = (
      <>
        <span className="flex flex-col">
          <b className="font-medium">{dateTime(inspection.inspected_at)}</b>
          <span className="text-xs text-muted">โดยทีมงาน NightOut</span>
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Chip
            label={SAFETY_CHECK_LABELS.PASS}
            n={inspection.pass_count}
            cls="border-(--crowd-available)/40 bg-(--crowd-available)/10 text-(--crowd-available)"
          />
          <Chip
            label={SAFETY_CHECK_LABELS.FAIL}
            n={inspection.fail_count}
            cls="border-(--crowd-full)/40 bg-(--crowd-full)/10 text-(--crowd-full)"
          />
          <Chip label={SAFETY_CHECK_LABELS.NA} n={inspection.na_count} cls="border-border text-muted" />
        </span>
        {inspection.note && <p className="m-0 whitespace-pre-line break-words">{inspection.note}</p>}
        {inspection.fail_count > 0 && (
          <p className="m-0 text-xs text-(--crowd-full)">
            ข้อที่ไม่พบถูกเปลี่ยนเป็น "ไม่มี" แล้ว — ถ้าแก้ไขแล้ว เลือก "มี" + แนบหลักฐานใหม่ ทีมงานจะลงพื้นที่ตรวจอีกครั้ง
          </p>
        )}
      </>
    );
  } else {
    // ไม่มีบันทึกการลงพื้นที่ (หรือเปิดดูไม่ได้) — แยกข้อ ADMIN_VERIFIED ตามวิธีตรวจที่บันทึกไว้
    const verified = bar.safety.filter((s) => s.source === 'ADMIN_VERIFIED');
    const onSite = verified.filter((s) => verifyMethodOf(s) === 'ON_SITE');
    const evidence = verified.filter((s) => verifyMethodOf(s) === 'EVIDENCE');
    const onSiteAt = latest(onSite);
    const evidenceAt = latest(evidence);
    body = (
      <>
        {onSiteAt ? (
          <p className="m-0">
            {SAFETY_VERIFY_METHOD_LABELS.ON_SITE}ล่าสุด {shortDate(onSiteAt)}{' '}
            <span className="text-muted">(ไม่มีรายละเอียด checklist)</span>
          </p>
        ) : (
          <p className="m-0 text-muted">
            ทีมงาน NightOut ยังไม่เคยลงพื้นที่ตรวจร้านนี้ · ข้อที่ "มี" แนบหลักฐานไว้ ทีมงานจะนัดลงพื้นที่
          </p>
        )}
        {evidence.length > 0 && (
          <p className="m-0 text-xs text-muted">
            {SAFETY_VERIFY_METHOD_LABELS.EVIDENCE} {evidence.length} ข้อ{evidenceAt ? ` · ล่าสุด ${shortDate(evidenceAt)}` : ''}
          </p>
        )}
      </>
    );
  }

  return (
    <Tile className="flex flex-col gap-2.5 !rounded-[18px] !p-3.5 text-sm lg:!rounded-[20px] lg:!p-[18px]">
      <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold">
        <ClipboardText size={18} className="text-gold-text" /> ลงพื้นที่ตรวจล่าสุด
      </h2>
      {body}
    </Tile>
  );
}

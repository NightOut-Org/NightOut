import { Car, CheckCircle, Circle, DoorOpen, Files, FirstAidKit, Footprints, GenderFemale, IdentificationCard, Lightbulb, Paperclip, Phone, SealCheck, UserFocus, VideoCamera, XCircle } from '@phosphor-icons/react';
import { SAFETY_CHECK_LABELS } from '@nightout/utils';
import { App, Upload } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { SAFETY_LABELS, type SafetyValue } from '@/services/data';
import { StatusChip } from '@/ui/components/statusChip';
import { RuleList } from '@/ui/components/ruleList';

type SafetyKey = keyof typeof SAFETY_LABELS;
import { HEADER_SAVE_CLASS } from '@/ui/utils/buttonClasses';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Ring, Tile } from '@/ui/components/merchantUi';
import { saveSafety, useInspectionPhotoUrls, useLatestInspection } from './api';
import {
  InspectionPhotos,
  inspectionItemOf,
  LastInspectionTile,
  shortDate,
  VERIFIED_BY_LABEL,
  verifyMethodOf,
} from './components/lastInspection';
import { useSafetyDraft } from './utils/useSafetyDraft';

const ICON: Record<SafetyKey, ReactNode> = {
  SECURITY: <UserFocus />,
  CCTV: <VideoCamera />,
  FIRE_EXIT: <DoorOpen />,
  FIRST_AID: <FirstAidKit />,
  ID_CHECK: <IdentificationCard />,
  PARKING_RIDE: <Car />,
  FEMALE_STAFF: <GenderFemale />,
  LIGHTING: <Lightbulb />,
  EMERGENCY_CONTACT: <Phone />,
};

/**
 * สีของปุ่มที่เลือก — ใส่ `!` เพราะธีมมืด `.embers-glass .bg-card .merchant-pill` ทับพื้นเป็นกระจกใส
 * (เดิมปุ่มที่เลือกจึงไม่มีสี) · ไม่ระบุ = พื้นเทาทึบ + ขอบ ให้ต่างจากปุ่มที่ไม่ได้เลือก
 */
const OPTIONS: { value: SafetyValue; label: string; on: string }[] = [
  { value: 'YES', label: 'มี', on: '!bg-(--crowd-available) !text-on-gold font-semibold' },
  { value: 'NO', label: 'ไม่มี', on: '!bg-(--crowd-full) !text-white font-semibold' },
  {
    value: 'UNKNOWN',
    label: 'ไม่ระบุ',
    on: '!bg-text/15 !text-text font-semibold ring-1 ring-inset ring-text/30',
  },
];

/**
 * /merchant/safety — Safety Score + ผลลงพื้นที่ตรวจล่าสุด (ซ้าย) + checklist มี/ไม่มี/ไม่ระบุ + แนบหลักฐาน (ขวา)
 * แก้ทั้งหน้าในเครื่องก่อน (คะแนนคิดจากค่าที่แก้) แล้วกดบันทึกครั้งเดียว: อัปโหลดหลักฐาน → PUT /merchant/bars/:barId/safety
 * ทีมงานตรวจได้ 2 วิธี แยกให้เห็นทุกแถว: ตรวจหลักฐานแล้ว (EVIDENCE) · ทีมงานลงพื้นที่ตรวจ (ON_SITE — ผลต่อข้อจาก GET …/safety/inspection)
 */
export function MerchantSafetyPage() {
  const bar = useMerchantBar();
  const { message } = App.useApp();
  const draft = useSafetyDraft(bar);
  const [progress, setProgress] = useState<string | null>(null);
  const saving = progress !== null;
  const { confirmDiscard } = useUnsavedGuard(draft.count > 0);
  const inspectionQuery = useLatestInspection(bar.id);
  const inspection = inspectionQuery.data;
  const photoPaths = useMemo(() => inspection?.items.flatMap((i) => (i.result === 'NA' ? [] : i.photo_paths)) ?? [], [inspection]);
  const { data: photoUrls } = useInspectionPhotoUrls(photoPaths);
  const total = bar.safety.length;
  const yes = bar.safety.filter((s) => draft.valueOf(s) === 'YES').length;
  const no = bar.safety.filter((s) => draft.valueOf(s) === 'NO').length;
  // เปลี่ยนค่า = กลับเป็นร้านแจ้งเอง (ไม่นับว่าตรวจแล้ว)
  const verifiedRows = bar.safety.filter((s) => s.source === 'ADMIN_VERIFIED' && s.value === 'YES' && !draft.valueChanged(s));
  const verified = verifiedRows.length;
  const verifiedOnSite = verifiedRows.filter((s) => verifyMethodOf(s) === 'ON_SITE').length;

  const save = async () => {
    setProgress('กำลังบันทึก…');
    try {
      let body;
      try {
        body = await draft.upload((done, n) => setProgress(done < n ? `กำลังอัปโหลด ${done + 1}/${n}` : 'กำลังบันทึก…'));
      } catch (e) {
        // หลักฐานที่อัปโหลดสำเร็จแล้วอยู่ใน draft — กดบันทึกใหม่ไม่อัปโหลดซ้ำ
        void message.error(`อัปโหลดหลักฐานไม่สำเร็จ — ${(e as Error).message}`);
        return;
      }
      const r = await saveSafety(bar.id, body);
      draft.reset();
      void message.success(r.evidence_added ? 'บันทึกแล้ว และส่งหลักฐานให้ทีม NightOut ตรวจแล้ว' : 'บันทึกแล้ว');
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const saveButton = (cls: string, label: string) => (
    <button
      type="button"
      disabled={saving || !draft.count}
      onClick={() => void save()}
      className={`merchant-pill disabled:opacity-60 ${cls}`}
    >
      {saving ? progress : label}
    </button>
  );

  /**
   * บรรทัดใต้ชื่อ: ผู้ตรวจ + วิธี + วันที่ (ทีมงาน NightOut ตรวจหลักฐานแล้ว / ลงพื้นที่ตรวจ · เขียว) · ร้านแจ้ง รอตรวจ (เหลือง) · ลงพื้นที่แล้วไม่พบ (แดง) · ยังไม่มีข้อมูล
   * วันที่ต่อท้ายเฉพาะเมื่อแถว "ลงพื้นที่ …" ด้านล่างไม่ได้บอกวันเดียวกันอยู่แล้ว
   */
  const evidence = (s: (typeof bar.safety)[number]) => {
    const method = verifyMethodOf(s);
    // ลงพื้นที่ + ครั้งล่าสุดมีผลข้อนี้ = วันที่เดียวกับแถว "ลงพื้นที่ …" (ผลใหม่กว่าจะทับ verified_at เสมอ)
    const sameVisit = method === 'ON_SITE' && !!inspectionItemOf(inspection, s.key);
    const when = s.verifiedAt && !sameVisit ? ` ${shortDate(s.verifiedAt)}` : '';
    const checked = method !== null && !draft.valueChanged(s);
    return draft.valueOf(s) === 'YES'
      ? checked
        ? { text: `${VERIFIED_BY_LABEL[method ?? 'EVIDENCE']}${when}`, cls: 'text-(--crowd-available)' }
        : { text: 'ร้านแจ้งและแนบหลักฐานให้ทีมตรวจ', cls: 'text-(--crowd-almost-full)' }
      : draft.valueOf(s) === 'NO'
        ? checked && method === 'ON_SITE'
          ? { text: 'ทีมงานลงพื้นที่แล้วไม่พบ ลูกค้าเห็นว่า "ไม่มี"', cls: 'text-(--crowd-full)' }
          : { text: 'ลูกค้าเห็นว่า "ไม่มี"', cls: 'text-muted' }
        : { text: 'ยังไม่มีข้อมูล', cls: 'text-muted' };
  };

  const statusIcon = (v: SafetyValue) =>
    v === 'YES' ? (
      <CheckCircle weight="fill" className="text-(--crowd-available)" />
    ) : v === 'NO' ? (
      <XCircle weight="fill" className="text-(--crowd-full)" />
    ) : (
      <Circle className="text-muted" />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-bold lg:font-display lg:text-[30px]">ความปลอดภัย</h1>
          <RuleList
            className="mt-2 hidden text-sm text-muted lg:block"
            rules={[
              'ลูกค้าเห็นทุกข้อในชื่อ "ข้อมูลอ้างอิงจากร้านค้า (Merchant Declared)" และมีผลต่อดาวของร้าน',
              'ทีมงาน NightOut ตรวจหลักฐานที่แนบหรือลงพื้นที่ตรวจ แล้วผลตรวจจะแสดงที่นี่',
              { tone: 'check', text: 'แก้ได้หลายข้อแล้วกดบันทึกครั้งเดียว' },
            ]}
          />
        </div>
        <div className="flex items-center gap-1 lg:gap-3">
          {draft.count > 0 && !saving && (
            <>
              <span className="hidden text-sm text-gold-text lg:inline" role="status">
                ยังไม่บันทึก {draft.count} ข้อ
              </span>
              <button
                type="button"
                onClick={() => confirmDiscard(draft.reset)}
                className="merchant-pill px-2 py-1 text-sm text-muted lg:h-10 lg:rounded-xl lg:border lg:border-border lg:px-[18px]"
              >
                คืนค่า
              </button>
            </>
          )}
          {saveButton(HEADER_SAVE_CLASS, 'บันทึกการเปลี่ยนแปลง')}
          {saveButton('px-2 py-1 text-sm font-semibold text-gold-text lg:hidden', 'บันทึก')}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {/* คะแนน — Desktop เป็นวงใหญ่ · มือถือเป็นแถวเดียว */}
          <Tile className="flex items-center gap-3.5 !rounded-[18px] !p-3.5 lg:flex-col lg:gap-3 lg:!rounded-[20px] lg:!p-[22px]">
            <span className="lg:hidden">
              <Ring pct={total ? (yes / total) * 100 : 0} size={72}>
                <b className="text-base">
                  {yes}/{total}
                </b>
              </Ring>
            </span>
            <span className="hidden lg:block">
              <Ring pct={total ? (yes / total) * 100 : 0} size={140}>
                <b className="text-[32px] leading-none">
                  {yes}/{total}
                </b>
                <span className="mt-1 text-xs font-normal text-muted">Safety Score</span>
              </Ring>
            </span>
            <span className="flex flex-col gap-0.5 lg:items-center">
              <b className="text-[15px] lg:hidden">Safety Score</b>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-(--crowd-available) lg:rounded-full lg:border lg:border-(--crowd-available)/40 lg:bg-(--crowd-available)/10 lg:px-3 lg:py-1">
                <SealCheck weight="fill" /> ทีมงานตรวจแล้ว {verified} ข้อ
              </span>
              {verified > 0 && (
                <span className="text-xs text-muted">
                  <span className="flex flex-wrap gap-1.5">
                    <StatusChip tone="success" icon={<Footprints weight="fill" />} value={verifiedOnSite}>ลงพื้นที่</StatusChip>
                    <StatusChip tone="purple" icon={<Files weight="fill" />} value={verified - verifiedOnSite}>ตรวจหลักฐาน</StatusChip>
                  </span>
                </span>
              )}
            </span>
          </Tile>
          <LastInspectionTile
            bar={bar}
            inspection={inspection}
            loading={inspectionQuery.isPending}
            error={inspectionQuery.isError}
          />
          <Tile className="hidden flex-col gap-2.5 !p-[18px] text-sm lg:flex">
            <span className="flex items-center gap-2.5">
              <CheckCircle weight="fill" size={18} className="text-(--crowd-available)" />
              มี<b className="ml-auto">{yes}</b>
            </span>
            <span className="flex items-center gap-2.5">
              <XCircle weight="fill" size={18} className="text-(--crowd-full)" />
              ไม่มี<b className="ml-auto">{no}</b>
            </span>
            <span className="flex items-center gap-2.5">
              <Circle size={18} className="text-muted" />
              ยังไม่มีข้อมูล<b className="ml-auto">{total - yes - no}</b>
            </span>
          </Tile>
        </div>

        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:gap-0 lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-border lg:bg-card">
          {bar.safety.map((s) => {
            const ev = evidence(s);
            const value = draft.valueOf(s);
            const file = draft.fileOf(s);
            const checked = inspectionItemOf(inspection, s.key);
            return (
              <li
                key={s.key}
                className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-[14px] border border-border bg-card p-3 lg:min-h-[58px] lg:flex-nowrap lg:rounded-none lg:border-0 lg:border-b lg:border-border/60 lg:bg-transparent lg:px-5 lg:py-2 lg:last:border-b-0"
              >
                <span className="w-6 text-xl text-muted">{ICON[s.key]}</span>
                <span className="flex min-w-0 flex-1 flex-col text-sm">
                  <b className="font-medium">{SAFETY_LABELS[s.key]}</b>
                  <span className={`text-[11px] lg:text-xs ${ev.cls}`}>{ev.text}</span>
                  {checked && inspection && (
                    <>
                      <span
                        className={`break-words text-[11px] lg:text-xs ${checked.result === 'PASS' ? 'text-(--crowd-available)' : 'text-(--crowd-full)'}`}
                      >
                        ลงพื้นที่ {shortDate(inspection.inspected_at)}: {SAFETY_CHECK_LABELS[checked.result]}
                        {checked.note ? ` (${checked.note})` : ''}
                      </span>
                      <InspectionPhotos paths={checked.photo_paths} urls={photoUrls} />
                    </>
                  )}
                  {(draft.valueChanged(s) || file) && (
                    <span className="text-[11px] text-gold-text lg:text-xs">
                      ยังไม่บันทึก{file ? ` (หลักฐาน ${file})` : ''}
                    </span>
                  )}
                </span>
                <span className="text-[22px] lg:hidden">{statusIcon(value)}</span>
                <div
                  role="radiogroup"
                  aria-label={SAFETY_LABELS[s.key]}
                  className="flex flex-1 gap-0.5 rounded-[10px] border border-border bg-surface p-[3px] text-xs lg:flex-none"
                >
                  {OPTIONS.map((o) => {
                    const on = value === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={saving}
                        onClick={() => !on && draft.setValue(s, o.value)}
                        className={`merchant-pill min-h-9 flex-1 rounded-[7px] px-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold lg:min-h-0 lg:py-1 ${on ? o.on : 'text-muted hover:text-text'}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <Upload
                  accept="image/*,application/pdf"
                  showUploadList={false}
                  disabled={saving}
                  beforeUpload={(f) => {
                    if (f.size > 10 * 1024 * 1024) void message.error('ไฟล์ใหญ่เกิน 10MB');
                    else draft.setFile(s, f);
                    return Upload.LIST_IGNORE;
                  }}
                >
                  <button
                    type="button"
                    disabled={saving}
                    className="merchant-pill inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-[13px] text-muted hover:text-text disabled:opacity-60 lg:h-8"
                  >
                    <Paperclip /> หลักฐาน
                  </button>
                </Upload>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

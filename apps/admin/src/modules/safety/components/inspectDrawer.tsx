import { Camera, ClipboardText, X } from '@phosphor-icons/react';
import { ERROR_MESSAGES } from '@nightout/contracts';
import type * as C from '@nightout/contracts';
import type { Db, SafetyCheckResult } from '@nightout/types';
import {
  SAFETY_CHECK_NOTE_MAX,
  SAFETY_CHECK_RESULTS,
  SAFETY_INSPECTION_MAX_AGE_DAYS,
  SAFETY_INSPECTION_MAX_PHOTOS,
  SAFETY_INSPECTION_NOTE_MAX,
  safetyVerifyLabel,
} from '@nightout/utils';
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Grid,
  Image,
  Input,
  Segmented,
  Skeleton,
  Tag,
  TimePicker,
  Typography,
  Upload,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { useAdminAuth } from '@/services/adminAuth';
import { LoadError } from '@/ui/components/LoadError';
import { SlipImage } from '@/ui/components/SlipImage';
import { date } from '@/ui/utils/format';
import { inspectSafetyAction, useBarSafety } from '../api';
import {
  SAFETY_CHECK_TAG,
  SAFETY_INSPECTION_HINTS,
  SAFETY_VALUE_TEXT,
  SAFETY_VERIFY_TAG,
} from '../utils/labels';
import { useInspectionDraft } from '../utils/useInspectionDraft';
import { RuleList } from '@/ui/components/RuleList';

type Draft = ReturnType<typeof useInspectionDraft>;

/** รูปจากกล้องมือถือใหญ่ได้ — ย่อเป็น webp 1600px ก่อนอัปโหลด */
const PHOTO_MAX_BYTES = 20 * 1024 * 1024;
/** เวลาเครื่องคลาดได้ (ตรงกับ DB) */
const CLOCK_SKEW_MIN = 5;

/**
 * Drawer ลงพื้นที่ตรวจ Safety ของร้านเดียว (มือถือ = เต็มจอ) — ผ่าน / ไม่พบ / ไม่ได้ตรวจ ต่อข้อ + หมายเหตุ + รูป ≤ 3/ข้อ
 * บันทึก = อัปโหลดรูป → POST /admin/bars/:id/safety-inspections (ชื่อผู้ตรวจ + วันเวลา · แก้ไม่ได้ ตรวจใหม่ได้)
 * ปิดตอนยังไม่บันทึก = ถามก่อน · `barId` null = ปิด (เนื้อหายังอยู่จนปิดเสร็จ)
 */
export function InspectDrawer({
  barId,
  barName,
  onClose,
}: {
  barId: string | null;
  barName: string | undefined;
  onClose: () => void;
}) {
  // จำร้านล่าสุดไว้ระหว่างแอนิเมชันปิด (ตอนนั้น barId เป็น null แล้ว)
  const [shown, setShown] = useState(barId);
  const [shownName, setShownName] = useState(barName);
  if (barId && barId !== shown) setShown(barId);
  if (barName && barName !== shownName) setShownName(barName);
  if (!shown) return null;
  return (
    <InspectPanel
      key={shown}
      barId={shown}
      barName={shownName ?? 'ร้าน'}
      open={barId === shown}
      onClose={onClose}
      onClosed={() => setShown(null)}
    />
  );
}

function InspectPanel({
  barId,
  barName,
  open,
  onClose,
  onClosed,
}: {
  barId: string;
  barName: string;
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { md } = Grid.useBreakpoint();
  const { message, modal } = App.useApp();
  const { displayName } = useAdminAuth();
  const inspector = displayName ?? 'บัญชีของคุณ';
  const act = useAdminAction();
  const { data, isLoading, error, refetch } = useBarSafety(barId);
  const rows = data ?? [];
  const draft = useInspectionDraft(
    barId,
    rows.map((r) => r.feature_key),
  );
  const [progress, setProgress] = useState<string | null>(null);
  const saving = progress !== null;
  const { confirmDiscard } = useUnsavedGuard(draft.dirty);

  // ทุกการตรวจมี ผ่าน/ไม่พบ อย่างน้อย 1 ข้อ → เวลาล่าสุดของ last_inspected_at = การตรวจครั้งล่าสุดของร้าน
  const latest = rows.reduce<string | null>(
    (m, r) => (r.last_inspected_at && (!m || r.last_inspected_at > m) ? r.last_inspected_at : m),
    null,
  );

  const timeOk = (at: Dayjs | null) => {
    if (!at) return true;
    if (at.isAfter(dayjs().add(CLOCK_SKEW_MIN, 'minute'))) return false;
    if (at.isBefore(dayjs().subtract(SAFETY_INSPECTION_MAX_AGE_DAYS, 'day'))) return false;
    return !latest || !at.isBefore(dayjs(latest));
  };

  const close = () => {
    if (saving) return;
    confirmDiscard(() => {
      draft.reset();
      onClose();
    });
  };

  const save = async () => {
    setProgress('กำลังบันทึก…');
    try {
      let body: C.SafetyInspectionBody;
      try {
        body = await draft.upload((done, total) =>
          setProgress(done < total ? `กำลังอัปโหลด ${done + 1}/${total}` : 'กำลังบันทึก…'),
        );
      } catch (e) {
        void message.error(`อัปโหลดรูปไม่สำเร็จ — ${(e as Error).message}`);
        return;
      }
      try {
        await act.mutateAsync({
          ...inspectSafetyAction(barId, body),
          success: (r) =>
            `บันทึกผลตรวจ ${barName} แล้ว (Safety Score ${(r as C.SafetyInspectionResult).safety_score ?? '-'})`,
        });
      } catch {
        return; // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ แก้แล้วบันทึกใหม่ได้
      }
      draft.reset();
      onClose();
    } finally {
      setProgress(null);
    }
  };

  const askSave = () => {
    if (!timeOk(draft.inspectedAt)) {
      void message.error(ERROR_MESSAGES.INVALID_INSPECTION_TIME);
      return;
    }
    const { pass, fail, na } = draft.counts;
    modal.confirm({
      title: `บันทึกผลตรวจของ ${barName}?`,
      content: (
        <div className="space-y-2">
          <p className="m-0 font-medium">
            ผ่าน {pass} ไม่พบ {fail} ไม่ได้ตรวจ {na}
          </p>
          <RuleList
            rules={[
              <>ยืนยันว่าคุณลงพื้นที่ร้านนี้จริง ในชื่อ {inspector}</>,
              'ข้อที่ “ผ่าน” ลูกค้าเห็นว่ามี พร้อมป้าย “ทีมงานลงพื้นที่ตรวจ” และวันที่',
              'ข้อที่ “ไม่พบ” เปลี่ยนเป็น “ไม่มี” ทันที',
              'ระบบแจ้งเจ้าของ/ผู้จัดการร้าน',
              { tone: 'warn', text: 'บันทึกแล้วแก้ไม่ได้ (ตรวจใหม่ได้)' },
            ]}
          />
        </div>
      ),
      okText: 'บันทึกผลตรวจ',
      cancelText: 'กลับไปแก้',
      onOk: () => {
        void save();
      },
    });
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      afterOpenChange={(o) => !o && onClosed()}
      size={md ? 640 : '100%'}
      destroyOnHidden
      mask={{ closable: !saving }}
      keyboard={!saving}
      closable={{ disabled: saving }}
      title={
        <span className="flex min-w-0 items-center gap-2">
          <ClipboardText size={18} aria-hidden className="shrink-0" />
          <span className="truncate">ลงพื้นที่ตรวจ {barName}</span>
        </span>
      }
      footer={
        rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-[env(safe-area-inset-bottom)]">
            <span className="mr-auto text-sm tabular-nums">
              ตรวจแล้ว {draft.done}/{draft.total} ข้อ
            </span>
            {/* มือถือใช้ size large (สูง 40px) — กดง่ายตอนอยู่หน้าร้าน */}
            <Button
              size={md ? 'middle' : 'large'}
              disabled={saving || draft.done === draft.total}
              onClick={draft.fillRestNA}
            >
              ที่เหลือ = ไม่ได้ตรวจ
            </Button>
            <Button
              size={md ? 'middle' : 'large'}
              disabled={saving || !draft.dirty}
              onClick={() => confirmDiscard(draft.reset)}
            >
              คืนค่า
            </Button>
            <Button
              type="primary"
              size={md ? 'middle' : 'large'}
              block={!md}
              loading={saving}
              disabled={!draft.canSave}
              onClick={askSave}
            >
              {progress ?? 'บันทึกผลตรวจ'}
            </Button>
          </div>
        )
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !error && rows.length === 0 ? (
        <Empty description="ไม่พบรายการ Safety ของร้านนี้" />
      ) : (
        <div className="space-y-4">
          <section className="space-y-3">
            <Typography.Text>
              ผู้ตรวจ: <span className="font-medium">{inspector}</span>
            </Typography.Text>
            <div className="space-y-1">
              <span className="block text-sm">วันเวลาที่ลงพื้นที่</span>
              <InspectedAtPicker
                value={draft.inspectedAt}
                onChange={draft.setInspectedAt}
                disabled={saving}
                stacked={!md}
                disabledDate={(d) =>
                  d.isAfter(dayjs(), 'day') ||
                  d.isBefore(dayjs().subtract(SAFETY_INSPECTION_MAX_AGE_DAYS, 'day'), 'day') ||
                  (!!latest && d.isBefore(dayjs(latest), 'day'))
                }
              />
              <span className="block text-xs opacity-70">
                ไม่ระบุ = ตอนนี้ ย้อนหลังได้ไม่เกิน {SAFETY_INSPECTION_MAX_AGE_DAYS} วัน
                {latest ? ` และไม่ก่อนการตรวจครั้งล่าสุด (${date(latest)})` : ''}
              </span>
            </div>
            <label className="block space-y-1">
              <span className="block text-sm">หมายเหตุรวม (ร้านเห็น)</span>
              <Input.TextArea
                value={draft.note}
                onChange={(e) => draft.setNote(e.target.value)}
                maxLength={SAFETY_INSPECTION_NOTE_MAX}
                showCount
                autoSize={{ minRows: 2, maxRows: 6 }}
                disabled={saving}
              />
            </label>
          </section>
          <ul className="m-0 list-none space-y-3 p-0">
            {rows.map((r) => (
              <FeatureCard key={r.feature_key} row={r} draft={draft} disabled={saving} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}

/** สถานะปัจจุบันของข้อ — ตรวจด้วยวิธีไหน โดยใคร เมื่อไร */
function SourceTag({ row }: { row: Db.AdminBarSafety }) {
  if (row.source === 'ADMIN_VERIFIED') {
    const method = row.verify_method ?? 'EVIDENCE';
    const by = row.verified_by_name ? ` โดย ${row.verified_by_name}` : '';
    return (
      <Tag color={SAFETY_VERIFY_TAG[method].color} className="!m-0">
        {safetyVerifyLabel(method)}
        {row.verified_at ? ` ${date(row.verified_at)}` : ''}
        {by}
      </Tag>
    );
  }
  if (row.source === null) return <Tag className="!m-0">ร้านยังไม่แจ้ง</Tag>;
  return (
    <Tag color="gold" className="!m-0">
      ร้านแจ้ง ยังไม่ลงพื้นที่
    </Tag>
  );
}

function FeatureCard({
  row,
  draft,
  disabled,
}: {
  row: Db.AdminBarSafety;
  draft: Draft;
  disabled: boolean;
}) {
  const { message } = App.useApp();
  const key = row.feature_key;
  const it = draft.itemOf(key);
  const hint = SAFETY_INSPECTION_HINTS[key];
  const room = SAFETY_INSPECTION_MAX_PHOTOS - it.files.length;

  const add = (files: File[]) => {
    const ok = files.filter((f) => {
      if (!f.type.startsWith('image/')) {
        void message.error(`${f.name} ไม่ใช่รูป`);
        return false;
      }
      if (f.size > PHOTO_MAX_BYTES) {
        void message.error(`${f.name} ใหญ่เกิน 20MB`);
        return false;
      }
      return true;
    });
    const added = draft.addFiles(key, ok);
    if (added < ok.length)
      void message.warning(
        `แนบได้สูงสุด ${SAFETY_INSPECTION_MAX_PHOTOS} รูปต่อข้อ — ใช้ ${added} รูปแรกที่เลือก`,
      );
  };

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="space-y-2">
        <div className="font-medium">{row.name_th}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span>ร้านแจ้ง: {SAFETY_VALUE_TEXT[row.value]}</span>
          <SourceTag row={row} />
          {row.open_inaccurate_reports > 0 && (
            <Tag color="red" className="!m-0">
              ลูกค้าแจ้งว่าไม่จริง {row.open_inaccurate_reports}
            </Tag>
          )}
          {row.last_result === 'FAIL' && row.last_inspected_at && (
            <Tag color="red" className="!m-0">
              ตรวจล่าสุด: ไม่พบ {date(row.last_inspected_at)}
            </Tag>
          )}
        </div>
        {row.evidence_path && (
          <div className="flex items-center gap-2 text-xs opacity-80">
            หลักฐานจากร้าน: <SlipImage bucket="bar-verifications" path={row.evidence_path} />
          </div>
        )}
        {row.note && <div className="text-xs opacity-80">หมายเหตุจากร้าน: {row.note}</div>}
        {hint && <div className="text-xs opacity-70">สิ่งที่ต้องดู: {hint}</div>}
        {/* ยังไม่เลือก = '' (ไม่ตรงตัวเลือกไหน → ไม่ไฮไลต์ · ไม่ส่ง undefined เพราะ Segmented จะเลือกตัวแรกให้เอง) */}
        <Segmented<SafetyCheckResult | ''>
          block
          aria-label={`ผลตรวจ ${row.name_th}`}
          disabled={disabled}
          value={it.result ?? ''}
          onChange={(v) => v && draft.setResult(key, v)}
          options={SAFETY_CHECK_RESULTS.map((v) => ({ value: v, label: SAFETY_CHECK_TAG[v].text }))}
        />
        {it.result && (
          <>
            <Input.TextArea
              value={it.note}
              onChange={(e) => draft.setItemNote(key, e.target.value)}
              maxLength={SAFETY_CHECK_NOTE_MAX}
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={disabled}
              placeholder={
                it.result === 'FAIL' ? 'ไม่พบอะไร เช่น ถังดับเพลิงหมดอายุ' : 'หมายเหตุ (ถ้ามี)'
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <Image.PreviewGroup>
                {it.urls.map((u, i) => (
                  // ปุ่มเอาออกอยู่ใต้รูป (ไม่ทับปุ่มดูรูป) · พื้นที่กด 64×40px
                  <span key={u} className="inline-flex flex-col items-center gap-1">
                    <Image
                      src={u}
                      alt={`รูปจากการลงพื้นที่ ${row.name_th} ที่ ${i + 1}`}
                      width={64}
                      height={64}
                      className="rounded-md object-cover"
                    />
                    <Button
                      type="text"
                      danger
                      disabled={disabled}
                      icon={<X size={16} />}
                      aria-label={`เอารูปที่ ${i + 1} ออก`}
                      className="!h-10 !w-16"
                      onClick={() => draft.removeFile(key, i)}
                    />
                  </span>
                ))}
              </Image.PreviewGroup>
              {room > 0 && (
                <Upload
                  accept="image/*"
                  multiple
                  showUploadList={false}
                  disabled={disabled}
                  beforeUpload={(file, list) => {
                    // antd เรียกทีละไฟล์ — รวบทั้งชุดตอนไฟล์สุดท้าย
                    if (file === list[list.length - 1]) add(list);
                    return Upload.LIST_IGNORE;
                  }}
                >
                  <Button icon={<Camera size={16} />} disabled={disabled} className="!min-h-10">
                    ถ่าย/แนบรูป ({it.files.length}/{SAFETY_INSPECTION_MAX_PHOTOS})
                  </Button>
                </Upload>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * วันเวลาที่ลงพื้นที่ — จอกว้าง: DatePicker showTime ช่องเดียว · มือถือ: วันที่ + เวลาแยก 2 ช่อง
 * (แผงวัน+เวลารวมกว้างราว 450px ล้นจอ 375px) · ไม่ระบุ = ตอนนี้
 */
function InspectedAtPicker({
  value,
  onChange,
  disabled,
  stacked,
  disabledDate,
}: {
  value: Dayjs | null;
  onChange: (d: Dayjs | null) => void;
  disabled: boolean;
  stacked: boolean;
  disabledDate: (d: Dayjs) => boolean;
}) {
  if (!stacked) {
    return (
      <DatePicker
        showTime
        format="DD/MM/YYYY HH:mm"
        placeholder="ตอนนี้"
        allowClear
        inputReadOnly
        disabled={disabled}
        className="w-64"
        value={value}
        onChange={(d) => onChange(d)}
        disabledDate={disabledDate}
      />
    );
  }
  // เลือกวันก่อน: ใช้เวลาเดิม (หรือเวลาตอนนี้) · เลือกเวลาก่อน: ใช้วันนี้
  const base = value ?? dayjs().second(0).millisecond(0);
  return (
    <div className="flex gap-2">
      <DatePicker
        format="DD/MM/YYYY"
        placeholder="ตอนนี้"
        allowClear
        inputReadOnly
        disabled={disabled}
        className="min-w-0 flex-1"
        value={value}
        onChange={(d) => onChange(d ? base.year(d.year()).month(d.month()).date(d.date()) : null)}
        disabledDate={disabledDate}
      />
      <TimePicker
        format="HH:mm"
        placeholder="เวลา"
        allowClear={false}
        inputReadOnly
        disabled={disabled}
        className="w-28 shrink-0"
        value={value}
        onChange={(t) =>
          t && onChange(base.hour(t.hour()).minute(t.minute()).second(0).millisecond(0))
        }
      />
    </div>
  );
}

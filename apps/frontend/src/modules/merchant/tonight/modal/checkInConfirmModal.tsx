import { Armchair, CheckCircle, Clock, Ticket } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import { CHECK_IN_EARLY_HOURS } from '@nightout/utils';
import { Alert, App, Button, Modal, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { BOOKING_STATUS } from '@/ui/utils/format';
import { checkIn, useCheckInPreview } from '../api';
import { MetaList } from '@/ui/components/metaList';

/**
 * ขั้นยืนยันก่อนเช็กอิน (requirement "สแกนเช็กอิน": ยืนยันคิว/สถานะ → ดึงชื่อ/จำนวนคน → กดยืนยัน)
 * ทุกทางเข้า (กล้อง / เครื่องสแกน / พิมพ์รหัส / ปุ่มในรายการ) มาที่นี่ — เปลี่ยนสถานะเฉพาะตอนกด "ยืนยันเช็กอิน"
 * ข้อมูลจาก bar_check_in_preview ณ เวลา server · ไม่มียอดเงิน (Staff/PR เห็นหน้านี้)
 */
export function CheckInConfirmModal({
  barId,
  code,
  onClose,
  onDone,
}: {
  barId: string;
  /** รหัสที่ผ่าน parseCheckInScan แล้ว (NL-XXXXXX / NIGHTOUT:<id>) · null = ปิด */
  code: string | null;
  onClose: () => void;
  onDone: (result: C.CheckInResult) => void;
}) {
  const { message } = App.useApp();
  const preview = useCheckInPreview(barId, code);
  const [busy, setBusy] = useState(false);
  const p = preview.data;

  const confirm = async () => {
    if (!p?.can_check_in || busy) return;
    setBusy(true);
    try {
      onDone(await checkIn(barId, p.code));
    } catch (e) {
      message.error((e as Error).message);
      void preview.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!code}
      title="ยืนยันเช็กอิน"
      centered
      width={440}
      rootClassName="dark"
      destroyOnHidden
      mask={{ closable: !busy }}
      onCancel={() => !busy && onClose()}
      footer={[
        <Button key="cancel" disabled={busy} onClick={onClose}>
          ยกเลิก
        </Button>,
        // key เปลี่ยนเมื่อข้อมูลมา → ปุ่ม mount ใหม่พร้อม autoFocus (เครื่องสแกนแบบคีย์บอร์ดกด Enter ยืนยันต่อได้เลย)
        <Button
          key={p ? `ok-${p.id}` : 'ok'}
          type="primary"
          autoFocus
          loading={busy}
          disabled={!p?.can_check_in}
          onClick={() => void confirm()}
        >
          ยืนยันเช็กอิน
        </Button>,
      ]}
    >
      {preview.isLoading ? (
        <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 3 }} />
      ) : preview.error ? (
        <Alert type="error" showIcon title={(preview.error as Error).message} />
      ) : p ? (
        <PreviewBody p={p} />
      ) : null}
    </Modal>
  );
}

/** ชื่อ · จำนวนคน · โซน/โต๊ะ · เวลา · โปร/หมายเหตุ · สถานะว่ากดเช็กอินได้ไหม */
function PreviewBody({ p }: { p: C.CheckInPreview }) {
  /** เวลาในวันเดียวกับ server = HH:mm · วันอื่น = D MMM HH:mm */
  const at = (iso: string) => {
    const d = dayjs(iso);
    return d.isSame(dayjs(p.server_now), 'day') ? d.format('HH:mm') : d.format('D MMM HH:mm');
  };
  const start = dayjs(p.booking_datetime);
  const place = [p.zone_name, p.table_name].filter(Boolean).join(' ') || 'ไม่ระบุโต๊ะ';
  const block = blockAlert(p, at);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-end justify-between gap-4">
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted">ลูกค้า</span>
          <b className="truncate text-2xl font-semibold">{p.customer_name ?? 'ลูกค้า'}</b>
        </span>
        <b className="shrink-0 text-3xl font-bold text-gold-text tabular-nums">{p.pax} คน</b>
      </div>
      <p className="text-sm text-muted">
        <MetaList
          items={[
            { icon: <Armchair weight="fill" />, label: 'ที่นั่ง', value: place, strong: true },
            { icon: <Clock weight="fill" />, label: 'เวลาจอง', value: start.format(p.is_today ? 'HH:mm' : 'D MMM HH:mm') },
            { icon: <Ticket weight="fill" />, label: 'รหัสจอง', value: p.code },
          ]}
        />
      </p>
      {(p.promotion_title || p.customer_note) && (
        <div className="flex flex-col gap-1 text-sm">
          {p.promotion_title && (
            <span>
              <span className="text-muted">โปร: </span>
              <span className="text-gold-text">{p.promotion_title}</span>
            </span>
          )}
          {p.customer_note && (
            <span>
              <span className="text-muted">หมายเหตุ: </span>
              {p.customer_note}
            </span>
          )}
        </div>
      )}
      {block ? (
        <Alert type={block.type} showIcon title={block.text} />
      ) : (
        <p
          className="flex items-center gap-2 text-sm font-medium text-(--crowd-available)"
          role="status"
        >
          <CheckCircle size={20} weight="fill" className="shrink-0" aria-hidden />
          พร้อมเช็กอิน เก็บโต๊ะถึง {at(p.auto_cancel_at)}
        </p>
      )}
      {p.can_check_in && !p.is_today && (
        <Alert
          type="warning"
          showIcon
          title={`การจองนี้เป็นของวันที่ ${start.format('D MMM')} — ตรวจกับลูกค้าก่อนยืนยัน`}
        />
      )}
    </div>
  );
}

/** ข้อความสถานะตาม block_reason (null = พร้อมเช็กอิน) */
function blockAlert(
  p: C.CheckInPreview,
  at: (iso: string) => string,
): { type: 'info' | 'warning' | 'error'; text: string } | null {
  switch (p.block_reason) {
    case 'TOO_EARLY':
      return {
        type: 'warning',
        text: `ยังไม่ถึงเวลาเช็กอิน — เช็กอินได้ตั้งแต่ ${at(p.check_in_opens_at)} (${CHECK_IN_EARLY_HOURS} ชม. ก่อนเวลาจอง)`,
      };
    case 'TOO_LATE':
      return {
        type: 'error',
        text: `เลยเวลาเก็บโต๊ะแล้ว (${at(p.auto_cancel_at)}) — ระบบจะปลดโต๊ะ (Forfeited)`,
      };
    case 'ALREADY_CHECKED_IN':
      return {
        type: 'info',
        text: p.checked_in_at ? `เช็กอินแล้วเมื่อ ${at(p.checked_in_at)}` : 'เช็กอินแล้ว',
      };
    case 'NOT_CONFIRMED':
      return {
        type: 'warning',
        text: `สถานะ: ${BOOKING_STATUS[p.status].label} — เช็กอินได้เฉพาะการจองที่ยืนยันแล้ว`,
      };
    default:
      return null;
  }
}

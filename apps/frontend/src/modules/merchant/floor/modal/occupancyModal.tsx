import type * as C from '@nightout/contracts';
import { Alert, App, Input, InputNumber, Modal } from 'antd';
import { useState } from 'react';
import { setTableOccupancy } from '../api';
import { hhmm } from '../utils/board';

/**
 * ตั้งโต๊ะเป็น "กำลังใช้" เอง — ลูกค้านั่งโต๊ะโดยไม่มีการจองในระบบ (ไม่ใช่ระบบคิว Walk-in · ไม่เก็บข้อมูลลูกค้า)
 */
export function OccupancyModal({
  table,
  onClose,
  onDone,
}: {
  table: C.TableBoardTable | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [pax, setPax] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    setPax(null);
    setNote('');
    onClose();
  };

  const submit = async () => {
    if (!table) return;
    setSaving(true);
    try {
      await setTableOccupancy(table.id, { in_use: true, pax, note: note.trim() || null });
      message.success(`โต๊ะ ${table.name} กำลังใช้`);
      close();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <Modal
      open={!!table}
      rootClassName="dark"
      title={table ? `ตั้งโต๊ะ ${table.name} เป็นกำลังใช้` : ''}
      okText="ตั้งเป็นกำลังใช้"
      cancelText="ยกเลิก"
      onOk={() => void submit()}
      onCancel={close}
      confirmLoading={saving}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      {table && (
        <div className="space-y-4">
          <p className="m-0 text-sm text-muted">ใช้เมื่อมีลูกค้านั่งโต๊ะนี้โดยไม่มีการจองในระบบ — ตั้งเป็นว่างเมื่อลูกค้ากลับ</p>
          {table.next_booking_at && (
            <Alert
              type="warning"
              showIcon
              title={`มีจองเวลา ${hhmm(table.next_booking_at)} ที่โต๊ะนี้ — ต้องว่างก่อนเวลานั้น หรือย้ายการจองไปโต๊ะอื่น`}
            />
          )}
          <div>
            <label htmlFor="floor-occ-pax" className="mb-1.5 block text-sm font-medium">
              จำนวนคน (ไม่บังคับ)
            </label>
            <InputNumber
              id="floor-occ-pax"
              min={1}
              max={50}
              precision={0}
              inputMode="numeric"
              value={pax}
              onChange={(v) => setPax(typeof v === 'number' ? v : null)}
              className="!w-full !text-base"
            />
          </div>
          <div>
            <label htmlFor="floor-occ-note" className="mb-1.5 block text-sm font-medium">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <Input
              id="floor-occ-note"
              placeholder="เช่น ลูกค้าหน้าร้าน"
              maxLength={100}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="!text-base"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

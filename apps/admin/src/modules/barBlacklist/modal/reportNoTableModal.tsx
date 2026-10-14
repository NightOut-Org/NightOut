import { AdminReportNoTableBody, type AdminReportNoTableResult } from '@nightout/contracts';
import { parseCheckInScan } from '@nightout/utils';
import { Alert, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { baht } from '@/ui/utils/format';
import { reportNoTableAction } from '../api';

const CODE_ID = 'no-table-booking-code';
const NOTE_ID = 'no-table-note';

/** รหัสที่แอดมินพิมพ์/วาง → รหัสจองมาตรฐาน ("nl3f8k2a" → "NL-3F8K2A") · รูปแบบอื่นส่งตามที่พิมพ์ (ตัวใหญ่) ให้ backend ตอบว่าไม่พบ */
function normalizeCode(raw: string): string {
  const c = parseCheckInScan(raw);
  return c?.startsWith('NL-') ? c : raw.trim().toUpperCase();
}

/**
 * ลูกค้าร้องเรียนว่าร้านรับจองแล้วไม่มีโต๊ะ (Dispute & Refund Management) → แอดมินบันทึกแทนร้าน:
 * Override คืน Table Fee เต็มจำนวน (เข้า "รอคืนลูกค้า" ที่ /deposits) + ยกเลิกถ้ายังไม่เช็กอิน + บันทึกประวัติร้าน (source=ADMIN)
 */
export function ReportNoTableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const act = useAdminAction();
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const parsed = AdminReportNoTableBody.safeParse({ booking_code: normalizeCode(code), note });

  const submit = () => {
    if (!parsed.success) return;
    act.mutate(
      {
        ...reportNoTableAction(parsed.data),
        success: (res) => {
          const r = res as AdminReportNoTableResult;
          return r.refund_amount == null
            ? `บันทึกแล้ว (${r.booking_code}) — ไม่มี Table Fee ที่คืนผ่านระบบได้`
            : `บันทึกแล้ว (${r.booking_code}) — คืน Table Fee ${baht(r.refund_amount)} (โอนคืนที่หน้าเงินมัดจำ › รอคืนลูกค้า)`;
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open={open}
      title="บันทึกข้อร้องเรียน: ร้านไม่มีโต๊ะให้ลูกค้า"
      okText="บันทึกและคืน Table Fee"
      cancelText="ยกเลิก"
      okButtonProps={{ danger: true, disabled: !parsed.success }}
      confirmLoading={act.isPending}
      onOk={submit}
      onCancel={onClose}
      afterClose={() => {
        setCode('');
        setNote('');
      }}
      destroyOnHidden
    >
      <div className="space-y-4 pt-2">
        <Alert
          type="warning"
          showIcon
          title="ทำแล้วย้อนกลับไม่ได้"
          description={
            'คืน Table Fee เต็มจำนวนให้ลูกค้าแทนร้าน (เข้าแท็บ "รอคืนลูกค้า" ที่หน้าเงินมัดจำ) · ยกเลิกการจองถ้ายังไม่เช็กอิน · บันทึกประวัติร้าน 1 ครั้ง · แจ้งลูกค้าและทีมร้าน'
          }
        />
        <Form layout="vertical" disabled={act.isPending}>
          <Form.Item
            label="รหัสจอง"
            htmlFor={CODE_ID}
            required
            extra="ใช้ได้กับการจองที่ยืนยันแล้ว / เช็กอินแล้ว / จบแล้ว / ปลดโต๊ะ / ร้านยกเลิกแล้ว (เช่น ร้านเลือกเหตุผลอื่นตอนยกเลิก)"
          >
            <Input
              id={CODE_ID}
              placeholder="NL-XXXXXX"
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Form.Item>
          <Form.Item
            label="รายละเอียดข้อร้องเรียน"
            htmlFor={NOTE_ID}
            required
            extra="อย่างน้อย 3 ตัวอักษร · ทีมร้านเห็นข้อความนี้ในแจ้งเตือน"
            className="!mb-0"
          >
            <Input.TextArea
              id={NOTE_ID}
              rows={3}
              maxLength={300}
              showCount
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ลูกค้ามาถึงตามเวลาแต่ร้านแจ้งว่าโต๊ะเต็ม ให้รอ 1 ชั่วโมง"
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}

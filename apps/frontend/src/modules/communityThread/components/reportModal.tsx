import type { CommunityReportReason } from '@nightout/contracts';
import { App, Input, Modal, Radio } from 'antd';
import { useState } from 'react';
import { report } from '../api';

const REASONS: { value: CommunityReportReason; label: string }[] = [
  { value: 'SPAM', label: 'สแปม / โพสต์ซ้ำ' },
  { value: 'ADVERTISING', label: 'โฆษณาแฝง / โปรโมชันแอลกอฮอล์' },
  { value: 'OFFENSIVE', label: 'หยาบคาย / คุกคาม / ให้ร้ายร้านอื่น' },
  { value: 'PRIVACY', label: 'เปิดเผยข้อมูลส่วนตัวของคนอื่น' },
  { value: 'OTHER', label: 'อื่น ๆ' },
];

/** รายงานกระทู้หรือความคิดเห็นให้ทีมงานตรวจ (target = null → ปิด) */
export function ReportModal({
  target,
  onClose,
}: {
  target: { thread_id?: string; comment_id?: string } | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [reason, setReason] = useState<CommunityReportReason>('SPAM');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await report({ ...target, reason, detail: detail.trim() || null });
      message.success('ส่งรายงานแล้ว ทีมงานจะตรวจสอบโดยเร็ว');
      setDetail('');
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!target}
      title={target?.comment_id ? 'รายงานความคิดเห็น' : 'รายงานกระทู้'}
      okText="ส่งรายงาน"
      cancelText="ยกเลิก"
      confirmLoading={busy}
      onOk={() => void submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Radio.Group
        value={reason}
        onChange={(e) => setReason(e.target.value as CommunityReportReason)}
        className="!flex !flex-col !gap-2"
      >
        {REASONS.map((r) => (
          <Radio key={r.value} value={r.value}>
            {r.label}
          </Radio>
        ))}
      </Radio.Group>
      <Input.TextArea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={300}
        showCount
        autoSize={{ minRows: 2, maxRows: 4 }}
        placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
        className="!mt-4 !text-base"
      />
    </Modal>
  );
}

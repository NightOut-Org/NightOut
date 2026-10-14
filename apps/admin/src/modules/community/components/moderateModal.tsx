import { communityTeamBadge } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { Card, Input, Modal, Radio, Tag, Typography } from 'antd';
import { useState } from 'react';

export type Row = Db.AdminCommunityThread | Db.AdminCommunityComment;
export type ModerateTarget = { row: Row; action: 'HIDE' | 'REMOVE' };

/** เหตุผลสำเร็จรูป — ส่งถึงเจ้าของโพสต์ในแจ้งเตือน (admin_community_moderate) */
const REASONS = [
  'โฆษณา/โปรโมชันเครื่องดื่มแอลกอฮอล์ (ม.30/32)',
  'พูดถึงร้านอื่นในทางเสีย',
  'สแปม / โพสต์ซ้ำ',
  'หยาบคาย / คุกคาม',
  'เปิดเผยข้อมูลส่วนตัวของคนอื่น',
  'อื่น ๆ',
] as const;
const OTHER: (typeof REASONS)[number] = 'อื่น ๆ';
const DETAIL_MAX = 300;
/** ความยาวสูงสุดของ reason ที่ API รับ */
const REASON_MAX = 500;
const REASON_LABEL_ID = 'moderate-reason-label';

/** ซ่อน / ลบ กระทู้หรือความเห็น — ต้องเลือกเหตุผล (API บังคับ) แล้วเจ้าของโพสต์ได้รับแจ้งเตือนพร้อมเหตุผลนั้น */
export function ModerateModal({
  target,
  busy,
  onSubmit,
  onCancel,
}: {
  target: ModerateTarget | null;
  busy: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [preset, setPreset] = useState<string | undefined>();
  const [detail, setDetail] = useState('');
  // แถวล่าสุดที่เปิด — ตอน Modal กำลังปิด (target = null) ยังแสดงหัวข้อ/ปุ่ม/การ์ดเดิม ไม่ให้ "ลบ" กลายเป็น "ซ่อน"
  const [last, setLast] = useState(target);
  if (target && target !== last) {
    setLast(target);
    // เปลี่ยนแถว/การกระทำ → ล้างเหตุผลเดิม ไม่ให้แถวถัดไปติดเหตุผลของแถวก่อน
    setPreset(undefined);
    setDetail('');
  }
  const shown = target ?? last;

  const note = detail.trim();
  const needsDetail = preset === OTHER && !note;
  const ready = !!preset && !needsDetail;
  const remove = shown?.action === 'REMOVE';
  const row = shown?.row;

  return (
    <Modal
      open={!!target}
      title={remove ? 'ลบถาวรจากชุมชน?' : 'ซ่อนกระทู้/ความเห็นนี้?'}
      okText={remove ? 'ลบ' : 'ซ่อน'}
      cancelText="ยกเลิก"
      okButtonProps={{ danger: remove, disabled: !ready }}
      confirmLoading={busy}
      onOk={() => preset && onSubmit((preset + (note ? ` — ${note}` : '')).slice(0, REASON_MAX))}
      onCancel={onCancel}
      destroyOnHidden
    >
      {row && (
        <Card size="small" className="!mb-4">
          <Typography.Text strong ellipsis className="block">
            {'title' in row ? row.title : row.body}
          </Typography.Text>
          <Typography.Text type="secondary" className="!text-xs">
            โดย {row.author_name ?? 'บัญชีถูกลบ'}
          </Typography.Text>
          {row.team_bar && (
            <Tag color="gold" className="!ms-2 !text-xs">
              {communityTeamBadge(row.team_bar.name)}
            </Tag>
          )}
        </Card>
      )}
      <Typography.Paragraph id={REASON_LABEL_ID} type="secondary" className="!mb-2">
        เหตุผล (ส่งถึงเจ้าของโพสต์ในการแจ้งเตือน)
      </Typography.Paragraph>
      <Radio.Group
        aria-labelledby={REASON_LABEL_ID}
        orientation="vertical"
        value={preset}
        onChange={(e) => setPreset(e.target.value as string)}
        options={REASONS.map((r) => ({ label: r, value: r }))}
      />
      <Input.TextArea
        className="!mt-4"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={DETAIL_MAX}
        showCount
        autoSize={{ minRows: 2, maxRows: 5 }}
        status={needsDetail ? 'error' : undefined}
        placeholder={
          preset === OTHER
            ? 'รายละเอียดถึงเจ้าของโพสต์ (จำเป็นเมื่อเลือก "อื่น ๆ")'
            : 'รายละเอียดถึงเจ้าของโพสต์ (ไม่บังคับ)'
        }
        aria-label="รายละเอียดถึงเจ้าของโพสต์"
      />
    </Modal>
  );
}

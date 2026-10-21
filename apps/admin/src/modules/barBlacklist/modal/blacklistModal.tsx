import { BarBlacklistBody, type BarBlacklistResult } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { Alert, Form, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { date } from '@/ui/utils/format';
import { blacklistBarAction, liftBlacklistAction } from '../api';
import { RuleList } from '@/ui/components/RuleList';

export type BlacklistMode = 'blacklist' | 'lift';
export interface BlacklistTarget {
  bar: Db.AdminBarBlacklist;
  mode: BlacklistMode;
}

const REASON_ID = 'bar-blacklist-reason';

/**
 * Blacklist / ปลด Blacklist ร้าน — เหตุผลบังคับ 3–500 ตัวอักษร (ร้านเห็นข้อความนี้ · ลง Audit Log)
 * จำร้านล่าสุดไว้แสดงระหว่างปิด Modal (หัวข้อไม่กระพริบ) · ล้างเหตุผลหลังปิด
 */
export function BlacklistModal({
  target,
  onClose,
}: {
  target: BlacklistTarget | null;
  onClose: () => void;
}) {
  const act = useAdminAction();
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);

  const parsed = BarBlacklistBody.safeParse({ reason });
  const bar = shown?.bar;
  const lift = shown?.mode === 'lift';

  const submit = () => {
    if (!bar || !parsed.success) return;
    const name = bar.name;
    act.mutate(
      lift
        ? {
            ...liftBlacklistAction(bar.id, parsed.data),
            success: `ปลด Blacklist ${name} แล้ว — ร้านกลับมาแสดงบนเว็บ`,
          }
        : {
            ...blacklistBarAction(bar.id, parsed.data),
            success: (res) => {
              const r = res as BarBlacklistResult;
              return `Blacklist ${name} แล้ว — ซ่อนจากเว็บและปิดรับจอง${
                r.upcoming_bookings
                  ? ` (ยังมีการจองที่ไม่ถึงเวลา ${r.upcoming_bookings} รายการ)`
                  : ''
              }`;
            },
          },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open={!!target}
      title={lift ? `ปลด Blacklist ${bar?.name ?? ''}?` : `Blacklist ${bar?.name ?? ''}?`}
      okText={lift ? 'ปลด Blacklist' : 'Blacklist ร้าน'}
      cancelText="ยกเลิก"
      okButtonProps={{ danger: !lift, disabled: !parsed.success }}
      confirmLoading={act.isPending}
      onOk={submit}
      onCancel={onClose}
      afterClose={() => setReason('')}
      destroyOnHidden
    >
      <div className="space-y-4 pt-2">
        {lift ? (
          <Alert type="info" showIcon title="ร้านจะกลับมาแสดงบนเว็บและรับจองได้ทันที" />
        ) : (
          <Alert
            type="warning"
            showIcon
            title="ร้านจะถูกซ่อนจากหน้าค้นหาและหน้าร้าน และรับจองใหม่ไม่ได้ทันที"
            description={
              <RuleList
                rules={[
                  'การจองที่ยืนยันแล้วยังอยู่ ร้านต้องรับลูกค้าตามเดิม',
                  'ระบบแจ้งทีมร้านและบันทึก Audit Log',
                ]}
              />
            }
          />
        )}
        {bar && (
          <Typography.Paragraph type="secondary" className="!mb-0 text-sm">
            ไม่มีโต๊ะให้ลูกค้า {bar.strike_count_90d} ครั้งใน 90 วัน (ทั้งหมด {bar.strike_count}{' '}
            ครั้ง)
            {lift && bar.blacklisted_at && (
              <>
                <br />
                ติด Blacklist ตั้งแต่ {date(bar.blacklisted_at)}
                {bar.blacklist_reason ? ` — ${bar.blacklist_reason}` : ''}
              </>
            )}
          </Typography.Paragraph>
        )}
        <Form layout="vertical" disabled={act.isPending}>
          <Form.Item
            label="เหตุผล"
            htmlFor={REASON_ID}
            required
            extra={
              lift
                ? 'อย่างน้อย 3 ตัวอักษร ทีมร้านเห็นข้อความนี้ในแจ้งเตือน'
                : 'อย่างน้อย 3 ตัวอักษร ทีมร้านเห็นข้อความนี้ในแจ้งเตือนและหน้าสถานะร้าน'
            }
            className="!mb-0"
          >
            <Input.TextArea
              id={REASON_ID}
              rows={3}
              maxLength={500}
              showCount
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                lift
                  ? 'เหตุผลที่ปลด (ร้านเห็นข้อความนี้) เช่น ร้านปรับระบบรับจองแล้ว'
                  : 'เหตุผล (ร้านเห็นข้อความนี้) เช่น ไม่มีโต๊ะให้ลูกค้า 3 ครั้งใน 1 เดือน'
              }
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}

import { ArrowSquareOut } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { Alert, Button, Drawer, Form, Input, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import {
  BarLocationEditor,
  adminLocationFrom,
  toAdminLocationBody,
  useLocationDirty,
  type AdminLocationValues,
} from '@/ui/components/BarLocationEditor';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { webSrc } from '@/ui/utils/image';
import { BAR_STATUS } from '@/ui/utils/labels';
import { realPinOf } from '@/ui/utils/location';
import { reversePlace, searchPlace, setBarLocationAction } from '../api';

/**
 * แก้ตำแหน่งแทนร้าน — มีผลทันทีและถือว่าตรวจแล้ว · ยกเลิกคำขอที่ค้างของร้าน · แจ้งทีมร้าน (PUT /admin/bars/:id/location)
 * ไม่แก้อะไรเลยแต่ร้านยังไม่เคยตรวจหมุด = ปุ่ม "ยืนยันหมุดเดิม" (บันทึกค่าเดิมเพื่อยืนยัน)
 */
export function EditDrawer({
  bar,
  onClose,
  onDone,
}: {
  bar: Db.AdminBarLocation;
  onClose: () => void;
  /** บันทึกสำเร็จ → ปิด Drawer + ล้าง ?bar= */
  onDone: () => void;
}) {
  const act = useAdminAction();
  const [form] = Form.useForm<AdminLocationValues>();
  const [initial] = useState(() => adminLocationFrom(bar));
  const { dirty, locationChanged } = useLocationDirty(form, initial);
  const { confirmDiscard } = useUnsavedGuard(dirty);
  const saving = act.isPending;
  /** หมุดจริงที่ยังไม่เคยมีใครตรวจ → บันทึกค่าเดิมได้ = ยืนยันหมุดเดิม */
  const confirmOnly = !locationChanged && !bar.location_reviewed_at && !bar.is_default_pin;

  const save = async () => {
    let v: AdminLocationValues;
    try {
      v = await form.validateFields();
    } catch {
      return; // ช่องที่ผิดแสดงข้อความใต้ช่องแล้ว
    }
    try {
      await act.mutateAsync({
        ...setBarLocationAction(bar.id, { ...toAdminLocationBody(v), note: v.note?.trim() || null }),
        success: `บันทึกตำแหน่ง ${bar.name} และแจ้งทีมร้านแล้ว`,
      });
      onDone();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว — เปิดฟอร์มค้างไว้ให้แก้ต่อ
    }
  };

  return (
    <Drawer
      open
      onClose={() => !saving && confirmDiscard(onClose)}
      size="large"
      destroyOnHidden
      mask={{ closable: !saving }}
      keyboard={!saving}
      title={
        <span className="flex flex-wrap items-center gap-2">
          แก้ตำแหน่งแทนร้าน {bar.name}
          <StatusTag map={BAR_STATUS} value={bar.status} />
        </span>
      }
      extra={
        bar.status === 'APPROVED' && (
          <Button
            href={webSrc(`/bars/${bar.slug}`)}
            target="_blank"
            rel="noreferrer"
            icon={<ArrowSquareOut size={16} aria-hidden />}
          >
            ดูหน้าร้าน
          </Button>
        )
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={!dirty || saving} onClick={() => confirmDiscard(() => form.resetFields())}>
            คืนค่า
          </Button>
          <Button type="primary" loading={saving} disabled={!dirty && !confirmOnly} onClick={() => void save()}>
            {confirmOnly ? 'ยืนยันหมุดเดิม' : 'บันทึกตำแหน่ง'}
          </Button>
        </div>
      }
    >
      {bar.location_pending && (
        <Alert
          className="!mb-4"
          type="warning"
          showIcon
          title="ร้านมีคำขอรอตรวจ — บันทึกตรงนี้จะยกเลิกคำขอนั้น"
        />
      )}
      <Typography.Paragraph type="secondary" className="!mb-4 flex flex-wrap items-center gap-2 text-sm">
        {bar.is_default_pin ? (
          <Tag color="red" className="!m-0">
            ยังไม่ปักหมุด
          </Tag>
        ) : bar.location_reviewed_at ? (
          <span>
            ตรวจหมุดล่าสุด {dateTime(bar.location_reviewed_at)}
            {bar.location_reviewed_by ? ` โดย ${bar.location_reviewed_by.display_name}` : ''}
          </span>
        ) : (
          <Tag className="!m-0">ยังไม่เคยตรวจ</Tag>
        )}
        <span>บันทึกแล้วมีผลทันที และแจ้งทีมร้าน</span>
      </Typography.Paragraph>

      <Form<AdminLocationValues> form={form} layout="vertical" initialValues={initial} disabled={saving}>
        <BarLocationEditor
          form={form}
          current={realPinOf(bar)}
          search={searchPlace}
          reverse={reversePlace}
          disabled={saving}
        />
        <Form.Item name="note" label="ข้อความถึงร้าน (ไม่บังคับ)" extra="แสดงในแจ้งเตือนของทีมร้าน">
          <Input.TextArea rows={2} maxLength={500} showCount placeholder="เช่น ย้ายหมุดให้ตรงทางเข้าหน้าร้าน" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

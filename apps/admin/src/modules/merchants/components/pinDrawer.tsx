import { MapPin, PencilSimple } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { Alert, Button, Descriptions, Drawer, Form, Input } from 'antd';
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
import { PinMap } from '@/ui/components/PinMap';
import { StatusTag } from '@/ui/components/StatusTag';
import { BAR_STATUS } from '@/ui/utils/labels';
import { coordText, realPinOf, transitText } from '@/ui/utils/location';
import { barLocationAction, reversePlace, searchPlace } from '../api';

/**
 * หมุดของร้านใหม่ (ก่อนอนุมัติ) — ดูหมุด/ที่อยู่/ที่จอดรถ/รถไฟฟ้าที่ร้านกรอกตอนสมัคร
 * "แก้หมุด" / "ปักหมุด" = แอดมินตั้งแทนร้าน (PUT /admin/bars/:id/location · มีผลทันที · แจ้งทีมร้าน)
 * ยังเป็นหมุดค่าเริ่มต้นของระบบเดิม = เปิดมาในโหมดปักหมุดเลย (อนุมัติร้านไม่ได้จนกว่าจะปัก — BAR_LOCATION_NOT_SET)
 */
export function PinDrawer({ bar, onClose }: { bar: Db.AdminBarLocation; onClose: () => void }) {
  const act = useAdminAction();
  const [form] = Form.useForm<AdminLocationValues>();
  const [initial] = useState(() => adminLocationFrom(bar));
  const [editing, setEditing] = useState(bar.is_default_pin);
  const { dirty } = useLocationDirty(form, initial);
  const { confirmDiscard } = useUnsavedGuard(editing && dirty);
  const saving = act.isPending;
  const pin = realPinOf(bar);

  const save = async () => {
    let v: AdminLocationValues;
    try {
      v = await form.validateFields();
    } catch {
      return; // ช่องที่ผิดแสดงข้อความใต้ช่องแล้ว
    }
    try {
      await act.mutateAsync({
        ...barLocationAction(bar.id, { ...toAdminLocationBody(v), note: v.note?.trim() || null }),
        success: `บันทึกตำแหน่ง ${bar.name} และแจ้งทีมร้านแล้ว`,
      });
      onClose();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว — เปิดฟอร์มค้างไว้ให้แก้ต่อ
    }
  };

  const stopEditing = () =>
    confirmDiscard(() => {
      form.resetFields();
      setEditing(false);
    });

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
          หมุดร้าน {bar.name}
          <StatusTag map={BAR_STATUS} value={bar.status} />
        </span>
      }
      footer={
        editing ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={saving} onClick={stopEditing}>
              ยกเลิกการแก้
            </Button>
            <Button type="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
              บันทึกตำแหน่ง
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose}>ปิด</Button>
            <Button
              type="primary"
              icon={pin ? <PencilSimple size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
              onClick={() => setEditing(true)}
            >
              {pin ? 'แก้หมุด' : 'ปักหมุด'}
            </Button>
          </div>
        )
      }
    >
      <Form<AdminLocationValues> form={form} layout="vertical" initialValues={initial} disabled={saving}>
        {editing ? (
          <>
            <Alert
              className="!mb-4"
              type="info"
              showIcon
              title={pin ? 'แก้ตำแหน่งแทนร้าน — มีผลทันทีและแจ้งทีมร้าน' : 'ร้านยังไม่ได้ปักหมุดจริง — ปักหมุดก่อนอนุมัติร้าน'}
            />
            <BarLocationEditor form={form} current={pin} search={searchPlace} reverse={reversePlace} disabled={saving} />
            <Form.Item name="note" label="ข้อความถึงร้าน (ไม่บังคับ)" extra="แสดงในแจ้งเตือนของทีมร้าน">
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
          </>
        ) : (
          <div className="space-y-5">
            {pin ? (
              <PinMap value={pin} />
            ) : (
              <Alert type="warning" showIcon title="ร้านยังไม่ได้ปักหมุดจริง — กด ปักหมุด ก่อนอนุมัติร้าน" />
            )}
            <Descriptions
              size="small"
              bordered
              column={1}
              items={[
                { key: 'address', label: 'ที่อยู่', children: bar.address || '-' },
                { key: 'parking', label: 'ที่จอดรถ', children: bar.parking_note ?? 'ไม่ระบุ' },
                { key: 'transit', label: 'รถไฟฟ้าใกล้สุด', children: transitText(bar) ?? 'ไม่ระบุ' },
                {
                  key: 'pin',
                  label: 'พิกัด',
                  children: pin ? <span className="tabular-nums">{coordText(pin)}</span> : 'ยังไม่ปักหมุด',
                },
              ]}
            />
            <p className="text-xs text-muted">อนุมัติร้าน = ตรวจหมุดนี้ไปพร้อมกัน (หมุดขึ้นแผนที่ทันทีที่ร้านแสดง)</p>
          </div>
        )}
      </Form>
    </Drawer>
  );
}

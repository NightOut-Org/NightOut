import { ArrowSquareOut, PencilSimple } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { distanceMeters } from '@nightout/utils';
import { Alert, Button, Drawer, Form, Typography } from 'antd';
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
import { PinLegend, PinMap } from '@/ui/components/PinMap';
import { RejectButton } from '@/ui/components/RejectButton';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { webSrc } from '@/ui/utils/image';
import { BAR_STATUS } from '@/ui/utils/labels';
import { FAR_MOVE_METERS, movedText, pinOf, realPinOf } from '@/ui/utils/location';
import { reversePlace, reviewLocationAction, searchPlace } from '../api';
import { LocationCompare } from './locationCompare';

export type PendingBarLocation = Db.AdminBarLocation & {
  pending_request: NonNullable<Db.AdminBarLocation['pending_request']>;
};

/**
 * ตรวจคำขอแก้ตำแหน่ง 1 คำขอ — ดูหมุดเดิม (เทา) เทียบหมุดใหม่ (ทอง) + ตารางเทียบข้อมูล
 * อนุมัติ · ปรับหมุดแล้วอนุมัติ (admin_edited) · ตีกลับพร้อมเหตุผล → POST /admin/bar-location-requests/:id/review (audit + แจ้งทีมร้าน)
 * โหมดปรับหมุดมีการแก้ค้าง = ถามก่อนปิด/ออกจากหน้า (หน้าแม่ mount เฉพาะ Drawer ที่เปิด — useBlocker ได้ทีละตัว)
 */
export function ReviewDrawer({
  bar,
  onClose,
  onDone,
}: {
  bar: PendingBarLocation;
  onClose: () => void;
  /** ตรวจสำเร็จ → ปิด Drawer + ล้าง ?bar= */
  onDone: () => void;
}) {
  const act = useAdminAction();
  const [form] = Form.useForm<AdminLocationValues>();
  const req = bar.pending_request;
  const [initial] = useState(() => adminLocationFrom(req));
  const [editing, setEditing] = useState(false);
  const { dirty } = useLocationDirty(form, initial);
  const { confirmDiscard } = useUnsavedGuard(editing && dirty);
  const saving = act.isPending;

  const current = realPinOf(bar);
  const requested = pinOf(req);
  const far = !!current && distanceMeters(current, requested) > FAR_MOVE_METERS;

  const review = async (body: C.ReviewBarLocationBody, success: string) => {
    try {
      await act.mutateAsync({ ...reviewLocationAction(req.id, body), success });
      onDone();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว (เช่น คำขอถูกตรวจไปแล้ว) — เปิด Drawer ค้างไว้
    }
  };

  const approveEdited = async () => {
    let v: AdminLocationValues;
    try {
      v = await form.validateFields();
    } catch {
      return; // ช่องที่ผิดแสดงข้อความใต้ช่องแล้ว
    }
    await review(
      { approve: true, location: toAdminLocationBody(v) },
      `อนุมัติตำแหน่ง ${bar.name} แล้ว (ปรับก่อนอนุมัติ)`,
    );
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
          ตรวจตำแหน่ง {bar.name}
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
        editing ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button disabled={saving} onClick={stopEditing}>
              ยกเลิกการปรับ
            </Button>
            <Button type="primary" loading={saving} onClick={() => void approveEdited()}>
              บันทึกและอนุมัติ
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <RejectButton
              label="ตีกลับ"
              title={`ตีกลับตำแหน่งของ ${bar.name}?`}
              loading={saving}
              onReject={(reason) => void review({ approve: false, reason }, 'ตีกลับแล้ว — แจ้งร้านพร้อมเหตุผล')}
            />
            <Button icon={<PencilSimple size={16} aria-hidden />} disabled={saving} onClick={() => setEditing(true)}>
              ปรับหมุดแล้วอนุมัติ
            </Button>
            <Button
              type="primary"
              loading={saving}
              onClick={() => void review({ approve: true }, `อนุมัติตำแหน่ง ${bar.name} แล้ว`)}
            >
              อนุมัติ
            </Button>
          </div>
        )
      }
    >
      <Typography.Paragraph type="secondary" className="!mb-4 text-sm">
        ร้านส่งเมื่อ {dateTime(req.created_at)} โดย {req.requested_by?.display_name ?? 'ทีมร้าน'} ·
        ระหว่างรอ ลูกค้ายังเห็นหมุดเดิม
      </Typography.Paragraph>

      <Form<AdminLocationValues> form={form} layout="vertical" initialValues={initial} disabled={saving}>
        {editing ? (
          <>
            <Alert
              className="!mb-4"
              type="info"
              showIcon
              title="ปรับหมุดหรือข้อมูลให้ถูกต้อง แล้วกด บันทึกและอนุมัติ"
              description="ร้านได้รับแจ้งว่าทีม NightOut ปรับเล็กน้อยก่อนอนุมัติ"
            />
            <BarLocationEditor
              form={form}
              current={current}
              search={searchPlace}
              reverse={reversePlace}
              disabled={saving}
            />
          </>
        ) : (
          <div className="space-y-4">
            {current ? (
              far && (
                <Alert
                  type="warning"
                  showIcon
                  title={`หมุดใหม่ห่างจากหมุดเดิม ${movedText(current, requested)}`}
                  description="ตรวจให้แน่ใจว่าไม่ได้ปักผิดร้าน ก่อนอนุมัติ"
                />
              )
            ) : (
              <Alert type="info" showIcon title="ร้านนี้ยังไม่เคยปักหมุดจริง — นี่คือหมุดแรกของร้าน" />
            )}
            <div>
              <PinMap current={current} value={requested} />
              {current && (
                <div className="mt-2">
                  <PinLegend newLabel="หมุดที่ร้านขอ" />
                </div>
              )}
            </div>
            <LocationCompare
              columns={[
                { key: 'now', title: 'ตอนนี้ (ลูกค้าเห็น)', fields: bar },
                { key: 'request', title: 'ร้านขอ', fields: req, against: 0 },
              ]}
            />
          </div>
        )}
      </Form>
    </Drawer>
  );
}

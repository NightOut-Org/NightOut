import { isLegacyDefaultPin } from '@nightout/utils';
import { Alert, App, Button, Form, Popconfirm } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BarWithTier } from '@/services/data';
import { useFormDirty } from '@/hooks/useFormDirty';
import { HEADER_SAVE_CLASS } from '@/ui/utils/buttonClasses';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useNow } from '@/hooks/useNow';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { BarLocationFields } from '@/ui/components/barLocationFields';
import { LocationPicker } from '@/ui/components/locationPicker';
import { Tile } from '@/ui/components/merchantUi';
import { barImage } from '@/ui/utils/barImage';
import {
  fillEmptyAddress,
  locationDraftKey,
  locationFormFromBar,
  locationFormFromRequest,
  toLocationBody,
  type LocationFormValues,
} from '@/ui/utils/barLocation';
import { dateTime } from '@/ui/utils/format';
import { cancelLocationRequest, reversePlace, saveLocation, searchPlace } from './api';

/** ป้ายผลตรวจ (ผ่าน / ทีมงานตั้งให้) แสดงกี่วันหลังตรวจ */
const RECENT_MS = 14 * 24 * 60 * 60 * 1000;
const CANCEL_TITLE = 'ยกเลิกคำขอแก้ตำแหน่ง?';

interface Banner {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  /** มีคำขอรอตรวจ → ปุ่ม "ยกเลิกคำขอ" */
  pending?: boolean;
}

/** ป้ายสถานะตำแหน่งร้าน — ตรงข้อแรกที่เข้าเงื่อนไข (แสดงป้ายเดียว) */
function locationBanner(bar: BarWithTier, live: boolean, now: number): Banner | null {
  const req = bar.locationRequest;
  // ร้านที่แสดงอยู่แต่ยังเป็นหมุดค่าเริ่มต้น และส่งคำขอแล้ว → แสดงป้ายรอตรวจแทน
  // คำขอล่าสุดถูกตีกลับ → ต่อเหตุผลท้ายป้าย (ทีมร้านต้องเห็นเหตุผลเสมอ)
  if (isLegacyDefaultPin(bar.lat, bar.lng) && req?.status !== 'PENDING') {
    const rejected = req?.status === 'REJECTED';
    return {
      type: rejected ? 'error' : 'warning',
      title: `ร้านยังไม่ได้ปักหมุดจริง — ปักหมุดตำแหน่งร้านแล้ว${live ? 'ส่งให้ทีมตรวจ' : 'บันทึก'}${
        rejected ? ` (ครั้งก่อนไม่ผ่าน: ${req.reason ?? '-'})` : ''
      }`,
    };
  }
  if (!live)
    return {
      type: 'info',
      title: 'ร้านยังไม่เปิดแสดง — ตำแหน่งที่บันทึกจะถูกตรวจพร้อมการอนุมัติร้าน',
    };
  if (!req) return null;
  if (req.status === 'PENDING')
    return {
      type: 'info',
      title: `รอทีม NightOut ตรวจตำแหน่งใหม่ ส่งเมื่อ ${dateTime(req.createdAt)} ระหว่างรอ ลูกค้ายังเห็นหมุดเดิม (สีเทา)`,
      pending: true,
    };
  if (req.status === 'REJECTED')
    return {
      type: 'error',
      title: `ตำแหน่งที่ส่งล่าสุดไม่ผ่านการตรวจ: ${req.reason ?? '-'} — แก้แล้วส่งใหม่ได้เลย`,
    };
  if (
    req.status !== 'APPROVED' ||
    !req.reviewedAt ||
    now - new Date(req.reviewedAt).getTime() > RECENT_MS
  )
    return null;
  if (req.adminEdited || req.source === 'ADMIN')
    return {
      type: 'success',
      title: `ทีม NightOut ${req.source === 'ADMIN' ? 'ตั้งตำแหน่งให้' : 'ปรับหมุดเล็กน้อยแล้วอนุมัติ'} เมื่อ ${dateTime(req.reviewedAt)}${
        req.reason ? ` (${req.reason})` : ''
      }`,
    };
  return { type: 'success', title: `ตำแหน่งใหม่ผ่านการตรวจแล้ว เมื่อ ${dateTime(req.reviewedAt)}` };
}

const sameLocation = (a: Partial<LocationFormValues>, b: Partial<LocationFormValues>) =>
  JSON.stringify(locationDraftKey(a)) === JSON.stringify(locationDraftKey(b));

/**
 * /merchant/location — หมุดร้าน + ที่อยู่ ที่จอดรถ รถไฟฟ้าใกล้สุด
 * ร้านที่แสดงอยู่: ส่งเป็นคำขอให้ทีม NightOut ตรวจ (ระหว่างรอลูกค้าเห็นหมุดเดิม) · ร้านที่ยังไม่เคยแสดง: บันทึกทันที (ตรวจพร้อมการอนุมัติร้าน)
 * ทีมร้านทุกบทบาทดูได้ · แก้ได้เฉพาะเจ้าของ/ผู้จัดการ
 */
export function MerchantLocationPage() {
  const bar = useMerchantBar();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<LocationFormValues>();
  const now = useNow(60_000);
  const canEdit = bar.staffRole !== 'STAFF';
  const live = bar.status === 'APPROVED' || bar.status === 'SUSPENDED';
  const pending = bar.locationRequest?.status === 'PENDING' ? bar.locationRequest : undefined;
  const legacy = isLegacyDefaultPin(bar.lat, bar.lng);
  const current = useMemo(
    () => (legacy ? null : { lat: bar.lat, lng: bar.lng }),
    [legacy, bar.lat, bar.lng],
  );
  const liveValues = locationFormFromBar(bar);
  const initial = pending ? locationFormFromRequest(pending) : liveValues;
  const values = (Form.useWatch([], { form, preserve: true }) ?? {}) as Partial<LocationFormValues>;
  const dirty = useFormDirty(form, initial, locationDraftKey);
  // ค่าจาก server เปลี่ยนระหว่างเปิดหน้า (แอดมินตรวจ/ตั้งหมุดแทน · poll /me/overview) → ฟอร์มที่ยังไม่ได้แก้ตามค่าใหม่
  // (ไม่อย่างนั้นฟอร์มค้างค่าที่ถูกแทนแล้ว ขึ้น "ยังไม่บันทึก" เอง และกดส่งซ้ำทับหมุดที่แอดมินตั้ง) · แก้ค้างอยู่ = เก็บการแก้ไว้
  const initialKey = JSON.stringify(locationDraftKey(initial));
  const syncedKey = useRef(initialKey);
  useEffect(() => {
    if (syncedKey.current === initialKey) return;
    const untouched =
      JSON.stringify(locationDraftKey(form.getFieldsValue(true) as Partial<LocationFormValues>)) ===
      syncedKey.current;
    syncedKey.current = initialKey;
    if (untouched) form.setFieldsValue(initial);
  }, [form, initial, initialKey]);
  const [busy, setBusy] = useState(false);
  const { confirmDiscard } = useUnsavedGuard(canEdit && dirty);
  // รอตรวจอยู่ แล้วแก้กลับเป็นค่าที่ลูกค้าเห็น = ไม่มีอะไรให้ส่ง (API ตอบ LOCATION_UNCHANGED) → เสนอยกเลิกคำขอแทน
  const revertsToLive = !!pending && sameLocation(values, liveValues);
  const banner = locationBanner(bar, live, now);

  const cancelRequest = async () => {
    setBusy(true);
    try {
      await cancelLocationRequest(bar.id);
      // ฟอร์มยังเป็นค่าที่ส่งไว้ → กลับเป็นค่าที่ลูกค้าเห็นอยู่ (ถ้าแก้ต่อไว้ เก็บการแก้ไว้ให้ส่งใหม่ได้)
      if (!dirty || revertsToLive) form.setFieldsValue(liveValues);
      void message.success('ยกเลิกคำขอแล้ว');
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (revertsToLive) {
      modal.confirm({
        title: CANCEL_TITLE,
        content: 'ค่าตรงกับหมุดที่ลูกค้าเห็นอยู่ — ยกเลิกคำขอที่รอตรวจแทน',
        okText: 'ยกเลิกคำขอ',
        cancelText: 'เก็บคำขอไว้',
        onOk: () => cancelRequest(),
      });
      return;
    }
    let v: LocationFormValues;
    try {
      v = await form.validateFields();
    } catch {
      return; // ฟอร์มแสดงช่องที่ผิดให้แล้ว
    }
    setBusy(true);
    try {
      const res = await saveLocation(bar.id, toLocationBody(v));
      void message.success(
        res.status === 'PENDING'
          ? 'ส่งให้ทีม NightOut ตรวจแล้ว ระหว่างรอ ลูกค้ายังเห็นหมุดเดิม'
          : 'บันทึกตำแหน่งแล้ว — ทีม NightOut ตรวจพร้อมการอนุมัติร้าน',
      );
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveButton = (cls: string, label: string) => (
    <button
      type="button"
      disabled={busy || !dirty}
      onClick={() => void save()}
      className={`merchant-pill disabled:opacity-60 ${cls}`}
    >
      {busy ? (live ? 'กำลังส่ง…' : 'กำลังบันทึก…') : label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold lg:font-display lg:text-[30px]">ตำแหน่งร้าน</h1>
          <p className="mt-1 hidden text-sm text-muted lg:block">
            ลูกค้าเห็นหมุด ที่อยู่ ที่จอดรถ และรถไฟฟ้าใกล้สุดในหน้าร้าน และแก้แล้วต้องรอทีม NightOut
            ตรวจก่อนแสดง (ระหว่างรอลูกค้ายังเห็นหมุดเดิม)
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1 lg:gap-3">
            {dirty && !busy && (
              <>
                <span className="hidden text-sm text-gold-text lg:inline" role="status">
                  ยังไม่บันทึก
                </span>
                <button
                  type="button"
                  onClick={() => confirmDiscard(() => form.resetFields())}
                  className="merchant-pill px-2 py-1 text-sm text-muted lg:h-10 lg:rounded-xl lg:border lg:border-border lg:px-[18px]"
                >
                  คืนค่า
                </button>
              </>
            )}
            {saveButton(
              HEADER_SAVE_CLASS,
              live ? 'ส่งให้ทีมตรวจ' : 'บันทึกตำแหน่ง',
            )}
            {saveButton(
              'px-2 py-1 text-sm font-semibold text-gold-text lg:hidden',
              live ? 'ส่งตรวจ' : 'บันทึก',
            )}
          </div>
        )}
      </div>

      {banner && (
        <Alert
          showIcon
          type={banner.type}
          title={banner.title}
          action={
            banner.pending && canEdit ? (
              <Popconfirm
                title={CANCEL_TITLE}
                description="ลูกค้ายังเห็นหมุดเดิมต่อ"
                okText="ยกเลิกคำขอ"
                cancelText="เก็บคำขอไว้"
                disabled={busy}
                onConfirm={() => cancelRequest()}
              >
                <Button size="small" disabled={busy}>
                  ยกเลิกคำขอ
                </Button>
              </Popconfirm>
            ) : undefined
          }
        />
      )}

      <Form<LocationFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initial}
        disabled={busy}
        className="merchant-location-form"
      >
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Tile>
            <Form.Item
              name="pin"
              label="หมุดบนแผนที่"
              rules={[{ required: true, message: 'ปักหมุดตำแหน่งร้านบนแผนที่' }]}
              className="!mb-0"
            >
              <LocationPicker
                current={current}
                // ร้านที่ยังไม่เปิดแสดง: ลูกค้ายังไม่เห็นหมุด
                currentLabel={live ? undefined : 'หมุดที่บันทึกไว้'}
                image={barImage(bar)}
                search={searchPlace}
                onPickPlace={(p) => fillEmptyAddress(form, p)}
                readOnly={!canEdit}
                // ระหว่างส่ง/ยกเลิกคำขอ ห้ามย้ายหมุด (Form disabled ไม่ถึงแผนที่)
                disabled={busy}
              />
            </Form.Item>
          </Tile>
          <Tile>
            <BarLocationFields reverse={reversePlace} disabled={!canEdit || busy} />
            {(!canEdit || (live && bar.locationReviewedAt)) && (
              <div className="mt-4 flex flex-col gap-1 text-[13px] text-muted">
                {live && bar.locationReviewedAt && (
                  <span>หมุดผ่านการตรวจล่าสุด {dateTime(bar.locationReviewedAt)}</span>
                )}
                {!canEdit && <span>เฉพาะเจ้าของ/ผู้จัดการแก้ตำแหน่งได้</span>}
              </div>
            )}
          </Tile>
        </div>
      </Form>
    </div>
  );
}

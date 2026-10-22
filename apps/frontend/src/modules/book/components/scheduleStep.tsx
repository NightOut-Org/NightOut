import { Tag as PromoIcon } from '@phosphor-icons/react';
import { Alert, Button, Card, DatePicker, Form, Radio, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { promotionApplies } from '@/services/data';
import { promoNote } from '@/ui/utils/promotion';
import type { BookingForm } from '../hooks/useBookingForm';
import { PAX_OPTIONS, TIMES } from '../utils/times';

/** ขั้น 1: วันเวลา จำนวนคน โซน และโปรโมชัน (ถ้ามี) */
export function ScheduleStep({ f }: { f: BookingForm }) {
  return (
    <Card>
      <Form layout="vertical">
        <div className="grid gap-4 sm:grid-cols-3">
          <Form.Item label="วันที่">
            <DatePicker
              className="w-full"
              value={f.date}
              onChange={(d) => d && f.setDate(d)}
              disabledDate={(d) => d.isBefore(dayjs(), 'day') || d.isAfter(dayjs().add(30, 'day'))}
              format="D MMM YYYY"
              allowClear={false}
            />
          </Form.Item>
          <Form.Item label="เวลา">
            <Select
              value={f.time}
              onChange={f.setTime}
              options={TIMES.map((t) => ({ label: `${t} น.`, value: t }))}
            />
          </Form.Item>
          <Form.Item label="จำนวนคน">
            <Select value={f.pax} onChange={f.setPax} options={PAX_OPTIONS} />
          </Form.Item>
        </div>
        {f.past && <Alert type="warning" showIcon className="mb-4" title="เวลานี้ผ่านไปแล้ว เลือกเวลาใหม่" />}

        <ZonePicker f={f} />
        <PromotionPicker f={f} />

        <Button type="primary" block disabled={!f.canContinue} onClick={() => f.setStep(1)}>
          ถัดไป
        </Button>
      </Form>
    </Card>
  );
}

/** เลือกโซน — โซนเต็มกดไม่ได้ */
function ZonePicker({ f }: { f: BookingForm }) {
  return (
    <Form.Item label="โซน">
      <Radio.Group
        value={f.zoneId}
        onChange={(e) => f.setZoneId(e.target.value)}
        className="grid w-full gap-3 sm:grid-cols-3"
      >
        {f.loadingSlots && <Spin />}
        {f.slots.map(({ zone, freeTables, full }) => (
          <Radio.Button
            key={zone.id}
            value={zone.id}
            disabled={full}
            className="!h-auto !rounded-xl !border !p-3 text-center"
          >
            <span className="block font-semibold">{zone.name}</span>
            <span className="block text-xs text-muted">
              {full ? 'เต็มแล้ว' : freeTables > 0 ? `ว่าง ${freeTables} โต๊ะ` : 'มีที่ว่าง'}
            </span>
          </Radio.Button>
        ))}
      </Radio.Group>
    </Form.Item>
  );
}

/** เลือกโปรของร้านได้ 1 อย่าง — โปรที่ไม่เข้าเงื่อนไขเวลาเลือกไม่ได้ */
function PromotionPicker({ f }: { f: BookingForm }) {
  if (!f.promos.length) return null;
  return (
    <Form.Item
      label={
        <span className="inline-flex items-center gap-1.5">
          <PromoIcon /> โปรโมชันของร้าน (เลือกได้ 1 อย่าง)
        </span>
      }
    >
      <Radio.Group
        value={f.promotionId ?? ''}
        onChange={(e) => f.setPromotionId(e.target.value || undefined)}
        className="grid w-full gap-2"
      >
        <Radio value="">ไม่รับโปร</Radio>
        {f.promos.map((p) => {
          const ok = promotionApplies(p, f.iso);
          return (
            <Radio key={p.id} value={p.id} disabled={!ok} className="!items-start">
              <span className="block font-semibold">{p.title}</span>
              <span className="block text-xs text-muted">
                {promoNote(p)}
                {!ok && ' — ใช้กับเวลาที่เลือกไม่ได้'}
              </span>
            </Radio>
          );
        })}
      </Radio.Group>
    </Form.Item>
  );
}

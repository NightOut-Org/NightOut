import { Alert, Input, Radio } from 'antd';
import { useId } from 'react';
import {
  detailMaxLength,
  MERCHANT_CANCEL_REASONS,
  type MerchantCancelReason,
} from '../utils/cancelReasons';

/**
 * เลือกเหตุผลที่ร้านยกเลิก / คืน Table Fee + รายละเอียด (กล่องคืนเงิน และกล่องยกเลิกการจอง)
 * "ร้านไม่มีโต๊ะให้ลูกค้า" แสดงเฉพาะการจองที่ร้านรับแล้ว (allowNoTable) และเตือนว่าร้านจะถูกบันทึกประวัติ
 */
export function ReasonPicker({
  value,
  detail,
  onChange,
  onDetail,
  allowNoTable,
  limit = 300,
}: {
  value?: MerchantCancelReason;
  detail: string;
  onChange: (key: MerchantCancelReason) => void;
  onDetail: (detail: string) => void;
  allowNoTable: boolean;
  /** ความยาวเหตุผลรวมที่ API รับ (คืน Table Fee 300 · ยกเลิกการจอง 200) */
  limit?: number;
}) {
  const id = useId();
  const max = detailMaxLength(value, limit);
  const options = MERCHANT_CANCEL_REASONS.filter((r) => allowNoTable || r.key !== 'NO_TABLE').map(
    (r) => ({
      value: r.key,
      label: r.label,
    }),
  );

  return (
    <div className="space-y-3">
      <div>
        <span id={`${id}-label`} className="mb-1.5 block text-sm font-medium">
          เหตุผล
        </span>
        <Radio.Group
          aria-labelledby={`${id}-label`}
          orientation="vertical"
          value={value}
          options={options}
          onChange={(e) => {
            const key = e.target.value as MerchantCancelReason;
            onChange(key);
            // เปลี่ยนเหตุผลแล้วรายละเอียดเดิมยาวเกินที่ API รับ → ตัดให้พอดี
            const m = detailMaxLength(key, limit);
            if (detail.length > m) onDetail(detail.slice(0, m));
          }}
        />
      </div>
      {value === 'NO_TABLE' && (
        <Alert
          type="warning"
          showIcon
          title='ร้านจะถูกบันทึกประวัติ "ไม่มีโต๊ะให้ลูกค้า"'
          description="คืน Table Fee เต็มจำนวนให้ลูกค้า และแจ้งทีม NightOut — ร้านที่ไม่มีโต๊ะให้ลูกค้าซ้ำอาจถูกระงับการแสดงและการจอง (Blacklist)"
        />
      )}
      <div>
        <label htmlFor={`${id}-detail`} className="mb-1.5 block text-sm font-medium">
          รายละเอียด{' '}
          <span className="font-normal text-muted">
            {value === 'OTHER' ? '(บังคับ)' : '(ไม่บังคับ)'}
          </span>
        </label>
        <Input.TextArea
          id={`${id}-detail`}
          rows={2}
          maxLength={max}
          showCount
          placeholder="อธิบายสั้น ๆ ให้ทีม NightOut เข้าใจเคสนี้"
          value={detail}
          onChange={(e) => onDetail(e.target.value)}
        />
      </div>
    </div>
  );
}

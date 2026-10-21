import type { Booking } from '@/services/models';
import type { BookingStatus } from '@nightout/types';

/** booking — แถวจาก view booking_detail → Booking ของหน้าเว็บ (ใช้ทั้งการจองของฉันและของร้าน) */
export interface BookingDetailRow {
  id: string;
  code: string;
  status: BookingStatus;
  user_id: string;
  booking_datetime: string;
  pax: number;
  customer_note: string | null;
  cancel_reason: string | null;
  deposit_required: number;
  checked_in_at: string | null;
  /** เวลาปลดโต๊ะ (Forfeited) — grace ของร้าน + เวลาที่ต่อแล้ว */
  auto_cancel_at: string;
  /** เวลาที่ลูกค้ากด "ขอต่อเวลา 15 นาที" (null = ยังไม่ต่อ) */
  extended_at: string | null;
  created_at: string;
  bar: { id: string } | null;
  zone: { id: string; name: string } | null;
  table: { id: string; name: string } | null;
  promotion: { id: string | null; title: string } | null;
  deposit: {
    id: string;
    amount: number;
    status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
    reject_reason: string | null;
    settlement: string;
    verified_at: string | null;
    created_at: string;
    /** SLIP = โอน + สลิป · ONLINE = ชำระผ่านผู้ให้บริการ (booking_deposit_summary · migration 20261013001100) */
    method?: 'SLIP' | 'ONLINE';
    provider?: string | null;
  } | null;
  status_history: { from_status: BookingStatus | null; to_status: BookingStatus; reason: string | null; created_at: string }[];
  customer_name: string | null;
  share_token: string | null;
  has_review: boolean;
}
/** ใครเปลี่ยนสถานะ (DB เก็บเหตุผล ไม่ได้เก็บชื่อให้ลูกค้าเห็น) */
function historyBy(reason: string | null, customer: string): string {
  switch (reason) {
    case 'created':
    case 'deposit submitted':
    case 'customer cancelled':
      return customer;
    case 'deposit verified':
    case 'payment paid':
    case 'slip rejected':
      return 'NightOut';
    case 'timeout':
      return 'ระบบ';
    case 'team forfeit':
      return 'ร้าน';
    case null:
      return 'ร้าน';
    default:
      return reason === 'merchant' || reason === 'staff' || reason === 'check-in' ? 'ร้าน' : reason;
  }
}

export function toBooking(r: BookingDetailRow): Booking {
  const userName = r.customer_name ?? 'ลูกค้า';
  const settlement = r.deposit?.settlement;
  return {
    id: r.id,
    code: r.code,
    barId: r.bar?.id ?? '',
    userId: r.user_id,
    userName,
    zoneId: r.zone?.id ?? '',
    tableId: r.table?.id,
    datetime: r.booking_datetime,
    pax: r.pax,
    status: r.status,
    depositRequired: Number(r.deposit_required),
    cancelReason: r.cancel_reason ?? undefined,
    depositRejectReason: r.deposit?.status === 'REJECTED' ? (r.deposit.reject_reason ?? undefined) : undefined,
    promotionId: r.promotion?.id ?? undefined,
    promotionTitle: r.promotion?.title,
    deposit: r.deposit
      ? {
          amount: Number(r.deposit.amount),
          status: r.deposit.status,
          submittedAt: r.deposit.created_at,
          verifiedAt: r.deposit.verified_at ?? undefined,
          method: r.deposit.method ?? 'SLIP',
          provider: r.deposit.provider ?? undefined,
          settlement:
            settlement && settlement !== 'NONE'
              ? (settlement as NonNullable<Booking['deposit']>['settlement'])
              : undefined,
        }
      : undefined,
    note: r.customer_note ?? undefined,
    createdAt: r.created_at,
    history: r.status_history.map((h) => ({
      from: h.from_status,
      to: h.to_status,
      by: historyBy(h.reason, userName),
      at: h.created_at,
    })),
    checkedInAt: r.checked_in_at ?? undefined,
    autoCancelAt: r.auto_cancel_at,
    extendedAt: r.extended_at ?? undefined,
    shareToken: r.share_token ?? '',
    reviewed: r.has_review,
  };
}


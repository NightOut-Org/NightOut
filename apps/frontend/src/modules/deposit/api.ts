import type * as C from '@nightout/contracts';
import { PAYMENT_POLL_MS } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { uploadDepositSlip } from '@/services/api/storage';
import { me } from '@/services/sync';

/**
 * API ของหน้าชำระ Table Fee (/bookings/:id/deposit)
 * backend: domains/deposit (โอน + แนบสลิป) · domains/payment (หน้าชำระเงินของผู้ให้บริการ) · สัญญา: @nightout/contracts deposit.ts · payment.ts
 */

/** อัปโหลดสลิปเข้า deposit-slips/<user>/... แล้ว POST /bookings/:id/deposit */
export async function submitDeposit(bookingId: string, slip: Blob) {
  const path = await uploadDepositSlip(me().id, bookingId, slip);
  await Rest.post(`/bookings/${bookingId}/deposit`, { slip_path: path } satisfies C.SubmitDepositBody);
}

/** GET /payments/config — ช่องทางที่เปิด (PROVIDER = หน้าชำระเงินออนไลน์ · SLIP = โอน + แนบสลิปเดิม) */
export const usePaymentConfig = () =>
  useQuery({
    queryKey: ['payment', 'config'],
    queryFn: () => Rest.get<C.PaymentConfig>('/payments/config'),
    staleTime: 5 * 60_000,
  });

/** POST /bookings/:id/checkout — เปิด (หรือใช้ซ้ำ) หน้าชำระเงินของผู้ให้บริการ */
export const startCheckout = (bookingId: string) =>
  Rest.post<C.CheckoutResult>(`/bookings/${bookingId}/checkout`);

export const bookingPaymentsKey = (bookingId: string) => ['payment', 'booking', bookingId] as const;

/** GET /bookings/:id/payments — ใหม่สุดก่อน · poll ระหว่างรอผลจากผู้ให้บริการ */
export const useBookingPayments = (bookingId: string, opts: { enabled: boolean; poll: boolean }) =>
  useQuery({
    queryKey: bookingPaymentsKey(bookingId),
    queryFn: () => Rest.get<C.PaymentIntentView[]>(`/bookings/${bookingId}/payments`),
    enabled: opts.enabled,
    refetchInterval: opts.poll ? PAYMENT_POLL_MS : false,
  });

/** webhook ยืนยันแล้ว (GET ไม่โหลด store ใหม่เอง) → โหลด store ใหม่ให้สถานะการจอง/Table Fee ตรง */
export { refresh as reloadAfterPaid } from '@/services/sync';

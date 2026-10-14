import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าการชำระเงิน · backend: domains/backoffice (อ่าน admin_payment_intents / admin_payment_unmatched) · domains/payment (payment.admin.controller.ts) */

/** GET /admin/views/admin_payment_intents ใหม่สุดก่อน */
export const usePaymentIntents = () =>
  useAdminView('admin_payment_intents', { order: { column: 'created_at', ascending: false }, limit: 1000 });

/** GET /admin/views/admin_payment_unmatched — webhook ชำระสำเร็จที่หารายการไม่เจอ (ใหม่สุดก่อน) */
export const useUnmatchedPayments = () =>
  useAdminView('admin_payment_unmatched', { order: { column: 'received_at', ascending: false }, limit: 200 });

/** GET /payments/config — โหมดที่ backend เปิดอยู่ (PROVIDER / SLIP) */
export const usePaymentConfig = () =>
  useQuery({
    queryKey: ['admin', 'payment', 'config'],
    queryFn: () => Rest.get<C.PaymentConfig>('/payments/config'),
    staleTime: 60_000,
  });

/** POST /admin/payments/:id/refunded — บันทึกว่าคืนเงินที่ระบบผู้ให้บริการแล้ว (rpc admin_payment_mark_refunded) */
export const markPaymentRefundedAction = (intentId: string, body: C.MarkPaymentRefundedBody): AdminActionInput => ({
  method: 'POST',
  path: `payments/${intentId}/refunded`,
  body,
});

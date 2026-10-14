import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/**
 * API ของหน้าชำระเงินจำลอง (/pay/mock/:intentId · PAYMENT_PROVIDER=mock)
 * backend: domains/payment (payment.public.controller.ts · payment.me.controller.ts) · สัญญา: @nightout/contracts payment.ts
 */

/** GET /payments/config — ประกาศซ้ำกับ modules/deposit (ADR 0007 · key เดียวกันใช้ cache ร่วม) */
export const usePaymentConfig = () =>
  useQuery({
    queryKey: ['payment', 'config'],
    queryFn: () => Rest.get<C.PaymentConfig>('/payments/config'),
    staleTime: 5 * 60_000,
  });

/** GET /payments/intents/:id — รายการชำระของฉัน 1 รายการ (rpc my_payment_intents) */
export const useMockIntent = (id: string) =>
  useQuery({
    queryKey: ['payment', 'intent', id],
    queryFn: () => Rest.get<C.PaymentIntentView>(`/payments/intents/${id}`),
    enabled: !!id,
  });

/** POST /payments/mock/:id/complete — สร้าง webhook จำลองที่เซ็นแล้ว (Rest โหลด store ใหม่ให้ → การจองเป็น CONFIRMED) */
export const completeMockPayment = (id: string, outcome: C.MockCompleteBody['outcome']) =>
  Rest.post<C.PaymentWebhookResult>(`/payments/mock/${id}/complete`, {
    outcome,
  } satisfies C.MockCompleteBody);

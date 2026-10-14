import type * as C from '@nightout/contracts';
import { PAYMENT_POLL_MAX_MS } from '@nightout/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { bookingPaymentsKey, reloadAfterPaid, useBookingPayments } from '../api';

export interface PaymentStatus {
  /** รายการชำระล่าสุดของการจองนี้ (ใหม่สุดก่อน) */
  latest: C.PaymentIntentView | undefined;
  /** กำลังรอผลจากผู้ให้บริการ (poll ทุก PAYMENT_POLL_MS) */
  checking: boolean;
  /** รอครบ PAYMENT_POLL_MAX_MS แล้วยังไม่ได้ผล */
  timedOut: boolean;
  /** โหลดผลการชำระไม่สำเร็จ (เน็ต/เซิร์ฟเวอร์) — ให้ตรวจใหม่ ห้ามชวนจ่ายซ้ำ */
  failed: boolean;
  /** เริ่มตรวจผลใหม่อีกรอบ */
  recheck: () => void;
}

/**
 * สถานะการชำระ Table Fee ผ่านผู้ให้บริการ — กลับมาจากหน้าชำระเงิน (`?payment=return`) แล้ว poll จนได้ผลหรือครบเวลา
 * ชำระสำเร็จและผูกกับการจองแล้ว → โหลด store ใหม่ (การจองเป็น CONFIRMED → หน้าแสดงสำเร็จ)
 */
export function usePaymentStatus(
  bookingId: string,
  { enabled, returning }: { enabled: boolean; returning: boolean },
): PaymentStatus {
  const [startedAt, setStartedAt] = useState<number | null>(() => (returning ? Date.now() : null));
  const now = useNow(1000);
  // อ่านจาก cache ก่อนเรียก useQuery (ค่าเดียวกับ q.data) เพื่อรู้ว่าต้อง poll ต่อไหม
  const cached = useQueryClient().getQueryData<C.PaymentIntentView[]>(
    bookingPaymentsKey(bookingId),
  )?.[0];
  const poll = !!startedAt && cached?.status === 'PENDING' && now - startedAt < PAYMENT_POLL_MAX_MS;
  const q = useBookingPayments(bookingId, { enabled, poll });
  const latest = q.data?.[0];

  const reloaded = useRef(false);
  const paidAndApplied = latest?.status === 'PAID' && latest.applied;
  useEffect(() => {
    if (!paidAndApplied || reloaded.current) return;
    reloaded.current = true;
    void reloadAfterPaid();
  }, [paidAndApplied]);

  const { refetch } = q;
  const recheck = useCallback(() => {
    setStartedAt(Date.now());
    void refetch();
  }, [refetch]);

  return {
    latest,
    checking: poll || (returning && q.isLoading),
    timedOut: !!startedAt && latest?.status === 'PENDING' && !poll,
    failed: q.isError,
    recheck,
  };
}

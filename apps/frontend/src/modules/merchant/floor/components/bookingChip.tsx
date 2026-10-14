import { useDraggable } from '@dnd-kit/core';
import { DotsSixVertical } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import type { CSSProperties, ReactNode } from 'react';
import { isHolding, isUnpaid } from '../utils/board';
import type { DragData } from '../utils/useBoardMove';

/** สีกรอบของการจองตามสถานะ (การจองที่ยังไม่ชำระ = เส้นประทอง) */
export function chipTone(b: C.TableBoardBooking): CSSProperties {
  if (b.status === 'CHECKED_IN') return { borderColor: 'var(--crowd-full)' };
  if (isUnpaid(b.status)) return { borderColor: 'var(--gold)', borderStyle: 'dashed' };
  if (b.status === 'CONFIRMED') return { borderColor: 'var(--gold)' };
  return { borderColor: 'var(--border)', opacity: 0.7 };
}

/** คำอธิบายบทบาทของการจองที่ลากได้ (แทน "draggable" ภาษาอังกฤษของ dnd-kit) */
export const DRAGGABLE_ROLE = 'การจองที่ลากได้';

/** หน้าตาชิป (ใช้ทั้งในการ์ดและใน DragOverlay) */
export function ChipFace({ booking, children }: { booking: C.TableBoardBooking; children: ReactNode }) {
  const draggable = isHolding(booking.status);
  return (
    <span
      className="merchant-solid flex min-h-11 w-full items-center gap-1.5 rounded-xl border bg-card px-2 py-1.5 text-left text-[13px] leading-snug"
      style={chipTone(booking)}
    >
      {draggable && <DotsSixVertical size={16} weight="bold" className="shrink-0 text-muted" aria-hidden />}
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
    </span>
  );
}

/**
 * ชิปการจองที่ลากไปวางที่โต๊ะอื่นได้ (เฉพาะสถานะที่ยังไม่จบ) — `booking:<id>`
 * แตะเฉย ๆ = onTap (dnd-kit เริ่มลากหลังเมาส์ขยับ 6px / นิ้วกดค้าง 220ms) · อยู่ข้างปุ่มของการ์ด ไม่ซ้อนใน <button>
 */
export function BookingChip({
  booking,
  label,
  onTap,
  children,
}: {
  booking: C.TableBoardBooking;
  /** ข้อความสำหรับโปรแกรมอ่านหน้าจอ */
  label: string;
  onTap: () => void;
  children: ReactNode;
}) {
  const draggable = isHolding(booking.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking:${booking.id}`,
    data: { bookingId: booking.id } satisfies DragData,
    disabled: !draggable,
  });
  // ลากไม่ได้ = ปุ่มธรรมดา (ไม่ใส่ aria-disabled / คำอธิบายการลากของ dnd-kit — ยังแตะเปิดรายละเอียดได้)
  const a11y = draggable ? { ...attributes, 'aria-roledescription': DRAGGABLE_ROLE } : { role: 'button', tabIndex: 0 };
  return (
    <div
      ref={setNodeRef}
      {...a11y}
      aria-label={draggable ? `${label} · ลากเพื่อย้ายโต๊ะ` : label}
      onClick={onTap}
      onKeyDown={(e) => {
        if (!draggable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
      // ลากได้: ตัวฟังของ dnd-kit (คีย์บอร์ด Space/Enter = ยก) ทับ onKeyDown ด้านบน
      {...listeners}
      className={`floor-chip relative z-10 block w-full rounded-xl ${isDragging ? 'opacity-40' : ''} ${
        draggable ? 'cursor-grab' : 'cursor-pointer'
      }`}
    >
      <ChipFace booking={booking}>{children}</ChipFace>
    </div>
  );
}

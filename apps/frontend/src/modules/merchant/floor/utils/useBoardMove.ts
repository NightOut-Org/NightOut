import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { boardDropBlock, type BoardDropBlock } from '@nightout/utils';
import { App } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { DROP_BLOCK_TEXT, type BoardIndex } from './board';

/** data ของสิ่งที่ลากได้ (`booking:<id>`) */
export interface DragData {
  bookingId: string;
}
/** data ของที่วาง (`table:<id>` การ์ดในผัง · `row:<id>` แถวในไทม์ไลน์) — มี zoneId ให้ moveBooking ไม่ต้องหาจากชื่อ */
export interface DropData {
  tableId: string;
  zoneId: string;
}
/** การย้ายที่รอกดยืนยัน (MoveConfirmModal) */
export interface PendingMove {
  bookingId: string;
  tableId: string;
  zoneId: string;
}

/** ใช้ pointer ก่อน (นิ้ว/เมาส์อยู่บนการ์ดไหน) · คีย์บอร์ดไม่มี pointer → ใช้พื้นที่ที่ทับกัน */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

const screenReaderInstructions = {
  draggable: 'กด Space เพื่อยกการจอง ใช้ลูกศรเลื่อนไปโต๊ะปลายทาง แล้วกด Space อีกครั้งเพื่อวาง หรือ Escape เพื่อยกเลิก',
};

/**
 * ย้ายโต๊ะในผัง — ลากวาง (dnd-kit: เมาส์ลาก 6px · นิ้วกดค้าง 220ms · คีย์บอร์ด) และแตะเพื่อย้าย (เลือกการจอง → แตะโต๊ะปลายทาง)
 * ตรวจ boardDropBlock ก่อนเสมอ (ไม่ยิง API ถ้าวางไม่ได้) · วางได้ → เปิด MoveConfirmModal ผ่าน `pending`
 * ระหว่างลากหยุดโพล (`onPause`) เพื่อไม่ให้ผังเปลี่ยนใต้มือ
 */
export function useBoardMove(index: BoardIndex | null, onPause: (paused: boolean) => void) {
  const { message } = App.useApp();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const lastDragEnd = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const dragging = (draggingId && index?.bookings.get(draggingId)) || null;
  const moving = (movingId && index?.bookings.get(movingId)) || null;
  const active = dragging ?? moving;

  /** วางการจองที่กำลังลาก/เลือกอยู่ลงโต๊ะนี้ได้ไหม · undefined = ไม่ได้ลาก/เลือกอะไรอยู่ */
  const blockFor = useCallback(
    (tableId: string): BoardDropBlock | null | undefined => {
      const ref = index?.tables.get(tableId);
      if (!active || !index || !ref) return undefined;
      return boardDropBlock(active, ref.table, index.byTable.get(tableId) ?? []);
    },
    [active, index],
  );

  const tryMove = useCallback(
    (bookingId: string, target: DropData) => {
      const booking = index?.bookings.get(bookingId);
      const ref = index?.tables.get(target.tableId);
      if (!index || !booking || !ref) return;
      const block = boardDropBlock(booking, ref.table, index.byTable.get(target.tableId) ?? []);
      if (block) {
        void message.warning(DROP_BLOCK_TEXT[block]);
        return;
      }
      setMovingId(null);
      setPending({ bookingId, tableId: target.tableId, zoneId: target.zoneId });
    },
    [index, message],
  );

  const endDrag = () => {
    setDraggingId(null);
    lastDragEnd.current = Date.now();
    onPause(false);
  };

  const announcements = useMemo<Announcements>(() => {
    const label = (id: string | number) => {
      const b = index?.bookings.get(String(id).replace(/^booking:/, ''));
      return b ? `${b.code} ${b.customer_name ?? ''}` : 'การจอง';
    };
    const target = (data: unknown) => {
      const d = data as DropData | undefined;
      const t = d && index?.tables.get(d.tableId);
      return t ? `โต๊ะ ${t.table.name}` : 'นอกโต๊ะ';
    };
    return {
      onDragStart: ({ active: a }) => `ยก ${label(a.id)}`,
      onDragOver: ({ active: a, over }) => `${label(a.id)} อยู่เหนือ ${target(over?.data.current)}`,
      onDragEnd: ({ active: a, over }) => `วาง ${label(a.id)} ที่ ${target(over?.data.current)}`,
      onDragCancel: ({ active: a }) => `ยกเลิกการลาก ${label(a.id)}`,
    };
  }, [index]);

  const startTapMove = useCallback((bookingId: string) => setMovingId(bookingId), []);
  const cancelTapMove = useCallback(() => setMovingId(null), []);
  const clearPending = useCallback(() => setPending(null), []);

  const dndProps = {
    sensors,
    collisionDetection,
    accessibility: { announcements, screenReaderInstructions },
    onDragStart: (e: DragStartEvent) => {
      const data = e.active.data.current as DragData | undefined;
      if (!data) return;
      setMovingId(null);
      setDraggingId(data.bookingId);
      onPause(true);
    },
    onDragEnd: (e: DragEndEvent) => {
      const data = e.active.data.current as DragData | undefined;
      const drop = e.over?.data.current as DropData | undefined;
      endDrag();
      if (data && drop) tryMove(data.bookingId, drop);
    },
    onDragCancel: endDrag,
  };

  return {
    dndProps,
    dragging,
    moving,
    /** เริ่ม/เลิกโหมดแตะเพื่อย้าย */
    startTapMove,
    cancelTapMove,
    blockFor,
    tryMove,
    pending,
    clearPending,
    /** คลิกที่ตามหลังการลากทันที (ปล่อยเมาส์บนการ์ด) ไม่ให้เปิดแผงโต๊ะ */
    justDragged: () => Date.now() - lastDragEnd.current < 300,
  };
}

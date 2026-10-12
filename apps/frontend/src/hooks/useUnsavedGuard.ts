import { App } from 'antd';
import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

const TITLE = 'ยังไม่ได้บันทึกการแก้ไข';
const CONTENT = 'ถ้าออกตอนนี้ การแก้ไขในหน้านี้จะหายไป';

/**
 * กันหลุดตอนมีการแก้ที่ยังไม่บันทึก (CLAUDE.md "ฟอร์ม · การบันทึก")
 * เปลี่ยนหน้าในแอป = ถามยืนยันก่อน · ปิด/รีโหลดแท็บ = กล่องเตือนของเบราว์เซอร์
 * เปลี่ยนแค่ query ไม่นับ · `confirmDiscard` ใช้ถามก่อนทิ้งการแก้ (ปุ่มคืนค่า / ปิด Drawer)
 */
export function useUnsavedGuard(dirty: boolean) {
  const { modal } = App.useApp();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const asking = useRef(false);

  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return;
    asking.current = true;
    modal.confirm({
      title: TITLE,
      content: CONTENT,
      okText: 'ออกโดยไม่บันทึก',
      okButtonProps: { danger: true },
      cancelText: 'อยู่ต่อ',
      onOk: () => blocker.proceed(),
      onCancel: () => blocker.reset(),
      afterClose: () => {
        asking.current = false;
      },
    });
  }, [blocker, modal]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** ถามก่อนทิ้งการแก้ (ปิด Drawer / กดคืนค่า) — ไม่มีอะไรค้าง = ทำเลย */
  const confirmDiscard = (onDiscard: () => void) => {
    if (!dirty) return onDiscard();
    modal.confirm({
      title: TITLE,
      content: CONTENT,
      okText: 'ทิ้งการแก้ไข',
      okButtonProps: { danger: true },
      cancelText: 'แก้ต่อ',
      onOk: onDiscard,
    });
  };

  return { confirmDiscard };
}

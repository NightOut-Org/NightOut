import { TABLE_FEE_SHORT } from '@nightout/utils';
import { App } from 'antd';

/** ข้อมูลการจองที่ใช้ในกล่องยืนยัน */
interface ForfeitTarget {
  code: string;
  userName: string;
}

/**
 * ถามยืนยันก่อน "ปลดโต๊ะ (Forfeited)" ด้วยมือ (ทีมร้านทุกบทบาท · ได้เมื่อเลยเวลาเก็บโต๊ะแล้ว — `canTeamForfeit`)
 * `run` = ฟังก์ชันใน api.ts ของโมดูลที่เรียก POST /merchant/bookings/:id/forfeit · ไม่แสดงยอดเงิน (Staff/PR ห้ามเห็นยอด)
 */
export function useConfirmForfeit() {
  const { modal, message } = App.useApp();
  return (b: ForfeitTarget, run: () => Promise<unknown>) =>
    modal.confirm({
      title: `ปลดโต๊ะ ${b.code} (Forfeited)?`,
      content: `${b.userName} เลยเวลาเก็บโต๊ะแล้วและยังไม่เช็กอิน — โต๊ะจะว่างให้ลูกค้าคนอื่น ${TABLE_FEE_SHORT} ของการจองนี้เป็นของร้าน และระบบแจ้งลูกค้าให้ทราบ (ย้อนกลับไม่ได้)`,
      okText: 'ปลดโต๊ะ',
      okButtonProps: { danger: true },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          await run();
          message.success('ปลดโต๊ะแล้ว');
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
}

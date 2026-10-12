import { Button, Space } from 'antd';

/**
 * ปุ่ม "คืนค่า" + "บันทึก (n)" ของหน้าที่แก้แบบ draft (CLAUDE.md "ฟอร์ม · การบันทึก") — วางใน `extra` ของ PageContainer / Drawer
 * ไม่มีอะไรเปลี่ยน = ปุ่มบันทึก disabled · ระหว่างบันทึก ปุ่มบันทึก loading (+ ข้อความความคืบหน้า) และคืนค่าไม่ได้
 */
export function SaveBar({
  count,
  saving,
  progress,
  disabled,
  onSave,
  onReset,
}: {
  /** จำนวนการแก้ที่ยังไม่บันทึก */
  count: number;
  saving: boolean;
  /** เช่น "กำลังอัปโหลด 2/5" — แสดงแทนคำว่าบันทึกระหว่างทำงาน */
  progress?: string | null;
  /** บันทึกไม่ได้ชั่วคราว (เช่น มีค่าที่ต้องแก้ก่อน) */
  disabled?: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <Space wrap>
      <Button disabled={!count || saving} onClick={onReset}>
        คืนค่า
      </Button>
      <Button type="primary" loading={saving} disabled={!count || disabled} onClick={onSave}>
        {saving ? (progress ?? 'กำลังบันทึก…') : count ? `บันทึก (${count})` : 'บันทึก'}
      </Button>
    </Space>
  );
}

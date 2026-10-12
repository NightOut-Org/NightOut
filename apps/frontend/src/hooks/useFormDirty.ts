import { Form, type FormInstance } from 'antd';

/**
 * ฟอร์มต่างจากค่าตั้งต้น (ค่าจาก server) ไหม — เทียบค่าจริงทุกครั้ง แก้แล้วย้อนกลับเป็นค่าเดิมเอง = ไม่นับว่าแก้
 * `pick` แปลงค่าฟอร์มเป็นรูปที่จะส่งบันทึก (ตัดช่องที่ไม่เกี่ยว · ค่าว่างแบบต่างๆ ให้เป็นค่าเดียวกัน) แล้วเทียบด้วย JSON
 */
export function useFormDirty<T, R>(form: FormInstance<T>, initial: T, pick: (v: T) => R) {
  const values = Form.useWatch([], { form, preserve: true }) as T | undefined;
  return values !== undefined && JSON.stringify(pick(values)) !== JSON.stringify(pick(initial));
}

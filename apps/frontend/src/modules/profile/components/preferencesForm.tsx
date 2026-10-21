import { App, Button, Form, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import { useFormDirty } from '@/hooks/useFormDirty';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAuth, type AppUser } from '@/services/auth';
import { MASTER, myPrefs } from '@/services/data';
import { updateProfile } from '../api';
import { districtSelectOptions } from '@/ui/utils/area';

interface PrefsValues {
  displayName: string;
  styles?: string[];
  districts?: string[];
  budget?: number | null;
  pax?: number | null;
}

/** ค่าที่จะบันทึก — ใช้เทียบว่าฟอร์มถูกแก้หรือยัง */
const pick = (v: PrefsValues) => ({
  display_name: v.displayName,
  style_ids: v.styles ?? [],
  district_ids: v.districts ?? [],
  budget_per_person: v.budget ?? null,
  usual_pax: v.pax ?? null,
});

/** ฟอร์มแก้ "ข้อมูลและความชอบ" — บันทึกสำเร็จ / ยกเลิก = กลับไปโหมดดู */
export function PreferencesForm({ user, onDone }: { user: AppUser; onDone: () => void }) {
  const { reload } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm<PrefsValues>();
  const [saving, setSaving] = useState(false);
  const [initial] = useState<PrefsValues>(() => ({
    displayName: user.displayName,
    styles: myPrefs.styleIds,
    districts: myPrefs.districtIds,
    budget: myPrefs.budget,
    pax: myPrefs.pax,
  }));
  const dirty = useFormDirty(form, initial, pick);
  useUnsavedGuard(dirty && !saving);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initial}
      onFinish={async (v) => {
        setSaving(true);
        try {
          await updateProfile(pick(v));
          await reload();
          message.success('บันทึกแล้ว');
          onDone();
        } catch (e) {
          message.error((e as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <Form.Item name="displayName" label="ชื่อที่แสดง" rules={[{ required: true, whitespace: true, message: 'ใส่ชื่อที่แสดง' }]}>
        <Input maxLength={60} />
      </Form.Item>
      <Form.Item name="styles" label="สไตล์ร้านที่ชอบ">
        <Select mode="multiple" options={MASTER.styles.map((st) => ({ label: st.label, value: st.id }))} />
      </Form.Item>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="budget" label="งบต่อหัว (บาท)">
          <InputNumber className="!w-full" min={0} step={100} />
        </Form.Item>
        <Form.Item name="pax" label="ไปกันกี่คนปกติ">
          <InputNumber className="!w-full" min={1} max={30} />
        </Form.Item>
      </div>
      <Form.Item name="districts" label="ย่านที่ชอบ">
        <Select mode="multiple" showSearch={{ optionFilterProp: 'label' }} placeholder="พิมพ์ชื่อย่าน" options={districtSelectOptions()} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving} className="w-full sm:w-auto">
        บันทึก
      </Button>
    </Form>
  );
}

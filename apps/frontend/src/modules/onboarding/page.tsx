import { App, Button, Card, Form, InputNumber, Select } from 'antd';
import { useState } from 'react';
import { MASTER, myPrefs } from '@/services/data';
import { updateProfile } from './api';
import { useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/ui/components/pageHeader';
import { AreaMultiSelect } from '@/ui/components/areaMultiSelect';
import { joinAreaPicks, splitAreaPicks } from '@/ui/utils/area';

/** `?next=` จากหน้าสมัคร (เช่น ลิงก์แชร์ที่กด "ไปด้วย") — รับเฉพาะ path ในเว็บเรา กันพาออกไปเว็บอื่น */
const safeNext = (v: string | null) => (v && /^\/(?![/\\])/.test(v) ? v : '/');

/** /onboarding — ความชอบ ใช้กับ rule-based recommendation · เสร็จ/ข้าม → ไป `?next=` (ไม่มี = หน้าแรก) */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="ชอบร้านแบบไหน?"
        subtitle="ช่วยให้เราแนะนำร้านที่ใช่ (แก้ได้ภายหลังในโปรไฟล์)"
      />
      <Card>
        <Form
          layout="vertical"
          size="large"
          initialValues={{
            styles: myPrefs.styleIds,
            areas: joinAreaPicks(myPrefs.districtIds, myPrefs.areaCodes),
            budget: myPrefs.budget,
            pax: myPrefs.pax,
          }}
          onFinish={async (v) => {
            setSaving(true);
            try {
              await updateProfile({
                style_ids: v.styles ?? [],
                ...splitAreaPicks(v.areas),
                budget_per_person: v.budget ?? null,
                usual_pax: v.pax ?? null,
                onboarded: true,
              });
              navigate(next);
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="styles" label="สไตล์ร้าน">
            <Select
              mode="multiple"
              options={MASTER.styles.map((st) => ({ label: st.label, value: st.id }))}
            />
          </Form.Item>
          <div className="grid gap-4 sm:grid-cols-2">
            <Form.Item name="budget" label="งบต่อหัว">
              <InputNumber className="!w-full" min={0} step={100} suffix="บาท" />
            </Form.Item>
            <Form.Item name="pax" label="ไปกันกี่คน">
              <InputNumber className="!w-full" min={1} max={30} suffix="คน" />
            </Form.Item>
          </div>
          <Form.Item
            name="areas"
            label="พื้นที่"
            extra="ย่าน ตำบล/แขวง อำเภอ/เขต หรือจังหวัด เลือกได้ไม่เกิน 20"
          >
            <AreaMultiSelect />
          </Form.Item>
          <div className="flex gap-3">
            <Button block onClick={() => navigate(next)}>
              ข้าม
            </Button>
            <Button block type="primary" htmlType="submit" loading={saving}>
              เริ่มเลย
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}

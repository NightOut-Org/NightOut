import { Camera, Warning } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import { MINI_AD_PLACEMENT_LABELS, MINI_AD_PLACEMENTS } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { ALCOHOL_WARNING_TEXT, alcoholWordsIn, MINI_AD_NO_ALCOHOL_TEXT } from '@nightout/utils';
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  Switch,
  Typography,
  Upload,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { webSrc } from '@/ui/utils/image';
import { dateTime } from '@/ui/utils/format';
import { MiniAdPreview } from '../components/miniAdPreview';
import { fromPeriod, todayBangkok, toPeriod } from '../utils/dates';
import { checkImage, IMAGE_ACCEPT, uploadMiniAdImage } from '../utils/media';
import { createMiniAdAction, updateMiniAdAction } from '../api';

interface Values {
  advertiser_name: string;
  title: string;
  description?: string;
  cta_label: string;
  image_url?: string;
  link_url: string;
  placements: C.MiniAdPlacement[];
  period: [Dayjs, Dayjs];
  active: boolean;
  note?: string | null;
  confirm_no_alcohol: boolean;
}

/** field เนื้อหา — แก้แล้วต้องติ๊กยืนยัน "ไม่ใช่แบรนด์แอลกอฮอล์" ใหม่ (DB ตรวจซ้ำ: MINI_AD_NO_ALCOHOL_CONFIRM_REQUIRED) */
const CREATIVE_FIELDS = [
  'advertiser_name',
  'title',
  'description',
  'cta_label',
  'link_url',
  'image_url',
] as const;
type CreativeField = (typeof CREATIVE_FIELDS)[number];

/** เหมือน linkUrl ใน contracts/mini-ads.ts: https://… หรือ /path (ห้าม // และห้าม \) */
const LINK_RE = /^(https:\/\/[^\s/\\]+[^\s\\]*|\/(?![/\\])[^\s\\]*)$/;
const DAY_MS = 86_400_000;

const PLACEMENT_OPTIONS = MINI_AD_PLACEMENTS.map((p) => ({
  value: p,
  label: MINI_AD_PLACEMENT_LABELS[p],
}));

/** ค่าในฟอร์ม → body เต็ม (ตัดช่องว่าง · note ว่าง = null · description ว่าง = '') */
function toBody(v: Values, image_url: string) {
  return {
    advertiser_name: v.advertiser_name.trim(),
    title: v.title.trim(),
    description: (v.description ?? '').trim(),
    cta_label: v.cta_label.trim(),
    image_url,
    link_url: v.link_url.trim(),
    placements: v.placements,
    ...toPeriod(v.period[0], v.period[1]),
    active: v.active,
    note: v.note?.trim() || null,
  };
}
type FullBody = ReturnType<typeof toBody>;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** เฉพาะ field ที่ต่างจากของเดิม (วันที่เทียบเป็น instant — PostgREST ตอบ +00:00 แต่ toPeriod สร้าง +07:00) */
function diffOf(ad: Db.AdminMiniAd, b: FullBody): Partial<FullBody> {
  const out: Partial<FullBody> = {};
  for (const k of CREATIVE_FIELDS) {
    const before = k === 'description' ? (ad.description ?? '').trim() : ad[k].trim();
    if (b[k] !== before) out[k] = b[k];
  }
  if (!sameSet(ad.placements, b.placements)) out.placements = b.placements;
  if (Date.parse(ad.starts_at) !== Date.parse(b.starts_at)) out.starts_at = b.starts_at;
  if (Date.parse(ad.ends_at) !== Date.parse(b.ends_at)) out.ends_at = b.ends_at;
  if (ad.active !== b.active) out.active = b.active;
  if ((ad.note?.trim() || null) !== b.note) out.note = b.note;
  return out;
}

/**
 * เพิ่ม / แก้โฆษณาแบนเนอร์ 1 ชิ้น — ad = null คือเพิ่มใหม่
 * ภาพที่เลือกอัปโหลดตอนกดบันทึก (ยกเลิก = ไม่มีไฟล์ค้างใน Storage) · แก้เนื้อหาต้องติ๊กยืนยันไม่ใช่แบรนด์แอลกอฮอล์ (ม.32)
 * พิมพ์คำที่อาจเกี่ยวกับแอลกอฮอล์ = เตือนสีเหลือง แต่ยังบันทึกได้ (คอมเมนต์ #87)
 */
export function MiniAdDrawer({
  open,
  ad,
  onClose,
}: {
  open: boolean;
  ad: Db.AdminMiniAd | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={520}
      destroyOnHidden
      title={ad ? 'แก้โฆษณา' : 'เพิ่มโฆษณา'}
    >
      {open && <MiniAdEditor key={ad?.id ?? 'new'} ad={ad} onClose={onClose} />}
    </Drawer>
  );
}

function MiniAdEditor({ ad, onClose }: { ad: Db.AdminMiniAd | null; onClose: () => void }) {
  const { message } = App.useApp();
  const act = useAdminAction();
  const [form] = Form.useForm<Values>();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (filePreview && URL.revokeObjectURL(filePreview)), [filePreview]);

  const [initialValues] = useState<Partial<Values>>(() => {
    if (ad) {
      return {
        advertiser_name: ad.advertiser_name,
        title: ad.title,
        description: ad.description,
        cta_label: ad.cta_label,
        image_url: ad.image_url,
        link_url: ad.link_url,
        placements: ad.placements,
        period: fromPeriod(ad.starts_at, ad.ends_at),
        active: ad.active,
        note: ad.note ?? undefined,
        confirm_no_alcohol: false,
      };
    }
    const today = todayBangkok();
    return {
      cta_label: 'ดูเพิ่มเติม',
      placements: ['HOME', 'SEARCH'],
      active: true,
      period: [today, today.add(29, 'day')],
      confirm_no_alcohol: false,
    };
  });

  const advertiser = Form.useWatch('advertiser_name', form);
  const title = Form.useWatch('title', form);
  const description = Form.useWatch('description', form);
  const cta = Form.useWatch('cta_label', form);
  const imageUrl = Form.useWatch('image_url', form);
  const image = filePreview ?? webSrc(imageUrl);
  /** คำที่อาจเกี่ยวกับแอลกอฮอล์ในข้อความโฆษณา — เตือนเท่านั้น ไม่บล็อก */
  const alcoholWords = alcoholWordsIn(
    [advertiser, title, description, cta].filter(Boolean).join('\n'),
  );

  /** แก้เนื้อหาไปจากของเดิมหรือยัง (ใหม่ = ต้องยืนยันเสมอ) */
  const creativeChanged = (get: (name: CreativeField) => unknown) =>
    !ad ||
    !!file ||
    CREATIVE_FIELDS.some((k) => String(get(k) ?? '').trim() !== String(ad[k] ?? '').trim());

  const save = async () => {
    let v: Values;
    try {
      v = await form.validateFields();
    } catch {
      return; // ช่องที่ผิดแสดงข้อความใต้ช่องแล้ว
    }
    let image_url = v.image_url ?? '';
    if (file) {
      setUploading(true);
      try {
        image_url = await uploadMiniAdImage(file);
      } catch (e) {
        void message.error(`อัปโหลดภาพไม่สำเร็จ: ${(e as Error).message}`);
        return;
      } finally {
        setUploading(false);
      }
      // เก็บ URL ที่อัปโหลดแล้วไว้ — บันทึกไม่ผ่านแล้วกดใหม่จะไม่อัปโหลดซ้ำ
      form.setFieldValue('image_url', image_url);
      setFile(null);
    }
    const body = toBody(v, image_url);
    try {
      if (!ad) {
        await act.mutateAsync({
          ...createMiniAdAction({ ...body, confirm_no_alcohol: true }),
          success: 'เพิ่มโฆษณาแล้ว',
        });
      } else {
        const diff = diffOf(ad, body);
        if (!Object.keys(diff).length) {
          void message.info('ไม่มีอะไรเปลี่ยน');
          onClose();
          return;
        }
        await act.mutateAsync({
          ...updateMiniAdAction(
            ad.id,
            v.confirm_no_alcohol ? { ...diff, confirm_no_alcohol: true } : diff,
          ),
          success: 'บันทึกโฆษณาแล้ว',
        });
      }
      onClose();
    } catch {
      // useAdminAction แจ้งเหตุผลเป็นภาษาไทยแล้ว — เปิดฟอร์มค้างไว้ให้แก้ต่อ
    }
  };

  const busy = uploading || act.isPending;
  const confirmer = ad?.confirmed_by;

  return (
    <>
      <Form<Values> form={form} layout="vertical" initialValues={initialValues} disabled={busy}>
        <div className="mb-6 space-y-2">
          <MiniAdPreview
            advertiser_name={advertiser}
            title={title}
            description={description}
            cta_label={cta}
            image={image}
          />
          <Upload
            accept={IMAGE_ACCEPT}
            showUploadList={false}
            beforeUpload={(f) => {
              const err = checkImage(f);
              if (err) void message.error(err);
              else {
                setFile(f);
                void form
                  .validateFields(['image_url', 'confirm_no_alcohol'])
                  .catch(() => undefined);
              }
              return Upload.LIST_IGNORE;
            }}
          >
            <Button icon={<Camera size={16} />}>{image ? 'เปลี่ยนภาพ' : 'เลือกภาพ'}</Button>
          </Upload>
          <Typography.Text type="secondary" className="block text-xs">
            ภาพแนวนอน 16:9 (แนะนำ 960×540 ขึ้นไป) · ระบบย่อเป็น webp ให้เอง ·
            ห้ามมีชื่อ/โลโก้/ขวด/แก้วเครื่องดื่มแอลกอฮอล์
          </Typography.Text>
          <Form.Item
            name="image_url"
            noStyle
            rules={[
              {
                validator: (_, value?: string) =>
                  file || value ? Promise.resolve() : Promise.reject(new Error('เลือกภาพโฆษณา')),
              },
            ]}
          >
            <Input type="hidden" />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const errs = form.getFieldError('image_url');
              return errs.length ? (
                <Typography.Text type="danger" className="block text-sm">
                  {errs[0]}
                </Typography.Text>
              ) : null;
            }}
          </Form.Item>
        </div>

        <Form.Item
          name="advertiser_name"
          label="ผู้ลงโฆษณา"
          rules={[{ required: true, whitespace: true, message: 'กรอกชื่อผู้ลงโฆษณา' }, { max: 60 }]}
        >
          <Input maxLength={60} placeholder="เช่น ชื่อแบรนด์ / ผู้จัดงาน" />
        </Form.Item>
        <Form.Item
          name="title"
          label="หัวข้อ"
          rules={[{ required: true, whitespace: true, message: 'กรอกหัวข้อ' }, { max: 60 }]}
        >
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item name="description" label="คำอธิบายสั้น" rules={[{ max: 120 }]}>
          <Input.TextArea rows={2} maxLength={120} showCount />
        </Form.Item>
        <Form.Item
          name="cta_label"
          label="ข้อความปุ่ม"
          rules={[{ required: true, whitespace: true, message: 'กรอกข้อความปุ่ม' }, { max: 20 }]}
        >
          <Input maxLength={20} />
        </Form.Item>
        {alcoholWords.length > 0 && (
          <Alert
            className="!mb-6"
            type="warning"
            showIcon
            icon={<Warning size={18} weight="fill" />}
            title="อาจผิด พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.30"
            description={`พบคำ: ${alcoholWords.join(', ')} — ${ALCOHOL_WARNING_TEXT} (ยังบันทึกได้ ตรวจเนื้อหาให้แน่ใจก่อน)`}
          />
        )}
        <Form.Item
          name="link_url"
          label="ลิงก์"
          extra='https://… เปิดแท็บใหม่ · หรือลิงก์ในเว็บ เช่น /search?style=Rooftop · โปรโมทร้านในระบบใช้หน้า "โปรโมท" ไม่ใช่ที่นี่'
          rules={[
            { required: true, whitespace: true, message: 'กรอกลิงก์' },
            {
              pattern: LINK_RE,
              message: 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือเป็นลิงก์ในเว็บที่ขึ้นต้นด้วย /',
            },
            { max: 500 },
          ]}
        >
          <Input maxLength={500} placeholder="https://… หรือ /search?…" inputMode="url" />
        </Form.Item>
        <Form.Item
          name="placements"
          label="ตำแหน่งที่แสดง"
          extra='หน้าแรก: ใต้ "ร้านยอดนิยม" · หน้าค้นหา: หลังร้านลำดับที่ 6 (มุมมองรายการ) — แสดง 1 ชิ้นต่อหน้า สุ่มเมื่อมีหลายชิ้น'
          rules={[{ required: true, type: 'array', min: 1, message: 'เลือกอย่างน้อย 1 ตำแหน่ง' }]}
        >
          <Checkbox.Group options={PLACEMENT_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="period"
          label="ช่วงวันที่แสดง"
          extra="ตามเวลาไทย · แสดงถึงสิ้นวันสุดท้าย · ไม่เกิน 1 ปี"
          rules={[
            { required: true, message: 'เลือกช่วงวันที่' },
            {
              validator: (_, value?: [Dayjs, Dayjs] | null) =>
                value && value[1].startOf('day').diff(value[0].startOf('day')) > 365 * DAY_MS
                  ? Promise.reject(new Error('ช่วงแสดงไม่เกิน 1 ปี'))
                  : Promise.resolve(),
            },
          ]}
        >
          <DatePicker.RangePicker format="D MMM YYYY" className="w-full" allowClear={false} />
        </Form.Item>
        <Form.Item name="active" label="เปิดใช้งาน" valuePropName="checked">
          <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
        </Form.Item>
        <Form.Item
          name="note"
          label="บันทึกภายใน"
          extra="แอดมินเห็นเท่านั้น เช่น ผู้ติดต่อ/เลขที่สัญญา"
          rules={[{ max: 300 }]}
        >
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>

        <Divider />
        <Alert
          className="!mb-3"
          type="warning"
          showIcon
          title="ห้ามแบรนด์เครื่องดื่มแอลกอฮอล์ (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.32)"
        />
        <Form.Item
          name="confirm_no_alcohol"
          valuePropName="checked"
          dependencies={[...CREATIVE_FIELDS]}
          className="!mb-2"
          rules={[
            ({ getFieldValue }) => ({
              validator: (_, checked?: boolean) =>
                checked || !creativeChanged((k) => getFieldValue(k))
                  ? Promise.resolve()
                  : Promise.reject(new Error('ติ๊กยืนยันก่อนบันทึก')),
            }),
          ]}
        >
          <Checkbox>{MINI_AD_NO_ALCOHOL_TEXT}</Checkbox>
        </Form.Item>
        {ad && (
          <Typography.Text type="secondary" className="block text-xs">
            ยืนยันล่าสุด {dateTime(ad.no_alcohol_confirmed_at)} โดย{' '}
            {confirmer?.display_name ?? confirmer?.email ?? 'ไม่ทราบ'} — แก้เนื้อหาต้องยืนยันใหม่
          </Typography.Text>
        )}
      </Form>
      <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex justify-end gap-2 border-t border-black/5 bg-(--ant-color-bg-elevated) px-6 py-3 dark:border-white/10">
        <Button onClick={onClose} disabled={busy}>
          ยกเลิก
        </Button>
        <Button type="primary" loading={busy} onClick={() => void save()}>
          บันทึก
        </Button>
      </div>
    </>
  );
}

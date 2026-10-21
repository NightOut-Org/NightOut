import { EyeSlash, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import {
  App,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Upload,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { type MenuItem } from '@/services/data';
import { HEADER_ADD_CLASS, HEADER_SAVE_CLASS } from '@/ui/utils/buttonClasses';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Chip } from '@/ui/components/merchantUi';
import { baht } from '@/ui/utils/format';
import { PHOTO_ACCEPT, checkPhoto } from '@/ui/utils/media';
import { setMenu } from './api';
import { MenuPhoto } from './components/menuPhoto';
import { useMenuDraft } from './utils/useMenuDraft';
import { DraftChip, StatusChip } from '@/ui/components/statusChip';

const CATS: MenuItem['category'][] = ['เครื่องดื่ม', 'มิกเซอร์', 'อาหาร', 'ของทานเล่น'];
type ItemForm = Pick<MenuItem, 'category' | 'name' | 'price' | 'available'>;

/**
 * /merchant/menu — หมวด (ซ้าย) + ตารางรายการ (ขวา) · มือถือเป็นชิปหมวด + การ์ด + ปุ่มลอยเพิ่มรายการ
 * เพิ่ม/แก้/ลบรายการ · เปิด-ปิดการแสดง · รูป แก้ในหน้าก่อน แล้วกดบันทึกครั้งเดียว (อัปโหลดรูป → PUT /merchant/bars/:barId/menu)
 */
export function MerchantMenuPage() {
  const bar = useMerchantBar();
  const { message } = App.useApp();
  const [form] = Form.useForm<ItemForm>();
  const draft = useMenuDraft(bar.id, bar.menu);
  const [progress, setProgress] = useState<string | null>(null);
  const saving = progress !== null;
  const { confirmDiscard } = useUnsavedGuard(draft.count > 0);
  const [cat, setCat] = useState<MenuItem['category'] | null>(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  // หน้าต่างเพิ่ม/แก้ไข: null = ปิด · 'new' = เพิ่ม · item = แก้ไข
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  // รูปที่เลือกในหน้าต่าง · removePhoto = เอารูปเดิมออก (เข้า draft ตอนกดตกลง)
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const photoUrl = useObjectUrl(photo);

  const save = async () => {
    setProgress('กำลังบันทึก…');
    try {
      let menu;
      try {
        menu = await draft.upload((done, n) =>
          setProgress(done < n ? `กำลังอัปโหลด ${done + 1}/${n}` : 'กำลังบันทึก…'),
        );
      } catch (e) {
        // รูปที่อัปโหลดสำเร็จแล้วอยู่ใน draft — กดบันทึกใหม่ไม่อัปโหลดซ้ำ
        void message.error(`อัปโหลดรูปไม่สำเร็จ — ${(e as Error).message}`);
        return;
      }
      await setMenu(bar.id, menu);
      draft.reset();
      void message.success('บันทึกเมนูแล้ว');
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const saveButton = (cls: string, label: string) => (
    <button
      type="button"
      disabled={saving || !draft.count}
      onClick={() => void save()}
      className={`merchant-pill disabled:opacity-60 ${cls}`}
    >
      {saving ? progress : label}
    </button>
  );

  const openEditor = (item: MenuItem | 'new') => {
    setPhoto(null);
    setRemovePhoto(false);
    form.setFieldsValue(
      item === 'new'
        ? { category: cat ?? 'อาหาร', name: '', price: undefined, available: true }
        : {
            category: item.category,
            name: item.name,
            price: item.price,
            available: item.available,
          },
    );
    setEditing(item);
  };
  const close = () => {
    setEditing(null);
    setPhoto(null);
    form.resetFields();
  };
  /** ตกลงในหน้าต่าง = แก้ draft (บันทึกจริงด้วยปุ่มบันทึกของหน้า) */
  const submit = async () => {
    const v = await form.validateFields();
    const nextPhoto = photo ?? (removePhoto ? null : undefined);
    if (editing === 'new') draft.add(v, nextPhoto);
    else if (editing) draft.update(editing.id, v, nextPhoto);
    close();
  };

  const keyword = q.trim().toLowerCase();
  const menu = draft.items;
  const rows = menu.filter(
    (m) => (!cat || m.category === cat) && (!keyword || m.name.toLowerCase().includes(keyword)),
  );
  const count = (c: MenuItem['category']) => menu.filter((m) => m.category === c).length;
  const { serviceChargeRate, vatRate } = bar.fees;
  const pct = (r: number) => `${r}%`;
  const current = editing && editing !== 'new' ? editing : null;
  const shownPhoto = photoUrl ?? (current && !removePhoto ? current.imageUrl : undefined);

  const photoCell = (m: MenuItem, size: number) => (
    <MenuPhoto
      name={m.name}
      url={m.imageUrl}
      size={size}
      disabled={saving}
      onPick={(f) => draft.setPhoto(m.id, f)}
    />
  );
  const stateTag = (m: MenuItem) => {
    const st = draft.stateOf(m);
    return st ? (
      <DraftChip state={st === 'new' ? 'new' : 'changed'} className="ml-1.5 align-middle" />
    ) : null;
  };
  const empty = (
    <Empty
      className="!my-10"
      description={menu.length ? 'ไม่มีรายการในหมวดนี้' : 'ยังไม่มีเมนู — เพิ่มรายการแรกได้เลย'}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* หัวหน้า */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold lg:font-display lg:text-[30px]">เมนู</h1>
          <p className="mt-1 hidden text-sm text-muted lg:block">
            {menu.length} รายการ ใช้คำนวณยอดประเมินให้ลูกค้า (+ SC {pct(serviceChargeRate)} + VAT{' '}
            {pct(vatRate)})
          </p>
        </div>
        <div className="flex items-center gap-1 lg:gap-3">
          {draft.count > 0 && !saving && (
            <>
              <span className="hidden text-sm text-gold-text lg:inline" role="status">
                ยังไม่บันทึก {draft.count} รายการ
              </span>
              <button
                type="button"
                onClick={() => confirmDiscard(draft.reset)}
                className="merchant-pill px-2 py-1 text-sm text-muted lg:h-10 lg:rounded-xl lg:border lg:border-border lg:px-[18px]"
              >
                คืนค่า
              </button>
            </>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => openEditor('new')}
            className={HEADER_ADD_CLASS}
          >
            <Plus /> เพิ่มรายการ
          </button>
          {saveButton(
            HEADER_SAVE_CLASS,
            'บันทึกการเปลี่ยนแปลง',
          )}
          <button
            type="button"
            aria-label="ค้นหาเมนู"
            aria-pressed={searching}
            onClick={() => setSearching((s) => !s)}
            className="grid size-10 place-items-center text-xl lg:hidden"
          >
            <MagnifyingGlass />
          </button>
          {saveButton('px-2 py-1 text-sm font-semibold text-gold-text lg:hidden', 'บันทึก')}
        </div>
      </div>

      {/* ---------- Desktop ---------- */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          aria-label="หมวดเมนู"
          className="flex flex-col gap-0.5 self-start rounded-[20px] border border-border bg-card p-2.5"
        >
          <label className="mb-2 flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-muted focus-within:border-gold">
            <MagnifyingGlass />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาเมนู"
              aria-label="ค้นหาเมนู"
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
            />
          </label>
          {[null, ...CATS].map((c) => {
            const on = cat === c;
            return (
              <button
                key={c ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setCat(c)}
                className={`flex h-[42px] items-center gap-2.5 rounded-xl px-3 text-left text-sm ${
                  on ? 'bg-gold/15 text-gold-text' : 'text-text hover:bg-surface'
                }`}
              >
                <span className="flex-1">{c ?? 'ทั้งหมด'}</span>
                <span className="text-xs text-muted">{c ? count(c) : menu.length}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 overflow-hidden rounded-[20px] border border-border bg-card">
          {rows.length === 0 ? (
            empty
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="h-10 border-b border-border text-left text-xs text-muted">
                  <th className="w-[72px] pl-[18px] font-normal">รูป</th>
                  <th className="font-normal">รายการ</th>
                  <th className="font-normal">หมวด</th>
                  <th className="w-[110px] text-right font-normal">ราคา</th>
                  <th className="w-[90px] text-center font-normal">แสดง</th>
                  <th className="w-20 pr-[18px]">
                    <span className="sr-only">จัดการ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="h-[66px] border-b border-border/60 last:border-b-0">
                    <td className="pl-[18px]">{photoCell(m, 48)}</td>
                    <td className="font-medium">
                      {m.name}
                      {stateTag(m)}
                    </td>
                    <td className="text-muted">{m.category}</td>
                    <td className="text-right font-semibold text-gold-text">{baht(m.price)}</td>
                    <td className="text-center">
                      <Switch
                        checked={m.available}
                        disabled={saving}
                        aria-label={`แสดง ${m.name}`}
                        onChange={(available) => draft.update(m.id, { available })}
                      />
                    </td>
                    <td className="pr-[18px]">
                      <span className="flex justify-end gap-1 text-base text-muted">
                        <button
                          type="button"
                          aria-label={`แก้ไข ${m.name}`}
                          disabled={saving}
                          onClick={() => openEditor(m)}
                          className="grid size-8 place-items-center rounded-lg hover:text-text disabled:opacity-50"
                        >
                          <PencilSimple />
                        </button>
                        <Popconfirm
                          title="ลบรายการนี้?"
                          okText="ลบ"
                          cancelText="ยกเลิก"
                          okButtonProps={{ danger: true }}
                          disabled={saving}
                          onConfirm={() => draft.remove(m.id)}
                        >
                          <button
                            type="button"
                            aria-label={`ลบ ${m.name}`}
                            disabled={saving}
                            className="grid size-8 place-items-center rounded-lg hover:text-(--crowd-full) disabled:opacity-50"
                          >
                            <Trash />
                          </button>
                        </Popconfirm>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ---------- มือถือ ---------- */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {searching && (
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเมนู"
            aria-label="ค้นหาเมนู"
            className="h-12 rounded-xl border border-border bg-card px-3.5 text-base text-text outline-none focus:border-gold"
          />
        )}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip active={cat === null} onClick={() => setCat(null)}>
            ทั้งหมด
          </Chip>
          {CATS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>
          ))}
        </div>
        {rows.length === 0 ? (
          empty
        ) : (
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {rows.map((m) => (
              <li key={m.id}>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5">
                  {photoCell(m, 56)}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => openEditor(m)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col text-sm">
                      <b
                        className={`truncate font-medium ${m.available ? '' : 'text-muted line-through'}`}
                      >
                        {m.name}
                      </b>
                      <span className="text-xs text-muted">
                        {m.category}
                        {!m.available && (
                          <StatusChip tone="muted" icon={<EyeSlash weight="fill" />} className="ml-1.5 align-middle">
                            ซ่อนอยู่
                          </StatusChip>
                        )}
                        {stateTag(m)}
                      </span>
                    </span>
                    <b className="text-gold-text">{baht(m.price)}</b>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          aria-label="เพิ่มรายการ"
          disabled={saving}
          onClick={() => openEditor('new')}
          className="merchant-pill fixed bottom-[calc(96px+env(safe-area-inset-bottom,0px))] right-5 z-30 grid size-14 place-items-center rounded-full bg-gold text-[26px] text-on-gold shadow-[0_10px_24px_-6px_rgba(232,182,76,.6)]"
        >
          <Plus />
        </button>
      </div>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'เพิ่มรายการเมนู' : 'แก้ไขรายการ'}
        okText={editing === 'new' ? 'เพิ่ม' : 'ตกลง'}
        cancelText="ยกเลิก"
        onCancel={close}
        onOk={() => void submit()}
        footer={(origin) => (
          <div className="flex items-center justify-between gap-2">
            {current ? (
              <Popconfirm
                title="ลบรายการนี้?"
                okText="ลบ"
                cancelText="ยกเลิก"
                okButtonProps={{ danger: true }}
                onConfirm={() => {
                  draft.remove(current.id);
                  close();
                }}
              >
                <button type="button" className="text-sm text-(--crowd-full)">
                  ลบรายการ
                </button>
              </Popconfirm>
            ) : (
              <span />
            )}
            <span className="flex gap-2">{origin}</span>
          </div>
        )}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="category" label="หมวด">
            <Select options={CATS.map((c) => ({ label: c, value: c }))} />
          </Form.Item>
          <Form.Item
            name="name"
            label="ชื่อรายการ"
            rules={[{ required: true, message: 'กรอกชื่อรายการ' }]}
          >
            <Input />
          </Form.Item>
          <div className="grid grid-cols-[1fr_auto] items-end gap-4">
            <Form.Item
              name="price"
              label="ราคา (บาท)"
              rules={[{ required: true, message: 'กรอกราคา' }]}
            >
              <InputNumber className="!w-full" min={0} inputMode="decimal" />
            </Form.Item>
            <Form.Item name="available" label="แสดงให้ลูกค้าเห็น" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
          <Form.Item
            label="รูป (ไม่บังคับ)"
            extra="JPG, PNG หรือ WebP ไม่เกิน 15MB และลูกค้าเห็นในแท็บเมนูของหน้าร้าน"
            className="!mb-0"
          >
            <div className="flex items-center gap-3">
              {shownPhoto && (
                <img src={shownPhoto} alt="" className="size-16 rounded-xl object-cover" />
              )}
              <Upload
                accept={PHOTO_ACCEPT}
                showUploadList={false}
                beforeUpload={(file) => {
                  const err = checkPhoto(file);
                  if (err) message.error(err);
                  else setPhoto(file);
                  return Upload.LIST_IGNORE;
                }}
              >
                <button
                  type="button"
                  className="merchant-pill h-9 rounded-xl border border-border px-3.5 text-sm"
                >
                  {shownPhoto ? 'เปลี่ยนรูป' : 'เลือกรูป'}
                </button>
              </Upload>
              {shownPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setRemovePhoto(true);
                  }}
                  className="text-sm text-(--crowd-full)"
                >
                  เอารูปออก
                </button>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

/** URL ชั่วคราวของไฟล์ที่เลือก (พรีวิวก่อนอัปโหลด) — คืนหน่วยความจำเมื่อเปลี่ยนไฟล์/ปิด */
function useObjectUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

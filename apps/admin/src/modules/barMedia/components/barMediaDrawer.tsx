import {
  ArrowSquareOut,
  ImageSquare,
  Plus,
  Star,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import { BAR_GALLERY_MAX } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import {
  App,
  Button,
  Drawer,
  Empty,
  Image,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useState, type ReactNode } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { SaveBar } from '@/ui/components/SaveBar';
import { StatusTag } from '@/ui/components/StatusTag';
import { webSrc } from '@/ui/utils/image';
import { BAR_STATUS } from '@/ui/utils/labels';
import { barMediaAction, discardBarMedia } from '../api';
import { IMAGE_ACCEPT, checkImage } from '../utils/media';
import { useBarMediaDraft } from '../utils/useBarMediaDraft';

type Draft = ReturnType<typeof useBarMediaDraft>;

/**
 * จัดการรูปของร้านเดียว — ปก + แกลเลอรี (สูงสุด 10) และรูปเมนูรายรายการ
 * แก้ในหน้าก่อน (พรีวิวจากเครื่อง) แล้วกดบันทึกครั้งเดียว: อัปโหลดไฟล์ใหม่ → PUT /admin/bars/:id/media (audit log + แจ้งทีมร้าน 1 ครั้ง)
 * บันทึกพลาดหลังอัปโหลด = ลบไฟล์ที่เพิ่งอัปโหลด (POST /admin/bars/:id/media/discard)
 * ไฟล์ที่เอาออก backend ลบจาก Storage ให้ · ปิด Drawer ตอนยังไม่บันทึก = ถามก่อน
 */
export function BarMediaDrawer({
  bar,
  onClose,
  onSaved,
}: {
  bar: Db.AdminBarMedia | null;
  onClose: () => void;
  /** โหลดรายการใหม่หลังบันทึก (รอให้เสร็จก่อนล้าง draft จะได้ไม่เห็นรูปเดิมแวบ) */
  onSaved: () => Promise<unknown>;
}) {
  const { message } = App.useApp();
  const act = useAdminAction();
  const draft = useBarMediaDraft(bar);
  const [progress, setProgress] = useState<string | null>(null);
  const saving = progress !== null || act.isPending;
  const { confirmDiscard } = useUnsavedGuard(draft.count > 0);

  const save = async () => {
    if (!bar) return;
    setProgress('กำลังบันทึก…');
    const uploaded: string[] = [];
    // อัปโหลดแล้วแต่บันทึกไม่สำเร็จ → ลบไฟล์ที่เพิ่งอัปโหลด (draft ยังเก็บไฟล์ในเครื่อง กดบันทึกใหม่ได้)
    const discard = () =>
      uploaded.length && discardBarMedia(bar.id, uploaded).catch(() => undefined);
    try {
      let body;
      try {
        body = await draft.upload(
          (done, total) =>
            setProgress(done < total ? `กำลังอัปโหลด ${done + 1}/${total}` : 'กำลังบันทึก…'),
          uploaded,
        );
      } catch (e) {
        void message.error(`อัปโหลดรูปไม่สำเร็จ — ${(e as Error).message}`);
        await discard();
        return;
      }
      try {
        await act.mutateAsync({
          ...barMediaAction(bar.id, body),
          success: `บันทึกรูปของ ${bar.name} แล้ว`,
        });
      } catch {
        // useAdminAction แจ้งเหตุผลแล้ว
        await discard();
        return;
      }
      await onSaved();
      draft.reset();
    } finally {
      setProgress(null);
    }
  };

  const close = () =>
    confirmDiscard(() => {
      draft.reset();
      onClose();
    });

  return (
    <Drawer
      open={!!bar}
      onClose={() => !saving && close()}
      size={720}
      destroyOnHidden
      maskClosable={!saving}
      keyboard={!saving}
      title={
        bar && (
          <span className="flex flex-wrap items-center gap-2">
            {bar.name}
            <StatusTag map={BAR_STATUS} value={bar.status} />
          </span>
        )
      }
      extra={
        bar && (
          <Space wrap>
            <Button
              href={webSrc(`/bars/${bar.slug}`)}
              target="_blank"
              rel="noreferrer"
              icon={<ArrowSquareOut size={16} />}
            >
              ดูหน้าร้าน
            </Button>
            <SaveBar
              count={draft.count}
              saving={saving}
              progress={progress}
              onSave={() => void save()}
              onReset={() => confirmDiscard(draft.reset)}
            />
          </Space>
        )
      }
    >
      {bar && (
        <Spin spinning={saving} description={progress ?? undefined}>
          <div className="space-y-8">
            <Gallery bar={bar} draft={draft} disabled={saving} />
            <MenuPhotos bar={bar} draft={draft} disabled={saving} />
          </div>
        </Spin>
      )}
    </Drawer>
  );
}

function Gallery({
  bar,
  draft,
  disabled,
}: {
  bar: Db.AdminBarMedia;
  draft: Draft;
  disabled: boolean;
}) {
  const { message } = App.useApp();
  const { items, coverKey, room } = draft;

  const add = (files: File[]) => {
    files.map(checkImage).forEach((m) => m && void message.error(m));
    let ok = files.filter((f) => !checkImage(f));
    if (ok.length > room) {
      void message.warning(`เพิ่มได้อีก ${room} รูป — ใช้ ${room} รูปแรกที่เลือก`);
      ok = ok.slice(0, room);
    }
    if (ok.length) draft.addPhotos(ok);
  };

  const uploader = (children: ReactNode) => (
    <Upload
      accept={IMAGE_ACCEPT}
      multiple
      showUploadList={false}
      disabled={disabled}
      className="block size-full [&_.ant-upload]:block [&_.ant-upload]:size-full"
      beforeUpload={(file, list) => {
        // antd เรียกทีละไฟล์ — รวบทั้งชุดตอนไฟล์สุดท้าย
        if (file === list[list.length - 1]) add(list);
        return Upload.LIST_IGNORE;
      }}
    >
      {children}
    </Upload>
  );

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Typography.Title level={5} className="!m-0">
          ปก + แกลเลอรี
        </Typography.Title>
        <span className="text-xs tabular-nums opacity-70">
          {items.length}/{BAR_GALLERY_MAX} รูป
        </span>
      </div>
      <Image.PreviewGroup>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((g, i) => {
            const isCover = g.key === coverKey;
            return (
              <li
                key={g.key}
                className={`relative overflow-hidden rounded-lg border ${isCover ? 'col-span-2 border-(--gold) sm:row-span-2' : 'border-black/10 dark:border-white/10'}`}
              >
                <Image
                  src={g.url}
                  alt={isCover ? `รูปปก ${bar.name}` : `รูปร้าน ${bar.name} ที่ ${i + 1}`}
                  rootClassName="!block size-full"
                  className={`!block w-full object-cover ${isCover ? 'aspect-[16/10] sm:!h-full sm:aspect-auto' : 'aspect-[4/3]'}`}
                />
                <span className="pointer-events-none absolute left-2 top-2 flex gap-1">
                  {isCover && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs text-(--gold)">
                      <Star weight="fill" size={12} aria-hidden /> รูปปก
                    </span>
                  )}
                  {draft.isNew(g) && (
                    <Tag color="warning" className="!m-0">
                      ใหม่ · ยังไม่บันทึก
                    </Tag>
                  )}
                </span>
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-linear-to-t from-black/70 to-transparent p-2 pt-6">
                  {!isCover && (
                    <Button
                      icon={<Star size={14} />}
                      disabled={disabled}
                      onClick={() => draft.setCover(g.key)}
                    >
                      ตั้งเป็นปก
                    </Button>
                  )}
                  <Popconfirm
                    title="ลบรูปนี้ออกจากร้าน?"
                    description={
                      isCover && items.length > 1
                        ? 'รูปถัดไปจะเป็นรูปปกแทน · ทีมร้านได้รับแจ้งเตือน'
                        : 'ทีมร้านได้รับแจ้งเตือน'
                    }
                    okText="ลบ"
                    cancelText="ยกเลิก"
                    okButtonProps={{ danger: true }}
                    disabled={disabled}
                    onConfirm={() => draft.removePhoto(g.key)}
                  >
                    <Button
                      danger
                      icon={<Trash size={14} />}
                      disabled={disabled}
                      aria-label="ลบรูป"
                    />
                  </Popconfirm>
                </div>
              </li>
            );
          })}
          {room > 0 && (
            <li
              className={
                items.length
                  ? 'aspect-[4/3]'
                  : 'col-span-2 aspect-[16/10] sm:col-span-3 sm:aspect-[3/1]'
              }
            >
              {uploader(
                <span className="flex size-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-black/20 text-sm opacity-80 transition-opacity hover:opacity-100 dark:border-white/20">
                  <Plus size={22} aria-hidden />
                  {items.length ? 'เพิ่มรูป' : 'ร้านยังไม่มีรูป — อัปโหลดแทนร้าน (รูปแรกเป็นปก)'}
                  <span className="text-xs opacity-70">เหลือ {room} รูป</span>
                </span>,
              )}
            </li>
          )}
        </ul>
      </Image.PreviewGroup>
      <Typography.Text type="secondary" className="mt-2 block text-xs">
        ปกใช้บนการ์ดร้าน แผนที่ และหัวหน้าร้าน · JPG/PNG/WebP ไม่เกิน 15MB (ย่อเป็น 1920px ให้เอง) ·
        อัปโหลดและแจ้งทีมร้านตอนกดบันทึก
      </Typography.Text>
    </section>
  );
}

function MenuPhotos({
  bar,
  draft,
  disabled,
}: {
  bar: Db.AdminBarMedia;
  draft: Draft;
  disabled: boolean;
}) {
  const { message } = App.useApp();
  const withImage = bar.menu.filter((m) => draft.menuOf(m).url).length;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Typography.Title level={5} className="!m-0">
          รูปเมนู
        </Typography.Title>
        <span className="text-xs tabular-nums opacity-70">
          มีรูป {withImage}/{bar.menu.length} รายการ
        </span>
      </div>
      {bar.menu.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="ร้านยังไม่มีเมนู — ร้านเพิ่มรายการได้ที่หน้าเมนูของร้าน"
        />
      ) : (
        <Image.PreviewGroup>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {bar.menu.map((m) => {
              const { url, changed } = draft.menuOf(m);
              return (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  {url ? (
                    <Image
                      src={url}
                      alt={m.name}
                      width={48}
                      height={48}
                      className="rounded-md object-cover"
                    />
                  ) : (
                    <span
                      className="grid size-12 place-items-center rounded-md border border-dashed border-black/20 opacity-60 dark:border-white/20"
                      aria-hidden
                    >
                      <ImageSquare size={20} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{m.name}</span>
                      {changed && (
                        <Tag color="warning" className="!m-0 shrink-0">
                          {url ? 'รูปใหม่ · ยังไม่บันทึก' : 'จะลบรูป · ยังไม่บันทึก'}
                        </Tag>
                      )}
                    </div>
                    <div className="text-xs opacity-60">{m.category ?? '-'}</div>
                  </div>
                  <Upload
                    accept={IMAGE_ACCEPT}
                    showUploadList={false}
                    disabled={disabled}
                    beforeUpload={(f) => {
                      const err = checkImage(f);
                      if (err) void message.error(err);
                      else draft.setMenuPhoto(m, f);
                      return Upload.LIST_IGNORE;
                    }}
                  >
                    <Button icon={<UploadSimple size={14} />} disabled={disabled}>
                      {url ? 'เปลี่ยน' : 'เพิ่มรูป'}
                    </Button>
                  </Upload>
                  {url && (
                    <Popconfirm
                      title={`ลบรูป ${m.name}?`}
                      description="ทีมร้านได้รับแจ้งเตือน"
                      okText="ลบ"
                      cancelText="ยกเลิก"
                      okButtonProps={{ danger: true }}
                      disabled={disabled}
                      onConfirm={() => draft.removeMenuPhoto(m)}
                    >
                      <Button
                        danger
                        icon={<Trash size={14} />}
                        disabled={disabled}
                        aria-label={`ลบรูป ${m.name}`}
                      />
                    </Popconfirm>
                  )}
                </li>
              );
            })}
          </ul>
        </Image.PreviewGroup>
      )}
    </section>
  );
}

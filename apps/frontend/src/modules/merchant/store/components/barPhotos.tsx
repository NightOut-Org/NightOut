import { BAR_GALLERY_MAX } from '@nightout/contracts';
import { ImageSquare, Plus } from '@phosphor-icons/react';
import { App, Popconfirm, Upload } from 'antd';
import { useState, type ReactNode } from 'react';
import type { Bar } from '@/services/data';
import { PHOTO_ACCEPT, checkPhoto } from '@/ui/utils/media';
import type { useGalleryDraft } from '../utils/useGalleryDraft';

/**
 * รูปร้าน — ภาพใหญ่ + แถบฟิล์ม 10 ช่อง: แตะรูปในแถบเพื่อดูเป็นภาพใหญ่ แล้วกด "ตั้งเป็นปก" / "ลบ" บนภาพ
 * ช่องว่างในแถบเป็นลายแรเงา แตะเพื่อเพิ่มรูป · แก้ใน draft ของหน้า (useGalleryDraft) — อัปโหลด + บันทึกตอนกดบันทึกของหน้า
 */
export function BarPhotos({
  bar,
  gallery,
  disabled,
}: {
  bar: Bar;
  gallery: ReturnType<typeof useGalleryDraft>;
  /** ระหว่างบันทึก */
  disabled: boolean;
}) {
  const { message } = App.useApp();
  const [picked, setPicked] = useState<string | null>(null);
  const ordered = gallery.items;
  const room = gallery.room;
  const busy = disabled;
  // เริ่มที่ปก · รูปที่เลือกหายไป (ถูกเอาออก) → กลับไปที่ปก
  const found = picked ? ordered.findIndex((g) => g.key === picked) : -1;
  const selIndex = found < 0 ? 0 : found;
  const sel = ordered[selIndex];
  const selIsCover = selIndex === 0;

  const add = (files: File[]) => {
    const bad = files.map(checkPhoto).filter((m): m is string => !!m);
    bad.forEach((m) => void message.error(m));
    let ok = files.filter((f) => !checkPhoto(f));
    if (ok.length > room) {
      void message.warning(`เพิ่มได้อีก ${room} รูป — ใช้ ${room} รูปแรกที่เลือก`);
      ok = ok.slice(0, room);
    }
    if (ok.length) gallery.add(ok);
  };

  const uploader = (children: ReactNode, className = '', label?: string) => (
    <Upload
      accept={PHOTO_ACCEPT}
      multiple
      showUploadList={false}
      disabled={busy || room <= 0}
      className={className}
      aria-label={label}
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
    <div className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-border bg-card p-5">
      <span className="flex justify-between gap-3 text-sm">
        <b className="font-semibold">รูปร้าน</b>
        <span className="text-muted tabular-nums">
          {ordered.length} / {BAR_GALLERY_MAX} · รูปแรกเป็นปก
        </span>
      </span>

      <div className="flex flex-col gap-3">
          {sel ? (
            <div
              className={`relative aspect-[16/10] overflow-hidden rounded-2xl ${
                selIsCover ? 'border-2 border-gold' : 'border border-border'
              }`}
            >
              <img
                src={sel.url}
                alt={selIsCover ? `รูปปก ${bar.name}` : `รูปร้านที่ ${selIndex + 1}`}
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.7),transparent_50%)]" />
              <div className="absolute left-3 top-3 flex gap-1.5">
                {selIsCover && (
                  <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-on-gold">ปก</span>
                )}
                {gallery.isNew(sel) && (
                  <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-gold-text">ใหม่ · ยังไม่บันทึก</span>
                )}
                <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-xs text-white tabular-nums">
                  {selIndex + 1} / {ordered.length}
                </span>
              </div>
              <div className="absolute inset-x-3 bottom-3 flex justify-end gap-2">
                {!selIsCover && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => gallery.setCover(sel.key)}
                    className="merchant-pill inline-flex h-10 items-center rounded-xl bg-gold px-3.5 text-sm font-semibold text-on-gold disabled:opacity-40 sm:h-9"
                  >
                    ตั้งเป็นปก
                  </button>
                )}
                <Popconfirm
                  title="ลบรูปนี้?"
                  description={selIsCover && ordered.length > 1 ? 'รูปถัดไปจะเป็นรูปปกแทน' : undefined}
                  okText="ลบ"
                  cancelText="ยกเลิก"
                  okButtonProps={{ danger: true }}
                  disabled={busy}
                  onConfirm={() => {
                    gallery.remove(sel.key);
                    setPicked(null);
                  }}
                >
                  <button
                    type="button"
                    disabled={busy}
                    className="merchant-pill inline-flex h-10 items-center rounded-xl border border-border bg-surface/85 px-3.5 text-sm text-(--crowd-full) disabled:opacity-40 sm:h-9"
                  >
                    ลบ
                  </button>
                </Popconfirm>
              </div>
            </div>
          ) : (
            uploader(
              <span className="merchant-hatch flex aspect-[16/10] w-full cursor-pointer flex-col justify-end gap-1 rounded-2xl border-2 border-dashed border-gold/60 p-4 text-muted transition-colors hover:border-gold hover:text-text">
                <span className="self-start rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold-text">ปก</span>
                <span className="mt-auto flex items-center gap-2 text-sm text-text">
                  <ImageSquare size={22} className="text-gold-text" aria-hidden /> ยังไม่มีรูปร้าน
                </span>
                <span className="text-xs">แตะเพื่อเพิ่ม · รูปแรกจะเป็นปก (ตอนนี้ลูกค้าเห็นรูปแทนของ NightOut)</span>
              </span>,
              'block w-full [&_.ant-upload]:block [&_.ant-upload]:w-full',
              'เพิ่มรูปร้าน',
            )
          )}

          {/* แถบฟิล์ม 10 ช่องเสมอ · มือถือ 5×2 ให้ช่องใหญ่พอแตะ */}
          <ul className="m-0 grid list-none grid-cols-5 gap-1.5 p-0 sm:grid-cols-10">
            {Array.from({ length: BAR_GALLERY_MAX }, (_, i) => {
              const p = ordered[i];
              if (!p)
                return (
                  <li key={`empty-${i}`} className="aspect-square min-w-0">
                    {uploader(
                      <span
                        className={`merchant-hatch flex size-full cursor-pointer items-center justify-center rounded-[10px] border border-border transition-colors hover:border-gold ${
                          i === ordered.length ? '' : 'opacity-80'
                        }`}
                      >
                        {i === ordered.length && <Plus size={18} className="text-gold-text" aria-hidden />}
                      </span>,
                      'block size-full [&_.ant-upload]:block [&_.ant-upload]:size-full',
                      `เพิ่มรูปช่องที่ ${i + 1}`,
                    )}
                  </li>
                );
              const on = i === selIndex;
              return (
                <li key={p.key} className="aspect-square min-w-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={i === 0 ? `รูปปก ${bar.name}` : `รูปร้านที่ ${i + 1}`}
                    disabled={busy}
                    onClick={() => setPicked(p.key)}
                    className={`merchant-pill relative block size-full overflow-hidden rounded-[10px] bg-surface transition-opacity ${
                      i === 0 ? 'border-2 border-gold' : 'border border-border'
                    } ${on ? 'ring-2 ring-gold ring-offset-2 ring-offset-card' : 'opacity-55 hover:opacity-90'}`}
                  >
                    <img src={p.url} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                  </button>
                </li>
              );
            })}
          </ul>
      </div>

      <p className="text-xs text-muted">JPG, PNG หรือ WebP ไม่เกิน 15MB ต่อรูป · ใช้รูปบรรยากาศจริง ห้ามมีข้อความชวนดื่ม · อัปโหลดตอนกดบันทึก</p>
    </div>
  );
}

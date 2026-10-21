import { Camera, Play, VideoCamera, X } from '@phosphor-icons/react';
import type { ReviewMedia } from '@/services/data';
import { App, Upload } from 'antd';
import { useState } from 'react';
import { putBlob } from '@/services/mediaStore';
import { compressImage, fmtDuration, probeVideo } from '@/ui/utils/media';

export const MEDIA_LIMITS = {
  maxFiles: 6,
  imageMB: 15,
  videoMB: 60,
  videoSeconds: 60,
} as const;

const uid = () => `md-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * เลือกรูป/วิดีโอแนบรีวิว (สูงสุด 6 ไฟล์ · วิดีโอ ≤ 60 วินาที / 60MB · รูปย่ออัตโนมัติ)
 * มือถือ: accept image/*,video/* เปิดกล้องหรือคลังรูปได้เลย · แตะ X เพื่อลบ
 */
export function ReviewMediaPicker({
  value,
  onChange,
}: {
  value: ReviewMedia[];
  onChange: (next: ReviewMedia[]) => void;
}) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(0);
  const full = value.length + busy >= MEDIA_LIMITS.maxFiles;

  const add = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) return message.error('รองรับเฉพาะรูปและวิดีโอ');
    const mb = file.size / 1024 / 1024;
    if (isImage && mb > MEDIA_LIMITS.imageMB)
      return message.error(`รูปใหญ่เกิน ${MEDIA_LIMITS.imageMB}MB`);
    if (isVideo && mb > MEDIA_LIMITS.videoMB)
      return message.error(`วิดีโอใหญ่เกิน ${MEDIA_LIMITS.videoMB}MB`);
    setBusy((n) => n + 1);
    try {
      if (isImage) {
        const src = await compressImage(file);
        onChange([...value, { id: uid(), type: 'image', src }]);
      } else {
        // เบราว์เซอร์บางตัวเปิด codec ไม่ได้ (เช่น HEVC .mov บน Chrome) → ยังแนบได้ แค่ไม่มีภาพปก
        // ความยาวตรวจซ้ำที่ฝั่ง server ตอนอัปโหลดจริง
        const { duration, poster } = await probeVideo(file).catch(() => ({ duration: 0, poster: '' }));
        if (duration > MEDIA_LIMITS.videoSeconds + 0.5) {
          message.error(`วิดีโอยาวเกิน ${MEDIA_LIMITS.videoSeconds} วินาที`);
          return;
        }
        const id = uid();
        await putBlob(id, file);
        onChange([...value, { id, type: 'video', blobKey: id, poster, duration }]);
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy((n) => n - 1);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {value.map((m) => (
          <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card">
            {m.type === 'image' || m.poster ? (
              <img src={m.type === 'image' ? m.src : m.poster} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-muted">
                <VideoCamera size={28} />
              </span>
            )}
            {m.type === 'video' && (
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] text-white">
                <Play weight="fill" size={10} /> {m.duration ? fmtDuration(m.duration) : 'วิดีโอ'}
              </span>
            )}
            <button
              type="button"
              aria-label="ลบไฟล์นี้"
              onClick={() => onChange(value.filter((x) => x.id !== m.id))}
              className="absolute right-1 top-1 grid size-7 touch-manipulation place-items-center rounded-full bg-black/65 text-white transition-transform active:scale-90"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <div key={`busy-${i}`} className="aspect-square animate-pulse rounded-xl bg-card" />
        ))}
        {!full && (
          <Upload
            accept="image/*,video/*"
            multiple
            showUploadList={false}
            beforeUpload={(file, list) => {
              const room = MEDIA_LIMITS.maxFiles - value.length - busy;
              if (list.indexOf(file) >= room) {
                if (list.indexOf(file) === room) message.warning(`แนบได้สูงสุด ${MEDIA_LIMITS.maxFiles} ไฟล์`);
                return Upload.LIST_IGNORE;
              }
              void add(file);
              return false;
            }}
          >
            <button
              type="button"
              className="flex aspect-square w-full touch-manipulation select-none flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted transition-colors active:bg-card [@media(hover:hover)_and_(pointer:fine)]:hover:border-gold [@media(hover:hover)_and_(pointer:fine)]:hover:text-gold-text"
            >
              <span className="flex gap-1">
                <Camera size={20} />
                <VideoCamera size={20} />
              </span>
              <span className="text-xs">เพิ่มรูป/วิดีโอ</span>
            </button>
          </Upload>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        สูงสุด {MEDIA_LIMITS.maxFiles} ไฟล์ วิดีโอไม่เกิน {MEDIA_LIMITS.videoSeconds} วินาที และห้ามถ่ายหน้าคนอื่นโดยไม่ได้รับอนุญาต
      </p>
    </div>
  );
}

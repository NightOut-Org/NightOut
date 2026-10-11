import { COMMUNITY_MEDIA_LIMITS, type CommunityMediaItem } from '@nightout/contracts';
import { Image as ImageIcon, Play, VideoCamera, X } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { App } from 'antd';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { dataUrlToBlob, signedUrls, uploadCommunityMedia } from '@/services/api/storage';
import { useAuth } from '@/services/auth';
import { compressImage, fmtDuration, probeVideo } from '@/ui/utils/media';

export type MediaUpdate = (update: (prev: CommunityMediaItem[]) => CommunityMediaItem[]) => void;

export interface CommunityMediaPickerHandle {
  /** เปิดหน้าต่างเลือกไฟล์ (ปุ่มรูป/วิดีโอข้างช่องพิมพ์) */
  open: (kind: 'image' | 'video') => void;
}

const L = COMMUNITY_MEDIA_LIMITS;

/**
 * เลือกรูป/วิดีโอแนบกระทู้หรือความเห็น — อัปโหลดเข้า community-media ทันทีที่เลือก แล้วเก็บแค่ path (ร่างตามไปทุกเครื่อง)
 * - รูปย่อก่อนอัปโหลด · วิดีโอ ≤ 60 วิ / 60MB + ภาพปก · สูงสุด 6 ไฟล์ · X = เอาออก (ไฟล์ที่ไม่มีใครอ้าง backend ลบให้)
 * - variant grid = ช่องสี่เหลี่ยม + ปุ่มเพิ่ม (หน้าตั้งกระทู้) · row = แถวภาพย่อ + ตัวนับ x/6 (ช่องตอบ · ปุ่มเลือกอยู่ข้างช่องพิมพ์ เรียก ref.open)
 * - ไฟล์จากร่าง/กระทู้เดิม: ขอ signed URL มาแสดงภาพย่อ (`previews` = URL ที่รู้อยู่แล้ว เช่นจากหน้าอ่านกระทู้)
 */
export function CommunityMediaPicker({
  value,
  onChange,
  variant = 'grid',
  previews: known,
  onUploading,
  ref,
}: {
  value: CommunityMediaItem[];
  onChange: MediaUpdate;
  variant?: 'grid' | 'row';
  previews?: Record<string, string>;
  /** +1 เริ่มอัปโหลด · -1 เสร็จ — ฟอร์มกันกดโพสต์ระหว่างไฟล์ยังขึ้นไม่เสร็จ */
  onUploading?: (delta: 1 | -1) => void;
  ref?: Ref<CommunityMediaPickerHandle>;
}) {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const room = L.maxFiles - value.length - busy;

  // ภาพย่อของไฟล์ที่ไม่ได้เลือกในเครื่องนี้ (ร่างจากเครื่องอื่น / กระทู้เดิม)
  const missing = value
    .flatMap((m) => [m.thumb_path ?? (m.kind === 'IMAGE' ? m.path : null)])
    .filter((p): p is string => !!p && !local[p] && !known?.[p]);
  const signed = useQuery({
    queryKey: ['community', 'media-preview', missing],
    queryFn: () => signedUrls('community-media', missing, 3600),
    enabled: missing.length > 0,
    staleTime: 50 * 60_000,
  });
  const previewOf = (m: CommunityMediaItem) => {
    const p = m.thumb_path ?? (m.kind === 'IMAGE' ? m.path : null);
    return p ? (local[p] ?? known?.[p] ?? signed.data?.get(p) ?? null) : null;
  };

  useImperativeHandle(ref, () => ({
    open: (kind) => {
      if (!input.current) return;
      input.current.accept = kind === 'image' ? 'image/*' : 'video/*';
      input.current.click();
    },
  }));

  const addOne = async (file: File) => {
    if (!user) return;
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/'))
      return void message.error('รองรับเฉพาะรูปและวิดีโอ');
    const mb = file.size / 1024 / 1024;
    if (!isVideo && mb > L.imageMB) return void message.error(`รูปใหญ่เกิน ${L.imageMB}MB`);
    if (isVideo && mb > L.videoMB) return void message.error(`วิดีโอใหญ่เกิน ${L.videoMB}MB`);
    setBusy((n) => n + 1);
    onUploading?.(1);
    try {
      if (isVideo) {
        // เบราว์เซอร์บางตัวเปิด codec ไม่ได้ (เช่น HEVC .mov บน Chrome) → ยังแนบได้ แค่ไม่มีภาพปก
        const { duration, poster } = await probeVideo(file).catch(() => ({
          duration: 0,
          poster: '',
        }));
        if (duration > L.videoSeconds + 0.5)
          return void message.error(`วิดีโอยาวเกิน ${L.videoSeconds} วินาที`);
        const r = await uploadCommunityMedia(
          user.id,
          file,
          poster ? await dataUrlToBlob(poster) : undefined,
        );
        if (poster && r.thumb_path) setLocal((s) => ({ ...s, [r.thumb_path!]: poster }));
        onChange((prev) => [
          ...prev,
          {
            path: r.path,
            kind: 'VIDEO',
            thumb_path: r.thumb_path,
            duration_sec: duration ? Math.round(duration) : null,
            size_bytes: file.size,
          },
        ]);
      } else {
        const src = await compressImage(file);
        const blob = await dataUrlToBlob(src);
        const r = await uploadCommunityMedia(user.id, blob);
        setLocal((s) => ({ ...s, [r.path]: src }));
        onChange((prev) => [...prev, { path: r.path, kind: 'IMAGE', size_bytes: blob.size }]);
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy((n) => n - 1);
      onUploading?.(-1);
    }
  };

  const pick = (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (list.length > room) message.warning(`แนบได้สูงสุด ${L.maxFiles} ไฟล์`);
    list.slice(0, Math.max(room, 0)).forEach((f) => void addOne(f));
    if (input.current) input.current.value = '';
  };

  const tile = variant === 'grid' ? 'size-[76px] rounded-xl' : 'size-[60px] rounded-[10px]';
  const fileInput = (
    <input
      ref={input}
      type="file"
      multiple
      accept="image/*,video/*"
      className="hidden"
      onChange={(e) => pick(e.target.files)}
    />
  );

  if (variant === 'row' && value.length === 0 && busy === 0) return fileInput;

  return (
    <div
      className={
        variant === 'row'
          ? 'mb-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]'
          : 'flex flex-wrap gap-2'
      }
    >
      {fileInput}
      {value.map((m) => {
        const src = previewOf(m);
        return (
          <div
            key={m.path}
            className={`relative shrink-0 overflow-hidden border border-border bg-card ${tile}`}
          >
            {src ? (
              <img src={src} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-muted">
                {m.kind === 'VIDEO' ? <VideoCamera size={22} /> : <ImageIcon size={22} />}
              </span>
            )}
            {m.kind === 'VIDEO' && (
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-[5px] bg-black/75 px-1 text-[10px] font-semibold text-white">
                <Play weight="fill" size={9} />
                {m.duration_sec ? fmtDuration(m.duration_sec) : 'วิดีโอ'}
              </span>
            )}
            <button
              type="button"
              aria-label="เอาไฟล์นี้ออก"
              onClick={() => onChange((prev) => prev.filter((x) => x.path !== m.path))}
              className="absolute right-[3px] top-[3px] grid size-[22px] touch-manipulation place-items-center rounded-full bg-black/75 text-white active:scale-90"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        );
      })}
      {Array.from({ length: busy }, (_, i) => (
        <div
          key={`up-${i}`}
          className={`shrink-0 animate-pulse bg-card motion-reduce:animate-none ${tile}`}
          aria-label="กำลังอัปโหลด"
        />
      ))}
      {variant === 'grid' && room > 0 && (
        <button
          type="button"
          onClick={() => {
            if (!input.current) return;
            input.current.accept = 'image/*,video/*';
            input.current.click();
          }}
          className={`grid shrink-0 touch-manipulation select-none place-items-center border-[1.5px] border-dashed border-border bg-transparent text-muted active:bg-card ${tile}`}
          aria-label="เพิ่มรูปหรือวิดีโอ"
        >
          <span className="flex gap-0.5">
            <ImageIcon size={20} />
            <VideoCamera size={20} />
          </span>
        </button>
      )}
      {variant === 'row' && (
        <span className="shrink-0 pl-1 text-xs text-muted">
          {value.length + busy}/{L.maxFiles}
        </span>
      )}
    </div>
  );
}

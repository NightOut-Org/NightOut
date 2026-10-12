import type { CommunityMedia } from '@nightout/contracts';
import { CaretLeft, CaretRight, ImageBroken, Play } from '@phosphor-icons/react';
import { Modal } from 'antd';
import { useState } from 'react';
import { fmtDuration } from '@/ui/utils/media';

/**
 * ไฟล์แนบของกระทู้ / ความเห็น — กดแล้วเปิดดูเต็มจอ เลื่อนดูทีละไฟล์ (รูป = ภาพเต็ม · วิดีโอ = เล่นในหน้าต่าง)
 * layout: thread = กริดตามดีไซน์ (1 รูปเต็ม · 2 รูปคู่ · 3+ รูปใหญ่ซ้าย + 2 ขวา และ "+N") · comment / reply = ภาพย่อเรียงแถว
 */
export function CommunityMediaView({
  media,
  layout,
}: {
  media: CommunityMedia[];
  layout: 'thread' | 'comment' | 'reply';
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (media.length === 0) return null;

  const tiles =
    layout === 'thread' ? (
      <ThreadGrid media={media} onOpen={setOpen} />
    ) : (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {media.map((m, i) => (
          <Tile
            key={m.id}
            m={m}
            onClick={() => setOpen(i)}
            className={
              layout === 'comment' ? 'h-[120px] w-24 rounded-[10px]' : 'size-20 rounded-lg'
            }
          />
        ))}
      </div>
    );

  return (
    <>
      {tiles}
      <Viewer media={media} index={open} onIndex={setOpen} />
    </>
  );
}

function ThreadGrid({ media, onOpen }: { media: CommunityMedia[]; onOpen: (i: number) => void }) {
  if (media.length === 1) {
    return (
      <Tile
        m={media[0]!}
        onClick={() => onOpen(0)}
        className="mb-3.5 aspect-[4/3] w-full rounded-xl md:aspect-[16/9]"
      />
    );
  }
  if (media.length === 2) {
    return (
      <div className="mb-3.5 grid h-[220px] grid-cols-2 gap-1.5 md:h-[300px]">
        {media.map((m, i) => (
          <Tile key={m.id} m={m} onClick={() => onOpen(i)} className="size-full rounded-xl" />
        ))}
      </div>
    );
  }
  const more = media.length - 3;
  return (
    <div className="mb-3.5 grid h-[220px] grid-cols-[2fr_1fr] grid-rows-2 gap-1.5 md:h-[320px]">
      <Tile m={media[0]!} onClick={() => onOpen(0)} className="row-span-2 size-full rounded-xl" />
      <Tile m={media[1]!} onClick={() => onOpen(1)} className="size-full rounded-xl" />
      <Tile
        m={media[2]!}
        onClick={() => onOpen(2)}
        className="size-full rounded-xl"
        overlay={more > 0 ? `+${more}` : undefined}
      />
    </div>
  );
}

function Tile({
  m,
  onClick,
  className,
  overlay,
}: {
  m: CommunityMedia;
  onClick: () => void;
  className: string;
  overlay?: string;
}) {
  const src = m.kind === 'IMAGE' ? m.url : m.thumb_url;
  const label =
    m.kind === 'VIDEO'
      ? `เล่นวิดีโอ${m.duration_sec ? ` ${fmtDuration(m.duration_sec)}` : ''}`
      : 'ดูรูปเต็มจอ';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative block touch-manipulation overflow-hidden border-0 bg-card p-0 transition-transform active:scale-[0.98] ${className}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted">
          <ImageBroken size={24} />
        </span>
      )}
      {m.kind === 'VIDEO' && (
        <>
          <span className="absolute inset-0 grid place-items-center bg-[rgba(7,7,13,0.35)]">
            <span className="grid size-9 place-items-center rounded-full bg-white/90 text-[#07070d]">
              <Play weight="fill" size={16} />
            </span>
          </span>
          {!!m.duration_sec && (
            <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[rgba(7,7,13,0.7)] px-1.5 text-[11px] font-semibold text-white">
              {fmtDuration(m.duration_sec)}
            </span>
          )}
        </>
      )}
      {overlay && (
        <span className="absolute inset-0 grid place-items-center bg-black/50 text-xl font-bold text-white">
          {overlay}
        </span>
      )}
    </button>
  );
}

function Viewer({
  media,
  index,
  onIndex,
}: {
  media: CommunityMedia[];
  index: number | null;
  onIndex: (i: number | null) => void;
}) {
  const m = index === null ? null : media[index];
  const go = (d: number) => index !== null && onIndex((index + d + media.length) % media.length);
  return (
    <Modal
      open={!!m}
      onCancel={() => onIndex(null)}
      footer={null}
      centered
      width={880}
      destroyOnHidden
      title={media.length > 1 && index !== null ? `${index + 1} / ${media.length}` : ' '}
    >
      {m && (
        <div
          className="relative"
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(1);
            if (e.key === 'ArrowLeft') go(-1);
          }}
        >
          {m.kind === 'VIDEO' ? (
            m.url ? (
              <video
                key={m.id}
                src={m.url}
                poster={m.thumb_url ?? undefined}
                controls
                autoPlay
                playsInline
                className="max-h-[72vh] w-full rounded-lg bg-black"
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted">เปิดวิดีโอไม่ได้ ลองรีเฟรชหน้า</p>
            )
          ) : m.url ? (
            <img
              src={m.url}
              alt=""
              className="mx-auto max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted">เปิดรูปไม่ได้ ลองรีเฟรชหน้า</p>
          )}
          {media.length > 1 && (
            <>
              <NavButton side="left" onClick={() => go(-1)} />
              <NavButton side="right" onClick={() => go(1)} />
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'ไฟล์ก่อนหน้า' : 'ไฟล์ถัดไป'}
      onClick={onClick}
      className={`absolute top-1/2 grid size-11 -translate-y-1/2 touch-manipulation place-items-center rounded-full border-0 bg-black/60 text-white ${side === 'left' ? 'left-2' : 'right-2'}`}
    >
      {side === 'left' ? (
        <CaretLeft size={20} weight="bold" />
      ) : (
        <CaretRight size={20} weight="bold" />
      )}
    </button>
  );
}

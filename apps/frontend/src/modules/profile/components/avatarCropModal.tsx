import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { Modal, Slider } from 'antd';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { AvatarCrop } from '../utils/resizeAvatar';

/** ขนาดช่องครอปบนจอ (px) — ไม่เกินจอมือถือ 375px ที่หัก padding ของ modal แล้ว */
const VIEW = 280;
const MAX_ZOOM = 4;

interface Loaded {
  url: string;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * ครอปรูปโปรไฟล์ก่อนอัปโหลด: ลาก (เมาส์/นิ้ว) เพื่อเลื่อน · ซูมด้วยแถบเลื่อน / ล้อเมาส์
 * แป้นพิมพ์: ลูกศร = เลื่อน · + / - = ซูม · กรอบวงกลมคือส่วนที่เห็นเป็นรูปโปรไฟล์
 */
export function AvatarCropModal({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File, crop: AvatarCrop) => void;
}) {
  const [img, setImg] = useState<Loaded | null>(null);
  const [zoom, setZoomState] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      const base = VIEW / Math.min(el.naturalWidth, el.naturalHeight);
      setImg({ url, w: el.naturalWidth, h: el.naturalHeight });
      setZoomState(1);
      setOffset({ x: (VIEW - el.naturalWidth * base) / 2, y: (VIEW - el.naturalHeight * base) / 2 });
    };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const scaleOf = useCallback((z: number) => (img ? (VIEW / Math.min(img.w, img.h)) * z : 1), [img]);

  const clamp = useCallback(
    (p: Point, z: number): Point => {
      if (!img) return p;
      const s = scaleOf(z);
      return {
        x: Math.min(0, Math.max(VIEW - img.w * s, p.x)),
        y: Math.min(0, Math.max(VIEW - img.h * s, p.y)),
      };
    },
    [img, scaleOf],
  );

  // ซูมโดยคงจุดกลางช่องครอปไว้ที่เดิมของรูป
  const setZoom = useCallback(
    (next: number) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, next));
      const cx = (VIEW / 2 - offset.x) / scaleOf(zoom);
      const cy = (VIEW / 2 - offset.y) / scaleOf(zoom);
      setOffset(clamp({ x: VIEW / 2 - cx * scaleOf(z), y: VIEW / 2 - cy * scaleOf(z) }, z));
      setZoomState(z);
    },
    [clamp, scaleOf, zoom, offset],
  );

  // ล้อเมาส์ต้อง preventDefault (onWheel ของ React เป็น passive) — ไม่ให้หน้าเลื่อนตอนซูม
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(zoom - e.deltaY * 0.002);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, setZoom]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py }, zoom));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 10;
    const move: Record<string, Point> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };
    const d = move[e.key];
    if (d) {
      e.preventDefault();
      setOffset((o) => clamp({ x: o.x + d.x, y: o.y + d.y }, zoom));
    } else if (e.key === '+' || e.key === '=') setZoom(zoom + 0.1);
    else if (e.key === '-') setZoom(zoom - 0.1);
  };

  const confirm = () => {
    if (!img) return;
    const s = scaleOf(zoom);
    onConfirm(file, { x: -offset.x / s, y: -offset.y / s, side: VIEW / s });
  };

  const s = scaleOf(zoom);

  return (
    <Modal
      open
      title="ครอปรูปโปรไฟล์"
      okText="ใช้รูปนี้"
      cancelText="ยกเลิก"
      okButtonProps={{ disabled: !img }}
      onOk={confirm}
      onCancel={onCancel}
      width={360}
      centered
    >
      <div className="flex flex-col items-center gap-4 pt-2">
        <div
          ref={viewRef}
          role="application"
          aria-label="ช่องครอปรูป: ลากเพื่อเลื่อน ใช้ลูกศรเลื่อน และ + / - เพื่อซูม"
          tabIndex={0}
          className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-black select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          {img && (
            <img
              src={img.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
              style={{
                width: img.w * s,
                height: img.h * s,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* มืดนอกวงกลม = ส่วนที่ไม่อยู่ในรูปโปรไฟล์ */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(0,0,0,0.55)] ring-2 ring-white/70" />
        </div>
        <div className="flex w-full max-w-[280px] items-center gap-2 text-muted">
          <MagnifyingGlassMinus size={18} aria-hidden />
          <Slider
            className="flex-1"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={setZoom}
            tooltip={{ open: false }}
            disabled={!img}
            aria-label="ซูม"
          />
          <MagnifyingGlassPlus size={18} aria-hidden />
        </div>
      </div>
    </Modal>
  );
}

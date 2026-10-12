import { colors, useThemeMode } from '@nightout/ui';
import { useEffect, useRef } from 'react';
import './merchantAurora.css';

/**
 * พื้นหลังหน้าร้าน (/merchant/*) ตามดีไซน์ "Merchant Aurora" แบบ 10 Golden Embers — เฉพาะธีมมืด
 * แสงม่วง/ทองจากขอบบน + ม่วงอมชมพูขอบล่าง + ประกายทองลอยขึ้น · ไม่ตามเมาส์ (จุดแสงลอยเองช้า ๆ)
 * วาดบน canvas ครึ่งความละเอียดจอ · หยุดเมื่อสลับแท็บ · prefers-reduced-motion / ประหยัดเน็ต = ภาพนิ่ง
 * วางใน container ที่ isolate (ดู layouts/main.tsx) — canvas อยู่ fixed -z-10 หลังเนื้อหาทั้งหมด
 */
export function MerchantAurora() {
  const { resolved } = useThemeMode();
  if (resolved !== 'dark') return null;
  return (
    <>
      <EmbersCanvas />
      <div aria-hidden="true" className="merchant-aurora-grain pointer-events-none fixed inset-0 -z-10" />
    </>
  );
}

type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = colors.dark.background;
const PURPLE = hex(colors.dark.purple);
const GOLD = hex(colors.dark.gold);
const GOLD_HI = hex(colors.dark.goldHighlight);
/** ม่วงอมชมพูของแสงขอบล่าง — ไม่มีใน token (ใช้เฉพาะพื้นหลังนี้) */
const MAGENTA: Rgb = [150, 28, 100];

/** canvas เล็กกว่าจอ 2 เท่า แล้วยืดเต็มจอ (แสงนุ่มอยู่แล้ว ประหยัดแรง) */
const RES = 2;
const SPEED = 0.8;

const rgba = (c: Rgb, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: Rgb, a: number) {
  if (rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(0.45, rgba(c, a * 0.45));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** สุ่มแบบมี seed — ประกายอยู่ที่เดิมทุกครั้งที่เปิดหน้า */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rand = seeded(7);
const EMBERS = Array.from({ length: 90 }, () => ({
  x: rand(),
  y: rand(),
  v: 0.03 + rand() * 0.06,
  p: rand() * Math.PI * 2,
  s: 0.6 + rand() * 1.4,
}));

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  // จุดแสงลอยเองตามเวลา (แทนตำแหน่งเมาส์ในดีไซน์)
  const mx = 0.5 + 0.3 * Math.sin(t * 0.23);
  const my = 0.55 + 0.25 * Math.sin(t * 0.31 + 1);
  const gx = w * (0.5 + (mx - 0.5) * 0.3);
  blob(ctx, gx, -h * 0.1, w * 0.75, h * 0.75, PURPLE, 0.35);
  blob(ctx, gx, -h * 0.02, w * 0.45, h * 0.38, GOLD, 0.3 * (0.9 + 0.1 * Math.sin(t * 0.6)));
  blob(ctx, w * 0.5, h * 1.1, w * 0.6, h * 0.35, MAGENTA, 0.3);
  const px = mx * w;
  const py = my * h;
  const r = w * 0.08;
  for (const e of EMBERS) {
    const yy = 1 - ((e.y + t * e.v) % 1);
    let x = (e.x + 0.02 * Math.sin(t * 0.7 + e.p)) * w;
    let y = yy * h;
    const dx = x - px;
    const dy = y - py;
    const d = Math.hypot(dx, dy);
    if (d < r && d > 0) {
      x += (dx / d) * (r - d) * 0.6;
      y += (dy / d) * (r - d) * 0.6;
    }
    const a = Math.sin(yy * Math.PI) * (0.5 + 0.5 * Math.sin(t * 3 + e.p));
    ctx.fillStyle = rgba(GOLD_HI, a * 0.9);
    ctx.fillRect(x, y, e.s, e.s);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function EmbersCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let raf = 0;
    let t = 0;
    let prev = performance.now();

    const fit = () => {
      const w = Math.ceil(window.innerWidth / RES);
      const h = Math.ceil(window.innerHeight / RES);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
    };
    const still = () => reduce.matches || saveData;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      t += Math.min(0.05, (now - prev) / 1000) * SPEED;
      prev = now;
      fit();
      draw(ctx, cv.width, cv.height, t);
    };
    const stop = () => cancelAnimationFrame(raf);
    const start = () => {
      stop();
      fit();
      draw(ctx, cv.width, cv.height, t);
      if (still() || document.hidden) return;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    };

    start();
    const onResize = () => still() && start();
    document.addEventListener('visibilitychange', start);
    reduce.addEventListener('change', start);
    window.addEventListener('resize', onResize);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', start);
      reduce.removeEventListener('change', start);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 block size-full"
      style={{ background: BG }}
    />
  );
}

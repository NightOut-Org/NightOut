import { colors, useThemeMode } from '@nightout/ui';
import { useEffect, useRef } from 'react';
import { prefersLightweight } from '@/ui/utils/prefersLightweight';
import './embersBackdrop.css';

/**
 * พื้นหลัง "Golden Embers" (variant 10 ของดีไซน์ Merchant Aurora / Home Aurora) — เฉพาะธีมมืด
 * - แสงม่วง + ทองจากขอบบน (ลอยซ้าย-ขวาช้า ๆ เอง ไม่ตามเมาส์) · ม่วงอมชมพูจากขอบล่าง · เกรน noise ทับ 5%
 * - ประกายทอง 90 จุดลอยขึ้นและกระพริบ · หลบเมาส์ในรัศมี 8% ของความกว้างจอ (ไม่ขยับเมาส์ 4 วิ จุดหลบลอยวนเอง)
 * - canvas fixed เต็มจอหลังเนื้อหา วาดที่ 1/2 ความละเอียดแล้วยืด · หยุดเมื่อสลับแท็บ
 *   prefers-reduced-motion / ประหยัดเน็ต (prefersLightweight) = วาดเฟรมเดียว
 * วางเป็นลูกของ container ที่ `relative isolate` (fixed -z-10 จะไม่หลุดไปหลังพื้นทึบของ layout)
 * การ์ด/เมนูที่วางบนพื้นหลังนี้เป็นกระจก: ใส่คลาส `embers-glass` ที่ container (ดู embersBackdrop.css)
 */
export function EmbersBackdrop() {
  const { resolved } = useThemeMode();
  // ธีมสว่างใช้พื้นเรียบเดิม — ไม่ mount เลย จะได้ไม่วาด canvas ทิ้งไว้เบื้องหลัง
  if (resolved !== 'dark') return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <EmbersCanvas />
      <div className="embers-grain absolute inset-0 opacity-[0.05]" />
    </div>
  );
}

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = colors.dark.background;
const PURPLE = hex(colors.dark.purple);
const GOLD = hex(colors.dark.gold);
const GOLD_HI = hex(colors.dark.goldHighlight);
/** ม่วงอมชมพูของแสงขอบล่าง — ไม่มีใน token (ใช้เฉพาะพื้นหลังนี้) */
const MAGENTA: RGB = [150, 28, 100];
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;

/** วาดที่ 1/2 ความละเอียดจอ */
const RES = 2;
const SPEED = 0.8;
/** ไม่ขยับเมาส์นานเท่านี้ (ms) → จุดหลบลอยวนเอง */
const IDLE_MS = 4000;

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: RGB, a: number) {
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
const R = seeded(7);
const EMBERS = Array.from({ length: 90 }, () => ({
  x: R(),
  y: R(),
  v: 0.03 + R() * 0.06,
  p: R() * Math.PI * 2,
  s: 0.6 + R() * 1.4,
}));

function EmbersCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const still = prefersLightweight() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const m = { x: 0.5, y: 0.6, tx: 0.5, ty: 0.6, last: -1e9 };
    let t = 0;
    let prev = performance.now();
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      m.tx = e.clientX / window.innerWidth;
      m.ty = e.clientY / window.innerHeight;
      m.last = performance.now();
    };

    const draw = (now: number) => {
      const W = Math.ceil(window.innerWidth / RES);
      const H = Math.ceil(window.innerHeight / RES);
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      t += Math.min(0.05, (now - prev) / 1000) * SPEED;
      prev = now;
      if (now - m.last > IDLE_MS) {
        m.tx = 0.5 + 0.3 * Math.sin(t * 0.23);
        m.ty = 0.55 + 0.25 * Math.sin(t * 0.31 + 1);
      }
      m.x += (m.tx - m.x) * 0.07;
      m.y += (m.ty - m.y) * 0.07;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const gx = W * (0.5 + 0.04 * Math.sin(t * 0.1));
      blob(ctx, gx, -H * 0.1, W * 0.75, H * 0.75, PURPLE, 0.35);
      blob(ctx, gx, -H * 0.02, W * 0.45, H * 0.38, GOLD, 0.3 * (0.9 + 0.1 * Math.sin(t * 0.6)));
      blob(ctx, W * 0.5, H * 1.1, W * 0.6, H * 0.35, MAGENTA, 0.3);

      const mx = m.x * W;
      const my = m.y * H;
      const r = W * 0.08;
      for (const e of EMBERS) {
        const yy = 1 - ((e.y + t * e.v) % 1);
        let x = (e.x + 0.02 * Math.sin(t * 0.7 + e.p)) * W;
        let y = yy * H;
        const dx = x - mx;
        const dy = y - my;
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
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      draw(now);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        prev = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const onResize = () => draw(performance.now());

    if (still) {
      draw(performance.now());
      window.addEventListener('resize', onResize);
    } else {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="block size-full" style={{ background: BG }} />;
}

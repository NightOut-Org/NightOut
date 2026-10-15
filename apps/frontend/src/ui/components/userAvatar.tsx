import type { CSSProperties } from 'react';

/** รูปโปรไฟล์วงกลม — ไม่มีรูป = ตัวย่อ 2 ตัวแรกของชื่อบนพื้นม่วง (navbar · /profile) */
export function UserAvatar({
  name,
  src,
  size,
  className = '',
  style,
}: {
  name: string;
  src?: string | null;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-purple text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32), ...style }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : name.slice(0, 2)}
    </span>
  );
}

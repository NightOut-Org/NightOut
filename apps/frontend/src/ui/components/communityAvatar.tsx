import { avatarColor, initialOf } from '@/ui/utils/community';

/** วงกลมตัวอักษรแรกของผู้เขียน (ชุมชนไม่มีรูปโปรไฟล์) */
export function CommunityAvatar({
  id,
  name,
  size = 32,
}: {
  id: string;
  name: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: avatarColor(id),
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initialOf(name)}
    </span>
  );
}

import type { Db } from '@nightout/types';
import { Play } from '@phosphor-icons/react';
import { Image, Space } from 'antd';

/** ไฟล์แนบในตาราง — รูปกดดูเต็มจอ · วิดีโอเปิดแท็บใหม่ (urls = signed URL จาก useMediaUrls) */
export function MediaCell({
  media,
  urls,
}: {
  media: Db.CommunityMediaRow[];
  urls: Record<string, string>;
}) {
  if (media.length === 0) return <span className="opacity-50">-</span>;
  return (
    <Space size={4} wrap>
      <Image.PreviewGroup>
        {media
          .filter((m) => m.kind === 'IMAGE')
          .map((m) => (
            <Image
              key={m.id}
              src={urls[m.path]}
              width={44}
              height={44}
              className="rounded object-cover"
              alt=""
            />
          ))}
      </Image.PreviewGroup>
      {media
        .filter((m) => m.kind === 'VIDEO')
        .map((m) => (
          <a
            key={m.id}
            href={urls[m.path]}
            target="_blank"
            rel="noreferrer"
            title={m.duration_sec ? `วิดีโอ ${m.duration_sec} วิ` : 'วิดีโอ'}
            className="relative block size-11 overflow-hidden rounded bg-black"
          >
            {m.thumb_path && urls[m.thumb_path] && (
              <img src={urls[m.thumb_path]} alt="" className="size-full object-cover opacity-80" />
            )}
            <span className="absolute inset-0 grid place-items-center text-white">
              <Play weight="fill" size={16} />
            </span>
          </a>
        ))}
    </Space>
  );
}

import type { CommunityThreadSummary } from '@nightout/contracts';
import { ChatCircle, Eye, Heart, MapPin, PushPin } from '@phosphor-icons/react';
import { Tooltip } from 'antd';
import { Link } from 'react-router';
import { compactCount } from '@/ui/utils/community';
import { timeAgo } from '@/ui/utils/format';
import { CommunityAuthorBadges } from './communityAuthorBadges';
import { CommunityAvatar } from './communityAvatar';

const STATUS_NOTE: Partial<Record<CommunityThreadSummary['status'], string>> = {
  HIDDEN: 'ถูกซ่อนโดยทีมงาน',
};

/**
 * แถวกระทู้ในฟีด / กระทู้ของฉัน — ทั้งแถวกดเข้าไปอ่านได้ (ลิงก์ที่หัวข้อขยายเต็มแถว)
 * ปุ่มปักหมุดอยู่เหนือลิงก์ (ไม่ซ้อน <button> ใน <a>) · ไม่ส่ง onTogglePin = ไม่แสดงปุ่ม (ยังไม่ล็อกอิน)
 */
export function CommunityThreadRow({
  thread: t,
  onTogglePin,
  pinBusy = false,
}: {
  thread: CommunityThreadSummary;
  onTogglePin?: (t: CommunityThreadSummary) => void;
  pinBusy?: boolean;
}) {
  const note = STATUS_NOTE[t.status];
  return (
    <article
      className={`relative flex gap-3 border-b border-border px-4 py-3.5 transition-colors md:px-5 md:hover:bg-card ${t.is_pinned ? 'bg-gold/[0.06]' : ''}`}
    >
      <span className="hidden md:block">
        <CommunityAvatar id={t.author.id} name={t.author.name} size={40} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 text-[13px] text-muted md:hidden">
          <CommunityAvatar id={t.author.id} name={t.author.name} size={28} />
          <span className="min-w-0 truncate font-medium text-text">{t.author.name}</span>
          <CommunityAuthorBadges author={t.author} link={false} />
          <span className="shrink-0">{timeAgo(t.created_at)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pr-10">
          {t.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold-text">
              <PushPin weight="fill" size={12} />
              ปักหมุด
            </span>
          )}
          <span className="rounded-md bg-purple/15 px-2 py-0.5 text-[11px] font-semibold text-link">
            {t.category_name}
          </span>
          {t.bar && (
            <span className="hidden items-center gap-1 text-xs font-medium text-link md:inline-flex">
              <MapPin size={13} />
              {t.bar.name}
            </span>
          )}
          {note && (
            <span className="rounded-md bg-card px-2 py-0.5 text-[11px] font-semibold text-muted">
              {note}
            </span>
          )}
        </div>
        <h3 className="m-0 text-base font-semibold leading-snug [text-wrap:pretty]">
          <Link
            to={`/community/t/${t.id}`}
            className="!text-text after:absolute after:inset-0 after:content-['']"
          >
            {t.title}
          </Link>
        </h3>
        <div className="flex items-center gap-3.5 text-[13px] text-muted">
          <span className="hidden min-w-0 items-center gap-1.5 md:inline-flex">
            <span className="truncate">{t.author.name}</span>
            <CommunityAuthorBadges author={t.author} link={false} />
            <span className="ml-1 shrink-0">{timeAgo(t.created_at)}</span>
          </span>
          <span
            className="inline-flex items-center gap-1"
            aria-label={`${t.reply_count} ความคิดเห็น`}
          >
            <ChatCircle size={16} />
            {compactCount(t.reply_count)}
          </span>
          <span className="inline-flex items-center gap-1" aria-label={`${t.view_count} เข้าชม`}>
            <Eye size={16} />
            {compactCount(t.view_count)}
          </span>
          {t.like_count > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={`${t.like_count} ถูกใจ`}>
              <Heart size={16} />
              {compactCount(t.like_count)}
            </span>
          )}
          {t.bar && (
            <span className="ml-auto inline-flex min-w-0 items-center gap-1 font-medium text-link md:hidden">
              <MapPin size={15} className="shrink-0" />
              <span className="truncate">{t.bar.name}</span>
            </span>
          )}
        </div>
      </div>
      {onTogglePin && t.status === 'PUBLISHED' && (
        <Tooltip title={t.is_pinned ? 'เลิกปักหมุด' : 'ปักหมุดไว้บนสุด (เห็นเฉพาะคุณ)'}>
          <button
            type="button"
            disabled={pinBusy}
            aria-pressed={t.is_pinned}
            aria-label={t.is_pinned ? 'เลิกปักหมุด' : 'ปักหมุดกระทู้นี้'}
            onClick={() => onTogglePin(t)}
            className={`absolute right-2 top-2.5 z-10 grid size-10 touch-manipulation select-none place-items-center rounded-full transition-colors active:scale-95 disabled:opacity-50 md:right-3 md:hover:bg-surface ${
              t.is_pinned ? 'text-gold-text' : 'text-muted'
            }`}
          >
            <PushPin size={19} weight={t.is_pinned ? 'fill' : 'regular'} />
          </button>
        </Tooltip>
      )}
    </article>
  );
}

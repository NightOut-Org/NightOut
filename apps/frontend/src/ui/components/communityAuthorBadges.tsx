import {
  COMMUNITY_STAFF_BADGE,
  communityTeamBadge,
  type CommunityAuthor,
} from '@nightout/contracts';
import { Storefront } from '@phosphor-icons/react';
import { Tooltip } from 'antd';
import { Link } from 'react-router';

/**
 * ป้ายผู้เขียนในชุมชน: "ทีม NightOut" (บัญชีหลังบ้าน) · "ทีมร้าน · <ชื่อร้าน>" (ทีมร้าน ณ ตอนโพสต์)
 * ป้ายทีมร้านเป็นแบบเส้นขอบ (ไม่ทึบ) — ไม่ให้ซ้ำกับชิปหมวดในแถวฟีด
 * link = false (แถวฟีดที่ทั้งแถวเป็นลิงก์) → ไม่ทำลิงก์/Tooltip เพราะลิงก์ที่ขยายเต็มแถวทับป้ายอยู่ ใช้ aria-label แทน
 */
export function CommunityAuthorBadges({
  author,
  link = true,
  className = '',
}: {
  author: CommunityAuthor;
  link?: boolean;
  className?: string;
}) {
  const team = author.team;
  if (!author.is_staff && !team) return null;

  const teamHint = team ? `สมาชิกทีมร้าน ${team.name} — โพสต์นี้เขียนตอนอยู่ในทีมร้าน` : '';
  const teamPill = team && (
    <span
      aria-label={link ? undefined : teamHint}
      className="inline-flex min-w-0 max-w-[9rem] items-center gap-1 rounded-md border border-purple/40 px-1.5 py-px text-[11px] font-semibold text-link sm:max-w-[14rem]"
    >
      <Storefront size={12} weight="bold" className="shrink-0" />
      <span className="truncate">{communityTeamBadge(team.name)}</span>
    </span>
  );

  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      {author.is_staff && (
        <span className="shrink-0 rounded-md bg-gold/15 px-1.5 py-px text-[11px] font-semibold text-gold-text">
          {COMMUNITY_STAFF_BADGE}
        </span>
      )}
      {team &&
        (link ? (
          <Tooltip title={teamHint}>
            {team.slug ? (
              // พื้นที่แตะ ≥ 40px (ป้ายสูงแค่ ~18px) ด้วย ::before ที่ขยายออกนอกป้าย — หน้าตาป้ายเท่าเดิม
              <Link
                to={`/bars/${team.slug}`}
                className="relative inline-flex min-w-0 !text-link before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']"
              >
                {teamPill}
              </Link>
            ) : (
              teamPill
            )}
          </Tooltip>
        ) : (
          teamPill
        ))}
    </span>
  );
}

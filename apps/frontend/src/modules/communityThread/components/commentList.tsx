import type { CommunityComment } from '@nightout/contracts';
import { Heart } from '@phosphor-icons/react';
import { Popconfirm } from 'antd';
import { useMemo, type ReactNode } from 'react';
import { CommunityAvatar } from '@/ui/components/communityAvatar';
import { CommunityMediaView } from '@/ui/components/communityMediaView';
import { timeAgo } from '@/ui/utils/format';

export interface CommentActions {
  onReply: (c: CommunityComment) => void;
  onLike: (c: CommunityComment) => void;
  onDelete: (c: CommunityComment) => void;
  onReport: (c: CommunityComment) => void;
}

type Order = 'latest' | 'oldest';

/** ความเห็นหลัก + ตอบกลับซ้อน 1 ชั้น (API ส่งมาแบน) */
export function CommentList({
  comments,
  order,
  actions,
}: {
  comments: CommunityComment[];
  order: Order;
  actions: CommentActions;
}) {
  const tree = useMemo(() => {
    const roots = comments.filter((c) => !c.parent_id);
    if (order === 'latest') roots.reverse();
    return roots.map((r) => ({ ...r, replies: comments.filter((c) => c.parent_id === r.id) }));
  }, [comments, order]);

  if (tree.length === 0) {
    return (
      <p className="m-0 px-4 py-10 text-center text-sm text-muted md:px-0">
        ยังไม่มีความคิดเห็น — เริ่มคุยเป็นคนแรก
      </p>
    );
  }
  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {tree.map((c) => (
        <li key={c.id} className="flex flex-col gap-2.5">
          <CommentBubble c={c} actions={actions} />
          {c.replies.length > 0 && (
            <ol className="m-0 ml-[15px] flex list-none flex-col gap-2.5 border-l-2 border-border p-0 pl-[22px]">
              {c.replies.map((r) => (
                <li key={r.id}>
                  <CommentBubble c={r} actions={actions} nested />
                </li>
              ))}
            </ol>
          )}
        </li>
      ))}
    </ol>
  );
}

function CommentBubble({
  c,
  actions,
  nested = false,
}: {
  c: CommunityComment;
  actions: CommentActions;
  nested?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <CommunityAvatar id={c.author.id} name={c.author.name} size={nested ? 26 : 32} />
      <div className="min-w-0 flex-1">
        <div
          className={`border border-border px-3 py-2.5 ${nested ? 'rounded-[4px_12px_12px_12px] bg-surface' : 'rounded-[4px_14px_14px_14px] bg-card'}`}
        >
          <div className="text-[13px] font-semibold">
            {c.author.name}
            {c.author.is_staff && (
              <span className="ml-1.5 rounded-md bg-gold/15 px-1.5 py-px text-[11px] font-semibold text-gold-text">
                ทีมงาน
              </span>
            )}
            <span className="font-normal text-muted"> · {timeAgo(c.created_at)}</span>
          </div>
          {c.body && (
            <p className="m-0 mt-0.5 whitespace-pre-line break-words text-sm leading-relaxed [text-wrap:pretty]">
              {c.body}
            </p>
          )}
          <CommunityMediaView media={c.media} layout={nested ? 'reply' : 'comment'} />
        </div>
        <div className="flex items-center gap-1 pl-1 pt-0.5 text-xs font-medium text-muted">
          <ActionButton
            onClick={() => actions.onLike(c)}
            pressed={c.is_liked}
            label={c.is_liked ? 'เลิกถูกใจ' : 'ถูกใจ'}
            className={c.is_liked ? 'text-purple' : ''}
          >
            <Heart size={14} weight={c.is_liked ? 'fill' : 'regular'} />
            {c.like_count > 0 && c.like_count}
          </ActionButton>
          <ActionButton onClick={() => actions.onReply(c)} className="text-link">
            ตอบกลับ
          </ActionButton>
          {c.is_mine ? (
            <Popconfirm
              title="ลบความคิดเห็นนี้?"
              okText="ลบ"
              cancelText="ยกเลิก"
              okButtonProps={{ danger: true }}
              onConfirm={() => actions.onDelete(c)}
            >
              <ActionButton>ลบ</ActionButton>
            </Popconfirm>
          ) : (
            <ActionButton onClick={() => actions.onReport(c)}>รายงาน</ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  pressed,
  label,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  pressed?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      className={`inline-flex min-h-8 touch-manipulation select-none items-center gap-1 rounded-md bg-transparent px-2 active:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

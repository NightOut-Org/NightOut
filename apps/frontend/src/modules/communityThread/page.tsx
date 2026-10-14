import { COMMUNITY_SHOP_NEWS_CATEGORY } from '@nightout/contracts';
import type { CommunityComment, CommunityThreadDetail } from '@nightout/contracts';
import {
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  DotsThree,
  Flag,
  Heart,
  PencilSimple,
  PushPin,
  ShareNetwork,
  Star,
  Trash,
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Dropdown, Result, Segmented, Skeleton, type MenuProps } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { getBar } from '@/services/data';
import { useAuth } from '@/services/auth';
import { useAuthModal } from '@/ui/components/authModal';
import { CommunityAuthorBadges } from '@/ui/components/communityAuthorBadges';
import { CommunityAvatar } from '@/ui/components/communityAvatar';
import { CommunityMediaView } from '@/ui/components/communityMediaView';
import { barImage } from '@/ui/utils/barImage';
import { compactCount } from '@/ui/utils/community';
import { CROWD, dateTime, timeAgo } from '@/ui/utils/format';
import {
  addView,
  deleteComment,
  deleteThread,
  setCommentLike,
  setPin,
  setSave,
  setThreadLike,
  useMyCommunityTeam,
  useRelatedThreads,
  useThread,
} from './api';
import { CommentList } from './components/commentList';
import { HistoryModal, type HistoryTarget } from './components/historyModal';
import { ReplyComposer, type ReplyComposerHandle } from './components/replyComposer';
import { ReportModal } from './components/reportModal';

/** อ่านกระทู้ (/community/t/:id) — ทุกคนอ่านได้ · ตอบ/ถูกใจ/บันทึก/ปักหมุด ต้องล็อกอิน */
export function CommunityThreadPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: t, isPending, error, refetch } = useThread(id, user?.id ?? null);
  const related = useRelatedThreads(t?.category);
  const { data: myTeam = [] } = useMyCommunityTeam(user?.id ?? null);
  const [order, setOrder] = useState<'latest' | 'oldest'>('latest');
  const composer = useRef<ReplyComposerHandle>(null);
  const [reportTarget, setReportTarget] = useState<{
    thread_id?: string;
    comment_id?: string;
  } | null>(null);
  const [historyOf, setHistoryOf] = useState<HistoryTarget | null>(null);
  const viewed = useRef<string | null>(null);

  // นับยอดเข้าชมครั้งเดียวต่อการเปิดกระทู้
  useEffect(() => {
    if (!id || viewed.current === id) return;
    viewed.current = id;
    void addView(id).catch(() => undefined);
  }, [id]);

  const refresh = () => void qc.invalidateQueries({ queryKey: ['community'] });
  /** ต้องล็อกอินก่อน → เปิด modal แล้วกลับมาหน้านี้ */
  const guard = (fn: () => Promise<unknown>) => () => {
    if (!user) return openLogin(`/community/t/${id}`);
    fn()
      .then(refresh)
      .catch((e: Error) => message.error(e.message));
  };

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl">
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </div>
    );
  }
  if (error || !t) {
    return (
      <Result
        status="404"
        title="ไม่พบกระทู้นี้"
        subTitle={error?.message}
        extra={
          <div className="flex justify-center gap-2">
            <Button onClick={() => void refetch()}>ลองใหม่</Button>
            <Button type="primary" onClick={() => navigate('/community')}>
              กลับไปที่ชุมชน
            </Button>
          </div>
        }
      />
    );
  }

  /** กระทู้ที่แท็กร้านที่ฉันอยู่ในทีม → ถูกใจของฉัน (กระทู้ + ความเห็น) ไม่นับในยอด */
  const ownShopThread = !!t.bar && myTeam.some((b) => b.bar_id === t.bar!.id);
  const LIKE_NOT_COUNTED = 'ถูกใจแล้ว — ถูกใจจากทีมร้านไม่นับในยอด';
  const likeThread = guard(async () => {
    const r = await setThreadLike(t.id, !t.is_liked);
    if (r.liked && !r.counted) message.info(LIKE_NOT_COUNTED);
  });

  const togglePin = guard(async () => {
    const r = await setPin(t.id, !t.is_pinned);
    message.success(
      r.pinned ? `ปักหมุดแล้ว — กระทู้นี้อยู่บนสุดของฟีดคุณ (${r.pin_count}/3)` : 'เลิกปักหมุดแล้ว',
    );
  });
  const toggleSave = guard(async () => {
    const r = await setSave(t.id, !t.is_saved);
    message.success(
      r.saved ? 'บันทึกไว้แล้ว — ดูได้ที่ "กระทู้ของฉัน"' : 'เอาออกจากที่บันทึกไว้แล้ว',
    );
  });
  const share = async () => {
    const url = `${location.origin}/community/t/${t.id}`;
    try {
      if (navigator.share) await navigator.share({ title: t.title, url });
      else {
        await navigator.clipboard.writeText(url);
        message.success('คัดลอกลิงก์แล้ว');
      }
    } catch {
      /* ผู้ใช้ปิดหน้าแชร์ */
    }
  };
  const confirmDelete = () =>
    modal.confirm({
      title: 'ลบกระทู้นี้?',
      content: 'กระทู้และความคิดเห็นทั้งหมดจะไม่แสดงอีก',
      okText: 'ลบกระทู้',
      okButtonProps: { danger: true },
      cancelText: 'ยกเลิก',
      onOk: () =>
        deleteThread(t.id)
          .then(() => {
            message.success('ลบกระทู้แล้ว');
            refresh();
            navigate('/community/me', { replace: true });
          })
          .catch((e: Error) => message.error(e.message)),
    });

  const menu: MenuProps['items'] = [
    ...(t.status === 'PUBLISHED'
      ? [
          {
            key: 'pin',
            icon: <PushPin size={16} weight={t.is_pinned ? 'fill' : 'regular'} />,
            label: t.is_pinned ? 'เลิกปักหมุด' : 'ปักหมุด (เห็นเฉพาะคุณ)',
            onClick: togglePin,
          },
          {
            key: 'save',
            icon: <BookmarkSimple size={16} />,
            label: t.is_saved ? 'เอาออกจากที่บันทึก' : 'บันทึกไว้อ่าน',
            onClick: toggleSave,
          },
        ]
      : []),
    { key: 'share', icon: <ShareNetwork size={16} />, label: 'แชร์', onClick: () => void share() },
    ...(t.is_mine
      ? [
          { type: 'divider' as const },
          // ข่าวจากร้านแก้ได้เฉพาะทีมของร้านที่แท็ก (ร้านที่แสดงอยู่) — นอกนั้นลบได้อย่างเดียว
          ...(t.category === COMMUNITY_SHOP_NEWS_CATEGORY && !ownShopThread
            ? []
            : [
                {
                  key: 'edit',
                  icon: <PencilSimple size={16} />,
                  label: 'แก้กระทู้',
                  onClick: () => navigate(`/community/t/${t.id}/edit`),
                },
              ]),
          {
            key: 'delete',
            icon: <Trash size={16} />,
            label: 'ลบกระทู้',
            danger: true,
            onClick: confirmDelete,
          },
        ]
      : [
          {
            key: 'report',
            icon: <Flag size={16} />,
            label: 'รายงาน',
            onClick: () =>
              user ? setReportTarget({ thread_id: t.id }) : openLogin(`/community/t/${t.id}`),
          },
        ]),
  ];

  const commentActions = {
    onReply: (c: CommunityComment) =>
      user ? composer.current?.replyTo(c) : openLogin(`/community/t/${t.id}`),
    onLike: (c: CommunityComment) =>
      guard(async () => {
        const r = await setCommentLike(c.id, !c.is_liked);
        if (r.liked && !r.counted) message.info(LIKE_NOT_COUNTED);
      })(),
    onDelete: (c: CommunityComment) => guard(() => deleteComment(c.id))(),
    onReport: (c: CommunityComment) =>
      user ? setReportTarget({ comment_id: c.id }) : openLogin(`/community/t/${t.id}`),
    onHistory: (c: CommunityComment) => setHistoryOf({ kind: 'comment', id: c.id }),
  };

  return (
    <div className="mx-auto max-w-6xl pb-32 md:pb-0">
      <nav aria-label="ตำแหน่ง" className="mb-4 flex items-center gap-1 text-sm text-muted">
        <button
          type="button"
          aria-label="ย้อนกลับ"
          onClick={() => (history.length > 1 ? navigate(-1) : navigate('/community'))}
          className="-ml-2 grid size-11 place-items-center rounded-full bg-transparent text-text md:hidden"
        >
          <CaretLeft size={22} />
        </button>
        <Link to="/community" className="hidden !text-muted md:inline">
          ชุมชน
        </Link>
        <CaretRight size={12} className="hidden md:inline" />
        <Link
          to={`/community/c/${t.category}`}
          className="font-semibold !text-text md:font-normal md:!text-muted"
        >
          {t.category_name}
        </Link>
      </nav>

      <div className="flex gap-6">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          {t.status === 'HIDDEN' && (
            <Alert
              type="warning"
              showIcon
              title="กระทู้นี้ถูกซ่อนโดยทีมงาน — คนอื่นมองไม่เห็น แก้ให้ตรงกติกาแล้วติดต่อทีมงานได้"
            />
          )}
          <ThreadArticle
            t={t}
            menu={menu}
            ownShopThread={ownShopThread}
            onLike={likeThread}
            onSave={toggleSave}
            onPin={togglePin}
            onHistory={() => setHistoryOf({ kind: 'thread', id: t.id })}
          />

          {t.status === 'PUBLISHED' && (
            <ReplyComposer ref={composer} threadId={t.id} comments={t.comments} />
          )}

          <section aria-label="ความคิดเห็น" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[15px] font-semibold">{t.reply_count} ความคิดเห็น</h2>
              <Segmented
                value={order}
                onChange={(v) => setOrder(v as 'latest' | 'oldest')}
                options={[
                  { value: 'latest', label: 'ล่าสุด' },
                  { value: 'oldest', label: 'เก่าสุด' },
                ]}
              />
            </div>
            <CommentList
              threadId={t.id}
              comments={t.comments}
              order={order}
              actions={commentActions}
            />
          </section>
        </main>

        <aside className="sticky top-24 hidden w-80 shrink-0 flex-col gap-4 self-start lg:flex">
          {t.bar && <TaggedBarCard barRef={t.bar} />}
          {(related.data?.items.filter((r) => r.id !== t.id).length ?? 0) > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="m-0 mb-2 text-[15px] font-semibold">กระทู้ที่เกี่ยวข้อง</h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {related
                  .data!.items.filter((r) => r.id !== t.id)
                  .slice(0, 4)
                  .map((r) => (
                    <li key={r.id} className="border-b border-border py-2.5 last:border-b-0">
                      <Link
                        to={`/community/t/${r.id}`}
                        className="block text-sm font-medium leading-snug !text-text"
                      >
                        {r.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">
                        {r.reply_count} ความเห็น · {timeAgo(r.created_at)}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
      <HistoryModal target={historyOf} onClose={() => setHistoryOf(null)} />
    </div>
  );
}

function ThreadArticle({
  t,
  menu,
  ownShopThread,
  onLike,
  onSave,
  onPin,
  onHistory,
}: {
  t: CommunityThreadDetail;
  menu: MenuProps['items'];
  /** กระทู้แท็กร้านที่ฉันอยู่ในทีม → บอกว่าถูกใจของฉันไม่นับ */
  ownShopThread: boolean;
  onLike: () => void;
  onSave: () => void;
  onPin: () => void;
  onHistory: () => void;
}) {
  const pill =
    'inline-flex h-10 touch-manipulation select-none items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-transform active:scale-95';
  const open = t.status === 'PUBLISHED';
  return (
    <article className="md:rounded-2xl md:border md:border-border md:bg-surface md:p-6">
      <header className="mb-3 flex items-center gap-2.5">
        <CommunityAvatar id={t.author.id} name={t.author.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{t.author.name}</span>
            <CommunityAuthorBadges author={t.author} />
          </div>
          <div className="text-xs text-muted">
            {timeAgo(t.created_at)}
            {t.edited_at && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={onHistory}
                  title={`แก้ไขล่าสุด ${dateTime(t.edited_at)} — ดูประวัติการแก้ไข`}
                  className="touch-manipulation bg-transparent p-0 text-muted underline decoration-dotted underline-offset-2 md:hover:text-text"
                >
                  แก้ไขแล้ว
                </button>
              </>
            )}{' '}
            · เข้าชม {compactCount(t.view_count)}
          </div>
        </div>
        <Dropdown menu={{ items: menu }} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            aria-label="ตัวเลือกกระทู้"
            className="grid size-11 place-items-center rounded-full bg-transparent text-text"
          >
            <DotsThree size={24} weight="bold" />
          </button>
        </Dropdown>
      </header>
      {t.is_pinned && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold-text">
          <PushPin size={12} weight="fill" />
          ปักหมุดไว้ในฟีดของคุณ
        </div>
      )}
      <h1 className="m-0 mb-2.5 text-[21px] font-bold leading-snug [text-wrap:pretty] md:text-[28px]">
        {t.title}
      </h1>
      {t.body && (
        <p className="m-0 mb-4 whitespace-pre-line break-words text-[15px] leading-[1.75] opacity-90 [text-wrap:pretty] md:text-base">
          {t.body}
        </p>
      )}
      <CommunityMediaView media={t.media} layout="thread" />
      {t.bar && (
        <div className="mb-4 lg:hidden">
          <TaggedBarCard barRef={t.bar} compact />
        </div>
      )}
      {open && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLike}
            aria-pressed={t.is_liked}
            className={`${pill} ${t.is_liked ? 'border-purple bg-purple text-white' : 'border-border bg-transparent text-text'}`}
          >
            <Heart size={17} weight={t.is_liked ? 'fill' : 'regular'} />
            ถูกใจ {t.like_count}
          </button>
          <button
            type="button"
            onClick={onSave}
            aria-pressed={t.is_saved}
            className={`${pill} border-border bg-transparent ${t.is_saved ? 'text-gold-text' : 'text-text'}`}
          >
            <BookmarkSimple size={17} weight={t.is_saved ? 'fill' : 'regular'} />
            {t.is_saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
          <button
            type="button"
            onClick={onPin}
            aria-pressed={t.is_pinned}
            className={`${pill} border-border bg-transparent ${t.is_pinned ? 'text-gold-text' : 'text-text'}`}
          >
            <PushPin size={17} weight={t.is_pinned ? 'fill' : 'regular'} />
            {t.is_pinned ? 'ปักหมุดแล้ว' : 'ปักหมุด'}
          </button>
        </div>
      )}
      {open && ownShopThread && (
        <p className="m-0 mt-2 text-xs text-muted">
          ถูกใจของทีมร้านในกระทู้ที่แท็กร้านตัวเองไม่นับในยอดถูกใจ
        </p>
      )}
    </article>
  );
}

/** การ์ดร้านที่ถูกแท็ก → จองโต๊ะต่อได้ทันที (ข้อมูลร้านจาก catalog ที่โหลดไว้แล้ว) */
function TaggedBarCard({
  barRef,
  compact = false,
}: {
  barRef: { id: string; slug: string; name: string };
  compact?: boolean;
}) {
  const bar = getBar(barRef.id);
  const meta = bar && (
    <div className="flex items-center gap-1 text-xs text-muted">
      <Star size={12} weight="fill" className="text-gold" />
      {bar.rating.toFixed(1)} · {bar.district} ·{' '}
      <span style={{ color: CROWD[bar.crowd].dot }}>{CROWD[bar.crowd].label}</span>
    </div>
  );
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-border bg-card p-2.5">
        <img
          src={barImage(bar ?? {})}
          alt=""
          className="size-[52px] shrink-0 rounded-[10px] object-cover"
        />
        <Link to={`/bars/${barRef.slug}`} className="min-w-0 flex-1 !text-text">
          <div className="text-[11px] text-muted">ร้านที่ถูกพูดถึง</div>
          <div className="truncate text-[15px] font-semibold">{barRef.name}</div>
          {meta}
        </Link>
        <Link
          to={`/bars/${barRef.slug}/book`}
          className="shrink-0 rounded-[10px] bg-gold px-3.5 py-2 text-[13px] font-bold !text-on-gold"
        >
          จองโต๊ะ
        </Link>
      </div>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <img src={barImage(bar ?? {})} alt="" className="aspect-[16/9] w-full object-cover" />
      <div className="flex flex-col gap-1 p-4">
        <div className="text-xs text-muted">ร้านที่ถูกพูดถึงในกระทู้</div>
        <div className="text-lg font-semibold">{barRef.name}</div>
        {meta}
        <div className="mt-2 flex gap-2">
          <Link
            to={`/bars/${barRef.slug}/book`}
            className="flex-1 rounded-[10px] bg-gold py-2 text-center text-sm font-bold !text-on-gold"
          >
            จองโต๊ะ
          </Link>
          <Link
            to={`/bars/${barRef.slug}`}
            className="flex-1 rounded-[10px] border border-border py-2 text-center text-sm font-semibold !text-text"
          >
            ดูร้าน
          </Link>
        </div>
      </div>
    </section>
  );
}

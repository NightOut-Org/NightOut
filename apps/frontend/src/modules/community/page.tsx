import {
  COMMUNITY_SHOP_NEWS_WEEKLY_MAX,
  COMMUNITY_SHOP_NEWS_WINDOW_DAYS,
  type CommunitySort,
  type CommunityThreadSummary,
} from '@nightout/contracts';
import { MagnifyingGlass, Plus, PushPin } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, Input, Skeleton } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAuth } from '@/services/auth';
import { useAuthModal } from '@/ui/components/authModal';
import { CommunityThreadRow } from '@/ui/components/communityThreadRow';
import { setPin, useCommunityCategories, useCommunityFeed, useHasNewDraft } from './api';
import { CategoryAside, FeedSideRail } from './components/feedAside';

const TABS: { key: CommunitySort; label: string }[] = [
  { key: 'latest', label: 'ล่าสุด' },
  { key: 'popular', label: 'ยอดนิยม' },
  { key: 'unanswered', label: 'ยังไม่มีคำตอบ' },
];
const isSort = (v: string | null): v is CommunitySort => TABS.some((t) => t.key === v);

/** ฟีดกระทู้ (/community · /community/c/:category) — กระทู้ที่ผู้ใช้ปักหมุดไว้ขึ้นบนสุด (เห็นเฉพาะตัวเอง) */
export function CommunityPage() {
  const { category } = useParams();
  const [params, setParams] = useSearchParams();
  const sortParam = params.get('sort');
  const sort: CommunitySort = isSort(sortParam) ? sortParam : 'latest';
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();

  const { data: categories = [] } = useCommunityCategories();
  const feed = useCommunityFeed({ category, sort, q: q || undefined }, user?.id ?? null);
  const { data: hasDraft = false } = useHasNewDraft(!!user);
  const threads = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const current = categories.find((c) => c.slug === category);

  // พิมพ์ค้นหาแล้วหยุด 400ms ค่อยใส่ใน URL (แชร์ลิงก์ผลค้นหาได้)
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (search.trim() === q) return;
      setParams(
        (p) => {
          if (search.trim()) p.set('q', search.trim());
          else p.delete('q');
          return p;
        },
        { replace: true },
      );
    }, 400);
    return () => window.clearTimeout(t);
  }, [search, q, setParams]);

  const pin = useMutation({
    mutationFn: (t: CommunityThreadSummary) => setPin(t.id, !t.is_pinned),
    onSuccess: (r) => {
      message.success(
        r.pinned ? `ปักหมุดแล้ว — อยู่บนสุดของฟีดคุณ (${r.pin_count}/3)` : 'เลิกปักหมุดแล้ว',
      );
      void qc.invalidateQueries({ queryKey: ['community'] });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const compose = () => (user ? navigate('/community/new') : openLogin('/community/new'));
  const pickSort = (s: CommunitySort) =>
    setParams((p) => {
      if (s === 'latest') p.delete('sort');
      else p.set('sort', s);
      return p;
    });

  const chips = [{ slug: undefined as string | undefined, name: 'ทั้งหมด' }, ...categories];
  const pinnedCount = threads.filter((t) => t.is_pinned).length;

  return (
    <div className="-mx-4 md:mx-0">
      <header className="flex flex-wrap items-end gap-4 px-4 pb-1 md:px-0 lg:pb-5">
        <div className="min-w-0 flex-1">
          <div className="font-display text-[13px] tracking-[0.14em] text-gold-text">COMMUNITY</div>
          <h1 className="m-0 mt-0.5 text-[28px] font-bold leading-tight md:text-4xl">
            {current?.name ?? 'ชุมชน'}
          </h1>
          <p className="m-0 mt-0.5 text-sm text-muted">
            {current?.team_only
              ? `ข่าวและกิจกรรมจากทีมร้านโดยตรง · ร้านละไม่เกิน ${COMMUNITY_SHOP_NEWS_WEEKLY_MAX} กระทู้ใน ${COMMUNITY_SHOP_NEWS_WINDOW_DAYS} วัน`
              : 'คุยเรื่องคืนนี้กับคนที่ไปมาแล้วจริง'}
          </p>
        </div>
        <Input
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<MagnifyingGlass size={18} className="text-muted" />}
          placeholder="ค้นหากระทู้ ร้าน หรือย่าน"
          aria-label="ค้นหากระทู้"
          enterKeyHint="search"
          className="!h-[46px] w-full !rounded-[14px] !text-base md:!w-80"
        />
        <Button
          type="primary"
          size="large"
          onClick={compose}
          icon={<Plus size={18} weight="bold" />}
          className="!hidden !h-[46px] !rounded-full !px-5 !font-bold md:!inline-flex"
        >
          <span className="relative">
            ตั้งกระทู้
            {hasDraft && <DraftDot />}
          </span>
        </Button>
      </header>

      <div className="flex gap-6">
        <CategoryAside categories={categories} active={category} />

        <main className="min-w-0 flex-1 md:overflow-hidden md:rounded-2xl md:border md:border-border md:bg-surface">
          {/* หมวด (จอเล็ก) */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3.5 [scrollbar-width:none] lg:hidden">
            {chips.map((c) => {
              const on = c.slug === category;
              return (
                <Link
                  key={c.slug ?? 'all'}
                  to={c.slug ? `/community/c/${c.slug}` : '/community'}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-[34px] shrink-0 select-none items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium ${
                    on ? 'border-text bg-text !text-background' : 'border-border !text-text'
                  }`}
                >
                  {c.name}
                </Link>
              );
            })}
          </div>

          <div
            role="tablist"
            aria-label="เรียงกระทู้"
            className="flex gap-5 border-b border-border px-4 pt-2.5 md:px-5"
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={sort === t.key}
                onClick={() => pickSort(t.key)}
                className={`-mb-px touch-manipulation select-none border-b-2 bg-transparent px-0 py-2.5 text-sm font-semibold ${
                  sort === t.key ? 'border-gold text-text' : 'border-transparent text-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {user && pinnedCount > 0 && (
            <p className="m-0 flex items-center gap-1.5 border-b border-border px-4 py-2 text-xs text-muted md:px-5">
              <PushPin size={13} weight="fill" className="text-gold-text" />
              กระทู้ที่คุณปักหมุดอยู่บนสุดเสมอ — คนอื่นไม่เห็นหมุดของคุณ
            </p>
          )}

          {feed.isPending ? (
            <div className="flex flex-col gap-6 p-4 md:p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} active avatar={{ size: 28 }} paragraph={{ rows: 1 }} />
              ))}
            </div>
          ) : feed.isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-muted">
              โหลดกระทู้ไม่สำเร็จ — {feed.error.message}
              <Button onClick={() => void feed.refetch()}>ลองใหม่</Button>
            </div>
          ) : threads.length === 0 ? (
            <Empty
              className="!py-12"
              description={
                q
                  ? `ไม่พบกระทู้ที่ตรงกับ "${q}"`
                  : current?.team_only
                    ? 'ยังไม่มีข่าวจากร้าน'
                    : 'ยังไม่มีกระทู้ในหมวดนี้'
              }
            >
              {!q && !current?.team_only && <Button onClick={compose}>ตั้งกระทู้แรก</Button>}
            </Empty>
          ) : (
            <>
              {threads.map((t) => (
                <CommunityThreadRow
                  key={t.id}
                  thread={t}
                  onTogglePin={user ? (x) => pin.mutate(x) : undefined}
                  pinBusy={pin.isPending && pin.variables?.id === t.id}
                />
              ))}
              {feed.hasNextPage && (
                <div className="p-4 text-center">
                  <Button
                    loading={feed.isFetchingNextPage}
                    onClick={() => void feed.fetchNextPage()}
                  >
                    ดูกระทู้เพิ่มเติม
                  </Button>
                </div>
              )}
            </>
          )}
        </main>

        <FeedSideRail />
      </div>

      {/* ปุ่มลอย (มือถือ) — อยู่เหนือเมนูล่าง */}
      <button
        type="button"
        onClick={compose}
        className="fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+76px)] right-4 z-30 flex h-[52px] touch-manipulation select-none items-center gap-1.5 rounded-full border-0 bg-gradient-to-b from-gold-highlight to-gold px-5 text-[15px] font-bold text-on-gold shadow-[0_10px_24px_-8px_rgba(232,182,76,0.7)] transition-transform active:scale-95 md:hidden"
      >
        <Plus size={18} weight="bold" />
        ตั้งกระทู้
        {hasDraft && <DraftDot />}
      </button>
    </div>
  );
}

/** จุดบอกว่ามีร่างตั้งกระทู้ค้างอยู่ */
function DraftDot() {
  return (
    <span
      title="มีร่างที่ยังไม่โพสต์"
      aria-label="มีร่างที่ยังไม่โพสต์"
      className="absolute -right-2.5 -top-1 size-2.5 rounded-full border-2 border-gold bg-purple"
    />
  );
}

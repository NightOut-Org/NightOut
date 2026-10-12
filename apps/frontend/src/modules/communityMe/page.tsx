import {
  COMMUNITY_DRAFT_TTL_DAYS,
  COMMUNITY_PIN_MAX,
  type CommunityDraft,
  type CommunityScope,
  type CommunityThreadSummary,
} from '@nightout/contracts';
import { NotePencil, Trash } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, Popconfirm, Skeleton, Tabs } from 'antd';
import { Link, useSearchParams } from 'react-router';
import { CommunityThreadRow } from '@/ui/components/communityThreadRow';
import { PageHeader } from '@/ui/components/pageHeader';
import { timeAgo } from '@/ui/utils/format';
import { deleteDraft, setPin, useMyDrafts, useMyThreads, useThreadTitle } from './api';

type Tab = CommunityScope | 'drafts';
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'mine', label: 'กระทู้ของฉัน', empty: 'ยังไม่ได้ตั้งกระทู้' },
  { key: 'saved', label: 'ที่บันทึกไว้', empty: 'กด "บันทึก" ในกระทู้ที่อยากกลับมาอ่าน' },
  {
    key: 'pinned',
    label: 'ปักหมุด',
    empty: `ปักหมุดได้ ${COMMUNITY_PIN_MAX} กระทู้ — ขึ้นบนสุดของฟีดคุณ คนอื่นไม่เห็น`,
  },
  { key: 'drafts', label: 'ฉบับร่าง', empty: 'ไม่มีร่างค้างอยู่' },
];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

/** กระทู้ของฉัน (/community/me) — ตั้งเอง · บันทึกไว้ · ปักหมุด · ฉบับร่าง */
export function CommunityMePage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = isTab(raw) ? raw : 'mine';
  const { data: drafts = [] } = useMyDrafts();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="กระทู้ของฉัน"
        extra={
          <Link to="/community/new">
            <Button type="primary" icon={<NotePencil size={16} />}>
              ตั้งกระทู้
            </Button>
          </Link>
        }
      />
      <Tabs
        activeKey={tab}
        onChange={(k) => setParams({ tab: k }, { replace: true })}
        items={TABS.map((t) => ({
          key: t.key,
          label: t.key === 'drafts' && drafts.length ? `${t.label} (${drafts.length})` : t.label,
        }))}
      />
      {tab === 'drafts' ? (
        <DraftList drafts={drafts} />
      ) : (
        <ThreadList scope={tab} empty={TABS.find((t) => t.key === tab)!.empty} />
      )}
    </div>
  );
}

function ThreadList({ scope, empty }: { scope: CommunityScope; empty: string }) {
  const q = useMyThreads(scope);
  const qc = useQueryClient();
  const { message } = App.useApp();
  const pin = useMutation({
    mutationFn: (t: CommunityThreadSummary) => setPin(t.id, !t.is_pinned),
    onSuccess: (r) => {
      message.success(
        r.pinned ? `ปักหมุดแล้ว (${r.pin_count}/${COMMUNITY_PIN_MAX})` : 'เลิกปักหมุดแล้ว',
      );
      void qc.invalidateQueries({ queryKey: ['community'] });
    },
    onError: (e: Error) => message.error(e.message),
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.isPending) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (q.isError)
    return (
      <div className="py-10 text-center text-muted">
        โหลดไม่สำเร็จ — {q.error.message} <Button onClick={() => void q.refetch()}>ลองใหม่</Button>
      </div>
    );
  if (items.length === 0) return <Empty className="!py-10" description={empty} />;
  return (
    <div className="-mx-4 md:mx-0 md:overflow-hidden md:rounded-2xl md:border md:border-border md:bg-surface">
      {items.map((t) => (
        <CommunityThreadRow
          key={t.id}
          thread={t}
          onTogglePin={(x) => pin.mutate(x)}
          pinBusy={pin.isPending && pin.variables?.id === t.id}
        />
      ))}
      {q.hasNextPage && (
        <div className="p-4 text-center">
          <Button loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>
            ดูเพิ่มเติม
          </Button>
        </div>
      )}
    </div>
  );
}

const DRAFT_KIND = { NEW: 'กระทู้ใหม่', EDIT: 'แก้กระทู้', REPLY: 'ตอบกระทู้' } as const;
const draftLink = (d: CommunityDraft) =>
  d.kind === 'NEW'
    ? '/community/new'
    : d.kind === 'EDIT'
      ? `/community/t/${d.thread_id}/edit`
      : `/community/t/${d.thread_id}`;

function DraftList({ drafts }: { drafts: CommunityDraft[] }) {
  if (drafts.length === 0) return <Empty className="!py-10" description="ไม่มีร่างค้างอยู่" />;
  return (
    <>
      <p className="m-0 mb-3 text-[13px] text-muted">
        ร่างบันทึกอัตโนมัติขณะพิมพ์ และเก็บไว้ {COMMUNITY_DRAFT_TTL_DAYS} วัน —
        เขียนต่อได้จากทุกเครื่อง
      </p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {drafts.map((d) => (
          <DraftItem key={d.id} d={d} />
        ))}
      </ul>
    </>
  );
}

function DraftItem({ d }: { d: CommunityDraft }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { data: threadTitle } = useThreadTitle(d.kind === 'NEW' ? null : d.thread_id);
  const title = d.kind === 'REPLY' ? threadTitle : d.payload.title?.trim() || threadTitle;
  const preview = (d.payload.body ?? '').replace(/\s+/g, ' ').trim();
  const remove = () =>
    deleteDraft(d)
      .then(() => qc.invalidateQueries({ queryKey: ['community', 'drafts'] }))
      .catch((e: Error) => message.error(e.message));

  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <Link to={draftLink(d)} className="min-w-0 flex-1 !text-text">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <span className="rounded-md bg-purple/15 px-2 py-0.5 font-semibold text-link">
            {DRAFT_KIND[d.kind]}
          </span>
          แก้ล่าสุด {timeAgo(d.updated_at)}
        </div>
        <div className="truncate font-semibold">
          {title || (d.kind === 'NEW' ? 'ยังไม่มีหัวข้อ' : 'กระทู้')}
        </div>
        {preview && <div className="mt-0.5 line-clamp-2 text-sm text-muted">{preview}</div>}
        {!!d.payload.media?.length && (
          <div className="mt-1 text-xs text-muted">แนบ {d.payload.media.length} ไฟล์</div>
        )}
        <div className="mt-2 text-[13px] font-semibold text-link">เขียนต่อ</div>
      </Link>
      <Popconfirm
        title="ทิ้งร่างนี้?"
        okText="ทิ้งร่าง"
        cancelText="ยกเลิก"
        okButtonProps={{ danger: true }}
        onConfirm={() => void remove()}
      >
        <Button type="text" aria-label="ทิ้งร่าง" icon={<Trash size={18} />} />
      </Popconfirm>
    </li>
  );
}

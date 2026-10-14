import { PageContainer } from '@ant-design/pro-components';
import { communityTeamBadge } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { Alert, Button, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { PAGE_SIZE } from '@/configs/constants';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { COMMUNITY_REPORT_REASON, COMMUNITY_STATUS } from '@/ui/utils/labels';
import {
  moderateCommentAction,
  moderateThreadAction,
  useCommunityComments,
  useCommunityThreads,
  useMediaUrls,
} from './api';
import { HistoryModal } from './components/historyModal';
import { MediaCell } from './components/mediaCell';
import { ModerateModal, type ModerateTarget, type Row } from './components/moderateModal';

type Action = 'KEEP' | 'HIDE' | 'REMOVE' | 'RESTORE';
type Mode = 'reported' | 'live' | 'hidden';
const isThread = (r: Row): r is Db.AdminCommunityThread => 'title' in r;
/** ความกว้างคอลัมน์ปุ่ม ตามจำนวนปุ่มของแต่ละแท็บ */
const ACTION_WIDTH: Record<Mode, number> = { reported: 250, live: 180, hidden: 150 };
const DONE: Record<Action, string> = {
  KEEP: 'เก็บไว้ และปิดรายงานแล้ว',
  HIDE: 'ซ่อนแล้ว — เจ้าของได้รับแจ้งเตือน',
  REMOVE: 'ลบแล้ว — เจ้าของได้รับแจ้งเตือน',
  RESTORE: 'แสดงอีกครั้งแล้ว',
};

/** ชุมชน — กระทู้/ความเห็นที่ถูกรายงาน · โพสต์ทีมร้าน · ซ่อน / ลบ (ต้องมีเหตุผล) / แสดงอีกครั้ง (audit log + แจ้งเจ้าของ) */
export function CommunityPage() {
  const threads = useCommunityThreads();
  const comments = useCommunityComments();
  const act = useAdminAction();
  const [history, setHistory] = useState<Row | null>(null);
  /** ซ่อน/ลบที่รอเลือกเหตุผลใน ModerateModal */
  const [pending, setPending] = useState<ModerateTarget | null>(null);

  /** KEEP / RESTORE ไม่ต้องมีเหตุผล · HIDE / REMOVE ต้องมี (API บังคับ) → ผ่าน ModerateModal เท่านั้น */
  const moderate = (r: Row, action: Action, reason?: string, onSuccess?: () => void) =>
    act.mutate(
      {
        ...(isThread(r)
          ? moderateThreadAction(r.id, { action, reason })
          : moderateCommentAction(r.id, { action, reason })),
        success: DONE[action],
      },
      { onSuccess },
    );

  const t = useMemo(() => split(threads.data ?? []), [threads.data]);
  // ไฟล์แนบทุกแถว (รวมฉบับก่อนแก้) ขอ signed URL ครั้งเดียว
  const mediaPaths = useMemo(
    () =>
      [...(threads.data ?? []), ...(comments.data ?? [])].flatMap((r) =>
        [...r.media, ...r.revisions.flatMap((v) => v.media)].flatMap((m) =>
          m.thumb_path ? [m.path, m.thumb_path] : [m.path],
        ),
      ),
    [threads.data, comments.data],
  );
  /** "แก้ไขแล้ว N ครั้ง" ใต้เนื้อหา → เปิดประวัติ */
  const editedLink = (r: Row) =>
    r.revisions.length > 0 && (
      <Typography.Link className="!text-xs" onClick={() => setHistory(r)}>
        แก้ไขแล้ว {r.revisions.length} ครั้ง · ดูประวัติ
      </Typography.Link>
    );
  const { data: urls = {} } = useMediaUrls(mediaPaths);
  const c = useMemo(() => split(comments.data ?? []), [comments.data]);

  const actions = (mode: Mode) => ({
    title: 'จัดการ',
    key: 'a',
    fixed: 'right' as const,
    width: ACTION_WIDTH[mode],
    render: (_: unknown, r: Row) =>
      mode === 'hidden' ? (
        <Button loading={act.isPending} onClick={() => moderate(r, 'RESTORE')}>
          แสดงอีกครั้ง
        </Button>
      ) : (
        <Space>
          {mode === 'reported' && (
            <Button loading={act.isPending} onClick={() => moderate(r, 'KEEP')}>
              เก็บไว้
            </Button>
          )}
          <Button loading={act.isPending} onClick={() => setPending({ row: r, action: 'HIDE' })}>
            ซ่อน
          </Button>
          <Button
            danger
            loading={act.isPending}
            onClick={() => setPending({ row: r, action: 'REMOVE' })}
          >
            ลบ
          </Button>
        </Space>
      ),
  });

  const common = [
    {
      title: 'ไฟล์แนบ',
      key: 'media',
      width: 170,
      render: (_: unknown, r: Row) => <MediaCell media={r.media} urls={urls} />,
    },
    {
      title: 'ผู้เขียน',
      key: 'author',
      width: 200,
      render: (_: unknown, r: Row) => (
        <>
          <div>{r.author_name ?? 'บัญชีถูกลบ'}</div>
          {r.team_bar && (
            <Tag color="gold" className="!me-0 !mt-1 max-w-full truncate">
              {communityTeamBadge(r.team_bar.name)}
            </Tag>
          )}
        </>
      ),
    },
    {
      title: 'ถูกรายงาน',
      key: 'reports',
      width: 180,
      render: (_: unknown, r: Row) => (
        <Space size={[4, 4]} wrap>
          {r.reports
            .filter((x) => x.status === 'OPEN')
            .map((x) => (
              <Tag key={x.created_at} color="red" title={x.detail ?? undefined}>
                {COMMUNITY_REPORT_REASON[x.reason] ?? x.reason}
              </Tag>
            ))}
        </Space>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      width: 110,
      render: (s: Db.CommunityStatus) => <StatusTag map={COMMUNITY_STATUS} value={s} />,
    },
    { title: 'เมื่อ', dataIndex: 'created_at', width: 150, render: (v: string) => dateTime(v) },
  ];

  const threadColumns = (mode: Mode) => [
    {
      title: 'กระทู้',
      key: 'title',
      width: 300,
      render: (_: unknown, r: Db.AdminCommunityThread) => (
        <>
          <Typography.Text strong ellipsis={{ tooltip: r.title }} className="block">
            {r.title}
          </Typography.Text>
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} className="!mb-0 !text-xs">
            {r.body || '—'}
          </Typography.Paragraph>
          {editedLink(r)}
        </>
      ),
    },
    { title: 'หมวด', dataIndex: 'category_name', width: 110 },
    {
      title: 'ร้านที่แท็ก',
      key: 'bar',
      width: 150,
      render: (_: unknown, r: Db.AdminCommunityThread) => r.bar?.name ?? '-',
    },
    {
      title: 'ตอบ / ถูกใจ',
      key: 'stats',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, r: Db.AdminCommunityThread) => (
        <>
          <div>{`${r.reply_count} / ${r.like_count}`}</div>
          <ExcludedLikes count={r.excluded_like_count} />
        </>
      ),
    },
    ...common,
    actions(mode),
  ];

  const commentColumns = (mode: Mode) => [
    {
      title: 'ความคิดเห็น',
      key: 'body',
      width: 320,
      render: (_: unknown, r: Db.AdminCommunityComment) => (
        <>
          <Typography.Paragraph ellipsis={{ rows: 3 }} className="!mb-0">
            {r.body}
          </Typography.Paragraph>
          <Typography.Text type="secondary" ellipsis className="block !text-xs">
            ในกระทู้: {r.thread_title}
          </Typography.Text>
          <Space size={8}>
            <Typography.Text type="secondary" className="!text-xs">
              ถูกใจ {r.like_count}
            </Typography.Text>
            <ExcludedLikes count={r.excluded_like_count} />
          </Space>
          {editedLink(r)}
        </>
      ),
    },
    ...common,
    actions(mode),
  ];

  const table = <T extends Row>(rows: T[], columns: object[], loading: boolean, empty: string) => (
    <Table<T>
      rowKey="id"
      loading={loading}
      dataSource={rows}
      pagination={{ pageSize: PAGE_SIZE }}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: empty }}
      columns={columns}
    />
  );

  return (
    <PageContainer
      title="ชุมชน"
      subTitle="กระทู้และความคิดเห็นที่ถูกรายงาน · ปักหมุดเป็นของผู้ใช้แต่ละคน (ส่วนตัว) แอดมินไม่ต้องจัดการ"
    >
      <LoadError
        error={threads.error ?? comments.error}
        onRetry={() => void (threads.refetch(), comments.refetch())}
      />
      <Tabs
        items={[
          {
            key: 'threads-reported',
            label: `กระทู้ถูกรายงาน (${t.reported.length})`,
            children: table(
              t.reported,
              threadColumns('reported'),
              threads.isLoading,
              'ไม่มีกระทู้ที่ถูกรายงาน',
            ),
          },
          {
            key: 'comments-reported',
            label: `ความเห็นถูกรายงาน (${c.reported.length})`,
            children: table(
              c.reported,
              commentColumns('reported'),
              comments.isLoading,
              'ไม่มีความเห็นที่ถูกรายงาน',
            ),
          },
          {
            key: 'threads-live',
            label: `กระทู้ทั้งหมด (${t.live.length})`,
            children: table(t.live, threadColumns('live'), threads.isLoading, 'ยังไม่มีกระทู้'),
          },
          {
            key: 'team',
            label: `โพสต์ทีมร้าน (${t.team.length + c.team.length})`,
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  className="!mb-4"
                  title="ตรวจโฆษณา/โปรโมชันเครื่องดื่มแอลกอฮอล์ (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.30/32) และการพูดถึงร้านอื่นในทางเสีย — ซ่อนหรือลบพร้อมเหตุผล เจ้าของโพสต์ได้รับแจ้งเตือน"
                />
                <Typography.Title level={5}>กระทู้</Typography.Title>
                {table(t.team, threadColumns('live'), threads.isLoading, 'ไม่มีกระทู้จากทีมร้าน')}
                <Typography.Title level={5}>ความคิดเห็น</Typography.Title>
                {table(
                  c.team,
                  commentColumns('live'),
                  comments.isLoading,
                  'ไม่มีความเห็นจากทีมร้าน',
                )}
              </>
            ),
          },
          {
            key: 'hidden',
            label: `ซ่อน / ลบแล้ว (${t.hidden.length + c.hidden.length})`,
            children: (
              <>
                <Typography.Title level={5}>กระทู้</Typography.Title>
                {table(
                  t.hidden,
                  threadColumns('hidden'),
                  threads.isLoading,
                  'ไม่มีกระทู้ที่ถูกซ่อน',
                )}
                <Typography.Title level={5}>ความคิดเห็น</Typography.Title>
                {table(
                  c.hidden,
                  commentColumns('hidden'),
                  comments.isLoading,
                  'ไม่มีความเห็นที่ถูกซ่อน',
                )}
              </>
            ),
          },
        ]}
      />
      <HistoryModal row={history} urls={urls} onClose={() => setHistory(null)} />
      <ModerateModal
        target={pending}
        busy={act.isPending}
        onSubmit={(reason) =>
          pending && moderate(pending.row, pending.action, reason, () => setPending(null))
        }
        onCancel={() => setPending(null)}
      />
    </PageContainer>
  );
}

/** "+N ทีมร้าน (ไม่นับ)" — ถูกใจจากทีมของร้านที่แท็กกระทู้ ไม่นับใน like_count */
function ExcludedLikes({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Tooltip title="ถูกใจจากทีมของร้านที่แท็ก — ไม่นับในยอดถูกใจและร้านมาแรง">
      <Typography.Text type="secondary" className="!text-xs">
        +{count} ทีมร้าน (ไม่นับ)
      </Typography.Text>
    </Tooltip>
  );
}

/** แยกแถวตามแท็บ: ถูกรายงาน (ยังแสดงอยู่ + มีรายงานค้าง) · แสดงอยู่ทั้งหมด · โพสต์ทีมร้าน (แสดงอยู่) · ซ่อน/ลบแล้ว */
function split<T extends Row>(rows: T[]) {
  return {
    reported: rows.filter((r) => r.open_report_count > 0 && r.status === 'PUBLISHED'),
    live: rows.filter((r) => r.status === 'PUBLISHED'),
    team: rows.filter((r) => !!r.team_bar && r.status === 'PUBLISHED'),
    hidden: rows.filter((r) => r.status === 'HIDDEN' || r.status === 'REMOVED'),
  };
}

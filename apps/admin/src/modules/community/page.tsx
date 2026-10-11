import { PageContainer } from '@ant-design/pro-components';
import type { Db } from '@nightout/types';
import { Button, Popconfirm, Space, Table, Tabs, Tag, Typography } from 'antd';
import { useMemo } from 'react';
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
import { MediaCell } from './components/mediaCell';

type Action = 'KEEP' | 'HIDE' | 'REMOVE' | 'RESTORE';
type Row = Db.AdminCommunityThread | Db.AdminCommunityComment;
type Mode = 'reported' | 'live' | 'hidden';
const isThread = (r: Row): r is Db.AdminCommunityThread => 'title' in r;
const DONE: Record<Action, string> = {
  KEEP: 'เก็บไว้ และปิดรายงานแล้ว',
  HIDE: 'ซ่อนแล้ว — เจ้าของได้รับแจ้งเตือน',
  REMOVE: 'ลบแล้ว — เจ้าของได้รับแจ้งเตือน',
  RESTORE: 'แสดงอีกครั้งแล้ว',
};

/** ชุมชน — กระทู้/ความเห็นที่ถูกรายงาน · ซ่อน / ลบ / แสดงอีกครั้ง (audit log + แจ้งเจ้าของ) */
export function CommunityPage() {
  const threads = useCommunityThreads();
  const comments = useCommunityComments();
  const act = useAdminAction();

  const moderate = (r: Row, action: Action) =>
    act.mutate({
      ...(isThread(r)
        ? moderateThreadAction(r.id, { action })
        : moderateCommentAction(r.id, { action })),
      success: DONE[action],
    });

  const t = useMemo(() => split(threads.data ?? []), [threads.data]);
  // ไฟล์แนบทุกแถว ขอ signed URL ครั้งเดียว
  const mediaPaths = useMemo(
    () =>
      [...(threads.data ?? []), ...(comments.data ?? [])].flatMap((r) =>
        r.media.flatMap((m) => (m.thumb_path ? [m.path, m.thumb_path] : [m.path])),
      ),
    [threads.data, comments.data],
  );
  const { data: urls = {} } = useMediaUrls(mediaPaths);
  const c = useMemo(() => split(comments.data ?? []), [comments.data]);

  const actions = (mode: Mode) => ({
    title: '',
    key: 'a',
    fixed: 'right' as const,
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
          <Button loading={act.isPending} onClick={() => moderate(r, 'HIDE')}>
            ซ่อน
          </Button>
          <Popconfirm
            title="ลบถาวรจากชุมชน?"
            okText="ลบ"
            cancelText="ยกเลิก"
            okButtonProps={{ danger: true }}
            onConfirm={() => moderate(r, 'REMOVE')}
          >
            <Button danger loading={act.isPending}>
              ลบ
            </Button>
          </Popconfirm>
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
      dataIndex: 'author_name',
      width: 140,
      render: (v: string | null) => v ?? 'บัญชีถูกลบ',
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
      render: (_: unknown, r: Db.AdminCommunityThread) => (
        <div className="max-w-md">
          <div className="font-medium">{r.title}</div>
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} className="!mb-0 !text-xs">
            {r.body || '—'}
          </Typography.Paragraph>
        </div>
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
      width: 100,
      render: (_: unknown, r: Db.AdminCommunityThread) => `${r.reply_count} / ${r.like_count}`,
    },
    ...common,
    actions(mode),
  ];

  const commentColumns = (mode: Mode) => [
    {
      title: 'ความคิดเห็น',
      key: 'body',
      render: (_: unknown, r: Db.AdminCommunityComment) => (
        <div className="max-w-md">
          <Typography.Paragraph ellipsis={{ rows: 3 }} className="!mb-0">
            {r.body}
          </Typography.Paragraph>
          <div className="text-xs opacity-60">ในกระทู้: {r.thread_title}</div>
        </div>
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
      scroll={{ x: 1200 }}
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
    </PageContainer>
  );
}

/** แยกแถวตามแท็บ: ถูกรายงาน (ยังแสดงอยู่ + มีรายงานค้าง) · แสดงอยู่ทั้งหมด · ซ่อน/ลบแล้ว */
function split<T extends Row>(rows: T[]) {
  return {
    reported: rows.filter((r) => r.open_report_count > 0 && r.status === 'PUBLISHED'),
    live: rows.filter((r) => r.status === 'PUBLISHED'),
    hidden: rows.filter((r) => r.status === 'HIDDEN' || r.status === 'REMOVED'),
  };
}

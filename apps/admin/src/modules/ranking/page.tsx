import { PageContainer } from '@ant-design/pro-components';
import { ArrowDown, ArrowsClockwise, ArrowUp } from '@phosphor-icons/react';
import type { RecomputeRankingResult } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { TierStars } from '@nightout/ui';
import { Button, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { PAGE_SIZE } from '@/configs/constants';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { dateTime } from '@/ui/utils/format';
import { CATEGORY } from '@/ui/utils/labels';
import { recomputeRankingAction, useBarAreas, useRanking } from './api';
import { RuleList } from '@/ui/components/RuleList';

type Row = Db.AdminRanking & { rank: number; area?: Db.AdminBarArea };

const num = (v: number | null | undefined) => (v === null || v === undefined ? null : Number(v));
const pts = (v: number | null | undefined, max: number) => {
  const n = num(v);
  return n === null ? '-' : `${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}/${max}`;
};
/** ร้านที่ยังไม่มีเช็กอินใน 90 วัน: คะแนนรวม = (รีวิว + Safety) ขยายจากเต็ม 70 เป็น 100 (rankingScore().rescaled) */
const isRescaled = (b: Db.AdminRanking) => b.total_score !== null && num(b.checkin_score) === 0;

/**
 * /ranking — คะแนนรวมของทุกร้านที่แสดงอยู่ (รอบสัปดาห์ล่าสุด) แยกส่วนรีวิว / เช็กอิน / Safety + โหวตสัปดาห์/เดือน
 * กรองตามประเภทร้าน ย่าน อำเภอ/เขต และจังหวัด (จากหมุดร้าน · admin_bar_areas) · ปุ่ม "คำนวณใหม่" = คำนวณทันทีเหมือน job ทุกคืน · การโปรโมทไม่มีผลต่อคะแนน
 */
export function RankingPage() {
  const { data, isLoading, error, refetch } = useRanking();
  const areas = useBarAreas();
  const act = useAdminAction();

  const rows = useMemo<Row[]>(() => {
    const byBar = new Map((areas.data ?? []).map((a) => [a.bar_id, a]));
    return [...(data ?? [])]
      .sort(
        (a, b) =>
          (num(b.total_score) ?? -1) - (num(a.total_score) ?? -1) ||
          a.name.localeCompare(b.name, 'th'),
      )
      .map((b, i) => ({ ...b, rank: i + 1, area: byBar.get(b.id) }));
  }, [data, areas.data]);
  const districts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of rows) if (b.district) seen.set(b.district.id, b.district.name_th);
    return [...seen]
      .map(([value, text]) => ({ value, text }))
      .sort((a, b) => a.text.localeCompare(b.text, 'th'));
  }, [rows]);
  /** ตัวกรองจากพื้นที่ของร้านที่อยู่ในตาราง (ไม่แสดงพื้นที่ที่ไม่มีร้าน) */
  const areaFilters = (
    code: 'province_code' | 'amphoe_code',
    name: 'province_th' | 'amphoe_th',
  ) => {
    const seen = new Map<string, string>();
    for (const b of rows) if (b.area) seen.set(b.area[code], b.area[name]);
    return [...seen]
      .map(([value, text]) => ({ value, text }))
      .sort((a, b) => a.text.localeCompare(b.text, 'th'));
  };
  const lastComputed = rows.reduce<string | null>(
    (max, b) => (b.computed_at && (!max || b.computed_at > max) ? b.computed_at : max),
    null,
  );

  const recompute = () =>
    act.mutate({
      ...recomputeRankingAction(),
      success: (r) => `คำนวณใหม่แล้ว ${(r as RecomputeRankingResult).bars} ร้าน`,
    });

  return (
    <PageContainer
      title="ดาว / อันดับ"
      content={
        <RuleList
          rules={[
            'คะแนนรวม 100 = รีวิว 50 + เช็กอิน 30 (90 วันล่าสุด) + Safety 20',
            'ร้านที่ยังไม่มีเช็กอินใน 90 วัน คิดจากรีวิว + Safety แล้วขยายเป็นเต็ม 100',
            'ร้านที่รีวิวน้อยกว่า 5 เป็นร้านใหม่ ยังไม่มีดาวและไม่ติดอันดับ',
            'คำนวณอัตโนมัติทุกคืน 00:05 หรือกด "คำนวณใหม่"',
            { tone: 'check', text: 'การโปรโมทไม่มีผลต่อคะแนน' },
          ]}
        />
      }
      extra={
        <Space wrap>
          <Typography.Text type="secondary">
            {lastComputed ? `คำนวณล่าสุด ${dateTime(lastComputed)}` : 'ยังไม่เคยคำนวณ'}
          </Typography.Text>
          <Button
            type="primary"
            icon={<ArrowsClockwise size={16} />}
            loading={act.isPending}
            onClick={recompute}
          >
            คำนวณใหม่
          </Button>
        </Space>
      }
    >
      <LoadError
        error={error ?? areas.error}
        onRetry={() => {
          void refetch();
          void areas.refetch();
        }}
      />
      <Table<Row>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{ x: 1770 }}
        columns={[
          {
            title: 'อันดับ',
            dataIndex: 'rank',
            width: 72,
            render: (v: number) => <span className="tabular-nums">{v}</span>,
          },
          { title: 'ร้าน', dataIndex: 'name', width: 200 },
          {
            title: 'ประเภท',
            dataIndex: 'category',
            width: 120,
            filters: Object.entries(CATEGORY).map(([value, text]) => ({ text, value })),
            onFilter: (v, b) => b.category === v,
            render: (c: Db.AdminRanking['category']) => CATEGORY[c],
          },
          {
            title: 'ย่าน',
            key: 'district',
            width: 130,
            filters: districts,
            onFilter: (v, b) => b.district_id === v,
            render: (_, b) => b.district?.name_th ?? '-',
          },
          {
            title: 'อำเภอ / เขต',
            key: 'amphoe',
            width: 140,
            filters: areaFilters('amphoe_code', 'amphoe_th'),
            filterSearch: true,
            onFilter: (v, b) => b.area?.amphoe_code === v,
            render: (_, b) => b.area?.amphoe_th ?? '-',
          },
          {
            title: 'จังหวัด',
            key: 'province',
            width: 130,
            filters: areaFilters('province_code', 'province_th'),
            filterSearch: true,
            onFilter: (v, b) => b.area?.province_code === v,
            render: (_, b) => b.area?.province_th ?? '-',
          },
          {
            title: 'อันดับในประเภท / ย่าน',
            key: 'ranks',
            width: 150,
            render: (_, b) => (
              <span className="tabular-nums">
                {b.rank_in_category ?? '-'} / {b.rank_in_district ?? '-'}
              </span>
            ),
          },
          {
            title: 'ดาว',
            key: 'stars',
            width: 130,
            render: (_, b) => {
              if (b.is_new || !b.stars) return <Tag>ร้านใหม่</Tag>;
              const up = b.prev_stars !== null && b.stars > b.prev_stars;
              const down = b.prev_stars !== null && b.stars < b.prev_stars;
              return (
                <span className="inline-flex items-center gap-1">
                  <TierStars stars={b.stars} />
                  {(up || down) && (
                    <Tooltip title={`รอบก่อน ${b.prev_stars} ดาว`}>
                      <Typography.Text
                        type={up ? 'success' : 'danger'}
                        className="inline-flex"
                        aria-label={`${up ? 'ขึ้น' : 'ลง'}จาก ${b.prev_stars} ดาว`}
                      >
                        {up ? (
                          <ArrowUp size={14} weight="bold" />
                        ) : (
                          <ArrowDown size={14} weight="bold" />
                        )}
                      </Typography.Text>
                    </Tooltip>
                  )}
                </span>
              );
            },
          },
          {
            title: 'คะแนนรวม',
            key: 'total',
            width: 140,
            render: (_, b) =>
              b.total_score === null ? (
                '-'
              ) : (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span className="font-semibold tabular-nums">{num(b.total_score)}</span>
                  {isRescaled(b) && (
                    <Tooltip title="ยังไม่มีเช็กอินใน 90 วัน — คิดจากรีวิว + Safety (เต็ม 70) แล้วขยายเป็นเต็ม 100">
                      <Tag className="!m-0 cursor-help">ขยายจาก 70</Tag>
                    </Tooltip>
                  )}
                </span>
              ),
          },
          {
            title: 'รีวิว',
            key: 'review',
            width: 150,
            render: (_, b) => (
              <span className="flex flex-col">
                <span className="tabular-nums">{pts(b.review_score, 50)}</span>
                <Typography.Text type="secondary" className="text-xs tabular-nums">
                  {b.rating_avg === null ? '-' : Number(b.rating_avg).toFixed(1)} ({b.rating_count}{' '}
                  รีวิว)
                </Typography.Text>
              </span>
            ),
          },
          {
            title: 'เช็กอิน',
            key: 'checkin',
            width: 100,
            render: (_, b) => <span className="tabular-nums">{pts(b.checkin_score, 30)}</span>,
          },
          {
            title: 'โหวต สัปดาห์ / เดือน',
            key: 'votes',
            width: 150,
            render: (_, b) => (
              <span className="tabular-nums">
                {b.votes_week} / {b.votes_month}
              </span>
            ),
          },
          {
            title: 'Safety',
            key: 'safety',
            width: 120,
            render: (_, b) => (
              <span className="flex flex-col">
                <span className="tabular-nums">{pts(b.safety_score, 20)}</span>
                <Typography.Text type="secondary" className="text-xs tabular-nums">
                  {b.safety_percent === null ? '-' : `${num(b.safety_percent)}%`}
                </Typography.Text>
              </span>
            ),
          },
          {
            title: 'โปรโมท',
            dataIndex: 'is_promoted',
            width: 180,
            render: (v: boolean) => (v ? <Tag color="gold">โฆษณา (ไม่มีผลต่อคะแนน)</Tag> : '-'),
          },
        ]}
      />
    </PageContainer>
  );
}

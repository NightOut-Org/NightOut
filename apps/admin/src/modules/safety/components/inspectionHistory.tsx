import type { Db } from '@nightout/types';
import { Table, Tag, Typography } from 'antd';
import { Link } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { LoadError } from '@/ui/components/LoadError';
import { SlipImage } from '@/ui/components/SlipImage';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { useSafetyInspections } from '../api';
import { SAFETY_CHECK_TAG, SAFETY_VALUE_TEXT } from '../utils/labels';

const valueText = (v: Db.Enums<'safety_value'> | null) => (v ? SAFETY_VALUE_TEXT[v] : 'ไม่ระบุ');

/** ประวัติการลงพื้นที่ตรวจ (ทุกร้าน หรือเฉพาะร้านที่กรอง) — ผู้ตรวจ · วันที่ · ผลรวม · คะแนนก่อน→หลัง · ขยายดูรายข้อ + รูป */
export function InspectionHistory({ barId }: { barId: string | null }) {
  const { data, isLoading, error, refetch } = useSafetyInspections(barId);
  return (
    <>
      <LoadError error={error} onRetry={() => void refetch()} />
      <Table<Db.AdminSafetyInspection>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{ x: 820 }}
        locale={{ emptyText: 'ยังไม่มีประวัติการตรวจ' }}
        expandable={{
          expandedRowRender: (r) => (
            <ul className="m-0 list-none space-y-2 p-0">
              {r.items.map((i) => (
                <li key={i.feature_key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{i.name_th}</span>
                  <StatusTag map={SAFETY_CHECK_TAG} value={i.result} />
                  {i.value_before !== i.value_after && (
                    <span className="text-xs opacity-80">
                      {valueText(i.value_before)} → {valueText(i.value_after)}
                    </span>
                  )}
                  {i.note && <span className="text-xs opacity-80">· {i.note}</span>}
                  {i.photo_paths.map((p) => (
                    <SlipImage key={p} bucket="bar-verifications" path={p} />
                  ))}
                </li>
              ))}
            </ul>
          ),
        }}
        columns={[
          { title: 'วันที่ลงพื้นที่', dataIndex: 'inspected_at', width: 170, render: (v: string) => dateTime(v) },
          ...(barId
            ? []
            : [{ title: 'ร้าน', key: 'bar', width: 180, render: (_: unknown, r: Db.AdminSafetyInspection) => r.bar.name }]),
          { title: 'ผู้ตรวจ', dataIndex: 'inspector_name', width: 150 },
          {
            title: 'ผลตรวจ',
            key: 'result',
            width: 230,
            render: (_, r) => (
              <span className="flex flex-wrap gap-1">
                <Tag color="green" className="!m-0">
                  ผ่าน {r.pass_count}
                </Tag>
                <Tag color="red" className="!m-0">
                  ไม่พบ {r.fail_count}
                </Tag>
                <Tag className="!m-0">ไม่ได้ตรวจ {r.na_count}</Tag>
              </span>
            ),
          },
          {
            title: 'Safety Score',
            key: 'score',
            width: 120,
            render: (_, r) => (
              <span className="tabular-nums">
                {r.safety_score_before ?? '-'} → {r.safety_score_after ?? '-'}
              </span>
            ),
          },
          { title: 'หมายเหตุ', dataIndex: 'note', ellipsis: true, render: (v: string | null) => v ?? '-' },
        ]}
      />
      <Typography.Text type="secondary" className="mt-2 block text-xs">
        ประวัตินี้เฉพาะการลงพื้นที่ — การกด “ยืนยันแล้ว” (ตรวจหลักฐาน ไม่ได้ลงพื้นที่) ดูได้ที่{' '}
        <Link to="/audit-logs">Audit Log</Link>
      </Typography.Text>
    </>
  );
}

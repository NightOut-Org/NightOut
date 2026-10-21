import type { Db } from '@nightout/types';
import { Descriptions, Drawer, Tag } from 'antd';
import { PinLegend, PinMap } from '@/ui/components/PinMap';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { LOCATION_REQUEST_STATUS, LOCATION_SOURCE, realPinOf } from '@/ui/utils/location';
import { LocationCompare, type CompareColumn } from './locationCompare';

/** ค่าที่ร้านขอ (คอลัมน์ของแถว) — แยกจาก previous / applied ที่เป็น jsonb */
const requestedOf = (r: Db.AdminBarLocationRequest): Db.BarLocationFields => ({
  lat: r.lat,
  lng: r.lng,
  address: r.address,
  parking_note: r.parking_note,
  transit_line: r.transit_line,
  transit_station: r.transit_station,
  transit_walk_minutes: r.transit_walk_minutes,
});

/**
 * ประวัติ 1 แถว (ดูอย่างเดียว) — หมุดก่อน (เทา) เทียบหมุดหลัง (ทอง) + ตาราง ก่อน / ร้านขอ / ใช้จริง
 * "ใช้จริง" แสดงเมื่อแอดมินปรับก่อนอนุมัติ หรือแอดมินตั้งแทนร้าน
 */
export function HistoryDrawer({ request: r, onClose }: { request: Db.AdminBarLocationRequest; onClose: () => void }) {
  const requested = requestedOf(r);
  const fromMerchant = r.source === 'MERCHANT';
  const applied = r.applied ?? (fromMerchant ? null : requested);
  const showApplied = !!applied && (!fromMerchant || r.admin_edited);
  const after = applied ?? requested;

  const columns: CompareColumn[] = [{ key: 'before', title: 'ก่อน', fields: r.previous }];
  if (fromMerchant) columns.push({ key: 'request', title: 'ร้านขอ', fields: requested, against: 0 });
  if (showApplied) {
    columns.push(
      fromMerchant
        ? { key: 'applied', title: 'ใช้จริง', fields: applied, against: 1, changedLabel: 'แอดมินปรับ' }
        : { key: 'applied', title: 'ใช้จริง', fields: applied, against: 0 },
    );
  }

  return (
    <Drawer
      open
      onClose={onClose}
      size="large"
      destroyOnHidden
      title={
        <span className="flex flex-wrap items-center gap-2">
          ประวัติตำแหน่ง {r.bar.name}
          <StatusTag map={LOCATION_REQUEST_STATUS} value={r.status} />
        </span>
      }
    >
      <div className="space-y-5">
        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2 }}
          items={[
            { key: 'source', label: 'ที่มา', children: LOCATION_SOURCE[r.source] },
            {
              key: 'status',
              label: 'ผล',
              children: (
                <span className="inline-flex flex-wrap gap-1">
                  <StatusTag map={LOCATION_REQUEST_STATUS} value={r.status} />
                  {r.admin_edited && (
                    <Tag color="gold" className="!m-0">
                      แอดมินปรับ
                    </Tag>
                  )}
                </span>
              ),
            },
            { key: 'created', label: 'ส่งเมื่อ', children: dateTime(r.created_at) },
            { key: 'by', label: 'ส่งโดย', children: r.requested_by?.display_name ?? '-' },
            { key: 'reviewed', label: 'ปิดเมื่อ', children: r.reviewed_at ? dateTime(r.reviewed_at) : '-' },
            { key: 'reviewer', label: 'ตรวจโดย', children: r.reviewed_by?.display_name ?? '-' },
            {
              key: 'reason',
              label: r.status === 'REJECTED' ? 'เหตุผลที่ตีกลับ' : 'เหตุผล/หมายเหตุ',
              span: 'filled',
              children: r.reason ?? '-',
            },
          ]}
        />
        <div>
          <PinMap current={realPinOf(r.previous)} value={realPinOf(after)} />
          <div className="mt-2">
            <PinLegend oldLabel="ก่อน" newLabel={showApplied ? 'ใช้จริง' : 'ร้านขอ'} />
          </div>
        </div>
        <LocationCompare columns={columns} />
      </div>
    </Drawer>
  );
}

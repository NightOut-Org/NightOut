import type { Db } from '@nightout/types';
import { Alert, Button, Drawer, Tag, Timeline, Typography } from 'antd';
import { useState } from 'react';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { BAR_STATUS, BOOKING_STATUS, type TagLabel } from '@/ui/utils/labels';
import type { BlacklistMode } from '../modal/blacklistModal';

/** ใครบันทึก "ไม่มีโต๊ะ" (bar_strikes.source) */
const STRIKE_SOURCE: Record<Db.AdminBarStrike['source'], TagLabel> = {
  TEAM: { text: 'ทีมร้านแจ้ง', color: 'default' },
  ADMIN: { text: 'ข้อร้องเรียนลูกค้า', color: 'purple' },
};

/**
 * ประวัติ "ร้านไม่มีโต๊ะให้ลูกค้า" ของ 1 ร้าน (ใหม่สุดก่อน) — ติด Blacklist อยู่แสดงกล่อง Blacklist ก่อน
 * ปุ่ม Blacklist / ปลด ที่หัว Drawer: เปิดจากลิงก์แจ้งเตือน (?bar=<id>) แล้วตัดสินใจได้เลย
 * จำร้านล่าสุดไว้แสดงระหว่างปิด Drawer (เนื้อหาไม่หายก่อนเลื่อนออก)
 */
export function StrikeDrawer({
  bar,
  onClose,
  onAction,
}: {
  bar: Db.AdminBarBlacklist | null;
  onClose: () => void;
  onAction: (bar: Db.AdminBarBlacklist, mode: BlacklistMode) => void;
}) {
  const [shown, setShown] = useState(bar);
  if (bar && bar !== shown) setShown(bar);
  // Blacklist ได้เฉพาะร้านที่เคยเปิดแสดงแล้ว (BAR_NOT_BLACKLISTABLE)
  const canBlacklist = shown?.status === 'APPROVED' || shown?.status === 'SUSPENDED';
  return (
    <Drawer
      open={!!bar}
      onClose={onClose}
      size="large"
      destroyOnHidden
      title={shown ? `${shown.name} ไม่มีโต๊ะให้ลูกค้า ${shown.strike_count} ครั้ง` : ''}
      extra={
        shown &&
        (shown.is_blacklisted ? (
          <Button onClick={() => onAction(shown, 'lift')}>ปลด Blacklist</Button>
        ) : (
          <Button danger disabled={!canBlacklist} onClick={() => onAction(shown, 'blacklist')}>
            Blacklist
          </Button>
        ))
      }
    >
      {shown && (
        <div className="space-y-5">
          {shown.is_blacklisted && (
            <Alert
              type="error"
              showIcon
              title="ติด Blacklist — ซ่อนจากเว็บและปิดรับจองใหม่"
              description={
                <dl className="mt-1 grid grid-cols-[72px_1fr] gap-y-1 text-sm">
                  <dt className="text-muted">ตั้งแต่</dt>
                  <dd>{shown.blacklisted_at ? dateTime(shown.blacklisted_at) : '-'}</dd>
                  <dt className="text-muted">โดย</dt>
                  <dd>{shown.blacklisted_by?.display_name ?? '-'}</dd>
                  <dt className="text-muted">เหตุผล</dt>
                  <dd className="whitespace-pre-line">{shown.blacklist_reason ?? '-'}</dd>
                </dl>
              }
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusTag map={BAR_STATUS} value={shown.status} />
            <span>
              ใน 90 วันล่าสุด{' '}
              <span className="font-medium tabular-nums">{shown.strike_count_90d}</span> ครั้ง
            </span>
            {shown.last_strike_at && (
              <Typography.Text type="secondary">
                (ล่าสุด {dateTime(shown.last_strike_at)})
              </Typography.Text>
            )}
          </div>
          {shown.strikes.length === 0 ? (
            <Typography.Text type="secondary">ยังไม่มีประวัติไม่มีโต๊ะให้ลูกค้า</Typography.Text>
          ) : (
            <>
              <Timeline
                items={shown.strikes.map((s) => ({
                  key: s.id,
                  color: 'red',
                  content: <StrikeItem strike={s} />,
                }))}
              />
              {/* view ส่งประวัติมาสูงสุด 50 ครั้งล่าสุด */}
              {shown.strike_count > shown.strikes.length && (
                <Typography.Text type="secondary" className="text-sm">
                  แสดง {shown.strikes.length} ครั้งล่าสุดจากทั้งหมด {shown.strike_count} ครั้ง
                </Typography.Text>
              )}
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

function StrikeItem({ strike: s }: { strike: Db.AdminBarStrike }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Typography.Text strong className="tabular-nums">
          {s.booking_code}
        </Typography.Text>
        <span className="text-sm tabular-nums">
          นัด {dateTime(s.booking_datetime)} ({s.pax} คน)
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <StatusTag map={BOOKING_STATUS} value={s.booking_status} />
        <Tag color={STRIKE_SOURCE[s.source].color}>{STRIKE_SOURCE[s.source].text}</Tag>
      </div>
      {s.note && (
        <Typography.Paragraph className="!mb-0 whitespace-pre-line text-sm">
          {s.note}
        </Typography.Paragraph>
      )}
      <Typography.Text type="secondary" className="text-xs">
        แจ้งโดย {s.reported_by ?? '-'} เมื่อ {dateTime(s.created_at)}
      </Typography.Text>
    </div>
  );
}

import { ArrowsLeftRight, CaretRight, Chair, SquaresFour } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import { checkInWindow } from '@nightout/utils';
import { App, Button, Drawer, Grid, Modal, Popconfirm, Tag } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BOOKING_STATUS } from '@/ui/utils/format';
import { setBookingStatus, setTableOccupancy } from '../api';
import { PR_LABEL, bookingWho, hhmm, isHolding, type BoardTableRef } from '../utils/board';
import { StatusPill } from './floorLegend';
import { TimingLine } from './tableCard';
import { MetaList } from '@/ui/components/metaList';

/** การ์ดการจองปัจจุบันของโต๊ะ (ไม่มียอดเงิน / เบอร์โทร) */
function CurrentBooking({ booking, now }: { booking: C.TableBoardBooking; now: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <b className="text-[17px] tabular-nums">{hhmm(booking.booking_datetime)}</b>
        <span className="min-w-0 flex-1 truncate font-medium">{bookingWho(booking)}</span>
        <Tag color={BOOKING_STATUS[booking.status].color} className="!m-0">
          {BOOKING_STATUS[booking.status].label}
        </Tag>
      </div>
      <span className="text-xs text-muted">รหัส {booking.code}</span>
      {booking.status !== 'CHECKED_IN' ? (
        <TimingLine booking={booking} now={now} />
      ) : (
        booking.checked_in_at && <span className="text-xs text-muted">เช็กอิน {hhmm(booking.checked_in_at)}</span>
      )}
      {booking.request_pr && <span className="text-[13px]">ขอ PR: {PR_LABEL[booking.request_pr]}</span>}
      {booking.promotion_title && <span className="text-[13px] text-gold-text">โปรโมชัน: {booking.promotion_title}</span>}
      {booking.customer_note && <span className="text-[13px] text-muted">หมายเหตุ: {booking.customer_note}</span>}
    </div>
  );
}

/**
 * แผงโต๊ะ (มือถือขึ้นจากล่าง · Desktop ออกขวา) — การจองปัจจุบัน + ปุ่มลัด (เช็กอิน / ลูกค้ากลับแล้ว / ตั้งกำลังใช้-ว่าง / ย้ายโต๊ะ)
 * + รายการจองคืนนี้ของโต๊ะนี้ · ข้อมูลมาจากผังล่าสุดทุกครั้ง (โพลไม่ปิดแผง)
 */
export function TableDrawer({
  target,
  bookings,
  current,
  now,
  onClose,
  onDone,
  onMove,
  onOccupy,
}: {
  target: BoardTableRef | null;
  /** การจองคืนนี้ของโต๊ะนี้ */
  bookings: C.TableBoardBooking[];
  current: C.TableBoardBooking | null;
  now: number;
  onClose: () => void;
  /** หลังเขียนสำเร็จ/ล้มเหลว — โหลดผังใหม่ */
  onDone: () => void;
  /** เริ่มแตะเพื่อย้าย (ปิดแผงแล้วให้แตะโต๊ะปลายทาง) */
  onMove: (b: C.TableBoardBooking) => void;
  onOccupy: (t: C.TableBoardTable) => void;
}) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const bp = Grid.useBreakpoint();
  const desktop = !!bp.lg;
  const [busy, setBusy] = useState<'checkin' | 'complete' | 'release' | null>(null);
  const [confirmCheckIn, setConfirmCheckIn] = useState(false);
  const table = target?.table;

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<unknown>, ok: string) => {
    setBusy(kind);
    try {
      await fn();
      message.success(ok);
      return true;
    } catch (e) {
      message.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
      onDone();
    }
  };

  const win = current ? checkInWindow({ datetime: current.booking_datetime, autoCancelAt: current.auto_cancel_at }) : null;
  const tooEarly = !!win && now < win.opensAt.getTime();
  const tooLate = !!win && now >= win.closesAt.getTime();
  const manual = table?.status === 'IN_USE' && table.status_source === 'MANUAL';

  const detailLink = (b: C.TableBoardBooking) => (
    <Button size="large" block onClick={() => navigate(`/merchant/bookings/${b.id}`)}>
      ดูรายละเอียดการจอง
    </Button>
  );
  const moveButton = (b: C.TableBoardBooking) => (
    <Button size="large" block icon={<ArrowsLeftRight size={18} />} onClick={() => onMove(b)}>
      ย้ายโต๊ะ
    </Button>
  );

  return (
    <>
      <Drawer
        open={!!target}
        onClose={onClose}
        rootClassName="dark"
        placement={desktop ? 'right' : 'bottom'}
        size={desktop ? 420 : '85vh'}
        destroyOnHidden
        title={
          table && (
            <div className="flex items-center gap-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">โต๊ะ {table.name}</span>
                <span className="text-xs font-normal text-muted">
                  <MetaList
                    items={[
                      { icon: <SquaresFour weight="fill" />, label: 'โซน', value: target.zone.name },
                      { icon: <Chair weight="fill" />, label: 'ที่นั่ง', value: `${table.seats} ที่นั่ง` },
                    ]}
                  />
                </span>
              </span>
              <StatusPill status={table.status} />
            </div>
          )
        }
      >
        {table && target && (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2.5">
              {current && table.status === 'RESERVED' && (
                <>
                  <CurrentBooking booking={current} now={now} />
                  {current.status === 'CONFIRMED' && (
                    <>
                      <Button
                        type="primary"
                        size="large"
                        block
                        disabled={tooEarly || tooLate}
                        loading={busy === 'checkin'}
                        onClick={() => setConfirmCheckIn(true)}
                      >
                        เช็กอิน
                      </Button>
                      {win && (tooEarly || tooLate) && (
                        <span className="text-center text-xs text-muted">
                          {tooEarly ? `เช็กอินได้ตั้งแต่ ${hhmm(win.opensAt)}` : 'เลยเวลาเก็บโต๊ะแล้ว'}
                        </span>
                      )}
                    </>
                  )}
                  {moveButton(current)}
                  {detailLink(current)}
                </>
              )}
              {current && table.status === 'IN_USE' && !manual && (
                <>
                  <CurrentBooking booking={current} now={now} />
                  <Popconfirm
                    rootClassName="dark"
                    title={`ลูกค้าโต๊ะ ${table.name} กลับแล้ว?`}
                    description='การจองจะเป็น "เสร็จสิ้น" และโต๊ะว่างทันที'
                    okText="ปิดโต๊ะ"
                    cancelText="ยกเลิก"
                    onConfirm={() =>
                      run('complete', () => setBookingStatus(current.id, 'COMPLETED'), `ปิดโต๊ะ ${table.name} แล้ว`)
                    }
                  >
                    <Button type="primary" size="large" block loading={busy === 'complete'}>
                      ลูกค้ากลับแล้ว ปิดโต๊ะ
                    </Button>
                  </Popconfirm>
                  {moveButton(current)}
                  {detailLink(current)}
                </>
              )}
              {manual && table.occupancy && (
                <>
                  <div className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-3 text-[13px]">
                    <b className="text-[15px]">
                      กำลังใช้ (ไม่มีการจอง){table.occupancy.pax ? ` ${table.occupancy.pax} คน` : ''}
                    </b>
                    <span className="text-muted">
                      ตั้งแต่ {hhmm(table.occupancy.started_at)}
                      {table.occupancy.started_by_name ? ` โดย ${table.occupancy.started_by_name}` : ''}
                    </span>
                    {table.occupancy.note && <span>หมายเหตุ: {table.occupancy.note}</span>}
                  </div>
                  <Popconfirm
                    rootClassName="dark"
                    title={`ตั้งโต๊ะ ${table.name} เป็นว่าง?`}
                    okText="ตั้งเป็นว่าง"
                    cancelText="ยกเลิก"
                    onConfirm={() =>
                      run('release', () => setTableOccupancy(table.id, { in_use: false }), `โต๊ะ ${table.name} ว่างแล้ว`)
                    }
                  >
                    <Button type="primary" size="large" block loading={busy === 'release'}>
                      ตั้งเป็นว่าง
                    </Button>
                  </Popconfirm>
                </>
              )}
              {table.status === 'FREE' && (
                <>
                  <p className="m-0 text-sm text-muted">โต๊ะว่าง — ถ้ามีลูกค้านั่งโดยไม่มีการจองในระบบ ตั้งเป็นกำลังใช้ได้</p>
                  <Button type="primary" size="large" block onClick={() => onOccupy(table)}>
                    ตั้งเป็นกำลังใช้
                  </Button>
                </>
              )}
            </section>

            <section aria-labelledby="floor-drawer-tonight" className="flex flex-col gap-2">
              <h3 id="floor-drawer-tonight" className="m-0 text-sm font-semibold text-muted">
                คืนนี้ที่โต๊ะนี้
              </h3>
              {bookings.length === 0 ? (
                <p className="m-0 text-sm text-muted">ยังไม่มีการจองที่โต๊ะนี้คืนนี้</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center gap-2">
                      <Link
                        to={`/merchant/bookings/${b.id}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border px-2.5 text-[13px] text-text"
                      >
                        <b className="w-11 shrink-0 tabular-nums">{hhmm(b.booking_datetime)}</b>
                        <span className="min-w-0 flex-1 truncate">{bookingWho(b)}</span>
                        <Tag color={BOOKING_STATUS[b.status].color} className="!m-0 shrink-0">
                          {BOOKING_STATUS[b.status].label}
                        </Tag>
                        <CaretRight size={14} className="shrink-0 text-muted" aria-hidden />
                      </Link>
                      {isHolding(b.status) && (
                        <Button className="!h-11 shrink-0" onClick={() => onMove(b)} aria-label={`ย้ายโต๊ะ ${b.code}`}>
                          ย้าย
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <Modal
        open={confirmCheckIn && !!current}
        rootClassName="dark"
        title="ยืนยันเช็กอิน"
        okText="เช็กอิน"
        cancelText="ยกเลิก"
        confirmLoading={busy === 'checkin'}
        onCancel={() => setConfirmCheckIn(false)}
        onOk={async () => {
          if (!current || !table) return;
          const ok = await run(
            'checkin',
            () => setBookingStatus(current.id, 'CHECKED_IN'),
            `เช็กอินแล้ว — ${bookingWho(current)}`,
          );
          if (ok) setConfirmCheckIn(false);
        }}
        destroyOnHidden
      >
        {current && table && (
          <p className="m-0">
            {bookingWho(current)} รหัส {current.code} โต๊ะ {table.name} จะเป็น &quot;กำลังใช้&quot;
          </p>
        )}
      </Modal>
    </>
  );
}

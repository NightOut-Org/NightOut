import { ChatCircleDots, Clock, ClockClockwise, MapPin, ShareNetwork, Wallet } from '@phosphor-icons/react';
import { autoCancelAt, getBar, getBooking } from '@/services/data';
import { cancelBooking, extendBooking } from './api';
import { lineShareUrl, splitPayText } from './utils/shareText';
import { App, Button, Card, Timeline } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router';
import { BookingStatusTag } from '@/ui/components/bookingStatusTag';
import { DepositSummary } from '@/ui/components/depositCard';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';
import { useAuth } from '@/services/auth';
import { useDemo } from '@/hooks/useDemo';
import { BOOKING_STATUS, dateTime } from '@/ui/utils/format';
import { useNow } from '@/hooks/useNow';
import { NotFoundResult } from '@/ui/components/notFoundResult';
import {
  BOOKING_EXTENSION_MINUTES,
  canExtendBooking,
  checkInWindow,
  isReviewableStatus,
  TABLE_FEE_LABEL,
} from '@nightout/utils';
import { StatusChip } from '@/ui/components/statusChip';

/** เวลาที่เหลือ → "1 ชม. 5 นาที 3 วินาที" (หมดแล้ว = null) */
function countdownText(ms: number) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h > 0 ? `${h} ชม. ` : ''}${m} นาที ${s} วินาที`;
}

/** การจองที่จบไปแล้วโดยไม่ได้ไป — ไม่มีอะไรให้หาร */
const SPLIT_CLOSED_STATUSES: string[] = ['REJECTED', 'CANCELLED_BY_MERCHANT', 'CANCELLED_BY_CUSTOMER', 'EXPIRED'];

const hhmm = (d: Date | string) =>
  new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

/** เวลา "HH:mm น." — ถ้าคนละวันกับเวลาจอง ให้มีวันที่ด้วย */
const clockOf = (d: Date, bookingAt: string) =>
  d.toDateString() === new Date(bookingAt).toDateString() ? `${hhmm(d)} น.` : dateTime(d.toISOString());

/**
 * /bookings/:id — บัตรจอง + QR เช็กอิน
 * เก็บโต๊ะถึง auto_cancel_at (grace ของร้าน) · กด "ขอต่อเวลา 15 นาที" ได้ 1 ครั้ง ตั้งแต่ 15 นาทีก่อนเวลาจอง
 * · เลยเวลา → ปลดโต๊ะ (Forfeited) · เช็กอินได้ตั้งแต่ 3 ชม. ก่อนเวลาจอง (กติกาใน @nightout/utils booking-time)
 */
export function BookingDetailPage() {
  useDemo();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { message, modal } = App.useApp();
  const now = useNow(1000);
  const b = getBooking(id);
  const bar = b ? getBar(b.barId) : null;

  if (!b || !bar || b.userId !== user?.id) return <NotFoundResult title="ไม่พบการจองนี้" kind="booking" />;
  const zone = bar.zones.find((z) => z.id === b.zoneId);
  const table = zone?.tables.find((t) => t.id === b.tableId);
  const shareUrl = `${location.origin}/share/${b.shareToken}`;
  const canCancel = ['PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED'].includes(b.status);
  const releaseAt = autoCancelAt(b);
  const countdown = countdownText(releaseAt.getTime() - now);
  const timing = { status: b.status, datetime: b.datetime, autoCancelAt: releaseAt, extendedAt: b.extendedAt };
  const canExtend = canExtendBooking(timing, new Date(now));
  const extendOpensAt = new Date(b.datetime).getTime() - BOOKING_EXTENSION_MINUTES * 60_000;
  const checkInOpensAt = checkInWindow(timing).opensAt;
  const fee = Number(b.depositRequired ?? b.deposit?.amount) || 0;
  // หารจ่าย: มี Table Fee + ไปกัน 2 คนขึ้นไป + การจองยังไม่ถูกยกเลิก/ปฏิเสธ
  const canSplit = fee > 0 && b.pax > 1 && !SPLIT_CLOSED_STATUSES.includes(b.status);

  const askExtend = () => {
    const until = new Date(releaseAt.getTime() + BOOKING_EXTENSION_MINUTES * 60_000);
    modal.confirm({
      title: `ขอต่อเวลา ${BOOKING_EXTENSION_MINUTES} นาที?`,
      content: `ต่อได้ 1 ครั้ง เก็บโต๊ะถึง ${hhmm(until)} น.`,
      okText: 'ต่อเวลา',
      cancelText: 'ไม่ต่อ',
      onOk: async () => {
        try {
          const r = await extendBooking(b.id);
          message.success(`ต่อเวลาแล้ว เก็บโต๊ะถึง ${hhmm(r.auto_cancel_at)} น.`);
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });
  };

  const share = async () => {
    const text = `ไป ${bar.name} กัน! ${dateTime(b.datetime)} โซน ${zone?.name}\n${shareUrl}`;
    if (navigator.share) {
      await navigator
        .share({ title: 'บัตรจอง NightOut', text, url: shareUrl })
        .catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(text);
      message.success('คัดลอกลิงก์แล้ว');
    }
  };

  return (
    <div className="embers-glass relative isolate mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
      {/* พื้นหลัง Golden Embers เดียวกับหน้า /community (ธีมมืด) · fixed เลยไม่กินช่อง grid */}
      <EmbersBackdrop />
      <div className="space-y-6">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">รหัสจอง {b.code}</p>
              <h1 className="font-display text-3xl font-bold">{bar.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-muted">
                <MapPin /> {bar.address}
              </p>
            </div>
            <BookingStatusTag status={b.status} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">วันเวลา</dt>
              <dd className="font-semibold">{dateTime(b.datetime)}</dd>
            </div>
            <div>
              <dt className="text-muted">จำนวน</dt>
              <dd className="font-semibold">{b.pax} คน</dd>
            </div>
            <div>
              <dt className="text-muted">โซน</dt>
              <dd className="font-semibold">{zone?.name}</dd>
            </div>
            <div>
              <dt className="text-muted">โต๊ะ</dt>
              <dd className="font-semibold">{table?.name ?? 'ร้านจัดให้'}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={lineShareUrl(`ไป ${bar.name} กัน! ${dateTime(b.datetime)}\n${shareUrl}`)} target="_blank" rel="noreferrer">
              <Button icon={<ChatCircleDots />}>แชร์เข้า LINE</Button>
            </a>
            {canSplit && (
              <a
                href={lineShareUrl(
                  splitPayText({
                    barName: bar.name,
                    when: dateTime(b.datetime),
                    pax: b.pax,
                    fee,
                    paid: b.deposit?.status === 'VERIFIED',
                    avgPerPerson: bar.avgPerPerson,
                    shareUrl,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
              >
                <Button icon={<Wallet />}>หารจ่ายผ่าน LINE</Button>
              </a>
            )}
            <Button icon={<ShareNetwork />} onClick={share}>
              แชร์ลิงก์
            </Button>
            {b.status === 'AWAITING_DEPOSIT' && (
              <Link to={`/bookings/${b.id}/deposit`}>
                <Button type="primary">ชำระ Table Fee</Button>
              </Link>
            )}
            {isReviewableStatus(b.status) && !b.reviewed && (
              <Link to={`/reviews/new?booking=${b.id}`}>
                <Button type="primary">เขียนรีวิว</Button>
              </Link>
            )}
            {canCancel && (
              <Button
                danger
                onClick={() =>
                  modal.confirm({
                    title: 'ยกเลิกการจองนี้?',
                    content: bar.deposit.policy,
                    okText: 'ยกเลิกการจอง',
                    okButtonProps: { danger: true },
                    cancelText: 'ไม่ยกเลิก',
                    onOk: async () => {
                      try {
                        await cancelBooking(b.id);
                        message.success('ยกเลิกแล้ว');
                      } catch (e) {
                        message.error((e as Error).message);
                      }
                    },
                  })
                }
              >
                ยกเลิก
              </Button>
            )}
          </div>
        </Card>
        {b.cancelReason && ['REJECTED', 'CANCELLED_BY_MERCHANT', 'CANCELLED_BY_CUSTOMER'].includes(b.status) && (
          <Card title="เหตุผลที่ยกเลิก">
            <p>{b.cancelReason}</p>
          </Card>
        )}
        {b.promotionTitle && (
          <Card title="โปรโมชันที่เลือก">
            <p className="font-semibold">{b.promotionTitle}</p>
            <p className="text-sm text-muted">แจ้งพนักงานตอนเช็กอิน</p>
          </Card>
        )}
        <Card title={TABLE_FEE_LABEL}>
          <DepositSummary booking={b} />
        </Card>
        <Card title="ประวัติสถานะ">
          <Timeline
            items={b.history.map((h) => ({
              content: (
                <>
                  <span className="font-medium">{BOOKING_STATUS[h.to].label}</span>
                  <span className="block text-xs text-muted">
                    {dateTime(h.at)} โดย {h.by}
                  </span>
                </>
              ),
            }))}
          />
        </Card>
      </div>

      {/* มือถือ: การจองที่ยืนยันแล้วเอาการ์ด QR + ปุ่มต่อเวลาขึ้นก่อน (แจ้งเตือนก่อนปลดโต๊ะพามาหน้านี้ตอนยืนอยู่หน้าร้าน) */}
      <Card className={`h-fit text-center md:sticky md:top-24 ${b.status === 'CONFIRMED' ? 'max-md:order-first' : ''}`}>
        {b.status === 'CONFIRMED' ? (
          <>
            <p className="mb-3 font-semibold">แสดง QR นี้ให้การ์ดหน้าร้าน</p>
            <div className="inline-block rounded-2xl bg-white p-4">
              <QRCodeSVG value={`NIGHTOUT:${b.id}`} size={200} level="M" />
            </div>
            <p className="mt-3 font-mono text-lg tracking-widest">{b.code}</p>
            {now < checkInOpensAt.getTime() && (
              <p className="mt-1 text-xs text-muted">เช็กอินได้ตั้งแต่ {clockOf(checkInOpensAt, b.datetime)}</p>
            )}
            {countdown ? (
              <p className="mt-3 flex items-center justify-center gap-1 text-sm text-muted">
                <Clock /> ปลดโต๊ะ (Forfeited) ใน {countdown}
              </p>
            ) : (
              <p className="mt-3 text-sm text-(--crowd-full)">เลยเวลาเก็บโต๊ะแล้ว</p>
            )}
            {canExtend ? (
              <Button className="mt-4" block type="primary" icon={<ClockClockwise />} onClick={askExtend}>
                ขอต่อเวลา {BOOKING_EXTENSION_MINUTES} นาที
              </Button>
            ) : b.extendedAt ? (
              <p className="mt-2 flex justify-center">
                <StatusChip icon={<ClockClockwise weight="bold" />} value={`${hhmm(releaseAt)} น.`} className="!text-sm">
                  ต่อเวลาแล้ว เก็บโต๊ะถึง
                </StatusChip>
              </p>
            ) : (
              now < extendOpensAt && (
                <p className="mt-1 text-xs text-muted">
                  ขอต่อเวลาได้ตั้งแต่ {BOOKING_EXTENSION_MINUTES} นาทีก่อนเวลาจอง (1 ครั้ง)
                </p>
              )
            )}
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
              เพื่อนที่กด &quot;ไปด้วย&quot; จากลิงก์แชร์จะเห็น QR เดียวกัน — ใครถึงร้านก่อนสแกนได้เลย
            </p>
          </>
        ) : (
          <div className="py-8 text-muted">
            <p className="mb-2 text-lg">QR เช็กอิน</p>
            <p className="text-sm">
              {b.status === 'CHECKED_IN' || b.status === 'COMPLETED'
                ? `เช็กอินแล้ว${b.checkedInAt ? ` เมื่อ ${dateTime(b.checkedInAt)}` : ''} ขอให้สนุกนะ!`
                : b.status === 'AWAITING_DEPOSIT'
                  ? 'จะแสดงเมื่อชำระ Table Fee สำเร็จ'
                  : ['PENDING', 'DEPOSIT_SUBMITTED'].includes(b.status)
                    ? 'จะแสดงเมื่อ NightOut ตรวจสลิปแล้ว'
                  : 'การจองนี้ไม่สามารถเช็กอินได้แล้ว'}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

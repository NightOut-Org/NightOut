import { Camera, CheckCircle, QrCode, Scan, SquaresFour } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import type { CrowdStatus } from '@nightout/types';
import { getAntdTheme } from '@nightout/ui';
import { canTeamForfeit, parseCheckInScan } from '@nightout/utils';
import { App, ConfigProvider, Empty } from 'antd';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router';
import { autoCancelAt, barBookings, type Booking } from '@/services/data';
import { useConfirmForfeit } from '@/hooks/useConfirmForfeit';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { Chip, Ring, Tile } from '@/ui/components/merchantUi';
import { BOOKING_STATUS } from '@/ui/utils/format';
import { forfeitBooking, setCrowd } from './api';
import { QrScanner } from './components/qrScanner';
import { CheckInConfirmModal } from './modal/checkInConfirmModal';

const CLOSED = ['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_MERCHANT', 'REJECTED', 'EXPIRED'];
const isIn = (s: string) => s === 'CHECKED_IN' || s === 'COMPLETED';
const hhmm = (d: Date | string) =>
  new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });

const CROWD_OPTIONS: { value: CrowdStatus; label: string; short: string; color: string }[] = [
  { value: 'AVAILABLE', label: 'ว่าง', short: 'ว่าง', color: 'var(--crowd-available)' },
  { value: 'ALMOST_FULL', label: 'ใกล้เต็ม', short: 'ใกล้เต็ม', color: 'var(--crowd-almost-full)' },
  { value: 'FULL', label: 'โต๊ะเต็ม', short: 'เต็ม', color: 'var(--crowd-full)' },
];

/** เวลาปัจจุบัน อัปเดตทุก 30 วิ (ใช้กับนาฬิกาและนับถอยหลังปลดโต๊ะ) */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * /merchant/tonight — Staff Scanner (บังคับ Dark เสมอ)
 * เช็กอิน: กล้อง (QrScanner) / เครื่องสแกนแบบคีย์บอร์ด / พิมพ์รหัส / ปุ่มในรายการ → ขั้นยืนยัน (CheckInConfirmModal) → เช็กอิน
 */
export function TonightPage() {
  const bar = useMerchantBar();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const now = useNow();
  const confirmForfeit = useConfirmForfeit();
  const inputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [last, setLast] = useState<string>();
  /** เปิดกล้องสแกนอยู่ */
  const [scanning, setScanning] = useState(false);
  /** รหัสที่รอกดยืนยันเช็กอิน (เปิด CheckInConfirmModal) */
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'waiting' | 'in'>('all');

  const tonight = barBookings(bar.id)
    .filter((b) => new Date(b.datetime).toDateString() === now.toDateString() && !CLOSED.includes(b.status))
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
  const totalPax = tonight.reduce((a, b) => a + b.pax, 0);
  const inPax = tonight.filter((b) => isIn(b.status)).reduce((a, b) => a + b.pax, 0);
  const waiting = tonight.filter((b) => !isIn(b.status));
  const shown = filter === 'in' ? tonight.filter((b) => isIn(b.status)) : filter === 'waiting' ? waiting : tonight;

  // เลยเวลานัดแต่ยังไม่เช็กอิน → ระบบปลดโต๊ะ (Forfeited) เมื่อพ้นเวลาเก็บโต๊ะ (grace + ที่ลูกค้าต่อเวลา)
  const overdue = tonight.filter(
    (b) => b.status === 'CONFIRMED' && new Date(b.datetime) < now && autoCancelAt(b) > now,
  );
  const nextReleaseMin = overdue.length
    ? Math.max(0, Math.ceil((Math.min(...overdue.map((b) => autoCancelAt(b).getTime())) - now.getTime()) / 60_000))
    : null;
  // เลยเวลาเก็บโต๊ะแล้ว (ยังไม่ถึงรอบ job) → ทีมร้านทุกบทบาทกดปลดโต๊ะเองได้จากแถว
  const isForfeitable = (b: Booking) => canTeamForfeit({ status: b.status, autoCancelAt: autoCancelAt(b) }, now);
  const forfeitable = tonight.filter(isForfeitable).length;
  const overdueText = [
    overdue.length ? `เลยเวลา ${overdue.length} โต๊ะ · ปลดโต๊ะใน ${nextReleaseMin} นาที` : '',
    forfeitable ? `เลยเวลาเก็บโต๊ะ ${forfeitable} โต๊ะ · กดปลดโต๊ะได้` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const hours = bar.hours.find((h) => h.day === now.getDay());
  const closeLabel = !hours || hours.closed ? 'วันนี้ปิด' : `ปิดรับ ${hours.close}`;

  /** พิมพ์ / เครื่องสแกนแบบคีย์บอร์ด → ตรวจรูปแบบ แล้วเปิดขั้นยืนยัน (ยังไม่เช็กอิน) */
  const submitTyped = () => {
    if (!code.trim()) return;
    const c = parseCheckInScan(code);
    if (!c) {
      message.error('รหัสไม่ถูกต้อง — ใช้รหัสจอง เช่น NL-3F8K2A หรือสแกน QR จาก E-Ticket');
      return;
    }
    setPendingCode(c);
  };

  /** กล้องอ่าน QR ได้ — ไม่ใช่ E-Ticket ของ NightOut = เตือนแล้วสแกนต่อ */
  const onScan = (text: string) => {
    const c = parseCheckInScan(text);
    if (!c) {
      message.warning({ content: 'QR นี้ไม่ใช่ E-Ticket ของ NightOut', key: 'scan-invalid' });
      return;
    }
    setScanning(false);
    navigator.vibrate?.(50);
    setPendingCode(c);
  };

  const onCheckedIn = (b: C.CheckInResult) => {
    setPendingCode(null);
    setLast(`${b.customer_name ?? 'ลูกค้า'} · ${b.pax} คน · ${b.zone_name ?? ''} · ${b.code}`);
    setCode('');
    message.success('เช็กอินสำเร็จ — โต๊ะกำลังใช้งาน');
  };

  const updateCrowd = async (v: CrowdStatus) => {
    try {
      await setCrowd(bar.id, v);
      message.success('อัปเดตสถานะร้านแล้ว');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const zoneTable = (b: Booking) =>
    [bar.zones.find((z) => z.id === b.zoneId)?.name, bar.zones.flatMap((z) => z.tables).find((t) => t.id === b.tableId)?.name]
      .filter(Boolean)
      .join(' ');

  /** ปุ่มท้ายแถว: ยืนยันแล้ว → เช็กอิน · มาแล้ว → ป้ายเขียวน้ำทะเล · อื่น ๆ → ชื่อสถานะ */
  const rowAction = (b: Booking, big: boolean) => {
    const size = big ? 'h-11 px-3.5 text-sm rounded-xl' : 'h-8 px-3 text-[13px] rounded-[10px]';
    if (isForfeitable(b))
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            confirmForfeit(b, () => forfeitBooking(b.id));
          }}
          className={`merchant-pill inline-flex shrink-0 items-center border border-[color-mix(in_srgb,var(--crowd-full)_45%,transparent)] font-semibold text-(--crowd-full) ${size}`}
        >
          ปลดโต๊ะ
        </button>
      );
    if (b.status === 'CONFIRMED')
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPendingCode(b.code);
          }}
          className={`merchant-pill inline-flex shrink-0 items-center border border-gold bg-gold font-semibold text-on-gold ${size}`}
        >
          เช็กอิน
        </button>
      );
    return (
      <span
        className={`inline-flex shrink-0 items-center border font-semibold ${size} ${
          isIn(b.status) ? 'border-[#144848] text-[#13a8a8]' : 'border-border text-muted'
        }`}
      >
        {isIn(b.status) ? 'มาแล้ว' : BOOKING_STATUS[b.status].label}
      </span>
    );
  };

  const bookingCard = (b: Booking, big: boolean) => (
    <li key={b.id}>
      <div
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/merchant/bookings/${b.id}`)}
        // Enter บนปุ่มในแถว (เช็กอิน/ปลดโต๊ะ) ห้ามพาไปหน้ารายละเอียด
        onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && navigate(`/merchant/bookings/${b.id}`)}
        className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2.5 ${
          big ? 'border-border bg-card' : 'border-border/60 bg-surface'
        }`}
      >
        <span className={`shrink-0 font-semibold tabular-nums ${big ? 'w-12 text-base' : 'w-[52px] text-[17px]'}`}>
          {hhmm(b.datetime)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col text-sm">
          <b className="truncate font-medium">
            {b.userName} · {b.pax} คน
          </b>
          <span className="truncate text-xs text-muted">
            {zoneTable(b)}
            {big ? '' : ` · ${b.code}`}
          </span>
          {/* แยกบรรทัด ไม่ให้ถูกตัดด้วย … — พนักงานต้องเห็นว่าเก็บโต๊ะถึงกี่โมง */}
          {b.status === 'CONFIRMED' && b.extendedAt && (
            <span className="text-xs font-medium text-gold-text">ต่อเวลาแล้ว · เก็บโต๊ะถึง {hhmm(autoCancelAt(b))}</span>
          )}
        </span>
        {rowAction(b, big)}
      </div>
    </li>
  );

  const crowdButton = (o: (typeof CROWD_OPTIONS)[number], compact: boolean) => {
    const on = bar.crowd === o.value;
    return (
      <button
        key={o.value}
        type="button"
        aria-pressed={on}
        onClick={() => void updateCrowd(o.value)}
        className={`merchant-pill flex flex-1 items-center gap-2 rounded-xl px-3 text-sm ${
          compact ? 'h-12 justify-center' : 'min-h-11'
        } ${on ? 'border-2 font-semibold' : 'border border-border text-muted'}`}
        style={on ? { borderColor: o.color, background: `color-mix(in srgb, ${o.color} 12%, transparent)` } : undefined}
      >
        <span
          className={`size-2.5 rounded-full ${on && o.value === 'AVAILABLE' ? 'animate-pulse' : ''}`}
          style={{ background: o.color }}
        />
        {compact ? o.short : o.label}
      </button>
    );
  };

  /** ช่องพิมพ์รหัสมี 2 ชุด (Desktop / มือถือ ซ่อนด้วย CSS) — โฟกัสชุดที่มองเห็นอยู่ */
  const focusInput = () =>
    [desktopInputRef.current, inputRef.current].find((el) => el && el.offsetParent !== null)?.focus();

  const scanInput = (ref: RefObject<HTMLInputElement | null>) => (
    <form
      className="flex h-14 overflow-hidden rounded-[14px] border border-gold shadow-[0_0_0_3px_rgba(232,182,76,.15)]"
      onSubmit={(e) => {
        e.preventDefault();
        submitTyped();
      }}
    >
      <input
        ref={ref}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        // เลือกข้อความเดิมทั้งหมดตอนโฟกัส (เช่น ปิดขั้นยืนยันแล้วกลับมา) — สแกนใบถัดไปทับได้เลย ไม่ต่อท้ายรหัสเก่า
        onFocus={(e) => e.currentTarget.select()}
        aria-label="รหัสจองหรือข้อความจาก QR"
        placeholder="เช่น NL-3F8K2A หรือข้อความจาก QR"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        enterKeyHint="go"
        className="min-w-0 flex-1 bg-transparent px-4 text-[17px] text-text outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={!code.trim()}
        className="merchant-pill bg-gold px-6 text-base font-semibold text-on-gold disabled:opacity-70"
      >
        เช็กอิน
      </button>
    </form>
  );

  const lastCheckIn = last && (
    <div className="flex items-center gap-2.5 rounded-xl border border-(--crowd-available) px-3 py-2.5">
      <CheckCircle size={24} weight="fill" className="shrink-0 text-(--crowd-available)" aria-hidden />
      <b className="min-w-0 flex-1 text-sm font-semibold" role="status">
        {last}
      </b>
      <button
        type="button"
        onClick={() => setScanning(true)}
        className="merchant-pill inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-medium"
      >
        <Scan size={16} aria-hidden /> สแกนคนต่อไป
      </button>
    </div>
  );

  const filters = (
    <span className="flex gap-1.5 overflow-x-auto">
      <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
        ทั้งหมด
      </Chip>
      <Chip active={filter === 'waiting'} onClick={() => setFilter('waiting')}>
        ยังไม่มา {waiting.length}
      </Chip>
      <Chip active={filter === 'in'} onClick={() => setFilter('in')}>
        มาแล้ว {tonight.length - waiting.length}
      </Chip>
    </span>
  );

  /** ทางลัดไปผังโต๊ะ (ทีมร้านทุกบทบาท) */
  const floorLink = (
    <Link
      to="/merchant/floor"
      className="merchant-pill inline-flex h-11 shrink-0 lg:h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[13px] text-text hover:border-gold"
    >
      <SquaresFour size={16} aria-hidden /> ผังโต๊ะ
    </Link>
  );

  return (
    <ConfigProvider theme={getAntdTheme('dark')}>
      <div className="dark text-text">
        {/* ---------- Desktop ---------- */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-4 lg:grid-rows-[minmax(220px,auto)_auto]">
          <Tile className="col-span-2 flex flex-col gap-3 !p-[22px]">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-semibold">
                <QrCode size={22} className="text-gold" /> สแกน / กรอกรหัส
              </p>
              <span className="flex items-center gap-2">
                {floorLink}
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="merchant-pill inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:border-gold"
                >
                  <Camera size={18} aria-hidden /> เปิดกล้อง
                </button>
              </span>
            </div>
            {scanInput(desktopInputRef)}
            {lastCheckIn ?? (
              <p className="text-xs text-muted">ใช้เครื่องอ่าน QR ที่ต่อเป็นคีย์บอร์ด พิมพ์รหัสจองแล้วกด Enter หรือเปิดกล้อง</p>
            )}
          </Tile>
          <Tile className="flex flex-col gap-2.5">
            <span className="text-sm text-muted">สถานะร้านตอนนี้</span>
            <div className="flex flex-1 flex-col gap-1.5">{CROWD_OPTIONS.map((o) => crowdButton(o, false))}</div>
          </Tile>
          <Tile className="flex flex-col justify-between gap-3">
            <span className="text-sm text-muted">
              {hhmm(now)} · {closeLabel}
            </span>
            <div className="flex items-center gap-3.5">
              <Ring pct={totalPax ? (inPax / totalPax) * 100 : 0} size={80} />
              <span className="flex flex-col text-[13px] text-muted">
                <b className="text-[22px] text-text">
                  {inPax}/{totalPax}
                </b>
                คนเช็กอินแล้ว
              </span>
            </div>
            <span className={`text-[13px] ${overdueText ? 'text-(--crowd-full)' : 'text-muted'}`}>
              {overdueText || 'ยังไม่มีโต๊ะเลยเวลานัด'}
            </span>
          </Tile>
          <Tile className="col-span-4 flex flex-col gap-2.5">
            <span className="flex items-center justify-between gap-3">
              <b className="font-semibold">จองคืนนี้ ({tonight.length})</b>
              {filters}
            </span>
            {shown.length === 0 ? (
              <Empty description={tonight.length ? 'ไม่มีรายการในตัวกรองนี้' : 'ยังไม่มีการจองคืนนี้'} />
            ) : (
              <ul className="m-0 grid list-none grid-cols-2 gap-x-5 gap-y-2 p-0">{shown.map((b) => bookingCard(b, false))}</ul>
            )}
          </Tile>
        </div>

        {/* ---------- มือถือ ---------- */}
        <div className="flex flex-col gap-3 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold">คืนนี้</h1>
              {floorLink}
            </span>
            <span className="text-[13px] text-muted">
              {hhmm(now)} · {closeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="merchant-pill flex h-28 flex-col items-center justify-center gap-1 rounded-[20px] bg-gold text-[17px] font-bold text-on-gold"
          >
            <Scan size={38} aria-hidden />
            แตะเพื่อสแกน QR
          </button>
          <p className="-mb-1 text-center text-[13px] text-muted">หรือพิมพ์รหัสจองด้านล่าง</p>
          {scanInput(inputRef)}
          {lastCheckIn}
          <div className="grid grid-cols-3 gap-2">{CROWD_OPTIONS.map((o) => crowdButton(o, true))}</div>
          {overdueText && <p className="text-[13px] text-(--crowd-full)">{overdueText}</p>}
          <span className="flex justify-between text-sm text-muted">
            จองคืนนี้ ({tonight.length})
            <span>
              มาแล้ว {inPax}/{totalPax} คน
            </span>
          </span>
          {filters}
          {shown.length === 0 ? (
            <Empty description={tonight.length ? 'ไม่มีรายการในตัวกรองนี้' : 'ยังไม่มีการจองคืนนี้'} />
          ) : (
            <ul className="m-0 grid list-none gap-2 p-0">{shown.map((b) => bookingCard(b, true))}</ul>
          )}
        </div>

        <QrScanner
          open={scanning}
          onClose={() => setScanning(false)}
          onDetect={onScan}
          onTypeInstead={() => {
            setScanning(false);
            focusInput();
          }}
        />
        <CheckInConfirmModal barId={bar.id} code={pendingCode} onClose={() => setPendingCode(null)} onDone={onCheckedIn} />
      </div>
    </ConfigProvider>
  );
}

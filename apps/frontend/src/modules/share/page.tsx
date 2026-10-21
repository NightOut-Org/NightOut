import { CalendarCheck, MapPin, UsersThree, Wallet } from '@phosphor-icons/react';
import { TABLE_FEE_LABEL } from '@nightout/utils';
import { getBarBySlug } from '@/services/data';
import { useAuth } from '@/services/auth';
import { useShareCard } from './api';
import { canJoinShare, GroupCheckIn } from './components/groupCheckIn';
import { Button, Card, Spin } from 'antd';
import { Link, useParams } from 'react-router';
import { BarCover } from '@/ui/components/barCard';
import { baht, dateTime } from '@/ui/utils/format';
import { NotFoundResult } from '@/ui/components/notFoundResult';

/**
 * /share/:token — บัตรจองสาธารณะ (rpc get_share_card · ไม่มีข้อมูลส่วนตัว)
 * เพื่อนกด "ไปด้วย" (ล็อกอิน) → เห็น QR เช็กอินเดียวกับผู้จอง ใครถึงก่อนสแกนได้เลย (GroupCheckIn)
 * ยอดหารต่อหัว = Table Fee ÷ จำนวนคน (ปัดขึ้นเป็นบาท) — แชร์ให้ดูอย่างเดียว ผู้จองจ่ายผ่านแอปคนเดียว เพื่อนโอนคืนผู้จองเอง
 */
export function SharePage() {
  const { token = '' } = useParams();
  const { user } = useAuth();
  const { data: card, isLoading } = useShareCard(token, user?.id ?? null);
  if (isLoading) return <Spin fullscreen />;
  if (!card) return <NotFoundResult title="ลิงก์นี้หมดอายุหรือไม่ถูกต้อง" kind="home" />;
  const bar = getBarBySlug(card.bar_slug);
  const fee = Number(card.deposit_required) || 0;
  const feePerHead = card.pax > 0 ? Math.ceil(fee / card.pax) : fee;
  return (
    <div className="mx-auto max-w-md">
      <Card cover={bar ? <BarCover bar={bar} className="h-40" /> : undefined}>
        <p className="text-sm text-muted">{card.host_first_name} ชวนคุณไป</p>
        <h1 className="font-display text-3xl font-bold">{card.bar_name}</h1>
        <ul className="mt-4 space-y-2">
          <li className="flex items-center gap-2">
            <CalendarCheck className="text-gold-text" /> {dateTime(card.booking_datetime)}
          </li>
          <li className="flex items-center gap-2">
            <UsersThree className="text-gold-text" /> {card.pax} คน{card.zone_name ? ` โซน ${card.zone_name}` : ''}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="text-gold-text" /> {card.address}
          </li>
        </ul>
        <GroupCheckIn card={card} token={token} />
        {(fee > 0 || bar) && (
          <div className="mt-5 rounded-xl border border-border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="text-gold-text" /> ยอดหารต่อหัว
            </p>
            {fee > 0 && (
              <>
                <p className="mt-2 font-display text-2xl font-bold">
                  {baht(feePerHead)} <span className="text-sm font-normal text-muted">/ คน</span>
                </p>
                <p className="text-sm text-muted">
                  {TABLE_FEE_LABEL} {baht(fee)} หาร {card.pax} คน โดย {card.host_first_name} เป็นคนจ่ายผ่านแอป โอนส่วนของคุณให้ {card.host_first_name} โดยตรง
                </p>
              </>
            )}
            {bar && bar.avgPerPerson > 0 && (
              <p className="mt-2 text-sm text-muted">งบในร้านโดยประมาณ {baht(bar.avgPerPerson)} / คน (จ่ายที่ร้าน)</p>
            )}
          </div>
        )}
        <div className="mt-6 grid gap-3">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${card.lat},${card.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button block type={canJoinShare(card) ? 'default' : 'primary'} size="large">
              เปิดแผนที่
            </Button>
          </a>
          <Link to={`/bars/${card.bar_slug}`}>
            <Button block size="large">
              ดูหน้าร้าน
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

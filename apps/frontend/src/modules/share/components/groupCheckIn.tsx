import { CheckCircle, QrCode, UserPlus, UsersThree } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect } from 'react';
import { useAuth } from '@/services/auth';
import { useAuthModal } from '@/ui/components/authModal';
import { joinShare, shareCardKey, type ShareCard } from '../api';
import { rememberPendingShare, takePendingShare } from '../utils/pendingJoin';

/** สถานะที่ยังกด "ไปด้วย" ได้ — ตรงกับ rpc app_join_share (นอกนั้น = SHARE_CLOSED) */
const JOINABLE = ['PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED', 'CHECKED_IN'];
const AWAITING = ['PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED'];

/** ยังไม่อยู่ในกลุ่ม และการจองยังไม่ปิด → แสดงปุ่ม "ไปด้วย" */
export const canJoinShare = (card: ShareCard) => !card.is_member && JOINABLE.includes(card.status);

/** ข้อความแทน QR สำหรับสมาชิกที่ยังไม่มี QR (การจองยังไม่ยืนยัน / เช็กอินแล้ว / ปิดแล้ว) */
function memberNote(status: string) {
  if (status === 'CHECKED_IN' || status === 'COMPLETED') return 'เช็กอินแล้ว ขอให้สนุกนะ!';
  if (AWAITING.includes(status)) return 'QR จะแสดงเมื่อการจองยืนยันแล้ว';
  return 'การจองนี้ปิดแล้ว';
}

/**
 * กลุ่มที่จะไปด้วย — เพื่อนกด "ไปด้วย" (ต้องล็อกอิน) แล้วเห็น QR เช็กอินเดียวกับผู้จอง (`NIGHTOUT:<booking id>`)
 * ใครถึงร้านก่อนให้พนักงานสแกน → เช็กอินทั้งโต๊ะ · สมาชิกได้แจ้งเตือน 15 นาทีก่อนเวลาจอง
 */
export function GroupCheckIn({ card, token }: { card: ShareCard; token: string }) {
  const { user } = useAuth();
  const { openLogin } = useAuthModal();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinShare(token),
    onSuccess: () => {
      message.success('เข้ากลุ่มแล้ว — เราจะเตือนก่อนเวลาจอง 15 นาที');
      void qc.invalidateQueries({ queryKey: shareCardKey(token) });
    },
    onError: (e: Error) => message.error(e.message),
  });
  const going = Number(card.going_count) || 0;
  const joinable = canJoinShare(card);
  const joinNow = join.mutate;

  // กด "ไปด้วย" ตอนยังไม่ล็อกอิน → ล็อกอิน / สมัคร (+ onboarding ?next=) พากลับมาหน้านี้ → เข้ากลุ่มให้เองครั้งเดียว
  useEffect(() => {
    if (user && takePendingShare(token) && joinable) joinNow();
  }, [user, token, joinable, joinNow]);

  const askJoin = () => {
    if (user) {
      joinNow();
      return;
    }
    rememberPendingShare(token);
    openLogin(`/share/${token}`);
  };

  return (
    <section className="mt-5 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <UsersThree className="text-gold-text" />
          {going > 0 ? `ไปด้วยแล้ว ${going} คน` : 'ยังไม่มีใครกดไปด้วย'}
        </p>
        {card.is_member && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-gold-text">
            <CheckCircle weight="fill" /> คุณอยู่ในกลุ่มนี้
          </span>
        )}
      </div>

      {joinable && (
        <>
          <p className="mt-2 text-sm text-muted">
            กด &quot;ไปด้วย&quot; เพื่อรับแจ้งเตือนก่อนเวลาจอง และใช้ QR เช็กอินเดียวกับ {card.host_first_name}
          </p>
          <Button
            className="mt-3"
            block
            type="primary"
            size="large"
            icon={<UserPlus />}
            loading={join.isPending}
            onClick={askJoin}
          >
            ไปด้วย
          </Button>
        </>
      )}

      {card.checkin_qr ? (
        <div className="mt-4 text-center">
          <div className="inline-block rounded-2xl bg-white p-4">
            <QRCodeSVG value={card.checkin_qr} size={180} level="M" />
          </div>
          <p className="mt-3 flex items-start justify-center gap-1.5 text-sm text-muted">
            <QrCode className="mt-0.5 shrink-0 text-gold-text" />
            ใครถึงร้านก่อน ให้พนักงานสแกน QR นี้ — เช็กอินทั้งโต๊ะ
          </p>
        </div>
      ) : card.is_member ? (
        <p className="mt-3 text-sm text-muted">{memberNote(card.status)}</p>
      ) : (
        !joinable && <p className="mt-2 text-sm text-muted">การจองนี้ปิดแล้ว</p>
      )}
    </section>
  );
}

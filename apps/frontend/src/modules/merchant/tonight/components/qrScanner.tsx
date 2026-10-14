import { ArrowClockwise, CameraSlash, Keyboard, SpinnerGap } from '@phosphor-icons/react';
import { Modal } from 'antd';
import { useRef } from 'react';
import { useQrScanner, type QrScannerStatus } from '../hooks/useQrScanner';

/** ข้อความเมื่อยังสแกนไม่ได้ (บนพื้นกล้องสีดำ) */
const STATUS_TEXT: Partial<Record<QrScannerStatus, string>> = {
  starting: 'กำลังเปิดกล้อง…',
  denied:
    'ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องให้เว็บนี้ในการตั้งค่าเบราว์เซอร์ หรือพิมพ์รหัสจองแทน',
  unavailable: 'ไม่พบกล้องบนอุปกรณ์นี้ — พิมพ์รหัสจองแทน',
  insecure: 'ต้องเปิดเว็บผ่าน https จึงจะใช้กล้องได้ — พิมพ์รหัสจองแทน',
  error: 'เปิดกล้องไม่สำเร็จ',
};

/** มุมกรอบเล็งสีทอง (CSS ล้วน ไม่มี motion) */
const CORNERS = [
  'left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]',
  'right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]',
  'bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]',
  'bottom-0 right-0 rounded-br-2xl border-b-[3px] border-r-[3px]',
];

/**
 * สแกน E-Ticket ด้วยกล้อง — เจอ QR แล้วส่งข้อความให้ onDetect (หน้าเป็นคนตรวจรูปแบบ/เปิดขั้นยืนยัน)
 * ทุกสถานะมีปุ่ม "พิมพ์รหัสจองแทน" (กล้องใช้ไม่ได้ / ไม่อยากใช้)
 */
export function QrScanner({
  open,
  onClose,
  onDetect,
  onTypeInstead,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (text: string) => void;
  /** เรียกหลังปิด modal เสร็จ (หลัง antd คืนโฟกัสให้ปุ่มที่เปิด) — หน้าเอาไปโฟกัสช่องพิมพ์รหัส */
  onTypeInstead: () => void;
}) {
  const typeInstead = useRef(false);
  return (
    <Modal
      open={open}
      title="สแกน E-Ticket"
      centered
      width={440}
      footer={null}
      destroyOnHidden
      rootClassName="dark"
      onCancel={onClose}
      afterClose={() => {
        if (!typeInstead.current) return;
        typeInstead.current = false;
        onTypeInstead();
      }}
    >
      <ScannerView
        active={open}
        onDetect={onDetect}
        onTypeInstead={() => {
          typeInstead.current = true;
          onClose();
        }}
      />
    </Modal>
  );
}

/** ตัวกล้อง — แยกเป็น component ใน modal: <video> mount ก่อน effect ของ hook เสมอ และกล้องปิดเมื่อ modal ถูกทำลาย */
function ScannerView({
  active,
  onDetect,
  onTypeInstead,
}: {
  active: boolean;
  onDetect: (text: string) => void;
  onTypeInstead: () => void;
}) {
  const { videoRef, status, retry } = useQrScanner({ active, onDetect });
  const problem = status !== 'starting';
  const canRetry = status === 'error' || status === 'denied';

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="size-full object-cover" />
        {status === 'idle' ? null : status === 'scanning' ? (
          // กรอบเล็ง + มืดรอบนอก (เงาขนาดใหญ่) ให้รู้ว่าต้องวาง QR ตรงไหน
          <span
            aria-hidden
            className="pointer-events-none absolute inset-[16%] rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.38)]"
          >
            {CORNERS.map((c) => (
              <span key={c} className={`absolute size-10 border-gold ${c}`} />
            ))}
          </span>
        ) : (
          <div
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-sm text-white/85"
          >
            {problem ? (
              <CameraSlash size={36} className="text-white/60" aria-hidden />
            ) : (
              <SpinnerGap
                size={32}
                className="animate-spin text-gold motion-reduce:animate-none"
                aria-hidden
              />
            )}
            <span className="text-balance">{STATUS_TEXT[status]}</span>
            {canRetry && (
              <button
                type="button"
                onClick={retry}
                className="merchant-pill inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/30 px-4 font-semibold text-white"
              >
                <ArrowClockwise size={16} aria-hidden /> ลองใหม่
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-sm text-muted">
        หันกล้องไปที่ QR บน E-Ticket ของลูกค้า — ระบบจะแสดงชื่อและจำนวนคนให้ยืนยันก่อน
      </p>
      <button
        type="button"
        onClick={onTypeInstead}
        className="merchant-pill inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm"
      >
        <Keyboard size={18} aria-hidden /> พิมพ์รหัสจองแทน
      </button>
    </div>
  );
}

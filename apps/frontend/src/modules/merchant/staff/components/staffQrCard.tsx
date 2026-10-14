import { Copy, DownloadSimple, QrCode } from '@phosphor-icons/react';
import { App } from 'antd';
import { QRCodeCanvas } from 'qrcode.react';
import { useRef } from 'react';
import { Tile } from '@/ui/components/merchantUi';

/**
 * QR พาพนักงานเข้าหน้า "คืนนี้" (/merchant/tonight) ของเว็บโดยตรง — requirement "QR Code พาพนักงานเข้าหน้า Staff"
 * ไม่มีข้อมูลลับใน QR (เป็นแค่ลิงก์) · ยังไม่ล็อกอิน → หน้า login แล้วกลับมาที่ ?next=/merchant/tonight
 * · คนนอกทีมเข้าไม่ได้ (RequireRole) · ทีมร้านอื่นเห็นแค่ร้านของตัวเอง (1 บัญชี = 1 ร้าน)
 */
export function StaffQrCard({ barName, barSlug }: { barName: string; barSlug: string }) {
  const { message } = App.useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${window.location.origin}/merchant/tonight`;

  const copy = async () => {
    try {
      // navigator.clipboard ไม่มีในหน้าที่ไม่ใช่ https → ไปที่ catch
      await navigator.clipboard.writeText(url);
      message.success('คัดลอกลิงก์แล้ว');
    } catch {
      message.error('คัดลอกไม่สำเร็จ — กดค้างที่ลิงก์ด้านบนเพื่อคัดลอกเอง');
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `nightout-staff-${barSlug}.png`;
    a.click();
  };

  return (
    <Tile className="flex flex-col gap-3">
      <b className="flex items-center gap-2 text-sm font-semibold">
        <QrCode size={20} className="shrink-0 text-gold" aria-hidden /> QR เข้าหน้าคืนนี้ (Staff)
      </b>
      <p className="text-sm text-muted">
        ให้พนักงานสแกนด้วยกล้องมือถือ เพื่อเปิดหน้า "คืนนี้" ของ {barName} สำหรับสแกนเช็กอินลูกค้า —
        ต้องเข้าสู่ระบบด้วยบัญชีที่ตอบรับคำเชิญแล้ว
      </p>
      {/* วาดที่ 480px (ดาวน์โหลดไปพิมพ์ได้คม) แสดงย่อ 176px · พื้นขาวรอบ QR ให้กล้องอ่านได้ทั้งธีมมืด/สว่าง */}
      <span className="self-center rounded-2xl bg-white p-3">
        <QRCodeCanvas
          ref={canvasRef}
          value={url}
          size={480}
          marginSize={2}
          level="M"
          role="img"
          aria-label={`QR ลิงก์ ${url}`}
          className="block"
          // qrcode.react ใส่ width/height = size เป็น inline style → ย่อด้วย style (className แทนไม่ได้)
          style={{ width: 176, height: 176 }}
        />
      </span>
      <span className="select-all break-all text-center text-xs text-text">{url}</span>
      <p className="text-center text-xs text-muted">
        พิมพ์ติดจุดต้อนรับได้ · คนนอกทีมสแกนแล้วเข้าไม่ได้
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="merchant-pill inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm"
        >
          <Copy size={18} aria-hidden /> คัดลอกลิงก์
        </button>
        <button
          type="button"
          onClick={download}
          className="merchant-pill inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm"
        >
          <DownloadSimple size={18} aria-hidden /> ดาวน์โหลด QR
        </button>
      </div>
    </Tile>
  );
}

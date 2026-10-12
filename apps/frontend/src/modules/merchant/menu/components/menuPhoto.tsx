import { ImageSquare } from '@phosphor-icons/react';
import { App, Upload } from 'antd';
import { PHOTO_ACCEPT, checkPhoto } from '@/ui/utils/media';

interface Props {
  name: string;
  url?: string;
  disabled?: boolean;
  /** ขนาดกรอบ (px) */
  size?: number;
  /** เลือกรูปใหม่ (ตรวจไฟล์แล้ว) — เข้า draft · อัปโหลดตอนกดบันทึกของหน้า */
  onPick: (file: File) => void;
}

/** รูปของรายการเมนู — กดที่รูปเพื่อเลือกรูปใหม่ (เอารูปออกทำในหน้าต่างแก้ไขรายการ) */
export function MenuPhoto({ name, url, disabled, size = 48, onPick }: Props) {
  const { message } = App.useApp();

  return (
    <Upload
      accept={PHOTO_ACCEPT}
      showUploadList={false}
      disabled={disabled}
      beforeUpload={(file) => {
        const err = checkPhoto(file);
        if (err) void message.error(err);
        else onPick(file);
        return Upload.LIST_IGNORE;
      }}
    >
      <span
        role="button"
        aria-label={`${url ? 'เปลี่ยนรูป' : 'เพิ่มรูป'} ${name}`}
        title={url ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
        onClick={(e) => e.stopPropagation()}
        className="relative grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-border bg-[repeating-linear-gradient(135deg,var(--card)_0_6px,var(--surface)_6px_12px)] text-muted hover:border-gold"
        style={{ width: size, height: size }}
      >
        {url ? <img src={url} alt="" className="absolute inset-0 size-full object-cover" /> : <ImageSquare size={20} />}
      </span>
    </Upload>
  );
}

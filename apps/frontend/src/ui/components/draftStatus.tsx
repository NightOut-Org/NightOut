import { CheckCircle, CircleNotch, CloudSlash, WarningCircle } from '@phosphor-icons/react';
import type { DraftSaveStatus } from '@/hooks/useAutosaveDraft';
import { clockTime } from '@/ui/utils/community';

/** ข้อความสถานะร่าง (ข้างหัวฟอร์ม / ใต้ช่องตอบ) — บอกว่าร่างถึงเซิร์ฟเวอร์แล้วหรือยัง */
export function DraftStatus({
  status,
  savedAt,
  onRetry,
}: {
  status: DraftSaveStatus;
  savedAt: string | null;
  onRetry?: () => void;
}) {
  const base = 'inline-flex items-center gap-1 text-xs text-muted';
  switch (status) {
    case 'saving':
      return (
        <span className={base} aria-live="polite">
          <CircleNotch size={13} className="animate-spin motion-reduce:animate-none" />
          กำลังบันทึก…
        </span>
      );
    case 'saved':
      return savedAt ? (
        <span className={base} aria-live="polite">
          <CheckCircle size={13} weight="fill" className="text-[var(--crowd-available)]" />
          บันทึกร่างแล้ว {clockTime(savedAt)}
        </span>
      ) : null;
    case 'offline':
      return (
        <span className={base} aria-live="polite">
          <CloudSlash size={13} />
          ออฟไลน์ · จะบันทึกร่างเมื่อกลับมาออนไลน์
        </span>
      );
    case 'error':
      return (
        <span className={`${base} !text-[var(--crowd-full)]`} aria-live="polite">
          <WarningCircle size={13} />
          บันทึกร่างไม่สำเร็จ
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="bg-transparent px-1 font-semibold text-link underline"
            >
              ลองอีกครั้ง
            </button>
          )}
        </span>
      );
    default:
      return null;
  }
}

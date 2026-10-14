import type { MiniAdState } from '@nightout/utils';
import type { TagLabel } from '@/ui/utils/labels';

/** สถานะโฆษณาใน Backoffice (miniAdState ใน @nightout/utils — ตรงกับเงื่อนไขใน DB) */
export const MINI_AD_STATE_TAG: Record<MiniAdState, TagLabel> = {
  LIVE: { text: 'กำลังแสดง', color: 'green' },
  SCHEDULED: { text: 'รอเริ่ม', color: 'blue' },
  OFF: { text: 'ปิดอยู่', color: 'default' },
  ENDED: { text: 'หมดเวลา', color: 'default' },
};

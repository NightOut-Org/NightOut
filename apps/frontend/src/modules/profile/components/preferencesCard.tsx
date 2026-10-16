import { motionTokens } from '@nightout/ui';
import { Button } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { AppUser } from '@/services/auth';
import { PreferencesForm } from './preferencesForm';
import { PreferencesView } from './preferencesView';

/**
 * แท็บ "ข้อมูลและความชอบ" (ดีไซน์ 3c) — โหมดดู = Bento (PreferencesView) · กด "แก้ไขข้อมูล" → การ์ดฟอร์มใบเดียวแทนทั้ง grid
 * "ยกเลิก" = ทิ้งค่าที่กรอก (ฟอร์ม unmount) กลับโหมดดู · บันทึกสำเร็จ → PreferencesForm เรียก reload() แล้วกลับโหมดดู
 */
export function PreferencesCard({ user }: { user: AppUser }) {
  const [editing, setEditing] = useState(false);
  const reduce = useReducedMotion();

  return (
    <section aria-label="ข้อมูลและความชอบ">
      <AnimatePresence initial={false} mode="wait">
        {editing ? (
          <motion.div
            key="edit"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionTokens.duration.base, ease: motionTokens.ease.out }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">แก้ไขข้อมูลและความชอบ</h2>
              <Button type="text" className="!h-[34px] !text-muted" onClick={() => setEditing(false)}>
                ยกเลิก
              </Button>
            </div>
            <PreferencesForm user={user} onDone={() => setEditing(false)} />
          </motion.div>
        ) : (
          <motion.div key="view" exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.fast }}>
            <PreferencesView displayName={user.displayName} onEdit={() => setEditing(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

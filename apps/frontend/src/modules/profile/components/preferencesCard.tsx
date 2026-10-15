import { PencilSimple } from '@phosphor-icons/react';
import { motionTokens } from '@nightout/ui';
import { Button } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { AppUser } from '@/services/auth';
import { PreferencesForm } from './preferencesForm';
import { PreferencesView } from './preferencesView';
import './preferencesCard.css';

/** แท็บ "ข้อมูลและความชอบ" — การ์ดโหมดดู กด "แก้ไขข้อมูล" แล้วเป็นฟอร์ม */
export function PreferencesCard({ user }: { user: AppUser }) {
  const [editing, setEditing] = useState(false);
  const reduce = useReducedMotion();
  const fade = {
    initial: reduce ? false : ({ opacity: 0, height: 0 } as const),
    animate: { opacity: 1, height: 'auto' },
    exit: reduce ? undefined : { opacity: 0, height: 0 },
    transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
  };

  return (
    <section className="prefs-lux relative overflow-hidden rounded-2xl" aria-labelledby="prefs-title">
      <span aria-hidden className="prefs-lux__hairline absolute top-0 right-6 left-6 h-px opacity-70" />
      <div className="prefs-lux__head flex items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <h2 id="prefs-title" className="text-base font-semibold">
            ข้อมูลและความชอบ
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">ใช้แนะนำร้านที่ตรงกับสไตล์และงบของคุณ</p>
        </div>
        {editing ? (
          <Button type="text" className="!text-muted" onClick={() => setEditing(false)}>
            ยกเลิก
          </Button>
        ) : (
          <Button icon={<PencilSimple />} className="!h-[34px] shrink-0" onClick={() => setEditing(true)}>
            แก้ไขข้อมูล
          </Button>
        )}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {editing ? (
          <motion.div key="edit" className="overflow-hidden" {...fade}>
            <div className="p-6">
              <PreferencesForm user={user} onDone={() => setEditing(false)} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="view" className="overflow-hidden" {...fade}>
            <PreferencesView displayName={user.displayName} onEdit={() => setEditing(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

import { Moon, Sun } from '@phosphor-icons/react';
import { Button, Tooltip } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useThemeMode } from '../ThemeProvider';

/** อุปกรณ์ที่ hover ได้จริง (เมาส์) — จอสัมผัสจำลอง hover ตอนแตะ ทำให้ tooltip ค้างหลังกด */
const canHover = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** ปุ่มสลับ Light ↔ Dark (ไอคอนหมุน + circular reveal) · tooltip เฉพาะอุปกรณ์ที่ hover ได้ (aria-label บอกชื่อปุ่มเสมอ) */
export function ThemeToggle() {
  const { resolved, toggle } = useThemeMode();
  const reduce = useReducedMotion();
  const isDark = resolved === 'dark';
  const label = isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด';

  return (
    <Tooltip title={label} trigger={canHover() ? 'hover' : []}>
      <Button
        type="text"
        shape="circle"
        aria-label={label}
        onClick={(e) => toggle({ x: e.clientX, y: e.clientY })}
        icon={
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={resolved}
              className="inline-flex"
              initial={reduce ? false : { rotate: -90, scale: 0.6, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={reduce ? undefined : { rotate: 90, scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {isDark ? <Moon size={20} weight="fill" /> : <Sun size={20} weight="fill" />}
            </motion.span>
          </AnimatePresence>
        }
      />
    </Tooltip>
  );
}

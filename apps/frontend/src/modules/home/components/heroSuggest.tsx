import {
  Buildings,
  Couch,
  DiscoBall,
  ForkKnife,
  Martini,
  MusicNotes,
  Sparkle,
  Storefront,
  Tree,
  type Icon,
} from '@phosphor-icons/react';
import { listBars, type BarWithTier } from '@/services/data';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useLayoutEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import type { HomeCategory } from '../type/category';
import { useHoverIntent } from '../utils/useHoverIntent';
import { barPlace } from '@/ui/utils/area';

/** ไอคอนตาม slot ของการ์ดหมวด (ไอคอนเป็นเรื่องของหน้าเว็บ · DB ไม่เก็บแล้ว) · slot ใหม่ที่ไม่รู้จัก = Sparkle */
const SLOT_ICONS: Record<string, Icon> = {
  pub: Martini,
  chill: Couch,
  food: ForkKnife,
  live: MusicNotes,
  rooftop: Buildings,
  outdoor: Tree,
  party: DiscoBall,
};
const POPULAR_LIMIT = 4;
const BAR_MATCH_LIMIT = 6;
const PANEL_WIDTH = 480;

interface SuggestItem {
  id: string;
  label: string;
  hint: string;
  icon: Icon;
  to: string;
}
interface SuggestGroup {
  title: string;
  items: SuggestItem[];
}

/** ต่อ query ของตัวกรองใน Hero (ย่าน/งบ/คน) ท้ายลิงก์การ์ดหมวด เช่น /search?category=PUB_BAR&budget=400 */
const withQuery = (to: string, extra: string) => {
  if (!extra) return to;
  return `${to}${to.includes('?') ? '&' : '?'}${extra}`;
};

/** แบ่งการ์ดหมวดตามลิงก์: ?category= = ประเภทร้าน · ?style= = สไตล์ (การ์ดอื่น เช่น /ranking ไม่อยู่ในแผง) */
function buildGroups(categories: HomeCategory[] = [], popular: BarWithTier[], filterQuery: string, q: string) {
  const toItem = (c: HomeCategory): SuggestItem => ({
    id: `cat-${c.key}`,
    label: c.title,
    hint: c.hint,
    icon: SLOT_ICONS[c.key] ?? Sparkle,
    to: withQuery(c.to, filterQuery),
  });
  const linkParam = (c: HomeCategory, key: string) =>
    new URLSearchParams(c.to.split('?')[1] ?? '').has(key) && c.to.startsWith('/search');
  const groups: SuggestGroup[] = [
    { title: 'ประเภทร้าน', items: categories.filter((c) => linkParam(c, 'category')).map(toItem) },
    { title: 'สไตล์', items: categories.filter((c) => linkParam(c, 'style')).map(toItem) },
    {
      // พิมพ์แล้วค้นจากทุกร้าน (listBars แบบเดียวกับหน้า /search) ไม่ใช่แค่ร้านยอดนิยม
      title: q ? 'ร้าน' : 'ร้านยอดนิยม',
      items: (q ? listBars({ q }).slice(0, BAR_MATCH_LIMIT) : popular.slice(0, POPULAR_LIMIT)).map((b) => ({
        id: `bar-${b.id}`,
        label: b.name,
        hint: barPlace(b),
        icon: Storefront,
        to: `/bars/${b.slug}`,
      })),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

function filterGroups(groups: SuggestGroup[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(needle)),
    }))
    .filter((g) => g.items.length > 0);
}

/** ตำแหน่งแผง (fixed) ใต้ฟอร์มค้นหา ชิดซ้าย · กว้าง 480px หรือเท่าฟอร์มถ้าฟอร์มแคบกว่า (มือถือ) */
function usePanelPosition(anchorRef: RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>();
  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!open || !el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setPos({ top: r.bottom + 8, left: r.left, width: Math.min(PANEL_WIDTH, r.width) });
      });
    };
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left, width: Math.min(PANEL_WIDTH, r.width) });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, { capture: true });
    };
  }, [anchorRef, open]);
  return pos;
}

/**
 * ช่องพิมพ์ค้นหาใน Hero + แผงแนะนำตัวกรอง (ดีไซน์ 2a "Home Search Variations")
 * เปิด: hover ค้าง 150ms / focus / แตะ · ปิด: เมาส์ออกจากช่องและแผง 250ms (ถ้าช่องไม่ focus) · blur · Esc
 * 3 กลุ่ม: ประเภทร้าน + สไตล์ (จากการ์ดหมวดหน้าแรก) · ร้านยอดนิยม 4 ร้านแรก · พิมพ์ = กรองตามชื่อ/คำโปรย
 * แผงอยู่ใน portal (Hero เป็น overflow-hidden) · ไม่มี highlight แล้วกด Enter = submit ฟอร์มเดิม
 */
export function HeroSuggest({
  anchorRef,
  placeholder,
  categories,
  popularBars,
  filterQuery,
}: {
  /** ฟอร์มค้นหา — แผงวางใต้ฟอร์ม · กดนอกฟอร์ม = blur = ปิด */
  anchorRef: RefObject<HTMLElement | null>;
  placeholder?: string;
  categories?: HomeCategory[];
  popularBars: BarWithTier[];
  /** query ตัวกรองย่าน/งบ/คน (budgetSearchQuery ไม่รวม q) ที่ต่อท้ายลิงก์ประเภท/สไตล์ */
  filterQuery: string;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const listId = useId();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  /** กด Esc / เลือกแล้ว = ซ่อนจนกว่าจะพิมพ์ คลิก หรือ hover ใหม่ */
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const hover = useHoverIntent({ openDelay: 150, closeDelay: 250 });

  const groups = filterGroups(buildGroups(categories, popularBars, filterQuery, q.trim()), q);
  const flat = groups.flatMap((g) => g.items);
  const hasSource = categories !== undefined || popularBars.length > 0;
  const open = !dismissed && hasSource && (hover.hovered || focused);
  const pos = usePanelPosition(anchorRef, open);
  const activeItem = open ? flat[active] : undefined;
  const optionId = (item: SuggestItem) => `${listId}-${item.id}`;

  const close = () => {
    setDismissed(true);
    setActive(-1);
    hover.reset();
  };
  const reopen = () => {
    setDismissed(false);
  };
  const choose = (item: SuggestItem) => {
    close();
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!flat.length) return;
      e.preventDefault();
      if (!open) {
        reopen();
        setActive(e.key === 'ArrowDown' ? 0 : flat.length - 1);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i < 0 ? (step > 0 ? 0 : flat.length - 1) : (i + step + flat.length) % flat.length));
    } else if (e.key === 'Enter' && activeItem) {
      e.preventDefault();
      choose(activeItem);
    }
  };

  return (
    <>
      <input
        name="q"
        role="combobox"
        aria-label="ค้นหาร้าน"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeItem ? optionId(activeItem) : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
          reopen();
        }}
        onFocus={() => {
          setFocused(true);
          reopen();
        }}
        onBlur={() => {
          setFocused(false);
          setActive(-1);
          hover.reset();
        }}
        onPointerDown={reopen}
        onPointerEnter={(e) => {
          // มือถือแตะ = focus เปิดให้อยู่แล้ว · hover intent ใช้เฉพาะเมาส์
          if (e.pointerType !== 'mouse') return;
          reopen();
          hover.onEnter();
        }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && hover.onLeave()}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none placeholder:text-white/70"
      />
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              key="hero-suggest"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className="fixed z-[1000] rounded-[10px] border border-border bg-card p-1.5 text-left shadow-[0_18px_48px_rgba(0,0,0,.6)]"
              onPointerEnter={(e) => e.pointerType === 'mouse' && hover.onEnter()}
              onPointerLeave={(e) => e.pointerType === 'mouse' && hover.onLeave()}
              // คลิกในแผงไม่ให้ช่องค้นหา blur (แผงจะปิดก่อน click ทำงาน)
              onMouseDown={(e) => e.preventDefault()}
            >
              <div
                id={listId}
                role="listbox"
                aria-label="ตัวกรองแนะนำ"
                className="max-h-[330px] overflow-y-auto overscroll-contain"
              >
                {groups.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted">
                    กด "ค้นหา" เพื่อหาร้านจากคำว่า "{q.trim()}"
                  </p>
                ) : (
                  groups.map((g) => (
                    <div key={g.title} role="presentation">
                      <div
                        role="presentation"
                        className="px-3 pb-1.5 pt-2.5 text-[11px] font-semibold tracking-[.06em] text-muted"
                      >
                        {g.title}
                      </div>
                      {g.items.map((item) => {
                        const isActive = item === activeItem;
                        const ItemIcon = item.icon;
                        return (
                          <div
                            key={item.id}
                            id={optionId(item)}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => choose(item)}
                            onPointerMove={() => setActive(flat.indexOf(item))}
                            className={`flex cursor-pointer select-none items-center gap-3 rounded-md px-3 py-[9px] transition-colors ${isActive ? 'bg-[#231d2e]' : 'hover:bg-[#231d2e]'}`}
                          >
                            <ItemIcon size={17} className="shrink-0 text-gold" aria-hidden />
                            <span className="min-w-0 truncate text-sm text-text">{item.label}</span>
                            <span className="ml-auto shrink-0 truncate pl-3 text-xs text-muted">{item.hint}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

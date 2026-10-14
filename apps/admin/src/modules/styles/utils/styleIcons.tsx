import {
  BowlFood,
  BuildingOffice,
  Coffee,
  Confetti,
  Disc,
  Door,
  ForkKnife,
  GameController,
  Guitar,
  Heart,
  Microphone,
  Moon,
  MusicNotes,
  Sparkle,
  SpeakerSimpleNone,
  Star,
  Tag,
  Television,
  Tree,
  Users,
  Waves,
  type Icon,
} from '@phosphor-icons/react';
import type { StyleIcon as StyleIconName } from '@nightout/contracts';

/** ชื่อไอคอนใน STYLE_ICONS (@nightout/contracts) → คอมโพเนนต์ Phosphor */
export const STYLE_ICON_COMPONENTS: Record<StyleIconName, Icon> = {
  MusicNotes,
  Coffee,
  Disc,
  BuildingOffice,
  ForkKnife,
  SpeakerSimpleNone,
  Tree,
  Door,
  BowlFood,
  Microphone,
  Guitar,
  Sparkle,
  Moon,
  Confetti,
  GameController,
  Television,
  Waves,
  Heart,
  Users,
  Star,
};

/** ไอคอนของสไตล์ — ชื่อที่ไม่รู้จัก (ตั้งผ่าน migration) แสดงเป็น Tag */
export function StyleIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Glyph = (STYLE_ICON_COMPONENTS as Record<string, Icon>)[name] ?? Tag;
  return <Glyph size={size} aria-hidden />;
}

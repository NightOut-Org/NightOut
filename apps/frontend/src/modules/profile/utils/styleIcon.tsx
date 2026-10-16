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
  Television,
  Tree,
  Users,
  Waves,
  type Icon,
  type IconProps,
} from '@phosphor-icons/react';
import type { StyleIcon as StyleIconName } from '@nightout/contracts';

/** ชื่อไอคอนใน STYLE_ICONS (@nightout/contracts · แอดมินเลือกที่ Backoffice /styles) → คอมโพเนนต์ Phosphor */
const STYLE_ICON_COMPONENTS: Record<StyleIconName, Icon> = {
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

/** ไอคอนของสไตล์ร้าน — ไม่มีชื่อ / ไม่รู้จัก (snapshot เก่า · ตั้งผ่าน migration) = Sparkle */
export function StyleIcon({ name, ...props }: { name?: string } & IconProps) {
  const Glyph = (name && (STYLE_ICON_COMPONENTS as Record<string, Icon>)[name]) || Sparkle;
  return <Glyph aria-hidden {...props} />;
}

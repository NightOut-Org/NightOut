import { Image, PencilSimple, Trash } from '@phosphor-icons/react';
import { motionTokens } from '@nightout/ui';
import { App, Dropdown, Image as AntImage, Spin } from 'antd';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ROLE_META, roleScope } from '@/configs/roles';
import { useRoles } from '@/hooks/useRoles';
import { useAuth, type AppUser } from '@/services/auth';
import { getBar } from '@/services/data';
import { UserAvatar } from '@/ui/components/userAvatar';
import { removeAvatar, setAvatar } from '../api';
import { avatarFileError, resizeAvatar, type AvatarCrop } from '../utils/resizeAvatar';
import { AvatarCropModal } from './avatarCropModal';

/** หัวโปรไฟล์: รูปใหญ่ขอบสีชั้นบัญชี (กดดูรูปเต็ม) + ปุ่ม "แก้ไขรูป" (ครอปก่อนอัปโหลด) · ชื่อ · ป้ายชั้นบัญชี */
export function ProfileHeader({ user }: { user: AppUser }) {
  const { reload } = useAuth();
  const { message, modal } = App.useApp();
  const reduce = useReducedMotion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [viewing, setViewing] = useState(false);
  const meta = ROLE_META[user.role];
  const RoleIcon = meta.icon;
  const roles = useRoles();
  const tone = roles.tone(user.role);
  const label = user.roleLabel || roles.label(user.role);
  const scope = roleScope(user.role, user.barId ? getBar(user.barId)?.name : undefined);
  const shown = previewUrl ?? user.avatarUrl ?? null;

  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const pick = (file: File) => {
    const err = avatarFileError(file);
    if (err) return void message.error(err);
    setCropFile(file);
  };

  const upload = async (file: File, crop: AvatarCrop) => {
    setCropFile(null);
    setUploading(true);
    try {
      const blob = await resizeAvatar(file, crop);
      setPreviewUrl(URL.createObjectURL(blob));
      await setAvatar(user.id, blob);
      await reload();
      message.success('เปลี่ยนรูปโปรไฟล์แล้ว');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setPreviewUrl(null);
      setUploading(false);
    }
  };

  const remove = () =>
    modal.confirm({
      title: 'ลบรูปโปรไฟล์?',
      content: 'จะกลับไปใช้ตัวย่อชื่อแทนรูป',
      okText: 'ลบรูป',
      okButtonProps: { danger: true },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          await removeAvatar();
          await reload();
          message.success('ลบรูปโปรไฟล์แล้ว');
        } catch (e) {
          message.error((e as Error).message);
        }
      },
    });

  return (
    <header className="flex flex-col items-center gap-3.5 text-center">
      <div className="relative">
        <Spin spinning={uploading}>
          <button
            type="button"
            aria-label="ดูรูปโปรไฟล์เต็ม"
            disabled={!user.avatarUrl || uploading}
            onClick={() => setViewing(true)}
            className="relative block size-[136px] cursor-pointer overflow-hidden rounded-full border-4 p-0 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
            style={{ borderColor: tone.solid }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={shown ?? 'initials'}
                className="absolute inset-0"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: motionTokens.duration.base, ease: motionTokens.ease.out }}
              >
                <UserAvatar name={user.displayName} src={shown} size={128} className="!size-full !text-[42px]" />
              </motion.div>
            </AnimatePresence>
          </button>
        </Spin>
        {user.avatarUrl && (
          <AntImage
            src={user.avatarUrl}
            alt={`รูปโปรไฟล์ของ ${user.displayName}`}
            // ซ่อนด้วย style (ไม่ใช่ rootClassName — antd ส่ง rootClassName ต่อให้หน้าต่าง preview ด้วย จะถูกซ่อนตาม)
            style={{ display: 'none' }}
            // ดูอย่างเดียว: ไม่มีแถบเครื่องมือ (พลิก/หมุน/ซูม) · ลาก/ซูมไม่ได้
            preview={{
              open: viewing,
              onOpenChange: setViewing,
              actionsRender: () => null,
              movable: false,
              minScale: 1,
              maxScale: 1,
            }}
          />
        )}
        <Dropdown
          trigger={['click']}
          placement="bottom"
          disabled={uploading}
          menu={{
            items: [
              { key: 'upload', icon: <Image size={16} />, label: 'อัปโหลดรูปใหม่' },
              ...(user.avatarUrl ? [{ key: 'remove', icon: <Trash size={16} />, label: 'ลบรูป', danger: true }] : []),
            ],
            onClick: ({ key }) => (key === 'upload' ? fileRef.current?.click() : remove()),
          }}
        >
          <button
            type="button"
            className="absolute -bottom-3.5 left-1/2 flex h-[30px] -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs whitespace-nowrap text-text transition-colors hover:border-gold disabled:cursor-wait"
            disabled={uploading}
          >
            <PencilSimple size={14} />
            แก้ไขรูป
          </button>
        </Dropdown>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) pick(f);
          }}
        />
        {cropFile && (
          <AvatarCropModal
            key={`${cropFile.name}-${cropFile.lastModified}`}
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onConfirm={(f, crop) => void upload(f, crop)}
          />
        )}
      </div>
      <h1 className="mt-[18px] font-display text-[28px] leading-tight font-bold break-words sm:text-[34px]">
        {user.displayName}
      </h1>
      <span
        className="inline-flex min-h-9 max-w-full flex-wrap items-center justify-center gap-x-2 rounded-full px-4 py-1 text-[15px] font-semibold"
        style={{ background: tone.solid, color: tone.on, boxShadow: `0 8px 24px -10px ${tone.tint(0.6)}` }}
      >
        <RoleIcon size={18} weight="fill" />
        {label}
        <span className="ml-1 font-normal opacity-75">{scope}</span>
      </span>
    </header>
  );
}

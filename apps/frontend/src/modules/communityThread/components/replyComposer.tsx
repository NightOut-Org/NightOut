import {
  COMMUNITY_COMMENT_MAX,
  COMMUNITY_MEDIA_LIMITS,
  type CommunityComment,
  type CommunityMediaItem,
  type CommunityDraft,
  type CommunityDraftPayload,
} from '@nightout/contracts';
import { Image as ImageIcon, PaperPlaneRight, VideoCamera, X } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, type InputRef } from 'antd';
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft';
import { useAuth, type AppUser } from '@/services/auth';
import { useAuthModal } from '@/ui/components/authModal';
import { CommunityAvatar } from '@/ui/components/communityAvatar';
import {
  CommunityMediaPicker,
  type CommunityMediaPickerHandle,
  type MediaUpdate,
} from '@/ui/components/communityMediaPicker';
import { DraftStatus } from '@/ui/components/draftStatus';
import { addComment, deleteReplyDraft, saveReplyDraft, useMyDrafts } from '../api';

interface ReplyValue {
  body: string;
  parent_id: string | null;
  media: CommunityMediaItem[];
}
const EMPTY: ReplyValue = { body: '', parent_id: null, media: [] };
const toPayload = (v: ReplyValue): CommunityDraftPayload => ({
  body: v.body,
  parent_id: v.parent_id,
  media: v.media,
});

/** หน้ากระทู้สั่งช่องตอบ: กด "ตอบกลับ" ที่ความเห็น → ผูกความเห็นนั้น + โฟกัสช่องพิมพ์ */
export interface ReplyComposerHandle {
  replyTo: (c: CommunityComment) => void;
}

interface Props {
  threadId: string;
  comments: CommunityComment[];
  ref?: Ref<ReplyComposerHandle>;
}

/**
 * ช่องตอบกระทู้ — มือถือติดขอบล่าง · จอใหญ่อยู่เหนือรายการความเห็น
 * ร่างตอบ (REPLY) บันทึกที่ backend อัตโนมัติ เปิดกระทู้นี้จากเครื่องไหนก็พิมพ์ต่อได้ · ส่งสำเร็จ backend ลบร่างให้
 * รอโหลดร่างเดิมก่อนแล้วค่อย mount ช่องพิมพ์ (ค่าแรก = ร่างนั้น) · key = กระทู้ — โหลดร่างใหม่ภายหลังไม่ล้างข้อความที่กำลังพิมพ์
 */
export function ReplyComposer({ threadId, comments, ref }: Props) {
  const { user } = useAuth();
  const drafts = useMyDrafts(!!user);
  if (!user)
    return <ReplyBox threadId={threadId} comments={comments} user={null} draft={null} ref={ref} />;
  if (drafts.isPending || !drafts.isFetchedAfterMount) return <Shell>{null}</Shell>;
  const d = drafts.data?.find((x) => x.kind === 'REPLY' && x.thread_id === threadId) ?? null;
  return (
    <ReplyBox
      key={threadId}
      threadId={threadId}
      comments={comments}
      user={user}
      draft={d}
      ref={ref}
    />
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 min-h-[68px] border-t border-border bg-background px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 md:static md:z-auto md:rounded-2xl md:border md:bg-surface md:p-4">
      {children}
    </div>
  );
}

function ReplyBox({
  threadId,
  comments,
  user,
  draft,
  ref,
}: Props & { user: AppUser | null; draft: CommunityDraft | null }) {
  const { openLogin } = useAuthModal();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [value, setValue] = useState<ReplyValue>(() => {
    if (!draft) return EMPTY;
    const parent = draft.payload.parent_id;
    return {
      body: draft.payload.body ?? '',
      parent_id: parent && comments.some((c) => c.id === parent) ? parent : null,
      media: draft.payload.media ?? [],
    };
  });
  const [restored, setRestored] = useState(!!draft?.payload.body || !!draft?.payload.media?.length);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const picker = useRef<CommunityMediaPickerHandle>(null);
  const setMedia: MediaUpdate = (fn) => setValue((v) => ({ ...v, media: fn(v.media) }));
  const pick = (kind: 'image' | 'video') => (user ? picker.current?.open(kind) : login());
  const login = () => openLogin(`/community/t/${threadId}`);

  const autosave = useAutosaveDraft({
    value,
    enabled: !!user,
    isEmpty: (v) => !v.body.trim() && v.media.length === 0,
    save: (v) => saveReplyDraft(threadId, toPayload(v)),
    remove: () => deleteReplyDraft(threadId),
    initialSavedAt: draft?.updated_at ?? null,
  });

  useImperativeHandle(ref, () => ({
    replyTo: (c) => {
      setValue((v) => ({ ...v, parent_id: c.id }));
      inputRef.current?.focus();
    },
  }));

  const parent = comments.find((c) => c.id === value.parent_id) ?? null;
  // มีไฟล์แนบแล้ว ไม่ต้องพิมพ์ข้อความก็ส่งได้
  const canSend = (!!value.body.trim() || value.media.length > 0) && !sending;

  const send = async () => {
    if (!user) return login();
    if (!canSend) return;
    setSending(true);
    try {
      await addComment(threadId, {
        body: value.body.trim(),
        parent_id: value.parent_id,
        media: value.media,
      });
      setValue(EMPTY);
      autosave.baseline(EMPTY, null); // backend ลบร่างให้แล้ว
      setRestored(false);
      void qc.invalidateQueries({ queryKey: ['community'] });
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Shell>
      {(parent || restored) && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          {parent && (
            <span className="inline-flex items-center gap-1 rounded-full bg-card py-1 pl-2.5 pr-1">
              ตอบ <b className="font-semibold text-text">{parent.author.name}</b>
              <button
                type="button"
                aria-label="ยกเลิกการตอบความเห็นนี้"
                onClick={() => setValue((v) => ({ ...v, parent_id: null }))}
                className="grid size-6 place-items-center rounded-full bg-transparent"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {restored && (
            <span className="inline-flex items-center gap-1.5">
              ใช้ร่างที่ค้างไว้
              <button
                type="button"
                onClick={() => {
                  setValue(EMPTY);
                  setRestored(false);
                }}
                className="bg-transparent font-semibold text-link"
              >
                เริ่มใหม่
              </button>
            </span>
          )}
        </div>
      )}
      <CommunityMediaPicker ref={picker} variant="row" value={value.media} onChange={setMedia} />
      <div className="flex items-end gap-2.5 md:items-start md:gap-3">
        <span className="mb-5 flex shrink-0 md:hidden">
          <AttachButton label="แนบรูป" onClick={() => pick('image')}>
            <ImageIcon size={22} />
          </AttachButton>
          <AttachButton label="แนบวิดีโอ" onClick={() => pick('video')} className="-ml-1.5">
            <VideoCamera size={22} />
          </AttachButton>
        </span>
        {user && (
          <span className="mt-[5px] hidden shrink-0 md:block">
            <CommunityAvatar id={user.id} name={user.displayName} size={36} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Input.TextArea
            ref={inputRef}
            value={value.body}
            readOnly={!user}
            onChange={(e) => {
              setValue((v) => ({ ...v, body: e.target.value }));
              setRestored(false);
            }}
            onClick={() => !user && login()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
            }}
            maxLength={COMMUNITY_COMMENT_MAX}
            autoSize={{ minRows: 1, maxRows: 6 }}
            placeholder={user ? 'แสดงความคิดเห็นอย่างสุภาพ…' : 'เข้าสู่ระบบเพื่อแสดงความคิดเห็น'}
            aria-label="แสดงความคิดเห็น"
            enterKeyHint="send"
            className="!rounded-[22px] !px-4 !py-2.5 !text-base"
          />
          <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-3 gap-y-1 px-1 md:mt-2 md:px-0">
            <span className="-ml-2.5 hidden items-center gap-1 md:flex">
              <AttachButton label="แนบรูป" onClick={() => pick('image')} wide>
                <ImageIcon size={18} /> รูปภาพ
              </AttachButton>
              <AttachButton label="แนบวิดีโอ" onClick={() => pick('video')} wide>
                <VideoCamera size={18} /> วิดีโอ
              </AttachButton>
              <span className="ml-1 text-xs text-muted">
                {value.media.length}/{COMMUNITY_MEDIA_LIMITS.maxFiles} ไฟล์ · วิดีโอไม่เกิน{' '}
                {COMMUNITY_MEDIA_LIMITS.videoSeconds} วิ / {COMMUNITY_MEDIA_LIMITS.videoMB}MB
              </span>
            </span>
            <DraftStatus
              status={autosave.status}
              savedAt={autosave.savedAt}
              onRetry={() => void autosave.flush()}
            />
            <Button
              type="primary"
              disabled={!canSend}
              loading={sending}
              onClick={() => void send()}
              className="!ml-auto !hidden !h-9 !rounded-full !px-5 !font-bold md:!inline-flex"
            >
              ตอบกลับ
            </Button>
          </div>
        </div>
        <Button
          type="primary"
          shape="circle"
          size="large"
          aria-label="ส่งความคิดเห็น"
          disabled={!canSend}
          loading={sending}
          onClick={() => void send()}
          icon={<PaperPlaneRight size={20} weight="fill" />}
          className="!mb-5 !size-[46px] shrink-0 md:!hidden"
        />
      </div>
    </Shell>
  );
}

function AttachButton({
  label,
  onClick,
  children,
  wide = false,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`touch-manipulation select-none rounded-full border-0 bg-transparent text-muted active:bg-card ${
        wide
          ? 'inline-flex h-8 items-center gap-1 px-2.5 text-[13px] font-medium md:hover:bg-card'
          : 'grid size-11 place-items-center'
      } ${className}`}
    >
      {children}
    </button>
  );
}

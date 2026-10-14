import {
  COMMUNITY_COMMENT_MAX,
  COMMUNITY_MEDIA_LIMITS,
  type CommunityComment,
  type CommunityDraft,
  type CommunityMediaItem,
} from '@nightout/contracts';
import { Image as ImageIcon, VideoCamera } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, Skeleton } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft';
import {
  CommunityMediaPicker,
  type CommunityMediaPickerHandle,
  type MediaUpdate,
} from '@/ui/components/communityMediaPicker';
import { DraftStatus } from '@/ui/components/draftStatus';
import { deleteCommentEditDraft, saveCommentEditDraft, updateComment, useMyDrafts } from '../api';

interface EditValue {
  body: string;
  media: CommunityMediaItem[];
}

const fromComment = (c: CommunityComment): EditValue => ({
  body: c.body,
  media: c.media.map((m) => ({
    path: m.path,
    kind: m.kind,
    thumb_path: m.thumb_path,
    duration_sec: m.duration_sec,
  })),
});
const sameContent = (a: EditValue, b: EditValue) =>
  a.body.trim() === b.body.trim() &&
  a.media.length === b.media.length &&
  a.media.every((m, i) => m.path === b.media[i]!.path && m.thumb_path === b.media[i]!.thumb_path);

interface Props {
  threadId: string;
  comment: CommunityComment;
  onClose: () => void;
}

/**
 * แก้ความเห็นในที่ (แทนข้อความในกล่องความเห็น) — ข้อความ + ไฟล์แนบ แล้วกด "บันทึก" ครั้งเดียว
 * ร่าง EDIT_COMMENT บันทึกที่ backend อัตโนมัติ (ไฟล์ที่เลือกอัปโหลดทันทีตามระบบร่างชุมชน) · ยกเลิก = ทิ้งร่าง + backend ลบไฟล์ที่ไม่ได้ใช้
 * รอโหลดร่างเดิมก่อน mount ช่องแก้ (ค่าแรก = ร่างของความเห็นนี้ ถ้ามี)
 */
export function CommentEditor(props: Props) {
  const drafts = useMyDrafts(true);
  if (drafts.isPending || !drafts.isFetchedAfterMount) {
    return <Skeleton active title={false} paragraph={{ rows: 2 }} className="mt-1" />;
  }
  const draft =
    drafts.data?.find(
      (d) =>
        d.kind === 'EDIT_COMMENT' &&
        d.thread_id === props.threadId &&
        d.payload.comment_id === props.comment.id,
    ) ?? null;
  return <EditorForm {...props} draft={draft} />;
}

function EditorForm({ threadId, comment, onClose, draft }: Props & { draft: CommunityDraft | null }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const original = useMemo(() => fromComment(comment), [comment]);
  const [value, setValue] = useState<EditValue>(() =>
    draft ? { body: draft.payload.body ?? '', media: draft.payload.media ?? [] } : original,
  );
  const [restored, setRestored] = useState(!!draft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const picker = useRef<CommunityMediaPickerHandle>(null);
  const setMedia: MediaUpdate = (fn) => setValue((v) => ({ ...v, media: fn(v.media) }));

  const previews = useMemo(
    () =>
      Object.fromEntries(
        comment.media.flatMap((m) => [
          ...(m.url ? [[m.path, m.url]] : []),
          ...(m.thumb_path && m.thumb_url ? [[m.thumb_path, m.thumb_url]] : []),
        ]),
      ) as Record<string, string>,
    [comment.media],
  );

  // ค่าเดิมของความเห็น = ไม่ต้องมีร่าง (ลบร่างทิ้ง)
  const autosave = useAutosaveDraft({
    value,
    enabled: true,
    isEmpty: (v) => sameContent(v, original),
    save: (v) =>
      saveCommentEditDraft(threadId, { comment_id: comment.id, body: v.body, media: v.media }),
    remove: () => deleteCommentEditDraft(threadId),
    initialSavedAt: draft?.updated_at ?? null,
  });

  const changed = !sameContent(value, original);
  const empty = !value.body.trim() && value.media.length === 0;
  const canSave = changed && !empty && uploading === 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateComment(comment.id, { body: value.body.trim(), media: value.media });
      autosave.cancel(); // backend ลบร่างให้แล้ว
      message.success('บันทึกการแก้ไขแล้ว');
      void qc.invalidateQueries({ queryKey: ['community'] });
      onClose();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    autosave.cancel();
    // มีร่างของความเห็นนี้ค้างอยู่ (ค่าแรกจากร่าง หรือบันทึกร่างไปแล้ว) → ทิ้ง · ไฟล์ที่ไม่ได้ใช้ backend ลบให้
    if (draft || autosave.savedAt) void deleteCommentEditDraft(threadId).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['community', 'drafts'] });
    onClose();
  };

  return (
    <fieldset disabled={saving} className="m-0 mt-1.5 min-w-0 border-0 p-0">
      {restored && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          ใช้ร่างที่แก้ค้างไว้
          <button
            type="button"
            onClick={() => {
              setValue(original);
              setRestored(false);
            }}
            className="bg-transparent font-semibold text-link"
          >
            กลับไปใช้ข้อความเดิม
          </button>
        </div>
      )}
      <Input.TextArea
        autoFocus
        value={value.body}
        onChange={(e) => {
          setValue((v) => ({ ...v, body: e.target.value }));
          setRestored(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
          if (e.key === 'Escape') cancel();
        }}
        maxLength={COMMUNITY_COMMENT_MAX}
        autoSize={{ minRows: 2, maxRows: 8 }}
        placeholder="แก้ความคิดเห็น…"
        aria-label="แก้ความคิดเห็น"
        className="!rounded-xl !px-3 !py-2 !text-base md:!text-sm"
      />
      <div className="mt-2">
        <CommunityMediaPicker
          ref={picker}
          variant="row"
          value={value.media}
          onChange={setMedia}
          previews={previews}
          onUploading={(d) => setUploading((n) => n + d)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <button
          type="button"
          aria-label="แนบรูป"
          onClick={() => picker.current?.open('image')}
          className="inline-flex h-9 touch-manipulation select-none items-center gap-1 rounded-full bg-transparent px-2.5 text-[13px] font-medium text-muted active:bg-card md:hover:bg-card"
        >
          <ImageIcon size={18} /> รูปภาพ
        </button>
        <button
          type="button"
          aria-label="แนบวิดีโอ"
          onClick={() => picker.current?.open('video')}
          className="inline-flex h-9 touch-manipulation select-none items-center gap-1 rounded-full bg-transparent px-2.5 text-[13px] font-medium text-muted active:bg-card md:hover:bg-card"
        >
          <VideoCamera size={18} /> วิดีโอ
        </button>
        <span className="text-xs text-muted">
          {value.media.length}/{COMMUNITY_MEDIA_LIMITS.maxFiles}
        </span>
        <span className="ml-2">
          <DraftStatus
            status={autosave.status}
            savedAt={autosave.savedAt}
            onRetry={() => void autosave.flush()}
          />
        </span>
        <span className="ml-auto flex gap-2">
          <Button onClick={cancel} className="!rounded-full">
            ยกเลิก
          </Button>
          <Button
            type="primary"
            loading={saving}
            disabled={!canSave}
            onClick={() => void save()}
            className="!rounded-full !font-bold"
          >
            บันทึก
          </Button>
        </span>
      </div>
    </fieldset>
  );
}

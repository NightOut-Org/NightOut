import {
  COMMUNITY_BODY_MAX,
  COMMUNITY_DRAFT_TTL_DAYS,
  COMMUNITY_MEDIA_LIMITS,
  COMMUNITY_TITLE_MAX,
  type CommunityDraft,
  type CommunityDraftPayload,
  type CommunityMediaItem,
  type CommunityThreadDetail,
} from '@nightout/contracts';
import { ClockCounterClockwise, Info, Storefront, X } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, Result, Select, Skeleton } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft';
import { listBars } from '@/services/data';
import { useAuth } from '@/services/auth';
import { CommunityMediaPicker } from '@/ui/components/communityMediaPicker';
import { DraftStatus } from '@/ui/components/draftStatus';
import { clockTime } from '@/ui/utils/community';
import {
  createThread,
  deleteDraft,
  saveDraft,
  updateThread,
  useCategories,
  useMyDrafts,
  useThreadToEdit,
} from './api';
import { LeaveDraftModal } from './components/leaveDraftModal';

interface ThreadForm {
  category: string | null;
  title: string;
  body: string;
  bar_id: string | null;
  media: CommunityMediaItem[];
}
const EMPTY: ThreadForm = { category: null, title: '', body: '', bar_id: null, media: [] };
const fromThread = (t: CommunityThreadDetail): ThreadForm => ({
  category: t.category,
  title: t.title,
  body: t.body,
  bar_id: t.bar?.id ?? null,
  media: t.media.map((m) => ({
    path: m.path,
    kind: m.kind,
    thumb_path: m.thumb_path,
    duration_sec: m.duration_sec,
  })),
});
/** ภาพย่อของไฟล์ในกระทู้เดิม (signed URL ที่ได้มากับกระทู้) */
const previewsOf = (t: CommunityThreadDetail | undefined) =>
  Object.fromEntries(
    (t?.media ?? []).flatMap((m) => [
      ...(m.url ? [[m.path, m.url] as const] : []),
      ...(m.thumb_path && m.thumb_url ? [[m.thumb_path, m.thumb_url] as const] : []),
    ]),
  );
const fromDraft = (p: CommunityDraftPayload, fallback: ThreadForm): ThreadForm => ({
  category: p.category ?? fallback.category,
  title: p.title ?? '',
  body: p.body ?? '',
  bar_id: p.bar_id ?? null,
  media: p.media ?? [],
});
const sameForm = (a: ThreadForm, b: ThreadForm) => JSON.stringify(a) === JSON.stringify(b);
const BACKOFFICE_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * ตั้งกระทู้ใหม่ (/community/new) และแก้กระทู้ (/community/t/:id/edit)
 * ร่างบันทึกที่ backend อัตโนมัติ (NEW 1 ร่างต่อบัญชี · EDIT 1 ร่างต่อกระทู้) — กลับมาหน้าเดิมจากเครื่องไหนก็เติมให้เอง
 */
export function CommunityComposePage() {
  const { id: editId } = useParams();
  const [params] = useSearchParams();
  const kind = editId ? 'EDIT' : 'NEW';
  const { user } = useAuth();
  const navigate = useNavigate();
  const editing = useThreadToEdit(editId, user?.id ?? null);
  const drafts = useMyDrafts();

  if (editId && editing.isSuccess && !editing.data.is_mine) {
    return (
      <Result
        status="403"
        title="แก้ได้เฉพาะกระทู้ของตัวเอง"
        extra={<Button onClick={() => navigate(`/community/t/${editId}`)}>กลับไปที่กระทู้</Button>}
      />
    );
  }
  if (editing.isError || drafts.isError) {
    return (
      <Result
        status="warning"
        title="เปิดฟอร์มไม่สำเร็จ"
        subTitle={(editing.error ?? drafts.error)?.message}
      />
    );
  }
  if (!drafts.isSuccess || !drafts.isFetchedAfterMount || (editId && !editing.isSuccess)) {
    return (
      <div className="mx-auto max-w-[920px] md:rounded-2xl md:border md:border-border md:bg-surface md:p-8">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  // ค่าตั้งต้น: กระทู้เดิม (แก้) / หมวดจาก ?category= (ใหม่) → ทับด้วยร่างถ้ามี · key คงที่ = โหลดร่างใหม่ทีหลังไม่ล้างฟอร์ม
  const base: ThreadForm = editing.data
    ? fromThread(editing.data)
    : { ...EMPTY, category: params.get('category') };
  const draft =
    drafts.data.find((x) => x.kind === kind && (x.thread_id ?? undefined) === editId) ?? null;
  return (
    <ComposeForm
      key={editId ?? 'new'}
      editId={editId}
      base={base}
      draft={draft}
      previews={previewsOf(editing.data)}
    />
  );
}

function ComposeForm({
  editId,
  base,
  draft,
  previews,
}: {
  editId?: string;
  base: ThreadForm;
  draft: CommunityDraft | null;
  previews: Record<string, string>;
}) {
  const kind = editId ? 'EDIT' : 'NEW';
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const categories = useCategories();

  const [initial] = useState(base);
  const [form, setForm] = useState<ThreadForm>(() =>
    draft ? fromDraft(draft.payload, base) : base,
  );
  const [restoredAt, setRestoredAt] = useState<string | null>(() =>
    draft && !sameForm(fromDraft(draft.payload, base), base) ? draft.updated_at : null,
  );
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const autosave = useAutosaveDraft({
    value: form,
    enabled: true,
    // ร่างที่ไม่ต่างจากค่าตั้งต้น (ฟอร์มว่าง / กระทู้เดิมที่ยังไม่แก้) ไม่ต้องเก็บ
    isEmpty: (v) =>
      sameForm(v, initial) ||
      (!v.title.trim() && !v.body.trim() && !v.bar_id && v.media.length === 0),
    save: (v) => saveDraft(kind, editId ?? null, v),
    remove: () => deleteDraft(kind, editId ?? null),
    initialSavedAt: draft?.updated_at ?? null,
  });
  const { baseline } = autosave;

  const isStaff = !!user && BACKOFFICE_ROLES.has(user.role);
  const cats = (categories.data ?? []).filter(
    (c) => !c.staff_only || isStaff || c.slug === form.category,
  );
  const barOptions = useMemo(
    () => listBars({}).map((b) => ({ value: b.id, label: b.name, district: b.district })),
    [],
  );
  const changed = !sameForm(form, initial);
  const canPost = !!form.category && form.title.trim().length >= 3 && !posting && uploading === 0;
  const set = <K extends keyof ThreadForm>(k: K, v: ThreadForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const backTo = editId ? `/community/t/${editId}` : '/community';
  const exit = () => (history.length > 1 ? navigate(-1) : navigate(backTo, { replace: true }));
  const requestClose = () => (changed ? setLeaving(true) : exit());

  const keepAndLeave = async () => {
    setLeaveBusy(true);
    const ok = await autosave.flush();
    setLeaveBusy(false);
    if (!ok) return message.error('บันทึกร่างไม่สำเร็จ — เช็กอินเทอร์เน็ตแล้วลองอีกครั้ง');
    void qc.invalidateQueries({ queryKey: ['community', 'drafts'] });
    exit();
  };
  const discardAndLeave = async () => {
    setLeaveBusy(true);
    autosave.cancel();
    await deleteDraft(kind, editId ?? null).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['community', 'drafts'] });
    exit();
  };
  const startOver = async () => {
    setForm(initial);
    baseline(initial, null);
    setRestoredAt(null);
    await deleteDraft(kind, editId ?? null).catch((e: Error) => message.error(e.message));
    void qc.invalidateQueries({ queryKey: ['community', 'drafts'] });
  };

  const post = async () => {
    if (!canPost || !form.category) return;
    setPosting(true);
    const body = {
      category: form.category,
      title: form.title.trim(),
      body: form.body.trim(),
      bar_id: form.bar_id,
      media: form.media,
    };
    try {
      const r = editId ? await updateThread(editId, body) : await createThread(body);
      autosave.cancel(); // backend ลบร่างให้แล้ว
      void qc.invalidateQueries({ queryKey: ['community'] });
      message.success(editId ? 'แก้กระทู้แล้ว' : 'โพสต์กระทู้แล้ว');
      navigate(`/community/t/${r.id}`, { replace: true });
    } catch (e) {
      message.error((e as Error).message);
      setPosting(false);
    }
  };

  const heading = editId ? 'แก้กระทู้' : 'ตั้งกระทู้ใหม่';
  const postLabel = editId ? 'บันทึกการแก้ไข' : 'โพสต์กระทู้';

  return (
    <div className="mx-auto max-w-[920px]">
      {/* แถบบน (มือถือ) */}
      <div className="-mx-4 -mt-6 mb-4 flex items-center gap-1.5 border-b border-border px-1.5 pb-2 md:hidden">
        <button
          type="button"
          aria-label="ปิด"
          onClick={requestClose}
          className="grid size-11 place-items-center rounded-full bg-transparent text-text"
        >
          <X size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{heading}</div>
          <DraftStatus
            status={autosave.status}
            savedAt={autosave.savedAt}
            onRetry={() => void autosave.flush()}
          />
        </div>
        <Button
          type="primary"
          shape="round"
          disabled={!canPost}
          loading={posting}
          onClick={() => void post()}
          className="!mr-1.5 !font-bold"
        >
          {editId ? 'บันทึก' : 'โพสต์'}
        </Button>
      </div>

      <div className="md:rounded-2xl md:border md:border-border md:bg-surface md:p-8">
        <header className="mb-6 hidden items-center justify-between gap-3 md:flex">
          <h1 className="m-0 text-[28px] font-bold">{heading}</h1>
          {/* มุมขวา: สถานะร่างล่าสุด · ยังไม่ได้บันทึกอะไร = บอกว่าบันทึกอัตโนมัติ */}
          <span className="shrink-0 text-right">
            {autosave.status === 'idle' || (autosave.status === 'saved' && !autosave.savedAt) ? (
              <span className="text-[13px] text-muted">บันทึกร่างอัตโนมัติ</span>
            ) : (
              <DraftStatus
                status={autosave.status}
                savedAt={autosave.savedAt}
                onRetry={() => void autosave.flush()}
              />
            )}
          </span>
        </header>

        <div className="flex flex-col gap-[18px]">
          {restoredAt && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-purple/40 bg-purple/10 px-3.5 py-2.5 text-[13px]"
            >
              <ClockCounterClockwise size={18} className="shrink-0 text-link" />
              <span className="flex-1">
                ใช้ร่างที่ค้างไว้ · บันทึกล่าสุด {clockTime(restoredAt)}
              </span>
              <button
                type="button"
                onClick={() => void startOver()}
                className="bg-transparent font-semibold text-link"
              >
                เริ่มใหม่
              </button>
            </div>
          )}

          <Field label="หมวดหมู่">
            <div role="radiogroup" aria-label="หมวดหมู่" className="flex flex-wrap gap-2">
              {categories.isPending
                ? [0, 1, 2, 3, 4].map((i) => (
                    <Skeleton.Button key={i} active size="small" shape="round" />
                  ))
                : cats.map((c) => {
                    const on = form.category === c.slug;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set('category', c.slug)}
                        className={`h-[34px] touch-manipulation select-none whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium ${
                          on
                            ? 'border-text bg-text text-background'
                            : 'border-border bg-transparent text-text'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
            </div>
          </Field>

          <Field label="หัวข้อ" hint={`${form.title.length}/${COMMUNITY_TITLE_MAX}`}>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value.slice(0, COMMUNITY_TITLE_MAX))}
              placeholder="เช่น ร้านไหนเปิดถึงตีสี่แถวรัชดา"
              aria-label="หัวข้อ"
              className="!h-[50px] !rounded-xl !text-base !font-semibold"
            />
          </Field>

          <Field label="รายละเอียด">
            <Input.TextArea
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              maxLength={COMMUNITY_BODY_MAX}
              autoSize={{ minRows: 6, maxRows: 16 }}
              placeholder="เล่าเพิ่มอีกนิด งบ จำนวนคน หรือบรรยากาศที่อยากได้"
              aria-label="รายละเอียด"
              className="!rounded-xl !px-3.5 !py-3 !text-base !leading-relaxed"
            />
          </Field>

          <Field
            label="รูปภาพ / วิดีโอ"
            hint={`สูงสุด ${COMMUNITY_MEDIA_LIMITS.maxFiles} ไฟล์ · วิดีโอไม่เกิน ${COMMUNITY_MEDIA_LIMITS.videoSeconds} วิ`}
          >
            <CommunityMediaPicker
              value={form.media}
              onChange={(fn) => setForm((f) => ({ ...f, media: fn(f.media) }))}
              previews={previews}
              onUploading={(d) => setUploading((n) => n + d)}
            />
            {uploading > 0 && (
              <div className="mt-1.5 text-xs text-muted">
                กำลังอัปโหลด {uploading} ไฟล์ — โพสต์ได้เมื่ออัปโหลดเสร็จ
              </div>
            )}
          </Field>

          <Field label="แท็กร้าน" hint="ไม่บังคับ">
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              value={form.bar_id ?? undefined}
              onChange={(v?: string) => set('bar_id', v ?? null)}
              options={barOptions}
              optionRender={(o) => (
                <span>
                  {o.data.label} <span className="text-xs text-muted">· {o.data.district}</span>
                </span>
              )}
              placeholder="ค้นหาชื่อร้าน"
              prefix={<Storefront size={20} className="text-link" />}
              aria-label="แท็กร้าน"
              className="!h-[52px] w-full md:max-w-md [&_.ant-select-selector]:!rounded-xl"
            />
          </Field>

          <div className="flex gap-2.5 rounded-xl bg-gold/[0.14] px-3.5 py-3 text-[13px] leading-relaxed">
            <Info size={18} className="mt-px shrink-0 text-gold-text" />
            <div>
              <div className="font-semibold">ก่อนโพสต์</div>
              <ul className="m-0 mt-0.5 list-disc pl-4">
                <li>ตั้งหัวข้อให้ชัด ระบุย่านหรือวันที่</li>
                <li>แท็กร้านเพื่อให้คนอ่านจองต่อได้ทันที</li>
                <li>ไม่โฆษณาแฝง · 20+ · ดื่มไม่ขับ</li>
              </ul>
              <div className="mt-1 text-muted">
                ร่างเก็บไว้ในบัญชี {COMMUNITY_DRAFT_TTL_DAYS} วัน
              </div>
            </div>
          </div>

          <div className="hidden justify-end gap-2 md:flex">
            <Button size="large" onClick={requestClose}>
              ยกเลิก
            </Button>
            <Button
              type="primary"
              size="large"
              disabled={!canPost}
              loading={posting}
              onClick={() => void post()}
              className="!font-bold"
            >
              {postLabel}
            </Button>
          </div>
        </div>
      </div>

      <LeaveDraftModal
        open={leaving}
        busy={leaveBusy}
        onKeep={() => void keepAndLeave()}
        onDiscard={() => void discardAndLeave()}
        onCancel={() => setLeaving(false)}
      />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-[13px] font-semibold">
        <span>{label}</span>
        {hint && <span className="font-normal text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

import {
  COMMUNITY_BODY_MAX,
  COMMUNITY_DRAFT_TTL_DAYS,
  COMMUNITY_MEDIA_LIMITS,
  COMMUNITY_SHOP_NEWS_CATEGORY,
  COMMUNITY_SHOP_NEWS_WEEKLY_MAX,
  COMMUNITY_SHOP_NEWS_WINDOW_DAYS,
  COMMUNITY_TITLE_MAX,
  type CommunityDraft,
  type CommunityDraftPayload,
  type CommunityMediaItem,
  type CommunityTeamBar,
  type CommunityThreadDetail,
} from '@nightout/contracts';
import { ClockCounterClockwise, Info, Storefront, Warning, X } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { ALCOHOL_WARNING_TEXT, alcoholWordsIn } from '@nightout/utils';
import { Alert, App, Button, Input, Result, Select, Skeleton } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useAutosaveDraft } from '@/hooks/useAutosaveDraft';
import { listBars } from '@/services/data';
import { useAuth } from '@/services/auth';
import { CommunityMediaPicker } from '@/ui/components/communityMediaPicker';
import { DraftStatus } from '@/ui/components/draftStatus';
import { clockTime } from '@/ui/utils/community';
import { dateTime } from '@/ui/utils/format';
import {
  createThread,
  deleteDraft,
  saveDraft,
  updateThread,
  useCategories,
  useMyCommunityTeam,
  useMyDrafts,
  useThreadToEdit,
} from './api';
import { LeaveDraftModal } from './components/leaveDraftModal';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';

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
const isShopNews = (category: string | null) => category === COMMUNITY_SHOP_NEWS_CATEGORY;
const quotaFull = (b: CommunityTeamBar) => b.shop_news_used >= b.shop_news_limit;

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
  const team = useMyCommunityTeam(user?.id ?? null);

  if (editId && editing.isSuccess && !editing.data.is_mine) {
    return (
      <Result
        status="403"
        title="แก้ได้เฉพาะกระทู้ของตัวเอง"
        extra={<Button onClick={() => navigate(`/community/t/${editId}`)}>กลับไปที่กระทู้</Button>}
      />
    );
  }
  if (editing.isError || drafts.isError || team.isError) {
    return (
      <Result
        status="warning"
        title="เปิดฟอร์มไม่สำเร็จ"
        subTitle={(editing.error ?? drafts.error ?? team.error)?.message}
      />
    );
  }
  if (
    !drafts.isSuccess ||
    !drafts.isFetchedAfterMount ||
    !team.isSuccess ||
    (editId && !editing.isSuccess)
  ) {
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
      team={team.data}
      previews={previewsOf(editing.data)}
    />
  );
}

function ComposeForm({
  editId,
  base,
  draft,
  team,
  previews,
}: {
  editId?: string;
  base: ThreadForm;
  draft: CommunityDraft | null;
  /** ร้านที่ฉันอยู่ในทีม (ว่าง = ไม่ใช่ทีมร้าน) */
  team: CommunityTeamBar[];
  previews: Record<string, string>;
}) {
  const kind = editId ? 'EDIT' : 'NEW';
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const categories = useCategories();

  // ทีมร้าน: ตั้งกระทู้ใหม่ได้เฉพาะ "ข่าวจากร้าน" ของร้านที่แสดงอยู่ (ร้านถูกระงับ = มีป้ายแต่ตั้งข่าวไม่ได้)
  const isTeam = team.length > 0;
  const postable = team.filter((b) => b.can_post);
  const defaultTeamBar = postable.length === 1 ? (postable[0]?.bar_id ?? null) : null;
  /** ปรับค่าตามสิทธิ์ (ใช้กับทั้ง ?category= และร่าง → initial ตรงกับฟอร์ม ร่างไม่บันทึกเอง) */
  const coerce = (f: ThreadForm): ThreadForm => {
    if (editId) {
      // ร่างของการแก้อาจค้างจากก่อนเข้าทีมร้าน: ข่าวจากร้านล็อกหมวด + ร้าน · ทีมร้านย้ายหมวดไม่ได้
      // และแท็กร้านตัวเองใหม่ไม่ได้ (COMMUNITY_TEAM_OWN_TAG) → กลับเป็นค่าของกระทู้เดิม
      if (isShopNews(base.category)) return { ...f, category: base.category, bar_id: base.bar_id };
      if (!isTeam) return isShopNews(f.category) ? { ...f, category: base.category } : f;
      const newOwnTag =
        !!f.bar_id && f.bar_id !== base.bar_id && team.some((b) => b.bar_id === f.bar_id);
      return { ...f, category: base.category, bar_id: newOwnTag ? base.bar_id : f.bar_id };
    }
    if (!isTeam) return isShopNews(f.category) ? { ...f, category: null } : f;
    return {
      ...f,
      category: COMMUNITY_SHOP_NEWS_CATEGORY,
      bar_id: postable.some((b) => b.bar_id === f.bar_id) ? f.bar_id : defaultTeamBar,
    };
  };

  const [initial] = useState(() => coerce(base));
  const [form, setForm] = useState<ThreadForm>(() =>
    draft ? coerce(fromDraft(draft.payload, base)) : initial,
  );
  const [restoredAt, setRestoredAt] = useState<string | null>(() =>
    draft && !sameForm(coerce(fromDraft(draft.payload, base)), initial) ? draft.updated_at : null,
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
  const initialIsShopNews = isShopNews(initial.category);
  const cats = (categories.data ?? []).filter((c) => {
    // แก้กระทู้: ข่าวจากร้าน / ทีมร้าน = หมวดเดิมเท่านั้น (ย้ายหมวดไม่ได้)
    if (editId && (initialIsShopNews || isTeam)) return c.slug === initial.category;
    if (!editId && isTeam) return c.team_only || (c.staff_only && isStaff);
    return !c.team_only && (!c.staff_only || isStaff || c.slug === form.category);
  });
  const barOptions = useMemo(
    () => listBars({}).map((b) => ({ value: b.id, label: b.name, district: b.district })),
    [],
  );
  // นอกหมวดข่าวจากร้าน ทีมร้านแท็กร้านตัวเองเพิ่มไม่ได้ (COMMUNITY_TEAM_OWN_TAG) · แท็กเดิมของกระทู้คงไว้ได้
  const ownBarIds = new Set(
    team.map((b) => b.bar_id).filter((id) => !(editId && id === initial.bar_id)),
  );
  const generalBarOptions = barOptions.filter((o) => !ownBarIds.has(o.value));

  const shopNews = isShopNews(form.category);
  // ข่าวจากร้าน: เตือน (ไม่บล็อก) เมื่อหัวข้อ/รายละเอียดมีคำเกี่ยวกับแอลกอฮอล์ (พ.ร.บ.ฯ ม.30)
  const shopNewsAlcoholWords = shopNews ? alcoholWordsIn(`${form.title}\n${form.body}`) : [];
  const selectedTeamBar = team.find((b) => b.bar_id === form.bar_id);
  const teamBarOptions: {
    value: string;
    label: string;
    disabled: boolean;
    bar?: CommunityTeamBar;
  }[] = [
    ...team.map((b) => ({
      value: b.bar_id,
      label: b.name,
      disabled: !b.can_post || (!editId && quotaFull(b)),
      bar: b,
    })),
    // แก้ข่าวของร้านที่ฉันไม่ได้อยู่ทีมแล้ว — ช่อง (ที่ล็อกอยู่) ยังแสดงชื่อร้าน
    ...(editId && initial.bar_id && !team.some((b) => b.bar_id === initial.bar_id)
      ? barOptions
          .filter((o) => o.value === initial.bar_id)
          .map((o) => ({ value: o.value, label: o.label, disabled: true }))
      : []),
  ];
  /** ข่าวจากร้านที่ฉันแก้ไม่ได้แล้ว (ร้านไม่แสดงแล้ว / ไม่ได้อยู่ทีมของร้านที่แท็ก) */
  const shopNewsEditLocked =
    !!editId && initialIsShopNews && !postable.some((b) => b.bar_id === initial.bar_id);
  /** ทีมร้านที่ทุกร้านถูกระงับ — ตั้งกระทู้ใหม่ไม่ได้ชั่วคราว */
  const teamSuspended = !editId && isTeam && postable.length === 0;
  const shopNewsReady =
    !shopNews ||
    (!!form.bar_id &&
      (!!editId || (!!selectedTeamBar && selectedTeamBar.can_post && !quotaFull(selectedTeamBar))));

  const changed = !sameForm(form, initial);
  const canPost =
    !!form.category &&
    form.title.trim().length >= 3 &&
    shopNewsReady &&
    !shopNewsEditLocked &&
    !teamSuspended &&
    !posting &&
    uploading === 0;
  const set = <K extends keyof ThreadForm>(k: K, v: ThreadForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  /** เปลี่ยนหมวด → ร้านที่แท็กต้องเข้ากับหมวดใหม่ (ข่าวจากร้าน = ร้านตัวเอง · หมวดอื่น = ไม่ใช่ร้านตัวเอง) */
  const pickCategory = (slug: string) =>
    setForm((f) => {
      let bar_id = f.bar_id;
      if (isShopNews(slug)) {
        if (!postable.some((b) => b.bar_id === bar_id)) bar_id = defaultTeamBar;
      } else if (bar_id && ownBarIds.has(bar_id)) {
        bar_id = null;
      }
      return { ...f, category: slug, bar_id };
    });

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
    <div className="embers-glass relative isolate mx-auto max-w-[920px]">
      {/* พื้นหลัง Golden Embers เดียวกับหน้า /community (ธีมมืด) */}
      <EmbersBackdrop />
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

          {teamSuspended ? (
            <Note>
              ร้านของคุณถูกระงับอยู่ — ตั้งกระทู้ใหม่ไม่ได้ชั่วคราว (คอมเมนต์และตอบได้ตามปกติ)
            </Note>
          ) : shopNewsEditLocked ? (
            <Note>แก้ข่าวจากร้านได้เฉพาะทีมของร้านที่แท็ก (ร้านที่แสดงอยู่)</Note>
          ) : (
            !editId &&
            isTeam && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[13px]"
              >
                <Storefront size={18} className="mt-px shrink-0 text-gold-text" />
                <span className="flex-1">
                  บัญชีนี้อยู่ในทีมร้าน — ตั้งกระทู้ได้เฉพาะหมวด "ข่าวจากร้าน" ·
                  คอมเมนต์และตอบได้ทุกกระทู้
                </span>
              </div>
            )
          )}

          <Field label="หมวดหมู่">
            <div role="radiogroup" aria-label="หมวดหมู่" className="flex flex-wrap gap-2">
              {categories.isPending
                ? [0, 1, 2, 3, 4].map((i) => <Skeleton.Button key={i} active shape="round" />)
                : cats.map((c) => {
                    const on = form.category === c.slug;
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => pickCategory(c.slug)}
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

          {shopNewsAlcoholWords.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<Warning size={18} weight="fill" />}
              title="อาจผิด พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.30"
              description={`พบคำ: ${shopNewsAlcoholWords.join(', ')} — ${ALCOHOL_WARNING_TEXT} (ยังโพสต์ได้ ตรวจถ้อยคำให้แน่ใจก่อน)`}
            />
          )}

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

          {shopNews ? (
            <Field label="ร้านของคุณ" hint="บังคับ">
              <Select
                value={form.bar_id ?? undefined}
                onChange={(v: string) => set('bar_id', v)}
                options={teamBarOptions}
                disabled={!!editId}
                optionRender={(o) => {
                  const b = o.data.bar;
                  if (!b) return o.data.label;
                  // ตัวเลือกของ antd ตัดบรรทัดเดียว (ellipsis) → ให้ขึ้นบรรทัดใหม่ได้ บนมือถือจะได้เห็นเวลาโพสต์ได้อีก
                  return (
                    <span className="block whitespace-normal">
                      {b.name}{' '}
                      <span className="text-xs text-muted">
                        {!b.can_post
                          ? '· ร้านถูกระงับ — โพสต์ข่าวไม่ได้'
                          : `· โพสต์แล้ว ${b.shop_news_used}/${b.shop_news_limit}${
                              !editId && quotaFull(b) && b.next_slot_at
                                ? ` · ครบแล้ว — โพสต์ได้อีก ${dateTime(b.next_slot_at)}`
                                : ''
                            }`}
                      </span>
                    </span>
                  );
                }}
                placeholder="เลือกร้านที่จะโพสต์ข่าว"
                prefix={<Storefront size={20} className="text-link" />}
                aria-label="ร้านของคุณ"
                className="!h-[52px] w-full md:max-w-md [&_.ant-select-selector]:!rounded-xl"
              />
              {editId && (
                <div className="mt-1.5 text-xs text-muted">
                  ข่าวจากร้านเปลี่ยนหมวดหรือร้านที่แท็กไม่ได้
                </div>
              )}
            </Field>
          ) : (
            <Field label="แท็กร้าน" hint="ไม่บังคับ">
              <Select
                allowClear
                showSearch={{ optionFilterProp: 'label' }}
                value={form.bar_id ?? undefined}
                onChange={(v?: string) => set('bar_id', v ?? null)}
                options={generalBarOptions}
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
          )}

          <div className="flex gap-2.5 rounded-xl bg-gold/[0.14] px-3.5 py-3 text-[13px] leading-relaxed">
            <Info size={18} className="mt-px shrink-0 text-gold-text" />
            <div>
              <div className="font-semibold">ก่อนโพสต์</div>
              {shopNews ? (
                <ul className="m-0 mt-0.5 list-disc pl-4">
                  <li>
                    ร้านละไม่เกิน {COMMUNITY_SHOP_NEWS_WEEKLY_MAX} กระทู้ใน{' '}
                    {COMMUNITY_SHOP_NEWS_WINDOW_DAYS} วัน (นับรวมทั้งทีม · ลบแล้วก็ยังนับ)
                  </li>
                  <li>
                    ห้ามโปรโมชัน ลด แจก แถมเครื่องดื่มแอลกอฮอล์ (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์
                    ม.30/32)
                  </li>
                  <li>ห้ามพูดถึงร้านอื่นในทางเสีย — ลูกค้ารายงานได้ ทีมงานซ่อน/ลบได้</li>
                  <li>โพสต์และความเห็นของคุณจะมีป้าย "ทีมร้าน · &lt;ชื่อร้าน&gt;"</li>
                  {selectedTeamBar && (
                    <li>
                      {selectedTeamBar.name}: โพสต์แล้ว {selectedTeamBar.shop_news_used}/
                      {selectedTeamBar.shop_news_limit} ใน {COMMUNITY_SHOP_NEWS_WINDOW_DAYS} วัน
                      {!editId &&
                        quotaFull(selectedTeamBar) &&
                        selectedTeamBar.next_slot_at &&
                        ` — ครบแล้ว โพสต์ได้อีก ${dateTime(selectedTeamBar.next_slot_at)}`}
                    </li>
                  )}
                </ul>
              ) : (
                <ul className="m-0 mt-0.5 list-disc pl-4">
                  <li>ตั้งหัวข้อให้ชัด ระบุย่านหรือวันที่</li>
                  <li>แท็กร้านเพื่อให้คนอ่านจองต่อได้ทันที</li>
                  <li>ไม่โฆษณาแฝง · 20+ · ดื่มไม่ขับ</li>
                </ul>
              )}
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

/** ข้อความแจ้งเหตุที่โพสต์/บันทึกไม่ได้ (โทนเงียบ) */
function Note({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] text-muted"
    >
      <Info size={18} className="mt-px shrink-0" />
      <span className="flex-1">{children}</span>
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

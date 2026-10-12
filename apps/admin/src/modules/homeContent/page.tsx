import { PageContainer } from '@ant-design/pro-components';
import { ArrowSquareOut, PencilSimple } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { App, Button, Card, Form, Space, Spin, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { webSrc } from '@/ui/utils/image';
import { CategoryDrawer } from './form/categoryDrawer';
import { HeroForm } from './form/heroForm';
import { PopularCard } from './form/popularCard';
import { SectionHeadingForm } from './form/sectionHeadingForm';
import { SLOT_LABELS, SLOT_SPAN } from './utils/slots';
import { useHomePageDraft, type ContentValues } from './utils/useHomePageDraft';
import { homePageAction, useBars, useHomeContent, useHomeCategories, useHomePopular } from './api';

/** หน้าแรกบนเว็บลูกค้า (deploy: โดเมนเดียวกัน · dev: คนละ port) */
const HOME_URL = import.meta.env.DEV ? 'http://localhost:5173/' : '/';

/**
 * หน้าแรก — แก้ Hero · การ์ดหมวด "คืนนี้อยากได้ฟีลไหน" · ร้านยอดนิยม ของเว็บลูกค้า (เรียงตามลำดับบนเว็บ)
 * หัวข้อของแต่ละ section แก้ใน Card ของ section นั้น (SectionHeadingForm) ไม่ปนกับฟอร์ม Hero
 * แก้ทั้งหน้าแล้วกดบันทึกครั้งเดียว (อัปโหลดภาพ → PUT /admin/home-page) · ขึ้นเว็บทันที (ลูกค้าที่เปิดหน้าอยู่เห็นเมื่อโหลดใหม่/กลับมาที่แท็บ) · ทุกการแก้ลง Audit Log
 */
export function HomeContentPage() {
  const { message } = App.useApp();
  const content = useHomeContent();
  const categories = useHomeCategories();
  const pinned = useHomePopular();
  const bars = useBars();
  const [editing, setEditing] = useState<Db.AdminHomeCategory | null>(null);
  const [form] = Form.useForm<ContentValues>();
  const savedPopular = useMemo(() => (pinned.data ?? []).map((p) => p.bar_id), [pinned.data]);
  const draft = useHomePageDraft(form, content.data?.[0], savedPopular);
  const act = useAdminAction();
  const [progress, setProgress] = useState<string | null>(null);
  const saving = progress !== null || act.isPending;
  const { confirmDiscard } = useUnsavedGuard(draft.count > 0);
  // ร้านยอดนิยมที่ไม่แสดงบนเว็บแล้ว ต้องเอาออกก่อนบันทึก
  const notApproved = draft.popularIds.some((id) => bars.data?.find((b) => b.id === id)?.status !== 'APPROVED');

  const save = async () => {
    setProgress('กำลังบันทึก…');
    try {
      let body;
      try {
        body = await draft.upload((done, total) => setProgress(done < total ? `กำลังอัปโหลด ${done + 1}/${total}` : 'กำลังบันทึก…'));
      } catch (e) {
        // ฟอร์มผิด → antd แสดงช่องที่ผิดแล้ว · อัปโหลดพลาด → แจ้ง
        if (e instanceof Error) void message.error(`อัปโหลดภาพไม่สำเร็จ — ${e.message}`);
        return;
      }
      await act.mutateAsync({ ...homePageAction(body), success: 'บันทึกหน้าแรกแล้ว' });
      await Promise.all([content.refetch(), categories.refetch(), pinned.refetch()]);
      draft.reset();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
    } finally {
      setProgress(null);
    }
  };

  return (
    <PageContainer
      title="หน้าแรก"
      subTitle="แก้แล้วขึ้นเว็บทันที"
      extra={
        <Space wrap>
          <Button href={HOME_URL} target="_blank" rel="noreferrer" icon={<ArrowSquareOut size={16} />}>
            ดูหน้าแรก
          </Button>
          <SaveBar
            count={draft.count}
            saving={saving}
            progress={progress}
            disabled={notApproved}
            onSave={() => void save()}
            onReset={() => confirmDiscard(draft.reset)}
          />
        </Space>
      }
    >
      <LoadError error={content.error ?? categories.error} onRetry={() => void (content.refetch(), categories.refetch())} />
      <Spin spinning={saving} description={progress ?? undefined}>
      <Form<ContentValues> form={form} layout="vertical" disabled={saving || !content.data} className="space-y-6">
        <HeroForm loading={!content.data} preview={draft.heroPreview} onPickImage={draft.setHeroImage} />

        <Card title="การ์ดหมวด" loading={categories.isLoading}>
          <SectionHeadingForm
            fields={{ eyebrow: 'categories_eyebrow', title: 'categories_title' }}
            placeholders={{ eyebrow: 'เลือกตามสไตล์', title: 'คืนนี้อยากได้ฟีลไหน' }}
          />
          <p className="mb-4 text-sm opacity-70">ตำแหน่งบนกริดตายตัว กดการ์ดเพื่อแก้ภาพ ชื่อ คำอธิบาย ป้าย หรือลิงก์</p>
          <ul className="grid auto-rows-[120px] grid-cols-2 gap-3 lg:grid-cols-4">
            {(categories.data ?? []).map((row) => {
              const { values: c, image, changed } = draft.categoryOf(row);
              return (
                <li key={row.slot} className={SLOT_SPAN[row.slot] ?? ''}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setEditing(row)}
                    aria-label={`แก้การ์ด ${c.title} (${SLOT_LABELS[row.slot] ?? row.slot})`}
                    className="group relative flex size-full cursor-pointer flex-col justify-between overflow-hidden rounded-xl border-0 bg-[#14121c] bg-cover bg-center p-3 text-left text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b64c]"
                    style={{ backgroundImage: `url("${image.startsWith('blob:') ? image : webSrc(image)}")` }}
                  >
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />
                    <span className="relative flex justify-between gap-2">
                      <span>{changed && <Tag color="warning" className="!m-0">ยังไม่บันทึก</Tag>}</span>
                      <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <PencilSimple size={12} /> แก้
                      </span>
                    </span>
                    <span className="relative min-w-0">
                      {c.badge && (
                        <span className="mb-1 inline-block rounded-full bg-[#e8b64c] px-2 text-[11px] font-semibold text-[#07070d]">
                          {c.badge}
                        </span>
                      )}
                      <span className="block truncate font-semibold">{c.title}</span>
                      <span className="block truncate text-xs text-white/70">{c.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <PopularCard ids={draft.popularIds} onChange={draft.setPopular} dirty={draft.popularDirty} disabled={saving} />
      </Form>
      </Spin>
      <CategoryDrawer
        category={editing}
        current={editing ? draft.categoryOf(editing) : null}
        onApply={(values, file) => editing && draft.setCategory(editing.slot, values, file)}
        onClose={() => setEditing(null)}
      />
    </PageContainer>
  );
}

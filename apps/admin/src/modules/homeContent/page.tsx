import { PageContainer } from '@ant-design/pro-components';
import { ArrowDown, ArrowSquareOut, ArrowUp, User } from '@phosphor-icons/react';
import { SITE_NAV_LABEL_MAX, type SaveSiteNavResult } from '@nightout/contracts';
import { Button, Card, Input, Space, Switch, Table, Tabs, Tag, Tooltip } from 'antd';
import { useState } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { saveSiteNavAction, useSiteNav } from './api';
import { NAV_LINKS } from './utils/navLinks';
import { useSiteNavDraft, type NavMode, type NavRow } from './utils/useSiteNavDraft';
import { RuleList } from '@/ui/components/RuleList';

/** เว็บลูกค้า (deploy: โดเมนเดียวกัน · dev: คนละ port) */
const WEB_URL = import.meta.env.DEV ? 'http://localhost:5173/' : '/';

const MODES: { key: NavMode; label: string; hint: string }[] = [
  {
    key: 'desktop',
    label: 'Navbar (คอมพิวเตอร์)',
    hint: 'แถบเมนูด้านบนของทุกหน้า เรียงจากซ้ายไปขวา',
  },
  {
    key: 'mobile',
    label: 'แถบเมนูล่าง (มือถือ)',
    hint: 'แถบลอยด้านล่างบนมือถือ เรียงจากซ้ายไปขวา โดย "โปรไฟล์" อยู่ท้ายสุดเสมอ (แนะนำไม่เกิน 5 เมนู)',
  },
];

/**
 * /home-content — เมนู navbar ของเว็บลูกค้า (นอก MVP — อนุมัติ 2026-10-15)
 * เปลี่ยนชื่อ (ใช้ร่วมทั้ง 2 ชุด) · เรียงลำดับ · ซ่อน/แสดง แยก navbar คอมพิวเตอร์ กับแถบเมนูล่างมือถือ แล้วบันทึกครั้งเดียว (PUT /admin/site-nav · audit)
 * ลิงก์และไอคอนตายตัว · หน้าหลักซ่อนไม่ได้ · บัญชีร้านไม่เห็น "การจอง" (เห็น "ร้านของฉัน" แทน)
 */
export function HomeContentPage() {
  const { data, isLoading, error, refetch } = useSiteNav();
  const act = useAdminAction();
  const draft = useSiteNavDraft(data ?? []);
  const [mode, setMode] = useState<NavMode>('desktop');
  const saving = act.isPending;
  const { confirmDiscard } = useUnsavedGuard(draft.changes > 0);

  const save = async () => {
    try {
      await act.mutateAsync({
        ...saveSiteNavAction(draft.body()),
        success: (r) => `บันทึกเมนูแล้ว (เปลี่ยน ${(r as SaveSiteNavResult).updated} เมนู)`,
      });
      await refetch();
      draft.reset();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
    }
  };

  const tab = (m: NavMode) => {
    const list = draft.list(m);
    const last = list.length - 1;
    const shown = list.filter((r) => draft.isVisible(m, r));
    return (
      <div className="space-y-4">
        <p className="m-0 text-sm opacity-70">{MODES.find((x) => x.key === m)!.hint}</p>

        <div
          aria-label="ตัวอย่างเมนู"
          className="overflow-x-auto rounded-full border border-[#2a2638] bg-[#0d0b14] p-1.5"
        >
          <ol className="m-0 flex list-none items-center gap-1 p-0">
            {shown.map((r, i) => {
              const Icon = NAV_LINKS[r.key].icon;
              return (
                <li
                  key={r.key}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                    i === 0 ? 'bg-[#e8b64c] font-semibold text-[#07070d]' : 'text-white/80'
                  }`}
                >
                  {m === 'mobile' && <Icon size={16} />}
                  {r.label.trim() || '—'}
                </li>
              );
            })}
            {m === 'mobile' && (
              <li className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/50">
                <User size={16} /> โปรไฟล์
              </li>
            )}
          </ol>
        </div>

        <Table<NavRow>
          rowKey="key"
          loading={isLoading}
          dataSource={list}
          pagination={false}
          scroll={{ x: 720 }}
          columns={[
            {
              title: 'ลำดับ',
              key: 'order',
              width: 96,
              render: (_, r, i) => (
                <Space size={2}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowUp size={14} />}
                    disabled={saving || i === 0}
                    aria-label={`เลื่อน ${r.label} ขึ้น`}
                    onClick={() => draft.move(m, i, -1)}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<ArrowDown size={14} />}
                    disabled={saving || i === last}
                    aria-label={`เลื่อน ${r.label} ลง`}
                    onClick={() => draft.move(m, i, 1)}
                  />
                </Space>
              ),
            },
            {
              title: 'ลิงก์',
              key: 'link',
              width: 170,
              render: (_, r) => {
                const { icon: Icon, to } = NAV_LINKS[r.key];
                return (
                  <span className="inline-flex items-center gap-2">
                    <Icon size={18} aria-hidden />
                    <code className="text-xs">{to}</code>
                  </span>
                );
              },
            },
            {
              title: 'ชื่อที่แสดง',
              key: 'label',
              render: (_, r) => {
                const err = draft.errors.has(r.key);
                return (
                  <Tooltip title={err ? 'กรอกชื่อเมนู' : undefined} open={err ? undefined : false}>
                    <Input
                      value={r.label}
                      maxLength={SITE_NAV_LABEL_MAX}
                      disabled={saving}
                      status={err ? 'error' : undefined}
                      aria-label={`ชื่อเมนู ${NAV_LINKS[r.key].to}`}
                      aria-invalid={err}
                      onChange={(e) => draft.rename(r.key, e.target.value)}
                    />
                  </Tooltip>
                );
              },
            },
            {
              title: 'แสดง',
              key: 'visible',
              width: 80,
              render: (_, r) => (
                <Tooltip title={draft.canHide(r.key) ? undefined : 'หน้าหลักซ่อนไม่ได้'}>
                  <Switch
                    checked={draft.isVisible(m, r)}
                    disabled={saving || !draft.canHide(r.key)}
                    aria-label={`แสดง ${r.label}`}
                    onChange={(v) => draft.toggle(m, r.key, v)}
                  />
                </Tooltip>
              ),
            },
            {
              title: '',
              key: 'state',
              width: 120,
              render: (_, r) =>
                draft.isChanged(r.key) ? (
                  <Tag color="warning" className="!m-0">
                    ยังไม่บันทึก
                  </Tag>
                ) : !draft.isVisible(m, r) ? (
                  <Tag className="!m-0">ซ่อนอยู่</Tag>
                ) : null,
            },
          ]}
        />
      </div>
    );
  };

  return (
    <PageContainer
      title="เมนูเว็บ (Navbar)"
      content={
        <RuleList
          rules={[
            'แก้ชื่อ ลำดับ และการซ่อนเมนูของเว็บลูกค้า',
            'ชื่อเมนูใช้ร่วมกันทั้งคอมพิวเตอร์และมือถือ แต่ลำดับและการซ่อนตั้งแยกกัน',
            'บัญชีร้านไม่เห็น "การจอง" แต่เห็น "ร้านของฉัน" ท้ายสุดแทน',
            {
              tone: 'check',
              text: 'บันทึกแล้วขึ้นเว็บทันที ลูกค้าที่เปิดหน้าอยู่เห็นเมื่อโหลดใหม่',
            },
          ]}
        />
      }
      extra={
        <Space wrap>
          <Button
            href={WEB_URL}
            target="_blank"
            rel="noreferrer"
            icon={<ArrowSquareOut size={16} />}
          >
            ดูเว็บ
          </Button>
          <SaveBar
            count={draft.changes}
            saving={saving}
            disabled={draft.errors.size > 0}
            onSave={() => void save()}
            onReset={() => confirmDiscard(draft.reset)}
          />
        </Space>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <Card>
        <Tabs
          activeKey={mode}
          onChange={(k) => setMode(k as NavMode)}
          items={MODES.map((x) => ({ key: x.key, label: x.label, children: tab(x.key) }))}
        />
      </Card>
    </PageContainer>
  );
}

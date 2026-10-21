import { PageContainer } from '@ant-design/pro-components';
import { ArrowDown, ArrowUp, Plus, X } from '@phosphor-icons/react';
import { STYLE_ICONS, type SaveStylesResult } from '@nightout/contracts';
import { Alert, Button, Input, Select, Space, Switch, Table, Tag, Tooltip } from 'antd';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { saveStylesAction, useHomeCategories, useStyles } from './api';
import { StyleIcon } from './utils/styleIcons';
import { isNewStyle, useStylesDraft, type StyleRow } from './utils/useStylesDraft';
import { RuleList } from '@/ui/components/RuleList';

const ERROR_TEXT = { empty: 'กรอกชื่อสไตล์', duplicate: 'ชื่อซ้ำกับสไตล์อื่น' } as const;

const iconOption = (name: string) => ({
  value: name,
  label: (
    <span className="inline-flex items-center gap-2">
      <StyleIcon name={name} size={16} />
      <span className="truncate">{name}</span>
    </span>
  ),
});

/**
 * /styles — สไตล์ร้าน (Live Music, Rooftop …) ที่ร้านเลือกได้และลูกค้าใช้กรองในหน้าค้นหา
 * เพิ่ม / เปลี่ยนชื่อ / เปลี่ยนไอคอน / ซ่อน / เรียงลำดับ แล้วบันทึกครั้งเดียว (PUT /admin/styles · audit ต่อสไตล์) · ลบไม่ได้ ใช้ซ่อนแทน
 * ประเภทร้าน (bar_category) และประเภทโปรโมชัน (perk_type) แก้ผ่าน migration เท่านั้น
 */
export function StylesPage() {
  const { data, isLoading, error, refetch } = useStyles();
  const homeCategories = useHomeCategories();
  const act = useAdminAction();
  const draft = useStylesDraft(data ?? [], homeCategories.data ?? []);
  const saving = act.isPending;
  const { confirmDiscard } = useUnsavedGuard(draft.changes > 0);

  const save = async () => {
    try {
      await act.mutateAsync({
        ...saveStylesAction(draft.body()),
        success: (r) => {
          const { created, updated } = r as SaveStylesResult;
          return `บันทึกสไตล์แล้ว (เพิ่ม ${created} แก้ ${updated})`;
        },
      });
      await refetch();
      draft.reset();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
    }
  };

  const last = draft.list.length - 1;

  return (
    <PageContainer
      title="สไตล์ร้าน"
      content={
        <RuleList
          rules={[
            'สไตล์ที่ร้านเลือกได้ และลูกค้าใช้กรองในหน้าค้นหา',
            'ซ่อน = ไม่แสดงในตัวเลือกของร้าน ตัวกรอง และการ์ดร้าน (ร้านที่เลือกไว้ไม่หาย เปิดแสดงอีกครั้งได้)',
            { tone: 'warn', text: 'ลบสไตล์ไม่ได้ ใช้ซ่อนแทน' },
            {
              tone: 'warn',
              text: 'ประเภทร้าน (ผับ/บาร์ ชิล ร้านอาหาร) และประเภทโปรโมชันแก้ผ่าน migration เท่านั้น',
            },
          ]}
        />
      }
      extra={
        <Space wrap>
          <Button icon={<Plus size={16} />} disabled={saving || isLoading} onClick={draft.add}>
            เพิ่มสไตล์
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
      {draft.affected.length > 0 && (
        <Alert
          className="!mb-4"
          type="warning"
          showIcon
          title="การ์ดหมวดหน้าแรกลิงก์ด้วยชื่อสไตล์เดิม"
          description={
            <>
              บันทึกแล้วการ์ดจะพาไปหน้าค้นหาที่ว่างเปล่า — Backoffice แก้ลิงก์การ์ดหมวดไม่ได้แล้ว
              แจ้งทีมพัฒนาให้แก้ลิงก์ก่อน: {draft.affected.map((c) => c.title).join(', ')}
            </>
          }
        />
      )}
      <Table<StyleRow>
        rowKey="id"
        loading={isLoading}
        dataSource={draft.list}
        pagination={false}
        scroll={{ x: 900 }}
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
                  aria-label={`เลื่อน ${r.name_th || 'สไตล์ใหม่'} ขึ้น`}
                  onClick={() => draft.move(i, -1)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDown size={14} />}
                  disabled={saving || i === last}
                  aria-label={`เลื่อน ${r.name_th || 'สไตล์ใหม่'} ลง`}
                  onClick={() => draft.move(i, 1)}
                />
              </Space>
            ),
          },
          {
            title: 'ไอคอน',
            key: 'icon',
            width: 210,
            render: (_, r) => (
              <Select<string>
                value={r.icon}
                disabled={saving}
                className="w-full"
                aria-label={`ไอคอนของ ${r.name_th || 'สไตล์ใหม่'}`}
                options={[
                  ...((STYLE_ICONS as readonly string[]).includes(r.icon)
                    ? []
                    : [iconOption(r.icon)]),
                  ...STYLE_ICONS.map(iconOption),
                ]}
                onChange={(v) => draft.setIcon(r.id, v)}
              />
            ),
          },
          {
            title: 'ชื่อที่แสดง',
            key: 'name',
            render: (_, r) => {
              const err = draft.errors.get(r.id);
              return (
                <Tooltip title={err ? ERROR_TEXT[err] : undefined} open={err ? undefined : false}>
                  <Input
                    value={r.name_th}
                    maxLength={40}
                    disabled={saving}
                    status={err ? 'error' : undefined}
                    placeholder="เช่น Karaoke"
                    aria-label="ชื่อสไตล์"
                    aria-invalid={!!err}
                    onChange={(e) => draft.rename(r.id, e.target.value)}
                  />
                </Tooltip>
              );
            },
          },
          {
            title: 'ร้านที่ใช้',
            dataIndex: 'bar_count',
            width: 96,
            align: 'right',
            render: (v: number) => <span className="tabular-nums">{v}</span>,
          },
          {
            title: 'ลูกค้าที่ชอบ',
            dataIndex: 'fan_count',
            width: 110,
            align: 'right',
            render: (v: number) => <span className="tabular-nums">{v}</span>,
          },
          {
            title: 'แสดง',
            key: 'active',
            width: 80,
            render: (_, r) => (
              <Switch
                checked={r.active}
                disabled={saving}
                aria-label={`แสดง ${r.name_th || 'สไตล์ใหม่'}`}
                onChange={(v) => draft.toggle(r.id, v)}
              />
            ),
          },
          {
            title: '',
            key: 'state',
            width: 150,
            render: (_, r) =>
              isNewStyle(r) ? (
                <Space size={4}>
                  <Tag color="warning" className="!m-0">
                    ใหม่ (ยังไม่บันทึก)
                  </Tag>
                  <Button
                    type="text"
                    size="small"
                    icon={<X size={14} />}
                    disabled={saving}
                    aria-label="เอาสไตล์ใหม่ออก"
                    onClick={() => draft.discard(r.id)}
                  />
                </Space>
              ) : draft.isChanged(r) ? (
                <Tag color="warning" className="!m-0">
                  ยังไม่บันทึก
                </Tag>
              ) : !r.active ? (
                <Tag className="!m-0">ซ่อนอยู่</Tag>
              ) : null,
          },
        ]}
      />
    </PageContainer>
  );
}

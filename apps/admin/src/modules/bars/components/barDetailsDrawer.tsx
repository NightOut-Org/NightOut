import { ArrowSquareOut } from '@phosphor-icons/react';
import { Button, Drawer, Empty, Form, Grid, Space, Spin, Tabs, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { StatusTag } from '@/ui/components/StatusTag';
import { webSrc } from '@/ui/utils/image';
import { BAR_STATUS } from '@/ui/utils/labels';
import { barDetailsAction, useBarDetails, useDistricts, useStyleOptions } from '../api';
import { toInfoForm, useBarDetailsDraft, type InfoForm } from '../utils/useBarDetailsDraft';
import { BarInfoForm } from './barInfoForm';
import { MenuEditor } from './menuEditor';

type TabKey = 'info' | 'menu';

/**
 * Drawer "แก้ข้อมูลร้าน" แทนร้าน (/bars?edit=<id>) — แท็บข้อมูลร้าน + เมนูและราคา บันทึกครั้งเดียว (PUT /admin/bars/:id/details)
 * ไม่เรียก useUnsavedGuard เอง (router มี useBlocker ได้ตัวเดียว) — รายงาน dirty ให้หน้า /bars ผ่าน onDirtyChange แล้วหน้าถามก่อนปิด
 * บันทึกแล้ว: audit ต่อส่วน + แจ้งทีมร้าน 1 ครั้ง · บันทึกไม่สำเร็จ = draft ยังอยู่
 */
export function BarDetailsDrawer({
  barId,
  onClose,
  onDirtyChange,
}: {
  barId: string | null;
  /** ขอปิด — หน้า /bars ถามก่อนถ้ายังมีการแก้ค้าง */
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { md } = Grid.useBreakpoint();
  const [form] = Form.useForm<InfoForm>();
  const [tab, setTab] = useState<TabKey>('info');
  const details = useBarDetails(barId);
  const styles = useStyleOptions();
  const districts = useDistricts();
  const act = useAdminAction();
  const saving = act.isPending;

  const bar = details.data ?? null;
  const activeKeys = useMemo(
    () => new Set((styles.data ?? []).filter((s) => s.active).map((s) => s.key)),
    [styles.data],
  );
  const draft = useBarDetailsDraft(bar, activeKeys);
  // เปิดร้านอื่น = เริ่ม draft ใหม่ (Drawer ไม่ถูก unmount ระหว่างร้าน)
  const [draftFor, setDraftFor] = useState(barId);
  if (barId !== draftFor) {
    setDraftFor(barId);
    draft.reset();
  }
  const dirty = draft.count > 0;
  const ready = !!bar && !!styles.data;
  const missing = details.isSuccess && !details.data;
  const error = details.error ?? styles.error ?? districts.error;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const reset = () => {
    if (bar) form.setFieldsValue(toInfoForm(bar, activeKeys));
    draft.reset();
  };

  const save = async () => {
    if (!bar) return;
    let values: InfoForm | undefined;
    if (draft.infoDirty) {
      try {
        values = await form.validateFields();
      } catch {
        setTab('info'); // ฟอร์มแสดงช่องที่ผิดให้แล้ว
        return;
      }
    }
    try {
      await act.mutateAsync({
        ...barDetailsAction(bar.id, draft.body(values)),
        success: 'บันทึกข้อมูลร้านแล้ว — แจ้งทีมร้านแล้ว',
      });
    } catch {
      return; // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
    }
    const fresh = (await details.refetch()).data;
    if (fresh) form.setFieldsValue(toInfoForm(fresh, activeKeys));
    draft.reset();
  };

  return (
    <Drawer
      open={!!barId}
      onClose={() => !saving && onClose()}
      afterOpenChange={(o) => !o && setTab('info')}
      size={md ? 760 : '100%'}
      destroyOnHidden
      mask={{ closable: !saving }}
      keyboard={!saving}
      closable={{ disabled: saving }}
      title={
        bar ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate">{bar.name}</span>
            <StatusTag map={BAR_STATUS} value={bar.status} />
          </span>
        ) : (
          'แก้ข้อมูลร้าน'
        )
      }
      extra={
        bar && (
          <Space wrap>
            <Button
              href={webSrc(`/bars/${bar.slug}`)}
              target="_blank"
              rel="noreferrer"
              icon={<ArrowSquareOut size={16} />}
            >
              ดูหน้าร้าน
            </Button>
            <SaveBar
              count={draft.count}
              saving={saving}
              disabled={draft.menuChanged && draft.menuErrors > 0}
              onSave={() => void save()}
              onReset={reset}
            />
          </Space>
        )
      }
      footer={
        <Typography.Text type="secondary" className="text-xs">
          บันทึกแล้วทีมร้านได้รับแจ้งเตือน · ทุกการแก้ลง Audit Log
        </Typography.Text>
      }
    >
      <LoadError
        error={error}
        onRetry={() => {
          void details.refetch();
          void styles.refetch();
          void districts.refetch();
        }}
      />
      {missing ? (
        <Empty description="ไม่พบร้านนี้ — อาจถูกลบไปแล้ว" />
      ) : !ready ? (
        !error && (
          <div className="grid place-items-center py-16">
            <Spin />
          </div>
        )
      ) : (
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as TabKey)}
          items={[
            {
              key: 'info',
              label: draft.infoDirty ? 'ข้อมูลร้าน •' : 'ข้อมูลร้าน',
              forceRender: true,
              children: (
                <BarInfoForm
                  key={bar.id}
                  form={form}
                  bar={bar}
                  initialValues={toInfoForm(bar, activeKeys)}
                  styles={styles.data}
                  districts={districts.data ?? []}
                  disabled={saving}
                  onChange={draft.setInfo}
                />
              ),
            },
            {
              key: 'menu',
              label: `เมนูและราคา (${draft.rows.length})${draft.menuChanged ? ' •' : ''}`,
              children: <MenuEditor draft={draft} disabled={saving} />,
            },
          ]}
        />
      )}
    </Drawer>
  );
}

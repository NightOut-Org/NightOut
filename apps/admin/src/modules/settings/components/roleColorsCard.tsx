import type { SaveRoleColorsResult } from '@nightout/contracts';
import type { UserRole } from '@nightout/types';
import { Card, ColorPicker, Table, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { useAdminAuth } from '@/services/adminAuth';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { saveRoleColorsAction, useRoleColors } from '../api';

/** ตัวหนังสือบนป้ายทึบ — ดำ/ขาว ตามความสว่างของสี (สูตรเดียวกับ roleTone ของเว็บลูกค้า) */
function onColor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0) as [number, number, number];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.45 ? '#07070D' : '#FFFFFF';
}

/**
 * สีของชั้นบัญชี — เว็บลูกค้าใช้ทุกที่ที่แสดงชั้นบัญชี (ป้าย วงรอบรูป พื้นหลัง /profile รายการชั้นบัญชี ปุ่ม/เมนูบัญชีบน navbar)
 * Super Admin แก้ได้ (บันทึกครั้งเดียว · audit ต่อชั้น) · แอดมินดูอย่างเดียว
 */
export function RoleColorsCard() {
  const { isSuperAdmin } = useAdminAuth();
  const roles = useRoleColors();
  const act = useAdminAction();
  const [draft, setDraft] = useState<Partial<Record<UserRole, string>>>({});

  const changed = useMemo(
    () => (roles.data ?? []).filter((r) => draft[r.code] && draft[r.code] !== r.color).map((r) => ({ code: r.code, color: draft[r.code]! })),
    [roles.data, draft],
  );
  useUnsavedGuard(changed.length > 0);

  const save = async () => {
    try {
      await act.mutateAsync({
        ...saveRoleColorsAction({ items: changed }),
        success: (r) => `บันทึกสีชั้นบัญชีแล้ว (${(r as SaveRoleColorsResult).updated} ชั้น)`,
      });
      await roles.refetch();
      setDraft({});
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว · ค่าที่เลือกยังอยู่ กดบันทึกใหม่ได้
    }
  };

  return (
    <Card
      title="สีของชั้นบัญชี"
      extra={
        isSuperAdmin ? (
          <SaveBar count={changed.length} saving={act.isPending} onSave={() => void save()} onReset={() => setDraft({})} />
        ) : (
          <Typography.Text type="secondary">แก้ได้เฉพาะซูเปอร์แอดมิน</Typography.Text>
        )
      }
    >
      <LoadError error={roles.error} onRetry={() => void roles.refetch()} />
      <Typography.Paragraph type="secondary" className="!mb-3">
        ใช้ที่เว็บลูกค้า: ป้ายชั้นบัญชี วงรอบรูปโปรไฟล์ พื้นหลังหน้าโปรไฟล์ และปุ่มบัญชีบน navbar · ธีมสว่างระบบเข้มตัวหนังสือให้เอง
      </Typography.Paragraph>
      <Table
        rowKey="code"
        size="small"
        pagination={false}
        loading={roles.isLoading}
        dataSource={roles.data}
        columns={[
          { title: 'ชั้นบัญชี', dataIndex: 'label_th' },
          {
            title: 'สี',
            key: 'color',
            render: (_, r) => (
              <ColorPicker
                value={draft[r.code] ?? r.color}
                disabled={!isSuperAdmin || act.isPending}
                disabledAlpha
                disabledFormat
                format="hex"
                showText={(c) => c.toHexString().toUpperCase()}
                onChangeComplete={(c) => setDraft((d) => ({ ...d, [r.code]: c.toHexString().toUpperCase() }))}
              />
            ),
          },
          {
            title: 'ตัวอย่างป้าย',
            key: 'preview',
            render: (_, r) => {
              const color = draft[r.code] ?? r.color;
              return (
                <span className="inline-flex h-7 items-center rounded-full px-3 text-sm font-semibold" style={{ background: color, color: onColor(color) }}>
                  {r.label_th}
                </span>
              );
            },
          },
        ]}
      />
    </Card>
  );
}

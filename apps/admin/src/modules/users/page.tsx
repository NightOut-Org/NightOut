import { PageContainer } from '@ant-design/pro-components';
import { PencilSimple, Prohibit, Trash, UserPlus } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { App, Button, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { PAGE_SIZE } from '@/configs/constants';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAuth } from '@/services/adminAuth';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { formatThaiPhone } from '@nightout/utils';
import { dateTime } from '@/ui/utils/format';
import { STAFF_ROLE, USER_ROLE } from '@/ui/utils/labels';
import { BanUserModal } from './modal/banUserModal';
import { CreateUserModal } from './modal/createUserModal';
import { EditUserModal } from './modal/editUserModal';
import { UnbanUserModal } from './modal/unbanUserModal';
import { LEAVES_BARS, roleNotes, useRoleDraft, type Role } from './utils/useRoleDraft';
import {
  useUsers,
  useAccountRoles,
  deleteUserAction,
  setUsersRoleAction,
} from './api';

/**
 * ผู้ใช้ทั้งหมด — เพิ่มผู้ใช้ (แอดมินสร้างได้แค่ลูกค้า / เจ้าของ / ผู้จัดการ / พนักงานร้าน)
 * แก้ชั้นบัญชีที่สร้างผิดได้เฉพาะซูเปอร์แอดมิน: เลือกในตารางได้หลายคน แล้วกดบันทึกครั้งเดียว (ยืนยันผลกระทบก่อน · ADR 0005 · ลงบันทึก audit)
 * แบน / ปลดแบน (ต้องมีเหตุผล) / ลบบัญชี / เพิ่ม-แก้ผ่าน modal บันทึกทันที
 */
export function UsersPage() {
  const { modal } = App.useApp();
  const auth = useAdminAuth();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Db.AdminUser | null>(null);
  const [banning, setBanning] = useState<Db.AdminUser | null>(null);
  const [unbanning, setUnbanning] = useState<Db.AdminUser | null>(null);
  const { data, isLoading, error, refetch } = useUsers();
  const roles = useAccountRoles();
  const act = useAdminAction();
  const saveAct = useAdminAction();
  const draft = useRoleDraft(data ?? []);
  const saving = saveAct.isPending;
  /** ระหว่างบันทึกชั้นบัญชี หรือกำลังปลดแบน/ลบ — ล็อกปุ่มในตาราง */
  const busy = saving || act.isPending;
  const { confirmDiscard } = useUnsavedGuard(draft.changes.length > 0);
  const roleText = (r: Role) =>
    roles.data?.find((o) => o.code === r)?.label_th ?? USER_ROLE[r].text;
  const roleOptions = useMemo(
    () =>
      (roles.data ?? [])
        .filter((o) => o.can_assign)
        .map((o) => ({ value: o.code, label: o.label_th })),
    [roles.data],
  );
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (data ?? []).filter(
      (u) =>
        !k ||
        u.email.toLowerCase().includes(k) ||
        u.display_name.toLowerCase().includes(k) ||
        (!!u.phone_e164 &&
          k.replace(/\D/g, '').length >= 4 &&
          u.phone_e164.includes(k.replace(/\D/g, '').replace(/^0/, ''))),
    );
  }, [data, q]);

  /** แบนเองได้เฉพาะบัญชีที่ยังไม่ลบ ไม่ใช่ตัวเอง และไม่ใช่บัญชีทีมงาน NightOut (DB ตรวจซ้ำ) */
  const canBan = (u: Db.AdminUser) =>
    !u.deleted_at &&
    u.id !== auth.session?.user.id &&
    !!roles.data &&
    !roles.data.find((r) => r.code === u.role)?.can_enter_backoffice;

  /** ยืนยันผลกระทบของทุกคนที่แก้ แล้วบันทึกครั้งเดียว */
  const save = () => {
    const { changed, changes } = draft;
    const risky = changed.some(
      ({ user, role }) => LEAVES_BARS.includes(role) && user.bars.length > 0,
    );
    modal.confirm({
      title: `บันทึกชั้นบัญชี ${changed.length} คน?`,
      width: 520,
      content: (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {changed.map(({ user, role }) => (
            <li key={user.id} className="flex flex-col gap-0.5">
              <span>
                <b>{user.display_name}</b> · {roleText(user.role)} → {roleText(role)}
              </span>
              {roleNotes(user, role, auth.session?.user.id).map((n) => (
                <Typography.Text key={n} type="secondary" className="text-xs">
                  {n}
                </Typography.Text>
              ))}
            </li>
          ))}
        </ul>
      ),
      okText: 'บันทึกชั้นบัญชี',
      okButtonProps: { danger: risky },
      cancelText: 'ยกเลิก',
      onOk: async () => {
        try {
          await saveAct.mutateAsync({
            ...setUsersRoleAction({ changes }),
            success: `บันทึกชั้นบัญชีแล้ว ${changes.length} คน`,
          });
          await refetch();
          draft.reset();
        } catch {
          // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
        }
      },
    });
  };

  return (
    <PageContainer
      title="ผู้ใช้"
      subTitle={auth.isSuperAdmin ? undefined : 'แก้ชั้นบัญชีได้เฉพาะซูเปอร์แอดมิน'}
      extra={
        <Space wrap>
          <Input.Search
            placeholder="ชื่อ / อีเมล / เบอร์"
            allowClear
            onSearch={setQ}
            className="w-64"
          />
          {auth.isSuperAdmin && (
            <SaveBar
              count={draft.changes.length}
              saving={saving}
              onSave={save}
              onReset={() => confirmDiscard(draft.reset)}
            />
          )}
          {auth.isSuperAdmin && (
            <Button
              type="primary"
              icon={<UserPlus size={16} weight="bold" />}
              onClick={() => setCreating(true)}
            >
              เพิ่มผู้ใช้
            </Button>
          )}
        </Space>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <Table<Db.AdminUser>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{ x: 1100 }}
        columns={[
          { title: 'ชื่อ', dataIndex: 'display_name' },
          { title: 'อีเมล', dataIndex: 'email' },
          {
            title: 'เบอร์',
            dataIndex: 'phone_e164',
            render: (v: string | null) => (v ? formatThaiPhone(v) : '-'),
          },
          {
            title: 'ชั้นบัญชี',
            dataIndex: 'role',
            filters: (roles.data ?? []).map((o) => ({ text: o.label_th, value: o.code })),
            onFilter: (v, u) => u.role === v,
            render: (role: Role, u) =>
              auth.isSuperAdmin && !u.deleted_at ? (
                <span className="inline-flex items-center gap-2">
                  <Select<Role>
                    className="w-40"
                    value={draft.roleOf(u)}
                    options={roleOptions}
                    loading={roles.isLoading}
                    disabled={saving}
                    aria-label={`ชั้นบัญชีของ ${u.display_name}`}
                    onChange={(next) => draft.set(u, next)}
                  />
                  {draft.isChanged(u) && (
                    <Tag color="warning" className="!m-0">
                      ยังไม่บันทึก
                    </Tag>
                  )}
                </span>
              ) : (
                <Tag color={USER_ROLE[role].color}>{roleText(role)}</Tag>
              ),
          },
          {
            title: 'ร้าน',
            key: 'bars',
            render: (_, u) =>
              u.bars.length ? (
                <Space size={[4, 4]} wrap>
                  {u.bars.map((b) => (
                    <Tag key={b.id}>
                      {b.name} · {STAFF_ROLE[b.role]}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '-'
              ),
          },
          {
            title: 'สถานะบัญชี',
            key: 'ban',
            filters: [
              { text: 'ถูกแบน', value: 'banned' },
              { text: 'มีธงสลิปปลอม', value: 'flagged' },
            ],
            onFilter: (v, u) => (v === 'banned' ? !!u.banned_at : u.fake_slip_count > 0),
            render: (_, u) =>
              u.banned_at ? (
                <Space size={4} wrap>
                  <Tooltip title={u.ban_reason ? `เหตุผล: ${u.ban_reason}` : undefined}>
                    <Tag color="red" className="!m-0 cursor-help">
                      ถูกแบน · {dateTime(u.banned_at)}
                    </Tag>
                  </Tooltip>
                  <Button size="small" disabled={busy} onClick={() => setUnbanning(u)}>
                    ปลดแบน
                  </Button>
                </Space>
              ) : (
                <Space size={4} wrap>
                  {u.fake_slip_count > 0 ? (
                    <Tag color="orange">สลิปปลอม {u.fake_slip_count} ครั้ง</Tag>
                  ) : (
                    <Typography.Text type="secondary">ปกติ</Typography.Text>
                  )}
                  {canBan(u) && (
                    <Button
                      danger
                      size="small"
                      icon={<Prohibit size={14} />}
                      disabled={busy}
                      onClick={() => setBanning(u)}
                    >
                      แบน
                    </Button>
                  )}
                </Space>
              ),
          },
          {
            title: 'สมัครเมื่อ',
            dataIndex: 'created_at',
            render: (v: string, u) => (u.deleted_at ? <Tag>ลบบัญชีแล้ว</Tag> : dateTime(v)),
          },
          {
            title: 'จัดการ',
            key: 'actions',
            align: 'right',
            render: (_, u) => {
              const canEdit = auth.isSuperAdmin || u.id === auth.session?.user.id;
              if (!canEdit && !auth.isSuperAdmin) return null;
              return (
                <Space size={4}>
                  {canEdit && (
                    <Button
                      icon={<PencilSimple size={16} />}
                      aria-label={`แก้ไข ${u.display_name}`}
                      disabled={busy}
                      onClick={() => setEditing(u)}
                    ></Button>
                  )}
                  {auth.isSuperAdmin && !u.deleted_at && (
                    <Popconfirm
                      title={`ลบบัญชี ${u.display_name}?`}
                      description="บัญชีจะเข้าสู่สถานะลบและเข้าสู่ระบบไม่ได้"
                      okText="ลบ"
                      okButtonProps={{ danger: true }}
                      cancelText="ยกเลิก"
                      disabled={busy}
                      onConfirm={() =>
                        act.mutateAsync({
                          ...deleteUserAction(u.id),
                          success: `ลบบัญชี ${u.display_name} แล้ว`,
                        })
                      }
                    >
                      <Button
                        danger
                        icon={<Trash size={16} />}
                        aria-label={`ลบบัญชี ${u.display_name}`}
                        disabled={busy}
                      />
                    </Popconfirm>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
      <EditUserModal user={editing} open={!!editing} onClose={() => setEditing(null)} />
      <BanUserModal user={banning} onClose={() => setBanning(null)} />
      <UnbanUserModal user={unbanning} onClose={() => setUnbanning(null)} />
    </PageContainer>
  );
}

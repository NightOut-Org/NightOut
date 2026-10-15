import { PageContainer } from '@ant-design/pro-components';
import { LockOpen, PencilSimple, Prohibit, Trash, UserPlus } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import {
  App,
  Button,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TableColumnType,
} from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
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
import { groupUsers, USER_GROUP_LABEL, USER_GROUPS, type UserGroup } from './utils/userGroups';
import { useUsers, useAccountRoles, deleteUserAction, setUsersRoleAction } from './api';

type ColumnKey = 'name' | 'email' | 'phone' | 'role' | 'bars' | 'account' | 'created' | 'actions';

/** คอลัมน์ของแต่ละแท็บ — ทีม NightOut แบนไม่ได้และไม่มีร้าน · ทีมร้านเห็นร้าน + บทบาทในร้าน */
const TAB_COLUMNS: Record<UserGroup, ColumnKey[]> = {
  customers: ['name', 'email', 'phone', 'role', 'account', 'created', 'actions'],
  shop: ['name', 'email', 'phone', 'bars', 'role', 'account', 'created', 'actions'],
  team: ['name', 'email', 'role', 'created', 'actions'],
  inactive: ['name', 'email', 'phone', 'role', 'bars', 'account', 'created', 'actions'],
};

/** แท็บที่มีหลายชั้นบัญชี → คอลัมน์ชั้นบัญชีมีตัวกรอง */
const ROLE_FILTER_TABS: readonly UserGroup[] = ['shop', 'team', 'inactive'];

/**
 * ผู้ใช้ทั้งหมด — แยกแท็บตามกลุ่ม (?tab=): ลูกค้า · ทีมร้าน · ทีม NightOut · ถูกแบน / ลบแล้ว (utils/userGroups.ts)
 * ค้นหาค้นทุกแท็บ ตัวเลขบนแท็บ = จำนวนที่เจอ · แก้ชั้นบัญชีค้างไว้ยังอยู่แท็บเดิมจนกดบันทึก
 * เพิ่มผู้ใช้ (แอดมินสร้างได้แค่ลูกค้า / เจ้าของ / ผู้จัดการ / พนักงานร้าน)
 * แก้ชั้นบัญชีที่สร้างผิดได้เฉพาะซูเปอร์แอดมิน: เลือกในตารางได้หลายคน แล้วกดบันทึกครั้งเดียว (ยืนยันผลกระทบก่อน · ADR 0005 · ลงบันทึก audit)
 * แบน / ปลดแบน (ต้องมีเหตุผล) / ลบบัญชี / เพิ่ม-แก้ผ่าน modal บันทึกทันที
 */
export function UsersPage() {
  const { modal } = App.useApp();
  const auth = useAdminAuth();
  const [params, setParams] = useSearchParams();
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

  const tabParam = params.get('tab') as UserGroup | null;
  const tab: UserGroup = tabParam && USER_GROUPS.includes(tabParam) ? tabParam : 'customers';
  const setTab = (t: UserGroup) => {
    const next = new URLSearchParams(params);
    if (t === 'customers') next.delete('tab');
    else next.set('tab', t);
    setParams(next, { replace: true });
  };

  const roleText = (r: Role) =>
    roles.data?.find((o) => o.code === r)?.label_th ?? USER_ROLE[r].text;
  const roleOptions = useMemo(
    () =>
      (roles.data ?? [])
        .filter((o) => o.can_assign)
        .map((o) => ({ value: o.code, label: o.label_th })),
    [roles.data],
  );
  const groups = useMemo(() => {
    const k = q.trim().toLowerCase();
    const digits = k.replace(/\D/g, '');
    return groupUsers(
      (data ?? []).filter(
        (u) =>
          !k ||
          u.email.toLowerCase().includes(k) ||
          u.display_name.toLowerCase().includes(k) ||
          (!!u.phone_e164 && digits.length >= 4 && u.phone_e164.includes(digits.replace(/^0/, ''))),
      ),
    );
  }, [data, q]);
  const rolesInTab = useMemo(() => new Set(groups[tab].map((u) => u.role)), [groups, tab]);

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

  const columns: Record<ColumnKey, TableColumnType<Db.AdminUser>> = {
    name: { title: 'ชื่อ', key: 'name', dataIndex: 'display_name', width: 180, ellipsis: true },
    email: { title: 'อีเมล', key: 'email', dataIndex: 'email', width: 220, ellipsis: true },
    phone: {
      title: 'เบอร์',
      key: 'phone',
      dataIndex: 'phone_e164',
      width: 130,
      render: (v: string | null) => (v ? formatThaiPhone(v) : '-'),
    },
    role: {
      title: 'ชั้นบัญชี',
      key: 'role',
      dataIndex: 'role',
      width: 190,
      filters: ROLE_FILTER_TABS.includes(tab)
        ? (roles.data ?? [])
            .filter((o) => rolesInTab.has(o.code))
            .map((o) => ({ text: o.label_th, value: o.code }))
        : undefined,
      onFilter: (v, u) => u.role === v,
      render: (role: Role, u) =>
        auth.isSuperAdmin && !u.deleted_at ? (
          // ป้าย "ยังไม่บันทึก" อยู่ใต้ Select — ไม่ดันคอลัมน์ข้างๆ
          <span className="flex flex-col items-start gap-1">
            <Select<Role>
              className="w-full"
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
    bars: {
      title: 'ร้าน',
      key: 'bars',
      width: 240,
      filters: Object.entries(STAFF_ROLE).map(([value, text]) => ({ text, value })),
      onFilter: (v, u) => u.bars.some((b) => b.role === v),
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
    account: {
      title: 'สถานะบัญชี',
      key: 'account',
      filters:
        tab === 'customers' || tab === 'shop'
          ? [{ text: 'มีธงสลิปปลอม', value: 'flagged' }]
          : undefined,
      onFilter: (_, u) => u.fake_slip_count > 0,
      width: 170,
      // ป้ายสถานะอย่างเดียว — ปุ่มแบน / ปลดแบนอยู่คอลัมน์จัดการ
      render: (_, u) =>
        u.deleted_at ? (
          <Tag className="!m-0">ลบบัญชีแล้ว</Tag>
        ) : u.banned_at ? (
          <span className="flex flex-col items-start gap-1">
            <Tooltip title={u.ban_reason ? `เหตุผล: ${u.ban_reason}` : undefined}>
              <Tag color="red" className="!m-0 cursor-help">
                ถูกแบน
              </Tag>
            </Tooltip>
            <Typography.Text type="secondary" className="text-xs">
              {dateTime(u.banned_at)}
            </Typography.Text>
          </span>
        ) : u.fake_slip_count > 0 ? (
          <Tag color="orange" className="!m-0">
            สลิปปลอม {u.fake_slip_count} ครั้ง
          </Tag>
        ) : (
          <Typography.Text type="secondary">ปกติ</Typography.Text>
        ),
    },
    created: {
      title: 'สมัครเมื่อ',
      key: 'created',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => dateTime(v),
    },
    actions: {
      title: 'จัดการ',
      key: 'actions',
      align: 'right',
      fixed: 'right',
      width: 140,
      render: (_, u) => {
        const canEdit = auth.isSuperAdmin || u.id === auth.session?.user.id;
        return (
          <Space size={4}>
            {canEdit && (
              <Tooltip title="แก้ไข">
                <Button
                  icon={<PencilSimple size={16} />}
                  aria-label={`แก้ไข ${u.display_name}`}
                  disabled={busy}
                  onClick={() => setEditing(u)}
                />
              </Tooltip>
            )}
            {u.banned_at && !u.deleted_at ? (
              <Tooltip title="ปลดแบน">
                <Button
                  icon={<LockOpen size={16} />}
                  aria-label={`ปลดแบน ${u.display_name}`}
                  disabled={busy}
                  onClick={() => setUnbanning(u)}
                />
              </Tooltip>
            ) : (
              canBan(u) && (
                <Tooltip title="แบน">
                  <Button
                    danger
                    icon={<Prohibit size={16} />}
                    aria-label={`แบน ${u.display_name}`}
                    disabled={busy}
                    onClick={() => setBanning(u)}
                  />
                </Tooltip>
              )
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
                <Tooltip title="ลบบัญชี">
                  <Button
                    danger
                    icon={<Trash size={16} />}
                    aria-label={`ลบบัญชี ${u.display_name}`}
                    disabled={busy}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
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
      <Segmented<UserGroup>
        className="!mb-4"
        value={tab}
        onChange={setTab}
        options={USER_GROUPS.map((g) => ({
          value: g,
          label: `${USER_GROUP_LABEL[g]} (${groups[g].length.toLocaleString('th-TH')})`,
        }))}
      />
      <Table<Db.AdminUser>
        // แยก state ตัวกรอง/หน้าของแต่ละแท็บ
        key={tab}
        rowKey="id"
        loading={isLoading}
        dataSource={groups[tab]}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{
          x: TAB_COLUMNS[tab].reduce((sum, key) => sum + Number(columns[key].width ?? 150), 0),
        }}
        locale={{
          emptyText: q.trim()
            ? `ไม่พบ "${q.trim()}" ในแท็บ${USER_GROUP_LABEL[tab]}`
            : 'ยังไม่มีบัญชีในกลุ่มนี้',
        }}
        columns={TAB_COLUMNS[tab].map((key) => columns[key])}
      />
      <CreateUserModal open={creating} onClose={() => setCreating(false)} />
      <EditUserModal user={editing} open={!!editing} onClose={() => setEditing(null)} />
      <BanUserModal user={banning} onClose={() => setBanning(null)} />
      <UnbanUserModal user={unbanning} onClose={() => setUnbanning(null)} />
    </PageContainer>
  );
}

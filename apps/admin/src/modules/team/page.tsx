import { PageContainer } from '@ant-design/pro-components';
import { DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowSquareOut, PencilSimple, Plus, Trash, UserCircle } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { Avatar, Button, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAuth } from '@/services/adminAuth';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SaveBar } from '@/ui/components/SaveBar';
import { DragHandle, SortableDisabledContext, SortableRow } from './components/sortableRow';
import { TeamMemberDrawer } from './form/teamMemberDrawer';
import { contactCount, isOwnMember } from './utils/contacts';
import { photoSrc } from './utils/photo';
import { useTeamDraft } from './utils/useTeamDraft';
import { useTeamMembers, deleteTeamMemberAction, saveTeamPageAction } from './api';

/** หน้าเกี่ยวกับเราบนเว็บลูกค้า (deploy: โดเมนเดียวกัน · dev: คนละ port) */
const ABOUT_URL = import.meta.env.DEV ? 'http://localhost:5173/about' : '/about';

/**
 * จัดการทีมงาน — คนที่แสดงในหน้า /about ของเว็บลูกค้า
 * เพิ่ม / ลบ / ลากเรียงลำดับ = ซูเปอร์แอดมิน (ลำดับในตาราง = ลำดับบนหน้าเว็บ)
 * แก้ / ซ่อน = ซูเปอร์แอดมินทุกแถว · แอดมินเฉพาะแถวที่อีเมลในช่องทางติดต่อตรงกับอีเมลบัญชี · ทุกการเปลี่ยนแปลงลง Audit Log
 * ลำดับ + สวิตช์แสดงบนเว็บ แก้ในหน้าแล้วกดบันทึกครั้งเดียว · เพิ่ม/แก้รายคน (Drawer) และลบ บันทึกทันที
 */
export function TeamPage() {
  const { data, isLoading, error, refetch } = useTeamMembers();
  const act = useAdminAction();
  const { isSuperAdmin, session } = useAdminAuth();
  const canEdit = (r: Db.AdminTeamMember) =>
    isSuperAdmin || isOwnMember(r.contacts, session?.user.email);
  const [editing, setEditing] = useState<Db.AdminTeamMember | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const rows = data ?? [];
  const shown = rows.filter((r) => r.active).length;

  const openDrawer = (m: Db.AdminTeamMember | null) => {
    setEditing(m);
    setDrawerOpen(true);
  };

  const saveAct = useAdminAction();
  const draft = useTeamDraft(rows);
  const saving = saveAct.isPending;
  /** ระหว่างบันทึกหน้า หรือกำลังลบ — ล็อกตาราง */
  const busy = saving || act.isPending;
  const { confirmDiscard } = useUnsavedGuard(draft.count > 0);

  const save = async () => {
    if (!draft.body) return;
    try {
      await saveAct.mutateAsync({ ...saveTeamPageAction(draft.body), success: 'บันทึกทีมงานแล้ว' });
      await refetch();
      draft.reset();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
    }
  };

  return (
    <PageContainer
      title="จัดการทีมงาน"
      subTitle={
        data
          ? `แสดงบนเว็บ ${shown} จาก ${rows.length} คน${isSuperAdmin ? '' : ' (แอดมินแก้/ซ่อนได้เฉพาะแถวของตัวเอง)'}`
          : undefined
      }
      extra={
        <Space wrap>
          <SaveBar
            count={draft.count}
            saving={saving}
            onSave={() => void save()}
            onReset={() => confirmDiscard(draft.reset)}
          />
          <Button
            href={ABOUT_URL}
            target="_blank"
            rel="noreferrer"
            icon={<ArrowSquareOut size={16} />}
          >
            ดูหน้าเกี่ยวกับเรา
          </Button>
          {isSuperAdmin && (
            <Button
              type="primary"
              icon={<Plus size={16} weight="bold" />}
              onClick={() => openDrawer(null)}
            >
              เพิ่มทีมงาน
            </Button>
          )}
        </Space>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      {/* ลากเรียงลำดับ — เฉพาะซูเปอร์แอดมิน (API ตอบ SUPER_ADMIN_REQUIRED ถ้าไม่ใช่) · ระหว่างบันทึกล็อกไว้ */}
      <DndContext
        sensors={draft.sensors}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={draft.onDragEnd}
      >
        <SortableContext
          items={draft.ordered.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <SortableDisabledContext.Provider value={!isSuperAdmin || busy}>
            <Table<Db.AdminTeamMember>
              rowKey="id"
              loading={isLoading}
              dataSource={draft.ordered}
              components={{ body: { row: SortableRow } }}
              pagination={false}
              scroll={{ x: 880 }}
              rowClassName={(r) => (draft.activeOf(r) ? '' : 'opacity-60')}
              locale={{ emptyText: 'ยังไม่มีทีมงาน — กด "เพิ่มทีมงาน" เพื่อเริ่ม' }}
              columns={[
                ...(!isSuperAdmin
                  ? []
                  : [
                      {
                        title: draft.orderChanged ? (
                          <Tooltip title="ลำดับใหม่ยังไม่บันทึก">
                            <span className="text-(--ant-color-warning)">ลำดับ*</span>
                          </Tooltip>
                        ) : (
                          'ลำดับ'
                        ),
                        key: 'order',
                        width: 64,
                        align: 'center' as const,
                        render: (_: unknown, r: Db.AdminTeamMember) => (
                          <Tooltip title="ลากเพื่อจัดลำดับ">
                            <DragHandle label={`ลากเพื่อจัดลำดับ ${r.nickname}`} />
                          </Tooltip>
                        ),
                      },
                    ]),
                {
                  title: 'ทีมงาน',
                  key: 'member',
                  render: (_, r) => (
                    <div className="flex items-center gap-3">
                      <Avatar
                        size={48}
                        src={photoSrc(r.photo_url)}
                        icon={<UserCircle size={32} weight="thin" />}
                        alt=""
                      />
                      <div className="min-w-0">
                        <div className="font-semibold">{r.nickname}</div>
                        {r.full_name && (
                          <Typography.Text type="secondary" className="text-xs">
                            {r.full_name}
                          </Typography.Text>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'ตำแหน่ง',
                  dataIndex: 'roles',
                  render: (roles: string[]) =>
                    roles.length ? (
                      <Space size={[4, 4]} wrap>
                        {roles.map((role, i) => (
                          <Tag key={role} color={i === 0 ? 'gold' : undefined}>
                            {role}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">ยังไม่ระบุ</Typography.Text>
                    ),
                },
                {
                  title: 'ข้อมูล',
                  key: 'completeness',
                  width: 150,
                  render: (_, r) => {
                    const n = contactCount(r.contacts);
                    return (
                      <Typography.Text type="secondary" className="text-xs">
                        {r.bio ? 'มีแนะนำตัว' : 'ไม่มีแนะนำตัว'}
                        <br />
                        {n ? `ช่องทางติดต่อ ${n}` : 'ไม่มีช่องทางติดต่อ'}
                      </Typography.Text>
                    );
                  },
                },
                {
                  title: 'แสดงบนเว็บ',
                  dataIndex: 'active',
                  width: 170,
                  render: (_: boolean, r) => (
                    <span className="inline-flex items-center gap-2">
                      <Switch
                        checked={draft.activeOf(r)}
                        disabled={!canEdit(r) || busy}
                        aria-label={`แสดง ${r.nickname} บนหน้าเกี่ยวกับเรา`}
                        onChange={(next) => draft.setRowActive(r, next)}
                      />
                      {draft.activeChanged(r) && (
                        <Tag color="warning" className="!m-0">
                          ยังไม่บันทึก
                        </Tag>
                      )}
                    </span>
                  ),
                },
                {
                  title: '',
                  key: 'actions',
                  width: 120,
                  align: 'right',
                  render: (_, r) => (
                    <Space size={4}>
                      <Tooltip
                        title={canEdit(r) ? 'แก้ข้อมูล' : 'แก้ได้เฉพาะแถวที่อีเมลตรงกับบัญชีของคุณ'}
                      >
                        <Button
                          icon={<PencilSimple size={16} />}
                          aria-label={`แก้ข้อมูล ${r.nickname}`}
                          disabled={!canEdit(r) || busy}
                          onClick={() => openDrawer(r)}
                        />
                      </Tooltip>
                      {isSuperAdmin && (
                        <Popconfirm
                          title={`ลบ ${r.nickname} ออกจากทีม?`}
                          description="ลบแล้วกู้คืนไม่ได้ ถ้าแค่ไม่อยากให้แสดง ให้ปิด “แสดงบนเว็บ” แทน"
                          okText="ลบ"
                          okButtonProps={{ danger: true }}
                          cancelText="ยกเลิก"
                          disabled={busy}
                          onConfirm={() =>
                            act.mutateAsync({
                              ...deleteTeamMemberAction(r.id),
                              success: `ลบ${r.nickname}แล้ว`,
                            })
                          }
                        >
                          <Tooltip title="ลบ">
                            <Button
                              danger
                              icon={<Trash size={16} />}
                              aria-label={`ลบ ${r.nickname}`}
                              disabled={busy}
                            />
                          </Tooltip>
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </SortableDisabledContext.Provider>
        </SortableContext>
      </DndContext>
      <TeamMemberDrawer
        open={drawerOpen}
        member={editing}
        lockEmail={!isSuperAdmin}
        onClose={() => setDrawerOpen(false)}
      />
    </PageContainer>
  );
}

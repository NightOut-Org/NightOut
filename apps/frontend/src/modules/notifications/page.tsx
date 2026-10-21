import { Bell } from '@phosphor-icons/react';
import { myNotifications } from '@/services/data';
import { markRead } from './api';
import { isMerchantView, notificationsForView } from '@/ui/utils/notifications';
import { useAuth } from '@/services/auth';
import { App, Badge, Button, Empty, Listy } from 'antd';
import { ListRow } from '@/ui/components/listRow';
import { Link, useLocation, useSearchParams } from 'react-router';
import { PageHeader } from '@/ui/components/pageHeader';
import { useDemo } from '@/hooks/useDemo';
import { timeAgo } from '@/ui/utils/format';

export function NotificationsPage() {
  useDemo();
  const { message } = App.useApp();
  const { pathname } = useLocation();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const merchantView = isMerchantView(pathname, search);
  const items = notificationsForView(myNotifications(), merchantView, user?.barId);
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={merchantView ? 'แจ้งเตือนร้าน' : 'แจ้งเตือน'}
        extra={
          <Button
            disabled={unreadIds.length === 0}
            onClick={() => void markRead(unreadIds).catch((e: Error) => message.error(e.message))}
          >
            อ่านทั้งหมดแล้ว
          </Button>
        }
      />
      {items.length === 0 ? (
        <Empty description="ยังไม่มีแจ้งเตือน" />
      ) : (
        <Listy
          items={items}
          rowKey="id"
          itemRender={(n) => (
            <ListRow
              avatar={
                <Badge dot={!n.readAt}>
                  <Bell size={22} className="text-gold-text" />
                </Badge>
              }
              title={
                n.link ? (
                  <Link
                    to={n.link}
                    onClick={() => {
                      if (!n.readAt) void markRead([n.id]).catch((e: Error) => message.error(e.message));
                    }}
                  >
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )
              }
              description={
                <>
                  {n.body} <span className="ml-1 text-xs">{timeAgo(n.createdAt)}</span>
                </>
              }
            />
          )}
        />
      )}
    </div>
  );
}

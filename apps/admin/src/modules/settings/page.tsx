import { PageContainer } from '@ant-design/pro-components';
import type { Db } from '@nightout/types';
import { Card, Space, Table, Tag } from 'antd';
import { Link } from 'react-router';
import { LoadError } from '@/ui/components/LoadError';
import { useMasterTable } from './api';

/** ข้อมูลตั้งต้นของระบบ (อ่านอย่างเดียว — แก้ผ่าน migration/seed) · สไตล์ร้านจัดการที่ /styles */
export function SettingsPage() {
  const styles = useMasterTable<Db.Tables<'styles'>>('styles', 'sort_order');
  const safety = useMasterTable<Db.Tables<'safety_features'>>('safety_features', 'sort_order');
  const settings = useMasterTable<Db.Tables<'platform_settings'>>('platform_settings', 'key');
  return (
    <PageContainer
      title="ตั้งค่าระบบ"
      content="ค่าระบบและมาตรการ Safety แก้ผ่าน migration / seed ของทีม · สไตล์ร้านจัดการที่หน้าสไตล์ร้าน"
    >
      <Space orientation="vertical" size="large" className="w-full">
        <Card title="สไตล์ร้าน" extra={<Link to="/styles">จัดการสไตล์ร้าน</Link>}>
          <LoadError error={styles.error} onRetry={() => void styles.refetch()} />
          <Space size={[8, 8]} wrap>
            {(styles.data ?? []).map((s) => (
              <Tag key={s.id} color={s.active ? 'gold' : 'default'}>
                {s.name_th}
              </Tag>
            ))}
          </Space>
        </Card>
        <Card title="มาตรการ Safety และน้ำหนักคะแนน">
          <LoadError error={safety.error} onRetry={() => void safety.refetch()} />
          <Table<Db.Tables<'safety_features'>>
            rowKey="id"

            pagination={false}
            loading={safety.isLoading}
            dataSource={safety.data}
            columns={[
              { title: 'มาตรการ', dataIndex: 'name_th' },
              { title: 'น้ำหนัก', dataIndex: 'weight' },
            ]}
          />
        </Card>
        <Card title="ค่าระบบ">
          <LoadError error={settings.error} onRetry={() => void settings.refetch()} />
          <Table<Db.Tables<'platform_settings'>>
            rowKey="id"

            pagination={false}
            loading={settings.isLoading}
            dataSource={settings.data}
            columns={[
              { title: 'ชื่อ', dataIndex: 'key' },
              {
                title: 'ค่า',
                dataIndex: 'value',
                render: (v: unknown) => (
                  <code className="text-xs break-all">{JSON.stringify(v)}</code>
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </PageContainer>
  );
}

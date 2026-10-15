import { SignOutIcon } from '@phosphor-icons/react';
import { ProLayout } from '@ant-design/pro-components';
import { ThemeToggle, useThemeMode } from '@nightout/ui';
import { Button, ConfigProvider, Spin, Tooltip, Typography } from 'antd';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import logo from '/logo-mark.svg';
import { ADMIN_ROUTES } from '@/configs/menu';
import { useAdminAuth } from '@/services/adminAuth';
import { AuroraBackground } from '@/ui/components/AuroraBackground';

/** dark: header/sider/พื้นหน้าโปร่งให้เห็น Aurora (glass blur อยู่ใน styles/index.css) */
const DARK_LAYOUT_TOKEN = {
  bgLayout: 'transparent',
  header: { colorBgHeader: 'rgba(17,17,26,0.65)' },
  sider: { colorMenuBackground: 'rgba(17,17,26,0.6)' },
  pageContainer: { colorBgPageContainer: 'transparent' },
};
/**
 * dark: การ์ดโปร่งเล็กน้อย · ไม่แตะ colorBgElevated → Modal/Drawer/Dropdown ยังทึบ
 * ตารางต้องทึบ — คอลัมน์ `fixed` เป็นเซลล์ sticky ที่บังข้อความตอนเลื่อนแนวนอนด้วยพื้นหลังของตัวเอง
 * (หัวตาราง/hover antd คำนวณจาก colorBgContainer ที่โปร่ง → ใส่ค่าทึบเดิมของธีมมืดตรง ๆ)
 */
const TABLE_FILL_SOLID = '#201e29';
const DARK_CONTENT_THEME = {
  token: { colorBgContainer: 'rgba(23,21,32,0.8)' },
  components: {
    Table: {
      colorBgContainer: '#171520',
      headerBg: TABLE_FILL_SOLID,
      rowHoverBg: TABLE_FILL_SOLID,
      bodySortBg: TABLE_FILL_SOLID,
      footerBg: TABLE_FILL_SOLID,
      fixedHeaderSortActiveBg: '#33313b',
    },
  },
};
const LIGHT_CONTENT_THEME = {};

/** Layout หลักของ Backoffice — เข้าได้เฉพาะแอดมิน / ซูเปอร์แอดมิน ที่ยืนยัน MFA แล้ว (Supabase AAL2) */
export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAdminAuth();
  const dark = useThemeMode().resolved === 'dark';
  if (auth.loading) return <Spin fullscreen />;
  if (!auth.canEnter) return <Navigate to="/login" replace />;
  return (
    <>
      <AuroraBackground />
      <ProLayout
        style={{ position: 'relative', zIndex: 1 }}
        token={dark ? DARK_LAYOUT_TOKEN : undefined}
        title="NightOut Admin"
        logo={<img src={logo} alt="" width={28} height={28} />}
        layout="mix"
        fixSiderbar
        location={{ pathname: location.pathname }}
        route={{ path: '/', routes: ADMIN_ROUTES }}
        menuItemRender={(item, dom) => <Link to={item.path ?? '/'}>{dom}</Link>}
        actionsRender={() => [
          <Typography.Text
            key="me"
            type="secondary"
            className="hidden whitespace-nowrap text-sm md:inline"
          >
            {auth.displayName} · {auth.roleLabel}
          </Typography.Text>,
          <ThemeToggle key="theme" />,
          <Tooltip key="out" title="ออกจากระบบ">
            <Button
              type="text"
              shape="circle"
              aria-label="ออกจากระบบ"
              icon={<SignOutIcon size={18} />}
              onClick={() => {
                void auth.signOut().then(() => navigate('/login'));
              }}
            />
          </Tooltip>,
        ]}
      >
        {/* light ต้องเป็น {} ไม่ใช่ undefined — สลับ undefined ↔ object แล้ว token ของ Pro (หัว PageContainer) ค้างสีธีมสว่าง ข้อความมืดบนพื้นมืด */}
        <ConfigProvider theme={dark ? DARK_CONTENT_THEME : LIGHT_CONTENT_THEME}>
          <Outlet />
        </ConfigProvider>
      </ProLayout>
    </>
  );
}

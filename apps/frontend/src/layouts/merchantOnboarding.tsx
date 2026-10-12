import { Outlet } from 'react-router';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';

/** /merchant/join · /merchant/status — อยู่นอก MerchantLayout (ยังไม่มีร้าน) แต่ใช้พื้นหลังและการ์ดกระจกเดียวกับหน้าร้าน */
export function MerchantOnboardingLayout() {
  return (
    <div className="embers-glass relative isolate min-w-0">
      <EmbersBackdrop />
      <Outlet />
    </div>
  );
}

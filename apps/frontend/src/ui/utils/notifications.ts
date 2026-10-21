/** แจ้งเตือนของทีมร้าน = ลิงก์ไป /merchant… (ทุกเส้นของ app_notify_team) · ที่เหลือเป็นของลูกค้า (การจองของตัวเอง ฯลฯ) */
export const isMerchantNotification = (n: { link?: string }) => n.link?.startsWith('/merchant/') || n.link === '/merchant';

/** อยู่โหมดร้านไหม — หน้า /merchant/* หรือ /notifications?view=merchant */
export const isMerchantView = (pathname: string, search: URLSearchParams) =>
  pathname === '/merchant' || pathname.startsWith('/merchant/') || search.get('view') === 'merchant';

/**
 * แจ้งเตือนที่แสดงในโหมดนั้น — โหมดร้านเห็นเฉพาะของร้านที่กำลังจัดการ (`barId` = ร้านของโหมดร้าน)
 * กันแจ้งเตือนของร้านอื่นโผล่: ร้านที่เคยอยู่ทีมแล้วถูกถอด/ย้ายเจ้าของ (แถวเก่ายังอยู่ในกล่อง) หรืออยู่หลายร้าน
 */
export const notificationsForView = <T extends { link?: string; barId?: string }>(
  items: T[],
  merchantView: boolean,
  barId: string | undefined,
) =>
  items.filter((n) =>
    merchantView ? isMerchantNotification(n) && !!barId && n.barId === barId : !isMerchantNotification(n),
  );

/** แจ้งเตือนของทีมร้าน = ลิงก์ไป /merchant… (ทุกเส้นของ app_notify_team) · ที่เหลือเป็นของลูกค้า (การจองของตัวเอง ฯลฯ) */
export const isMerchantNotification = (n: { link?: string }) => n.link?.startsWith('/merchant/') || n.link === '/merchant';

/** อยู่โหมดร้านไหม — หน้า /merchant/* หรือ /notifications?view=merchant */
export const isMerchantView = (pathname: string, search: URLSearchParams) =>
  pathname === '/merchant' || pathname.startsWith('/merchant/') || search.get('view') === 'merchant';

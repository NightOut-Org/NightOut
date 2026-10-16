import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from '@nightout/contracts';

/** ขนาดรูปโปรไฟล์ที่เก็บจริง (สี่เหลี่ยมจัตุรัส) */
const SIZE = 400;

/** ตรวจไฟล์ก่อนย่อ — คืนข้อความผิดพลาด หรือ null ถ้าใช้ได้ */
export function avatarFileError(file: File): string | null {
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) return 'ใช้ได้เฉพาะรูป JPG, PNG หรือ WebP';
  if (file.size > AVATAR_MAX_BYTES) return 'รูปต้องไม่เกิน 5 MB';
  return null;
}

/** ครอปกลางเป็นจัตุรัสแล้วย่อเป็น 400×400 WebP (เบราว์เซอร์ที่ไม่รองรับ WebP ได้ PNG) */
export async function resizeAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('ย่อรูปไม่สำเร็จ');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ย่อรูปไม่สำเร็จ'))), 'image/webp', 0.86),
  );
}

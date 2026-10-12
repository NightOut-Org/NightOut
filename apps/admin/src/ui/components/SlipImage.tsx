import { Image, Spin } from 'antd';
import { useSignedUrl } from '@/services/adminData';

/** รูปสลิป/หลักฐานจากบักเก็ตส่วนตัว (ขอ URL ชั่วคราวด้วยสิทธิ์แอดมิน) · กดเพื่อขยาย */
export function SlipImage({
  bucket,
  path,
}: {
  bucket: 'deposit-slips' | 'promo-slips' | 'bar-verifications';
  path: string | null | undefined;
}) {
  const { data: url, isLoading } = useSignedUrl(bucket, path);
  if (!path) return <span className="text-xs text-muted">ไม่มีไฟล์</span>;
  if (isLoading) return <Spin />;
  if (!url) return <span className="text-xs text-muted">เปิดไฟล์ไม่ได้</span>;
  if (/\.pdf($|\?)/i.test(path)) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        เปิด PDF
      </a>
    );
  }
  return <Image src={url} alt="ไฟล์แนบ" height={64} width={48} className="object-cover" />;
}

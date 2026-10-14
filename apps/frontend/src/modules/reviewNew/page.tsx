import { getBar, getBooking, type ReviewMedia } from '@/services/data';
import { addReview } from './api';
import { App, Button, Card, Form, Input, Rate, Result } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ReviewMediaPicker } from '@/ui/components/reviewMediaPicker';
import { PageHeader } from '@/ui/components/pageHeader';
import { useDemo } from '@/hooks/useDemo';
import { NotFoundResult } from '@/ui/components/notFoundResult';
import { isReviewableStatus } from '@nightout/utils';

/** /reviews/new?booking=:id — รีวิวได้เมื่อ booking มัดจำผ่านแล้ว ไม่ต้องเช็กอิน (1 booking = 1 รีวิว) */
export function ReviewNewPage() {
  useDemo();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [media, setMedia] = useState<ReviewMedia[]>([]);
  const [sending, setSending] = useState(false);
  const b = getBooking(params.get('booking') ?? '');
  const bar = b ? getBar(b.barId) : null;
  if (!b || !bar) return <NotFoundResult title="ไม่พบการจอง" kind="booking" />;
  if (!isReviewableStatus(b.status))
    return <Result status="warning" title="รีวิวได้หลังจองและชำระ Table Fee แล้วเท่านั้น" />;
  if (b.reviewed) return <Result status="success" title="คุณรีวิวการจองนี้แล้ว ขอบคุณครับ" />;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={`รีวิว ${bar.name}`} subtitle="รีวิวของคุณช่วยคำนวณดาวของร้าน" />
      <Card>
        <Form
          layout="vertical"
          size="large"
          initialValues={{ rating: 5 }}
          onFinish={async (v: { rating: number; comment: string }) => {
            setSending(true);
            try {
              await addReview(b.id, v.rating, v.comment, media);
              message.success('ขอบคุณสำหรับรีวิว!');
              navigate(`/bars/${bar.slug}`);
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          <Form.Item name="rating" label="ให้คะแนน" rules={[{ required: true }]}>
            <Rate />
          </Form.Item>
          <Form.Item
            name="comment"
            label="เล่าประสบการณ์"
            rules={[{ required: true, min: 10, message: 'อย่างน้อย 10 ตัวอักษร' }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={500}
              showCount
              placeholder="บรรยากาศ บริการ ราคาตรงกับที่ประเมินไหม ความปลอดภัย ..."
            />
          </Form.Item>
          <Form.Item label="รูป / วิดีโอ (ไม่บังคับ)">
            <ReviewMediaPicker value={media} onChange={setMedia} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={sending}>
            ส่งรีวิว
          </Button>
        </Form>
      </Card>
    </div>
  );
}

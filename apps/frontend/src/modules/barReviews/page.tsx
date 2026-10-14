import { Images, PencilSimpleLine } from '@phosphor-icons/react';
import { barReviews, getBarBySlug, reviewableBooking } from '@/services/data';
import { Button, Empty, Segmented } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ReviewList } from '@/ui/components/reviewList';
import { PageHeader } from '@/ui/components/pageHeader';
import { useDemo } from '@/hooks/useDemo';
import { BarRating } from '@/ui/components/barRating';
import { NotFoundResult } from '@/ui/components/notFoundResult';

/**
 * /bars/:slug/reviews — รีวิวทั้งหมดของร้าน
 * กรอง "มีรูป/วิดีโอ" · ปุ่มเขียนรีวิว (แนบรูป/วิดีโอได้) โผล่เมื่อผู้ใช้มีการจองที่มัดจำผ่านแล้วแต่ยังไม่รีวิว
 */
export function BarReviewsPage() {
  useDemo();
  const { slug = '' } = useParams();
  const [filter, setFilter] = useState<'ALL' | 'MEDIA'>('ALL');
  const bar = getBarBySlug(slug);
  if (!bar) return <NotFoundResult title="ไม่พบร้าน" kind="bar" />;
  const all = barReviews(bar.id);
  const withMedia = all.filter((r) => r.media?.length);
  const reviews = filter === 'MEDIA' ? withMedia : all;
  const canReview = reviewableBooking(bar.id);

  return (
    <div>
      <PageHeader
        title={`รีวิว ${bar.name}`}
        subtitle={<BarRating bar={bar} />}
        extra={<Link to={`/bars/${bar.slug}`}>← กลับหน้าร้าน</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={(v) => setFilter(v as 'ALL' | 'MEDIA')}
          options={[
            { label: `ทั้งหมด (${all.length})`, value: 'ALL' },
            {
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Images /> มีรูป/วิดีโอ ({withMedia.length})
                </span>
              ),
              value: 'MEDIA',
            },
          ]}
        />
        {canReview ? (
          <Link to={`/reviews/new?booking=${canReview.id}`}>
            <Button type="primary" icon={<PencilSimpleLine />}>
              เขียนรีวิว + แนบรูป/วิดีโอ
            </Button>
          </Link>
        ) : (
          <span className="text-xs text-muted">รีวิวได้หลังจองและชำระ Table Fee แล้ว</span>
        )}
      </div>
      {reviews.length ? (
        <ReviewList reviews={reviews} />
      ) : (
        <Empty description={filter === 'MEDIA' ? 'ยังไม่มีรีวิวที่มีรูปหรือวิดีโอ' : 'ยังไม่มีรีวิว'} />
      )}
    </div>
  );
}

import { SealCheck } from '@phosphor-icons/react';
import type { Review } from '@/services/data';
import { StarRating } from '@nightout/ui';
import { Avatar, Listy } from 'antd';
import { ListRow } from '@/ui/components/listRow';
import { Link } from 'react-router';
import { timeAgo } from '@/ui/utils/format';
import { ReviewMediaGallery } from './reviewMediaGallery';
import { MetaList } from '@/ui/components/metaList';
import { StatusChip } from './statusChip';

export function ReviewList({ reviews, more }: { reviews: Review[]; more?: string }) {
  return (
    <div>
      <Listy
        items={reviews}
        rowKey="id"
        itemRender={(r) => (
          <ListRow
            avatar={<Avatar className="!bg-purple">{r.userName.slice(-2)}</Avatar>}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {r.userName} <StarRating value={r.rating} size={12} showValue={false} />
                <span className="text-xs font-normal text-muted">
                  <MetaList
                    items={[
                      timeAgo(r.createdAt),
                      <StatusChip key="v" tone="success" icon={<SealCheck weight="fill" />}>เช็กอินจริง</StatusChip>,
                    ]}
                  />
                </span>
              </span>
            }
            description={
              <>
                {r.comment}
                {r.media?.length ? <ReviewMediaGallery media={r.media} /> : null}
              </>
            }
          />
        )}
      />
      {more && (
        <Link
          to={more}
          className="mt-2 flex h-10 items-center justify-center rounded-xl border border-border text-sm font-medium !text-text transition-colors hover:border-gold hover:!text-gold-text"
        >
          ดูรีวิวทั้งหมด
        </Link>
      )}
    </div>
  );
}

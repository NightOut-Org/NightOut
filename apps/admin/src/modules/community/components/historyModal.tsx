import type { Db } from '@nightout/types';
import { Modal, Tag, Timeline, Typography } from 'antd';
import { dateTime } from '@/ui/utils/format';
import { MediaCell } from './mediaCell';

type Row = Db.AdminCommunityThread | Db.AdminCommunityComment;

/** ประวัติการแก้ไขของกระทู้/ความเห็น (ฉบับปัจจุบัน + ฉบับก่อนหน้า ใหม่สุดก่อน) — ไว้ตรวจรายงานที่ผู้ใช้แก้ข้อความหนีไปแล้ว */
export function HistoryModal({
  row,
  urls,
  onClose,
}: {
  row: Row | null;
  urls: Record<string, string>;
  onClose: () => void;
}) {
  const versions = row
    ? [
        {
          key: 'current',
          title: 'title' in row ? row.title : null,
          body: row.body,
          media: row.media,
          at: row.edited_at ?? row.created_at,
          current: true,
        },
        ...row.revisions.map((v, i) => ({
          key: v.replaced_at + i,
          title: v.title,
          body: v.body,
          media: v.media,
          at: v.version_at,
          current: false,
        })),
      ]
    : [];

  return (
    <Modal
      open={!!row}
      onCancel={onClose}
      footer={null}
      title={`ประวัติการแก้ไข (${row?.revisions.length ?? 0} ครั้ง)`}
      width={640}
      destroyOnHidden
    >
      <Timeline
        className="!mt-4"
        items={versions.map((v, i) => ({
          key: v.key,
          color: v.current ? 'green' : 'gray',
          content: (
            <>
              <div className="mb-1">
                {v.current ? (
                  <Tag color="green">ฉบับปัจจุบัน</Tag>
                ) : (
                  <Tag>{i === versions.length - 1 ? 'ฉบับแรก' : 'ฉบับแก้ไข'}</Tag>
                )}
                <Typography.Text type="secondary" className="!text-xs">
                  {dateTime(v.at)}
                </Typography.Text>
              </div>
              {v.title && <Typography.Text strong>{v.title}</Typography.Text>}
              <Typography.Paragraph className="!mb-1 whitespace-pre-line">
                {v.body || <Typography.Text type="secondary">(ไม่มีข้อความ)</Typography.Text>}
              </Typography.Paragraph>
              {v.media.length > 0 && <MediaCell media={v.media} urls={urls} />}
            </>
          ),
        }))}
      />
    </Modal>
  );
}

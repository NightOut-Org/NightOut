import { Alert, Modal, Skeleton } from 'antd';
import { CommunityMediaView } from '@/ui/components/communityMediaView';
import { dateTime, timeAgo } from '@/ui/utils/format';
import { useHistory } from '../api';

export type HistoryTarget = { kind: 'thread' | 'comment'; id: string };

/** ประวัติการแก้ไขกระทู้/ความเห็น — ทุกคนที่เห็นกระทู้/ความเห็นนั้นดูได้ · ใหม่สุดก่อน */
export function HistoryModal({
  target,
  onClose,
}: {
  target: HistoryTarget | null;
  onClose: () => void;
}) {
  const { data, isPending, error, refetch } = useHistory(target);
  const isThread = target?.kind === 'thread';

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      footer={null}
      title="ประวัติการแก้ไข"
      destroyOnHidden
      width={560}
    >
      {isPending ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : error ? (
        <Alert
          type="error"
          showIcon
          message={error.message}
          action={
            <button
              type="button"
              onClick={() => void refetch()}
              className="bg-transparent font-semibold text-link"
            >
              ลองใหม่
            </button>
          }
        />
      ) : (
        <>
          <p className="m-0 mb-3 text-[13px] text-muted">
            แก้ไข {data.length - 1} ครั้ง ฉบับใหม่สุดอยู่บนสุด
          </p>
          <ol className="m-0 flex max-h-[65vh] list-none flex-col gap-3 overflow-y-auto p-0">
            {data.map((v, i) => {
              const prev = data[i + 1];
              return (
                <li
                  key={v.at + i}
                  className={`rounded-xl border px-3.5 py-3 ${v.is_current ? 'border-purple/50 bg-purple/5' : 'border-border bg-card'}`}
                >
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="font-semibold text-text">
                      {v.is_current ? 'ฉบับปัจจุบัน' : i === data.length - 1 ? 'ฉบับแรก' : 'ฉบับแก้ไข'}
                    </span>
                    <time dateTime={v.at} title={dateTime(v.at)}>
                      {dateTime(v.at)} ({timeAgo(v.at)})
                    </time>
                  </div>
                  {isThread && (
                    <>
                      <div className="text-[15px] font-semibold leading-snug">{v.title}</div>
                      {prev && (prev.category_name !== v.category_name || prev.bar?.id !== v.bar?.id) && (
                        <div className="mt-0.5 text-xs text-muted">
                          หมวด {v.category_name}
                          {v.bar ? ` แท็กร้าน ${v.bar.name}` : ' ไม่แท็กร้าน'}
                        </div>
                      )}
                    </>
                  )}
                  {v.body ? (
                    <p className="m-0 mt-1 whitespace-pre-line break-words text-sm leading-relaxed">
                      {v.body}
                    </p>
                  ) : (
                    v.media.length === 0 && <p className="m-0 mt-1 text-sm text-muted">(ไม่มีข้อความ)</p>
                  )}
                  <CommunityMediaView media={v.media} layout="reply" />
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Modal>
  );
}

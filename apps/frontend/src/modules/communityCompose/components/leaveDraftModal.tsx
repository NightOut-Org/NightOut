import { Button, Modal } from 'antd';

/** ออกจากหน้าตั้งกระทู้ตอนยังมีข้อความ — เลือกเก็บร่าง (พิมพ์ต่อได้ทุกเครื่อง) หรือทิ้งร่าง */
export function LeaveDraftModal({
  open,
  busy,
  onKeep,
  onDiscard,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onKeep: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      centered
      width={400}
      title="เก็บร่างไว้ไหม?"
    >
      <p className="m-0 mb-5 text-sm text-muted">
        ร่างจะเก็บไว้ในบัญชีของคุณ 7 วัน กลับมาเขียนต่อได้จากทุกเครื่อง
      </p>
      <div className="flex flex-col gap-2">
        <Button type="primary" block loading={busy} onClick={onKeep}>
          เก็บร่างไว้
        </Button>
        <Button block danger disabled={busy} onClick={onDiscard}>
          ทิ้งร่าง
        </Button>
        <Button block type="text" disabled={busy} onClick={onCancel}>
          เขียนต่อ
        </Button>
      </div>
    </Modal>
  );
}

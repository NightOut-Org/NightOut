import { Image, Plus, Trash } from '@phosphor-icons/react';
import { AutoComplete, Button, Empty, Input, InputNumber, Switch, Table, Tag, Typography } from 'antd';
import type { BarDetailsDraft, MenuRow } from '../utils/useBarDetailsDraft';

/**
 * ตารางเมนูและราคาใน Drawer แก้ข้อมูลร้าน — แก้หมวด ชื่อ ราคา การแสดง · เพิ่ม/ลบรายการ (บันทึกทั้งชุดแทนที่ของเดิม)
 * รูปเมนูดูอย่างเดียว (คงรูปเดิม · จัดการที่ /bar-media) · รายการที่ลบ → ไฟล์รูปถูกลบให้ตอนบันทึก
 */
export function MenuEditor({ draft, disabled }: { draft: BarDetailsDraft; disabled: boolean }) {
  const categoryOptions = draft.categories.map((c) => ({ value: c }));

  return (
    <div className="flex flex-col gap-3">
      <Typography.Text type="secondary" className="text-xs">
        ราคาแสดงเพื่อประเมินงบเท่านั้น (ไม่มีสั่งล่วงหน้า) · รูปเมนูคงเดิม — จัดการที่หน้ารูปร้าน
      </Typography.Text>
      <Table<MenuRow>
        rowKey="key"
        size="small"
        dataSource={draft.rows}
        pagination={false}
        scroll={{ x: 680 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ร้านยังไม่มีเมนู" /> }}
        columns={[
          {
            title: 'หมวด',
            key: 'category',
            width: 150,
            render: (_, r) => (
              <AutoComplete
                value={r.category}
                options={categoryOptions}
                disabled={disabled}
                className="w-full"
                aria-label={`หมวดของ ${r.name || 'รายการใหม่'}`}
                onChange={(v: string) => draft.updateItem(r.key, { category: v.slice(0, 40) })}
                showSearch={{
                  filterOption: (input, o) => String(o?.value ?? '').toLowerCase().includes(input.toLowerCase()),
                }}
              />
            ),
          },
          {
            title: 'ชื่อรายการ',
            key: 'name',
            render: (_, r) => (
              <Input
                value={r.name}
                maxLength={80}
                disabled={disabled}
                status={r.name.trim() ? undefined : 'error'}
                placeholder="ชื่อรายการ"
                aria-label="ชื่อรายการ"
                onChange={(e) => draft.updateItem(r.key, { name: e.target.value })}
              />
            ),
          },
          {
            title: 'ราคา',
            key: 'price',
            width: 130,
            render: (_, r) => (
              <InputNumber<number>
                value={r.price}
                min={0}
                max={1_000_000}
                precision={2}
                prefix="฿"
                disabled={disabled}
                className="!w-full"
                aria-label={`ราคา ${r.name}`}
                onChange={(v) => draft.updateItem(r.key, { price: v ?? 0 })}
              />
            ),
          },
          {
            title: 'แสดง',
            key: 'available',
            width: 70,
            align: 'center',
            render: (_, r) => (
              <Switch
                size="small"
                checked={r.available}
                disabled={disabled}
                aria-label={`แสดง ${r.name}`}
                onChange={(available) => draft.updateItem(r.key, { available })}
              />
            ),
          },
          {
            title: 'รูป',
            key: 'image',
            width: 90,
            render: (_, r) =>
              r.image_path ? (
                <Tag icon={<Image size={12} aria-hidden />} className="!m-0 inline-flex items-center gap-1">
                  มีรูป
                </Tag>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              ),
          },
          {
            title: '',
            key: 'remove',
            width: 52,
            render: (_, r) => (
              <Button
                danger
                type="text"
                icon={<Trash size={16} />}
                disabled={disabled}
                aria-label={`ลบ ${r.name || 'รายการใหม่'}`}
                onClick={() => draft.removeItem(r.key)}
              />
            ),
          },
        ]}
      />
      <Button type="dashed" icon={<Plus size={14} />} disabled={disabled} onClick={draft.addItem} className="self-start">
        เพิ่มรายการ
      </Button>
      {draft.menuErrors > 0 && (
        <Typography.Text type="danger" className="text-xs">
          กรอกชื่อรายการให้ครบก่อนบันทึก ({draft.menuErrors} รายการ)
        </Typography.Text>
      )}
    </div>
  );
}

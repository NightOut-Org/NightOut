/**
 * สร้าง payload PromptPay (EMVCo) สำหรับทำ QR — ใช้ในหน้าจ่ายมัดจำ
 * รองรับเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน/นิติบุคคล 13 หลัก
 */
function tlv(id: string, value: string) {
  return id + value.length.toString().padStart(2, '0') + value;
}

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export function promptPayPayload(target: string, amount?: number): string {
  const id = target.replace(/\D/g, '');
  const account =
    id.length >= 13 ? tlv('02', id) : tlv('01', ('0066' + id.replace(/^0/, '')).padStart(13, '0'));
  const merchant = tlv('29', tlv('00', 'A000000677010111') + account);
  const parts = [
    tlv('00', '01'),
    tlv('01', amount ? '12' : '11'),
    merchant,
    tlv('58', 'TH'),
    tlv('53', '764'),
    ...(amount ? [tlv('54', amount.toFixed(2))] : []),
  ];
  const body = parts.join('') + '6304';
  return body + crc16(body);
}

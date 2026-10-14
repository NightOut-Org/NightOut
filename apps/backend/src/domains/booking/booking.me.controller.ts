import { Body, Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ExtendBookingResult, JoinShareResult } from '@nightout/contracts';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { clientInfo } from '../../common/client-info';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { CancelBookingDto, CreateBookingDto } from './booking.dto';

/** booking · ลูกค้า — จอง / ยกเลิก / ขอต่อเวลา / ไปด้วย (rpc app_create_booking, app_cancel_booking, app_extend_booking, app_join_share) */
@ApiTags('booking')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller()
export class BookingMeController {
  constructor(private readonly db: SupabaseService) {}

  @Post('bookings')
  @ApiDoc({
    summary: 'จองโต๊ะ',
    description:
      'ลูกค้าสร้างการจองโต๊ะ (เฉพาะโต๊ะ + เลือกโปรของร้านได้ 1 อย่าง) · DB ตรวจโซนว่าง เวลา และเงื่อนไขโปรในธุรกรรมเดียว · ทุกการจองต้องมัดจำ → สถานะเริ่มที่ AWAITING_DEPOSIT (หรือ PENDING ถ้าร้านไม่เก็บมัดจำ) · ต้องมี `contact_phone` และ `deposit_terms.accepted = true` — DB เก็บหลักฐานการยอมรับเงื่อนไขริบมัดจำ (ข้อความ + IP + User-Agent + เวลา) แก้ไม่ได้ · บัญชี/เบอร์ที่ถูกแบน (สลิปปลอม 2 ครั้ง) → 403',
    returns: '`id` รหัสการจอง · `code` รหัสเช็กอิน · `status` สถานะการจอง · `deposit_required` ยอดมัดจำที่ต้องโอน (บาท)',
    status: 201,
  })
  create(@CurrentUser() me: AuthUser, @Body() b: CreateBookingDto, @Req() req: Request) {
    return this.db.rpc('app_create_booking', {
      p_actor: me.id,
      p_bar: b.bar_id,
      p_zone: b.zone_id,
      p_datetime: b.datetime,
      p_pax: b.pax,
      p_promotion: b.promotion_id ?? null,
      p_note: b.note ?? null,
      p_contact_phone: b.contact_phone,
      p_consent: b.deposit_terms ? { ...b.deposit_terms, ...clientInfo(req) } : null,
    });
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ยกเลิกการจอง',
    description: 'ลูกค้ายกเลิกการจองของตัวเอง (ก่อนเช็กอิน) พร้อมเหตุผล (ไม่บังคับ) · มัดจำ: trigger ตัดสินว่าคืนลูกค้าหรือเป็นของร้านตาม refund_before_hours',
    returns: '`id` รหัสการจอง · `status` = CANCELLED_BY_CUSTOMER',
  })
  cancel(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CancelBookingDto) {
    return this.db.rpc('app_cancel_booking', { p_actor: me.id, p_booking: id, p_reason: b.reason ?? null });
  }

  @Post('bookings/:id/extend')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ขอต่อเวลา 15 นาที',
    description:
      'ลูกค้าขอเลื่อนเวลาปลดโต๊ะ (auto_cancel_at) ออกไป 15 นาที — ได้ 1 ครั้งต่อการจอง · เฉพาะการจองของตัวเองที่สถานะ CONFIRMED · กดได้ตั้งแต่ 15 นาทีก่อนเวลาจองจนถึงเวลาปลดโต๊ะ (ปลดโต๊ะ = Forfeited ริบ Table Fee) · แจ้งทีมร้าน (rpc app_extend_booking)',
    returns: '`id` · `auto_cancel_at` เวลาปลดโต๊ะใหม่ · `extended_at`',
  })
  extend(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.db.rpc<ExtendBookingResult>('app_extend_booking', { p_actor: me.id, p_booking: id });
  }

  @Post('share-cards/:token/join')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ไปด้วย (เข้าร่วมการจองจากลิงก์แชร์)',
    description:
      'เพื่อนที่ได้ลิงก์แชร์กด "ไปด้วย" → บันทึกเป็นสมาชิกของการจองนั้น แล้วเห็น QR เช็กอินชุดเดียวกับผู้จอง (ใครถึงร้านก่อนให้พนักงานสแกน = เช็กอินทั้งโต๊ะ) · กดซ้ำ/เป็นผู้จองเอง = ไม่เพิ่มซ้ำ · ลิงก์ถูกยกเลิก → 404 · การจองจบแล้ว/ยกเลิก → ปิดรับ · แจ้งผู้จองเมื่อมีคนเข้าร่วมใหม่ (rpc app_join_share)',
    returns: '`joined` · `going_count` จำนวนคนที่กดไปด้วยแล้ว',
  })
  joinShare(@CurrentUser() me: AuthUser, @Param('token') token: string) {
    return this.db.rpc<JoinShareResult>('app_join_share', { p_actor: me.id, p_token: token.slice(0, 200) });
  }
}

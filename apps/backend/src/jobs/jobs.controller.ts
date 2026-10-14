import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RecomputeRankingResult } from '@nightout/contracts';
import { SupabaseService } from '../supabase/supabase.service';
import { JobSecretGuard } from './job-secret.guard';

/** ผลของ run_booking_timeouts() — จำนวนการจองที่จัดการในรอบนี้ (`no_show` = ปลดโต๊ะ Forfeited) */
export interface BookingTimeoutsResult {
  expired: number;
  reminded: number;
  warned: number;
  no_show: number;
  completed: number;
}

/** Endpoint ที่ pg_cron + pg_net เรียกตามรอบ (ดู apps/backend/supabase/migrations/…001400_retention_jobs.sql) */
@ApiExcludeController()
@SkipThrottle()
@UseGuards(JobSecretGuard)
@Controller('jobs')
export class JobsController {
  constructor(private readonly db: SupabaseService) {}

  /**
   * ทุก 1 นาที: PENDING/AWAITING_DEPOSIT หมดเวลา → EXPIRED
   * · CONFIRMED อีก ≤15 นาทีถึงเวลาจอง → แจ้งเตือนผู้จอง + เพื่อนที่กด "ไปด้วย" (`reminded`)
   * · CONFIRMED ยังไม่ต่อเวลา อีก ≤5 นาทีถึงเวลาปลดโต๊ะ → เตือนผู้จองให้กดขอต่อเวลา (`warned`)
   * · CONFIRMED เลย auto_cancel_at → NO_SHOW = ปลดโต๊ะ (Forfeited) · CHECKED_IN เลยเวลา → COMPLETED
   */
  @Post('booking-timeouts')
  @HttpCode(200)
  bookingTimeouts() {
    if (!this.db.configured) {
      return { expired: 0, reminded: 0, warned: 0, no_show: 0, completed: 0, skipped: 'SUPABASE_SERVICE_ROLE_KEY is not configured' };
    }
    return this.db.rpc<BookingTimeoutsResult>('run_booking_timeouts', {});
  }

  /**
   * ทุกคืน 00:05 (เวลาไทย · pg_cron ดูหัวไฟล์ …20261013001030_catalog_ranking_scores.sql): คำนวณคะแนนรวม/ดาวของทุกร้านที่แสดงอยู่
   * → tier_scores (รอบสัปดาห์ + เดือนปัจจุบัน) + bar_stats · รีวิว 50 · เช็กอิน 30 · Safety 20 (rankingScore() ใน @nightout/utils) · โฆษณาไม่มีผล
   * · แอดมินสั่งเองได้ที่ POST /admin/ranking/recompute (ปุ่ม "คำนวณใหม่")
   */
  @Post('tier')
  @HttpCode(200)
  tier() {
    if (!this.db.configured) {
      return { bars: 0, skipped: 'SUPABASE_SERVICE_ROLE_KEY is not configured' };
    }
    return this.db.rpc<RecomputeRankingResult>('run_tier_scores', {});
  }

  /** ทุก 1 นาที (สำรองไว้): ส่งแจ้งเตือนช่องทางนอก (LINE / Web Push) — ตอนนี้แจ้งเตือนในเว็บเขียนตรงจากฟังก์ชัน DB (app_notify) ยังไม่มีคิวส่งออก */
  @Post('notifications')
  @HttpCode(200)
  notificationsJob() {
    return { sent: 0, failed: 0, skipped: 'external channels not implemented' };
  }
}

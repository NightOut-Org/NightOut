import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { BookingTimeoutsResult } from './jobs.controller';

/**
 * DB ในเครื่องที่ไม่มี pg_cron → ตั้ง JOBS_LOCAL_INTERVAL_MS (เช่น 60000) ให้ backend รัน run_booking_timeouts() เอง · ค่าเริ่มต้น 0 = ปิด
 * DB จริงใช้ pg_cron เรียกฟังก์ชันใน DB ตรงทุกนาที (…20261014000100_booking_cron_jobs) — ห้ามเปิดตัวนี้ตอนต่อ DB จริง (ยิงซ้ำทุกเครื่อง)
 */
@Injectable()
export class LocalJobsScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('LocalJobs');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly db: SupabaseService,
  ) {}

  onModuleInit() {
    const ms = this.config.get<number>('JOBS_LOCAL_INTERVAL_MS', 0);
    if (this.config.get('NODE_ENV') !== 'development' || !ms || !this.db.configured) return;
    this.timer = setInterval(() => void this.tick(), ms);
    this.timer.unref();
    this.logger.log(`รัน job หมดเวลาการจองทุก ${Math.round(ms / 1000)} วินาที (เครื่อง dev)`);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      const r = await this.db.rpc<BookingTimeoutsResult>('run_booking_timeouts', {});
      if (r.expired || r.reminded || r.warned || r.no_show || r.completed) {
        this.logger.log(
          `หมดเวลา ${r.expired} · เตือน 15 นาที ${r.reminded ?? 0} · เตือนก่อนปลดโต๊ะ ${r.warned ?? 0} · ปลดโต๊ะ (Forfeited) ${r.no_show} · ปิดโต๊ะ ${r.completed}`,
        );
      }
    } catch (e) {
      this.logger.warn(`run_booking_timeouts: ${(e as Error).message}`);
    }
  }
}

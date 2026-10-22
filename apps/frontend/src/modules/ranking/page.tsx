import { CATEGORY_LABELS, listBars, type RankingPeriod } from '@/services/data';
import type { RankPeriod } from '@nightout/contracts';
import type { BarCategory } from '@nightout/types';
import { Button, Empty, Result, Segmented, Spin } from 'antd';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useDemo } from '@/hooks/useDemo';
import { InfoButton } from '@/ui/components/infoButton';
import { RuleList } from '@/ui/components/ruleList';
import { toRankedBars } from '@/ui/utils/ranking';
import { useRanking } from './api';
import { Podium } from './components/podium';
import { RadialCarousel } from './components/radialCarousel';
import { RankingBackdrop } from './components/rankingBackdrop';
import { RankList } from './components/rankList';
import { ScrollReveal } from './components/scrollReveal';
import { SplitHeading } from './components/splitHeading';

const PERIOD_LABEL: Record<RankingPeriod, string> = { WEEK: 'สัปดาห์นี้', MONTH: 'เดือนนี้' };
/** ค่าใน URL (?period=WEEK|MONTH) → รอบของ API */
const PERIOD_API: Record<RankingPeriod, RankPeriod> = { WEEK: 'WEEKLY', MONTH: 'MONTHLY' };
const CATEGORIES: readonly BarCategory[] = ['PUB_BAR', 'CHILL', 'RESTAURANT'];

/**
 * /ranking — จัดอันดับรายสัปดาห์ / รายเดือน (Figma "จัดอันดับ")
 * 1) Hero วงล้อการ์ดหมุน (GSAP: หมุนต่อเนื่อง + scrub ตามการเลื่อน)
 * 2) "สัปดาห์นี้ผู้ชนะได้แก่…" (เล่นครั้งเดียวเมื่อเลื่อนถึง) + แท่น 3 อันดับ (การ์ดกางเป็นพัดตามการเลื่อน)
 * 3) อันดับ 4–10 (ไล่ขึ้นทีละแถว)
 * ตัวเลือกช่วงเวลา/ประเภทร้านอยู่ใน URL (?period=MONTH&category=PUB_BAR) แชร์ลิงก์ได้
 */
export function RankingPage() {
  useDemo();
  const [params, setParams] = useSearchParams();
  const period: RankingPeriod = params.get('period') === 'MONTH' ? 'MONTH' : 'WEEK';
  const rawCategory = params.get('category') as BarCategory | null;
  // ค่าแปลกใน URL = ทุกประเภท (ไม่ส่งไปให้ API ตอบ 400)
  const category: BarCategory | 'ALL' = rawCategory && CATEGORIES.includes(rawCategory) ? rawCategory : 'ALL';
  // อันดับจริงรอบล่าสุด (GET /public/ranking · job คำนวณทุกคืน) เรียงตามโหวตในรอบ แล้วตามคะแนนรวม
  const { data, isPending, isError, refetch } = useRanking(PERIOD_API[period], category === 'ALL' ? undefined : category);
  const ranked = useMemo(() => toRankedBars(data ?? []), [data]);
  // ยังไม่มีใครเช็กอินในรอบนี้ (เช่นต้นสัปดาห์) — อันดับมาจากคะแนนรวมล้วน ๆ บอกผู้ใช้ให้ชัด
  const noVotes = ranked.length > 0 && ranked.every((b) => b.votes === 0);
  const heroBars = listBars({ sort: 'rating' });

  const set = (k: string, v: string, fallback: string) => {
    const p = new URLSearchParams(params);
    if (v === fallback) p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true, preventScrollReset: true });
  };

  return (
    <div className="relative isolate pb-24 md:pb-16">
      <RankingBackdrop />

      <RadialCarousel bars={heroBars}>
        <h1 className="text-3xl font-bold sm:text-5xl lg:text-6xl">
          จัดอันดับร้าน
        </h1>
        <p className="mx-auto mt-2 max-w-48 text-balance text-xs text-muted sm:max-w-md sm:text-base">
          นับจากโหวตของคนที่เช็กอินจริง โฆษณาซื้ออันดับไม่ได้
        </p>
      </RadialCarousel>

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:pt-24">
        <ScrollReveal className="flex flex-col items-center gap-3">
          <Segmented
            value={period}
            onChange={(v) => set('period', String(v), 'WEEK')}
            options={[
              { label: 'รายสัปดาห์', value: 'WEEK' },
              { label: 'รายเดือน', value: 'MONTH' },
            ]}
          />
          <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 [scrollbar-width:none]">
          <Segmented
            value={category}
            onChange={(v) => set('category', String(v), 'ALL')}
            options={[
              { label: 'ทั้งหมด', value: 'ALL' },
              ...CATEGORIES.map((c) => ({
                label: CATEGORY_LABELS[c],
                value: c,
              })),
            ]}
          />
          </div>
        </ScrollReveal>

        <div className="mt-14 sm:mt-20">
          <SplitHeading key={period} lead={PERIOD_LABEL[period]} text="ผู้ชนะได้แก่" />
          {noVotes && (
            <p className="mx-auto mt-3 max-w-md text-balance text-center text-sm text-muted">
              ยังไม่มีโหวตในรอบนี้ — เรียงตามคะแนนรวม (จากรีวิว เช็กอิน และ Safety)
            </p>
          )}
        </div>

        {isPending ? (
          <div className="mt-10 flex min-h-64 items-center justify-center sm:mt-14">
            <Spin size="large" />
          </div>
        ) : isError ? (
          <Result
            className="mt-6"
            status="warning"
            title="โหลดอันดับไม่สำเร็จ"
            extra={<Button onClick={() => void refetch()}>ลองใหม่</Button>}
          />
        ) : ranked.length === 0 ? (
          <Empty className="mt-12" description="ยังไม่มีร้านติดอันดับในหมวดนี้" />
        ) : (
          <>
            <div className="mt-10 sm:mt-14">
              <Podium key={`${period}-${category}`} top3={ranked.slice(0, 3)} />
            </div>
            <div className="mt-16 sm:mt-20">
              <RankList key={`${period}-${category}`} rows={ranked.slice(3, 10)} />
            </div>
          </>
        )}

        <ScrollReveal className="mt-10 flex justify-center">
          <InfoButton label="วิธีนับอันดับ">
            <RuleList
              rules={[
                <>
                  <b className="text-text">นับโหวตยังไง</b> 1 การจองที่เช็กอินแล้ว = 1 โหวต อัปเดตทุกคืน
                </>,
                <>
                  <b className="text-text">เริ่มรอบใหม่เมื่อไร</b> รายสัปดาห์ทุกวันจันทร์ ส่วนรายเดือนทุกวันที่ 1
                </>,
                <>
                  <b className="text-text">ถ้าโหวตเท่ากัน</b> เรียงตามคะแนนรวม ร้านที่รีวิวไม่ถึง 5 ยังไม่ติดอันดับ และโฆษณาไม่มีผล
                </>,
              ]}
            />
          </InfoButton>
        </ScrollReveal>
      </section>
    </div>
  );
}

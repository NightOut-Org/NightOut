import { rankingByPeriod } from '@/services/data';
import { useDemo } from '@/hooks/useDemo';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';
import { CategoryGrid } from './components/categoryGrid';
import { Hero } from './components/hero';
import { Newsletter } from './components/newsletter';
import { PopularGrid } from './components/popularGrid';
import { WeeklySpotlight } from './components/weeklySpotlight';
import { pickPopular } from './utils/popularBars';
import { useHomeContent } from './utils/useHomeContent';

/**
 * / — หน้าแรก
 * Hero → การ์ดหมวดหมู่ (ซ้อนทับขอบล่าง Hero) → อันดับประจำสัปดาห์ (แบนเนอร์อันดับ 1 + อันดับ 2–3) → กริดร้านยอดนิยม → สมัครข่าวสาร
 * (ฟุตเตอร์อยู่ใน MainLayout)
 */
export function HomePage() {
  useDemo();
  // Hero + การ์ดหมวด แอดมินแก้ได้ที่ Backoffice (GET /public/home) · ยังไม่มา = skeleton · โหลดไม่ได้ = ปุ่มลองใหม่ใน Hero
  const { content, categories, popularIds, failed, retry } = useHomeContent();
  // ร้านที่แอดมินปักไว้ก่อน แล้วเติมด้วยคะแนนรีวิวสูงสุดจนครบ 8
  const popular = pickPopular(popularIds);
  // อันดับประจำสัปดาห์ตามโหวต (เดียวกับหน้า /ranking) — คนละชุดกับกริดยอดนิยม (ปักโดยแอดมิน + คะแนนรีวิว)
  const weekly = rankingByPeriod('WEEK').slice(0, 3);

  return (
    <>
      {/*
        พื้นหลัง Golden Embers (canvas fixed เต็มจอ · ธีมมืด) อยู่ชั้นล่างสุดของ MainLayout (Layout หน้าแรกเป็น isolate)
        → Hero ที่ทึบบังไว้ แสงไม่ล้นเข้า Hero · ใต้ Hero ไปจนถึงฟุตเตอร์ (ภาพเมืองไล่จากใส) เห็นพื้นหลังต่อเนื่อง
      */}
      <EmbersBackdrop />
      <Hero content={content} failed={failed} onRetry={retry} />
      {/* ทุกส่วนใต้ Hero ซ้อนขึ้นทับ Hero ให้เห็นหมวดหมู่ตั้งแต่จอแรก · ธีมสว่างใช้พื้นเรียบ */}
      <div className="relative isolate z-10 -mt-28 md:-mt-36">
        {/* แถบไล่ #07070d → ใส 280px เริ่มที่ขอบล่าง Hero (ต่อจากสีขอบล่างของ Hero) ให้แสงค่อย ๆ โผล่ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-28 -z-10 hidden h-[280px] bg-gradient-to-b from-[#07070d] to-transparent dark:block md:top-36"
        />

        <div className="bg-gradient-to-b from-transparent via-background/80 to-background pt-24 md:pt-28 dark:bg-none">
          {!failed && (
            <CategoryGrid
              eyebrow={content?.categories_eyebrow}
              title={content?.categories_title}
              categories={categories}
            />
          )}
        </div>

        <div className="space-y-16 pb-10 pt-14 md:space-y-24 md:pb-14 md:pt-20">
          <WeeklySpotlight bars={weekly} />
          <PopularGrid bars={popular} eyebrow={content?.popular_eyebrow} title={content?.popular_title} />
          <Newsletter />
        </div>
      </div>
    </>
  );
}

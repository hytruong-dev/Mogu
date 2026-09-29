import { HealthService } from './health.service';

describe('HealthService without water data', () => {
  const setup = (items: any[] = []) => {
    const water = { list: jest.fn().mockResolvedValue({ totalMl: 250 }) };
    const prisma = { db: {
      profile: { findUnique: jest.fn().mockResolvedValue({ goalKcal: 2000 }) },
      healthTarget: { findFirst: jest.fn().mockResolvedValue(null) },
      diaryMealLog: { findMany: jest.fn().mockResolvedValue([{ localDate: new Date('2026-09-29') }]) },
      waterLog: { findMany: jest.fn().mockResolvedValue([]) },
    } };
    const meals = { list: jest.fn().mockResolvedValue({ items }) };
    return { service: new HealthService(prisma as any, meals as any, water as any), water, prisma };
  };

  it('does not query or return water when excluded, and keeps an unlogged day empty', async () => {
    const { service, water } = setup();
    const day = await service.getDay('u', '2026-09-29', 'Asia/Ho_Chi_Minh', false);
    expect(water.list).not.toHaveBeenCalled();
    expect(day).not.toHaveProperty('water');
    expect(day.dataStatus).toBe('no_data');
    expect(day.energy.consumedKcal).toBeNull();
    expect(day.energy.targetKcal).toBe(2000);
  });

  it('preserves logged meal totals when excluding water', async () => {
    const { service } = setup([{ mealSlot: 'LUNCH', totals: { kcal: 650, proteinG: 35, carbsG: 75, fatG: 23 } }]);
    const day = await service.getDay('u', '2026-09-29', 'Asia/Ho_Chi_Minh', false);
    expect(day.dataStatus).toBe('OK');
    expect(day.energy.consumedKcal).toBe(650);
    expect(day.energy.remainingKcal).toBe(1350);
    expect(day.macros.protein.consumedG).toBe(35);
  });

  it('does not query calendar water logs and derives calendar coverage from meals only', async () => {
    const { service, prisma } = setup();
    const calendar = await service.getCalendar('u', '2026-09', 'Asia/Ho_Chi_Minh', false);
    expect(prisma.db.waterLog.findMany).not.toHaveBeenCalled();
    expect(calendar.days[0]).toEqual({ localDate: '2026-09-29', hasMealLog: true, completionRatio: 1 });
  });

  it('keeps legacy water responses when the flag is omitted', async () => {
    const { service, water } = setup();
    const day = await service.getDay('u', '2026-09-29');
    expect(water.list).toHaveBeenCalled();
    expect(day.water?.consumedMl).toBe(250);
    expect(day.dataStatus).toBe('PARTIAL');
  });
});

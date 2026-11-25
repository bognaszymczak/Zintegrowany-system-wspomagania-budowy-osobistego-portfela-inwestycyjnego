import { describe, expect, it } from 'vitest';
import { SKETCH_PLAN } from '../plan';
import { profileByLevel } from '../profiles';
import { assessPortfolio, buildWaterfall, lossProbability, riskContributions } from './assessment';

const BASE = [18, 15, 5, 20, 10, 15, 17];
const START = [20, 20, 6, 18, 8, 15, 13];
const input = (weights: number[], baseWeights = BASE) => ({
  weights,
  baseWeights,
  baseName: 'Równowaga',
  plan: SKETCH_PLAN,
  profile: profileByLevel(3),
});

describe('szansa na dużą stratę', () => {
  it('liczby ze szkicu ekranu 8: 3,78% → 5,10% (bez korekty klimatu: 3,49%)', () => {
    expect(lossProbability(BASE) * 100).toBeCloseTo(3.78, 2);
    expect(lossProbability(START) * 100).toBeCloseTo(5.1, 2);
    expect(lossProbability(START, undefined, 1) * 100).toBeCloseTo(3.49, 2);
  });

  it('więcej akcji → większa szansa; wyższy mnożnik wahań → większa szansa', () => {
    expect(lossProbability(START)).toBeGreaterThan(lossProbability(BASE));
    expect(lossProbability(START, undefined, 1.3)).toBeGreaterThan(lossProbability(START, undefined, 1));
  });
});

describe('assessPortfolio — przykład ze szkicu (ustawienia początkowe vs „Równowaga”)', () => {
  const a = assessPortfolio(input(START));

  it('poziom ryzyka i „N na 100”', () => {
    expect(a.sri).toBe(4);
    expect(a.sriWord).toBe('podwyższone');
    expect(a.baseSri).toBe(3);
    expect(a.per100).toBe(5);
    expect(a.per100Base).toBe(4);
    expect(a.changed).toBe(true);
    expect(a.changedCount).toBe(6);
  });

  it('najgorszy rok i pieniądze w kryzysie', () => {
    expect(a.worstYear).toBeCloseTo(-0.1653, 3);
    expect(a.moneyAtWorst).toBe(16_700);
    const c2008 = a.crises.find((c) => c.id === 'y2008')!;
    expect(c2008.mine).toBeCloseTo(-0.165, 3);
    expect(c2008.base).toBeCloseTo(-0.132, 3);
    expect(c2008.leftPLN).toBe(16_700);
    expect(c2008.leftBasePLN).toBe(17_400);
    const c2022 = a.crises.find((c) => c.id === 'y2022')!;
    expect(c2022.mine).toBeCloseTo(-0.121, 3);
    expect(c2022.leftPLN).toBe(17_600);
  });

  it('wodospad: dwa kroki (gotówka→akcje, obligacje→akcje), suma kroków = różnica końcowa', () => {
    const w = a.waterfall;
    expect(w.map((s) => s.kind)).toEqual(['start', 'step', 'step', 'end']);
    expect(w[0]?.label).toBe('Propozycja „Równowaga”');
    expect(w[0]?.value).toBeCloseTo(3.78, 2);
    expect(w[1]?.label).toBe('4 pkt proc. mniej gotówki, więcej akcji');
    expect(w[1]?.delta).toBeCloseTo(0.73, 1);
    expect(w[2]?.label).toBe('4 pkt proc. mniej obligacji, więcej akcji');
    expect(w[2]?.delta).toBeCloseTo(0.59, 1);
    expect(w[3]?.label).toBe('Twoja wersja');
    expect(w[3]?.value).toBeCloseTo(5.1, 2);
    const deltaSum = w.reduce((s, step) => s + (step.delta ?? 0), 0);
    expect(w[0]!.value + deltaSum).toBeCloseTo(w[3]!.value, 9);
  });

  it('udział w ryzyku: akcje 46% pieniędzy, ok. 82% ryzyka', () => {
    const [akcje, obligacje, zloto, gotowka] = a.contributions;
    expect(akcje?.weightPct).toBe(46);
    expect(akcje?.riskPct).toBeCloseTo(81.7, 1);
    expect(obligacje?.riskPct).toBeCloseTo(7.9, 1);
    expect(zloto?.riskPct).toBeCloseTo(10.3, 1);
    expect(gotowka?.riskPct).toBeCloseTo(0, 0);
    expect(a.contributions.reduce((s, c) => s + c.riskPct, 0)).toBeCloseTo(100, 6);
    expect(a.contributionNote).toBe(
      'Akcje to 46% Twoich pieniędzy, ale aż 82% ryzyka. Pozostałe grupy wygładzają wahania.',
    );
  });

  it('podsumowanie po ludzku i kompromis', () => {
    expect(a.takeaways.map((t) => t.text)).toEqual([
      'Mieści się w limitach Twojego profilu „Zrównoważony”.',
      'Jest ryzykowniejszy niż propozycja „Równowaga” (4 z 7 zamiast 3 z 7).',
      'W złym roku wartość może spaść o ok. 16,5%. Z 20 000 zł zostałoby wtedy ok. 16 700 zł.',
    ]);
    expect(a.tradeOff).toBe(
      'Twoje zmiany zwiększają szansę dużej straty o 1,3 pkt proc., a typowy wynik po 10 latach rośnie z 108 400 zł do 110 300 zł.',
    );
  });

  it('zakres wyników i opis modelu', () => {
    expect(Math.round(a.summary.median / 100) * 100).toBe(110_300);
    expect(a.summary.paidIn).toBe(80_000);
    expect(a.summary.goalPLN).toBe(100_000);
    expect(a.fan[a.fan.length - 1]?.median).toBeCloseTo(a.summary.median, 6);
    expect(a.model.kind).toBe('demo-analytic');
    expect(a.model.regime.volMultiplier).toBe(1.15);
    expect(a.model.pLossWithoutRegime).toBeCloseTo(3.49, 2);
  });
});

describe('assessPortfolio — przypadki brzegowe', () => {
  it('bez zmian: dwa wiersze wodospadu o tej samej wartości i komunikat „bez Twoich zmian”', () => {
    const a = assessPortfolio(input(BASE));
    expect(a.changed).toBe(false);
    expect(a.waterfall).toHaveLength(2);
    expect(a.waterfall[0]?.value).toBe(a.waterfall[1]?.value);
    expect(a.takeaways[1]?.text).toBe('To dokładnie propozycja „Równowaga” — bez Twoich zmian.');
    expect(a.tradeOff).toBe('Propozycja nie została zmieniona, więc ocena dotyczy dokładnie „Równowaga”.');
  });

  it('przesunięcie tylko wewnątrz grupy: jeden krok „Zmiany w obrębie grup”', () => {
    const moved = [15, 18, 5, 20, 10, 15, 17]; // 3 pkt z „świata” do USA
    const w = buildWaterfall(BASE, moved, 'Równowaga');
    expect(w.map((s) => s.kind)).toEqual(['start', 'step', 'end']);
    expect(w[1]?.label.startsWith('Zmiany w obrębie grup')).toBe(true);
    expect(w[0]!.value + (w[1]!.delta ?? 0)).toBeCloseTo(w[2]!.value, 9);
  });

  it('kilku odbiorców: etykieta wymienia wszystkie grupy, a suma kroków zgadza się', () => {
    // 10 pkt z gotówki: 6 do akcji świata, 4 do złota
    const final = [24, 15, 5, 20, 10, 19, 7];
    const w = buildWaterfall(BASE, final, 'Równowaga');
    const donor = w.find((s) => s.kind === 'step');
    expect(donor?.label).toBe('10 pkt proc. mniej gotówki, więcej akcji i złota');
    const deltaSum = w.reduce((s, step) => s + (step.delta ?? 0), 0);
    expect(w[0]!.value + deltaSum).toBeCloseTo(w[w.length - 1]!.value, 9);
  });

  it('ostrzega, gdy wersja wychodzi poza limity profilu', () => {
    const a = assessPortfolio(input([0, 55, 0, 0, 0, 0, 45]));
    expect(a.limits.ok).toBe(false);
    expect(a.takeaways[0]?.tone).toBe('warn');
    expect(a.takeaways[0]?.text.startsWith('Wychodzi poza limity Twojego profilu „Zrównoważony”: ')).toBe(true);
  });

  it('spokojniejsza wersja dostaje komunikat „spokojniejszy”', () => {
    const calm = [10, 9, 3, 27, 13, 14, 24];
    const a = assessPortfolio(input(calm));
    expect(a.takeaways[1]?.tone).toBe('down');
    expect(a.takeaways[1]?.text).toBe('Jest spokojniejszy niż propozycja „Równowaga” (2 z 7 zamiast 3 z 7).');
  });

  it('udział w ryzyku sumuje się do 100% dla dowolnego portfela', () => {
    for (const w of [BASE, START, [0, 55, 0, 0, 0, 0, 45], [14, 12, 4, 23, 12, 12, 23]]) {
      expect(riskContributions(w).reduce((s, c) => s + c.riskPct, 0)).toBeCloseTo(100, 6);
    }
  });
});

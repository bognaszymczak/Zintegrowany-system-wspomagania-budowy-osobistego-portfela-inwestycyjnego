import { useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssumptions, useProposals } from '@/api/hooks';
import type { MarketAssumptions, ProposalView, ProposalsResponse } from '@/api/types';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Donut } from '@/components/charts/Donut';
import { GroupLegend } from '@/components/charts/GroupLegend';
import { yearsLabel } from '@/components/charts/geometry';
import { RiskScale } from '@/components/charts/RiskScale';
import { LimitList } from '@/components/portfolio/LimitList';
import { DataNote } from '@/components/ui/DataNote';
import { KvList } from '@/components/ui/Kv';
import { PageHead } from '@/components/ui/PageHead';
import { Pill } from '@/components/ui/Pill';
import { QueryState } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { usePageTitle } from '@/components/usePageTitle';
import { MAX_WEIGHT, checkLimits, groupTotals, portfolioMetrics, redistribute, sumWeights } from '@/domain/portfolio/engine';
import { percentRound, rangeTys, zl } from '@/domain/portfolio/format';
import { GROUPS, INSTRUMENTS, colorOf } from '@/domain/portfolio/instruments';
import { pct } from '@/domain/profiles';
import { useSession } from '@/session/SessionProvider';

/** Ekran 6: edycja udziałów suwakami z podglądem skutków na żywo. */
export function AdjustPage() {
  usePageTitle('Dopasuj udziały');
  const { profile, level, riskProfile, proposalId, weights } = useSession();
  const proposals = useProposals(profile?.profileId ?? null, level);
  const assumptions = useAssumptions();
  if (!profile || !level || !riskProfile || !proposalId || !weights) return null; // pilnuje tego RequireChoice

  return (
    <AppShell stage={4}>
      <main className="page">
        <QueryState query={proposals} loading="Wczytujemy Twój portfel…">
          {(data) => {
            const base = data.proposals.find((p) => p.id === proposalId);
            if (!base) {
              return (
                <Notice tone="warn">
                  Nie znaleziono wybranej propozycji. Wróć do trzech portfeli i wybierz jeden jeszcze raz.
                </Notice>
              );
            }
            return (
              <QueryState query={assumptions} loading="Wczytujemy założenia rynkowe…">
                {(a) => <Editor data={data} base={base} assumptions={a} />}
              </QueryState>
            );
          }}
        </QueryState>
      </main>
    </AppShell>
  );
}

function Editor({
  data,
  base,
  assumptions,
}: {
  data: ProposalsResponse;
  base: ProposalView;
  assumptions: MarketAssumptions;
}) {
  const session = useSession();
  const navigate = useNavigate();
  const riskProfile = session.riskProfile!;
  const plan = data.plan;
  const weights = session.weights ?? base.weights;

  const metrics = useMemo(() => portfolioMetrics(weights, plan, assumptions), [weights, plan, assumptions]);
  const baseMetrics = useMemo(() => portfolioMetrics(base.weights, plan, assumptions), [base.weights, plan, assumptions]);
  const limits = checkLimits(metrics, riskProfile);
  const totals = groupTotals(weights);
  const baseTotals = groupTotals(base.weights);
  const changedCount = weights.filter((w, i) => w !== base.weights[i]).length;

  // Zmiana jednego suwaka: pozostałe udziały skalują się tak, by suma nadal wynosiła 100% (patrz redistribute).
  const update = (index: number, value: number) => session.setWeights(redistribute(weights, index, value));
  const reset = () => session.setWeights([...base.weights]);

  const equityLimit = Math.round(riskProfile.maxEquity * 100);
  const ref = `„${base.name}”`;

  return (
    <>
      <PageHead
        back={{ to: `/portfele/${base.id}`, label: 'Wróć do szczegółów portfela' }}
        eyebrow="Krok 4 · Dopasowanie"
        title="Dopasuj udziały po swojemu"
        lead={`Punktem wyjścia jest propozycja ${ref}. Przesuwaj suwaki — pozostałe udziały dostosują się same, a suma zawsze wyniesie 100%. Podgląd obok pokazuje skutki od razu.`}
      />

      <div className="layout">
        <div className="layout__main">
          <Sheet
            title="Udziały instrumentów"
            sub={`Ciemny znacznik na suwaku to udział z propozycji ${ref}.`}
            action={
              <button type="button" className="btn btn--secondary btn--small" onClick={reset} disabled={changedCount === 0}>
                <Icon name="undo" size={16} />
                Wróć do propozycji
              </button>
            }
          >
            <div className="pills pills--tight">
              <Pill tone="teal">
                <Icon name="check" size={14} strokeWidth={3} /> Suma: {sumWeights(weights)}%
              </Pill>
              <Pill tone={changedCount === 0 ? 'neutral' : 'amber'}>
                {changedCount === 0 ? 'Bez zmian względem propozycji' : `Zmienione pozycje: ${changedCount} z ${weights.length}`}
              </Pill>
            </div>

            {GROUPS.map((group, groupIndex) => {
              const total = totals[groupIndex] ?? 0;
              const overLimit = group.id === 'akcje' && total > equityLimit;
              return (
                <div className="alloc" role="group" aria-labelledby={`group-${group.id}`} key={group.id}>
                  <div className="alloc__head">
                    <h3 id={`group-${group.id}`}>{group.name}</h3>
                    <p className="alloc__meta">
                      {group.id === 'akcje' ? (
                        <span className={overLimit ? 'alloc__limit alloc__limit--over' : 'alloc__limit'}>
                          limit profilu: do {equityLimit}%
                        </span>
                      ) : null}
                      <span>propozycja: {Math.round(baseTotals[groupIndex] ?? 0)}%</span>
                      <b>{Math.round(total)}%</b>
                    </p>
                  </div>
                  {group.indexes.map((index) => (
                    <SliderRow
                      key={index}
                      index={index}
                      value={weights[index] ?? 0}
                      baseValue={base.weights[index] ?? 0}
                      onChange={update}
                    />
                  ))}
                </div>
              );
            })}

            <p className="note">
              <Icon name="info" size={18} />
              <span>
                <b>Spróbuj:</b> zwiększ udział akcji powyżej {equityLimit}%. Zobaczysz, jak rośnie ryzyko i jak narzędzie
                ostrzega o przekroczeniu limitu z Twojego profilu.
              </span>
            </p>

            <div className="sheet__foot">
              <p className="sheet__foot-text">
                <b>W następnym kroku</b> model uczenia maszynowego oceni, jak ryzykowny jest ten wybór na tle historii rynku.
              </p>
              <button type="button" className="btn btn--primary" onClick={() => navigate('/ocena')}>
                Oceń ryzyko mojego wyboru
                <Icon name="arrowRight" size={20} strokeWidth={2.2} />
              </button>
            </div>
          </Sheet>

          {/* Na wąskim ekranie podgląd jest pod suwakami — ten pasek pokazuje najważniejsze liczby cały czas. */}
          <div className="livebar" aria-hidden="true">
            <span className="livebar__item">
              <small>Ryzyko</small>
              <b>{metrics.sri} z 7</b>
            </span>
            <span className="livebar__item">
              <small>Typowy wynik</small>
              <b>{zl(metrics.median)}</b>
            </span>
            <span className={`livebar__status${limits.ok ? '' : ' livebar__status--warn'}`}>
              <Icon name={limits.ok ? 'check' : 'alert'} size={16} strokeWidth={2.4} />
              {limits.ok ? 'W limitach' : 'Poza limitami'}
            </span>
          </div>
        </div>

        <aside className="layout__aside" aria-label="Podgląd na żywo">
          <div className="live">
            <div className="live__head">
              <p className="eyebrow">Podgląd na żywo</p>
              <div className="live__title">
                <h2>Twoja wersja</h2>
                <Pill tone="amber">Dane przykładowe</Pill>
              </div>
            </div>

            <div className="live__mix">
              <Donut totals={totals} size={112} center={{ big: `${metrics.sri}/7`, small: 'ryzyko' }} />
              <GroupLegend totals={totals} />
            </div>

            <RiskScale level={metrics.sri} word={metrics.sriWord} />
            <p className="live__ref">
              Propozycja {ref}: {baseMetrics.sri} z 7 · {baseMetrics.sriWord}
            </p>

            <KvList
              items={[
                {
                  label: `Typowy wynik po ${yearsLabel(plan.years)}`,
                  value: zl(metrics.median),
                  sub: `zakres ${rangeTys(metrics.p10, metrics.p90)} · ${ref}: ${zl(baseMetrics.median)}`,
                },
                ...(plan.targetPLN !== null && metrics.goalProbability !== null
                  ? [
                      {
                        label: `Szansa na ${zl(plan.targetPLN, 1000)}`,
                        value: percentRound(metrics.goalProbability),
                        sub:
                          baseMetrics.goalProbability !== null ? `${ref}: ${percentRound(baseMetrics.goalProbability)}` : undefined,
                      },
                    ]
                  : []),
                {
                  label: 'Najgorszy rok w symulacji',
                  value: pct(metrics.worstYear, 1),
                  sub: `${metrics.worstScenario.name} · ${ref}: ${pct(baseMetrics.worstYear, 1)}`,
                },
                {
                  label: 'Koszt roczny',
                  value: `ok. ${pct(metrics.annualCost, 2)}`,
                  sub: `${ref}: ok. ${pct(baseMetrics.annualCost, 2)}`,
                },
              ]}
            />

            <div className={`verdict ${limits.ok ? 'verdict--ok' : 'verdict--warn'}`}>
              <h3>
                <Icon name={limits.ok ? 'shieldCheck' : 'alert'} size={20} />
                {limits.ok ? 'Mieści się w limitach Twojego profilu' : 'Wychodzisz poza limity Twojego profilu'}
              </h3>
              <LimitList check={limits} />
              {limits.ok ? null : (
                <p>To dozwolone — model oceni skutki w następnym kroku.</p>
              )}
            </div>
            {/* czytnik ekranu dostaje krótki komunikat tylko wtedy, gdy zmienia się stan „mieści się / nie mieści się” */}
            <p className="visually-hidden" role="status">
              {limits.ok ? 'Portfel mieści się w limitach profilu.' : 'Portfel wychodzi poza limity profilu.'}
            </p>

            <DataNote asOf={data.asOf} validUntil={data.validUntil} />
          </div>
        </aside>
      </div>
    </>
  );
}

interface SliderRowProps {
  index: number;
  value: number;
  baseValue: number;
  onChange: (index: number, value: number) => void;
}

/** Jeden instrument: nazwa, różnica względem propozycji, suwak z przyciskami −/+ i znacznikiem udziału z propozycji. */
function SliderRow({ index, value, baseValue, onChange }: SliderRowProps) {
  const instrument = INSTRUMENTS[index]!;
  const id = `slider-${instrument.id}`;
  const delta = value - baseValue;
  const style = {
    '--frac': value / MAX_WEIGHT,
    '--base': baseValue / MAX_WEIGHT,
  } as CSSProperties;

  return (
    <div className="slider-row" style={style} data-changed={delta !== 0 ? 'true' : undefined}>
      <div className="slider-row__head">
        <label htmlFor={id} className="slider-row__name">
          <span className="slider-row__swatch" style={{ background: colorOf(index) }} aria-hidden="true" />
          <span>
            <b>{instrument.name}</b>
            <span className="slider-row__sub">{instrument.sub}</span>
          </span>
        </label>
        <span className={`delta delta--${delta > 0 ? 'up' : delta < 0 ? 'down' : 'zero'}`}>
          {delta === 0 ? 'bez zmian' : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} pkt proc.`}
        </span>
        <output htmlFor={id} className="slider-row__value">
          {value}%
        </output>
      </div>
      <div className="slider-row__control">
        <button
          type="button"
          className="stepper"
          aria-label={`Zmniejsz udział: ${instrument.name}`}
          disabled={value <= 0}
          onClick={() => onChange(index, value - 1)}
        >
          <Icon name="minus" size={18} strokeWidth={2.4} />
        </button>
        <div className="slider-row__range">
          <input
            id={id}
            type="range"
            min={0}
            max={MAX_WEIGHT}
            step={1}
            value={value}
            aria-valuetext={`${value} procent`}
            onChange={(event) => onChange(index, Number(event.target.value))}
          />
          <span className="slider-row__tick" aria-hidden="true" />
        </div>
        <button
          type="button"
          className="stepper"
          aria-label={`Zwiększ udział: ${instrument.name}`}
          disabled={value >= MAX_WEIGHT}
          onClick={() => onChange(index, value + 1)}
        >
          <Icon name="plus" size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

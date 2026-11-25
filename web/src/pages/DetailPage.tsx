import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAssumptions, useBacktest, useProposals } from '@/api/hooks';
import type { BacktestResponse, MarketAssumptions, ProposalView, ProposalsResponse } from '@/api/types';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { CHART_COLORS } from '@/components/charts/colors';
import { HistoryChart, type HistorySeries } from '@/components/charts/HistoryChart';
import { RiskScale } from '@/components/charts/RiskScale';
import { LimitList } from '@/components/portfolio/LimitList';
import { DataNote } from '@/components/ui/DataNote';
import { KvList } from '@/components/ui/Kv';
import { PageHead } from '@/components/ui/PageHead';
import { Pill } from '@/components/ui/Pill';
import { Loading, QueryState } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { usePageTitle } from '@/components/usePageTitle';
import { yearsLabel } from '@/components/charts/geometry';
import { MAX_WEIGHT, checkLimits, portfolioMetrics, scenarioReturn } from '@/domain/portfolio/engine';
import { percentRound, zl } from '@/domain/portfolio/format';
import { INSTRUMENTS, colorOf } from '@/domain/portfolio/instruments';
import { pct } from '@/domain/profiles';
import { useSession } from '@/session/SessionProvider';

/** Ekran 5: szczegóły jednej z trzech propozycji i decyzja „wybieram ten portfel”. */
export function DetailPage() {
  usePageTitle('Szczegóły portfela');
  const { proposalId } = useParams();
  const { profile, level, riskProfile } = useSession();
  const proposals = useProposals(profile?.profileId ?? null, level);
  const assumptions = useAssumptions();
  if (!profile || !level || !riskProfile) return null; // pilnuje tego RequireProfile

  return (
    <AppShell stage={3}>
      <main className="page">
        <QueryState query={proposals} loading="Wczytujemy portfel…">
          {(data) => {
            const proposal = data.proposals.find((p) => p.id === proposalId);
            if (!proposal) {
              return (
                <>
                  <PageHead title="Nie znaleziono takiego portfela" back={{ to: '/portfele', label: 'Wróć do trzech propozycji' }} />
                  <Notice tone="warn">
                    Ten portfel nie należy do propozycji dla Twojego profilu. Wybierz jeden z trzech na poprzednim ekranie.
                  </Notice>
                </>
              );
            }
            return <DetailView data={data} proposal={proposal} assumptions={assumptions.data ?? null} />;
          }}
        </QueryState>
      </main>
    </AppShell>
  );
}

function DetailView({
  data,
  proposal,
  assumptions,
}: {
  data: ProposalsResponse;
  proposal: ProposalView;
  assumptions: MarketAssumptions | null;
}) {
  const session = useSession();
  const navigate = useNavigate();
  const backtest = useBacktest(proposal.weights);
  const riskProfile = session.riskProfile!;
  const plan = data.plan;

  const metrics = useMemo(
    () => (assumptions ? portfolioMetrics(proposal.weights, plan, assumptions) : null),
    [assumptions, proposal.weights, plan],
  );
  const limits = metrics ? checkLimits(metrics, riskProfile) : null;

  const choose = () => {
    session.chooseProposal(proposal.id, proposal.weights);
    navigate('/dopasowanie');
  };

  return (
    <>
      <PageHead
        back={{ to: '/portfele', label: 'Wróć do porównania trzech portfeli' }}
        eyebrow="Krok 3 · Wybór portfela"
        title={proposal.name}
        badge={<Pill tone="teal">{proposal.tag}</Pill>}
        lead="Sprawdź szczegóły, zanim zdecydujesz. Wybór możesz zmienić w każdej chwili — nic nie kupujesz, to symulacja."
      />

      <div className="layout layout--aside-first">
        <div className="layout__main">
          <Sheet title="Z czego się składa" sub="Siedem rodzajów instrumentów w czterech grupach. Udziały sumują się do 100%.">
            <ul className="holdings">
              {INSTRUMENTS.map((instrument, index) => {
                const weight = proposal.weights[index] ?? 0;
                return (
                  <li key={instrument.id}>
                    <span className="holdings__swatch" style={{ background: colorOf(index) }} aria-hidden="true" />
                    <div className="holdings__text">
                      <b>{instrument.name}</b>
                      <span>{instrument.sub}</span>
                    </div>
                    <span className="holdings__bar" aria-hidden="true">
                      <i style={{ width: `${(weight / MAX_WEIGHT) * 100}%`, background: colorOf(index) }} />
                    </span>
                    <b className="holdings__pct">{weight}%</b>
                  </li>
                );
              })}
            </ul>
            <p className="note">
              <Icon name="info" size={18} />
              <span>
                W symulacji używamy odpowiedników funduszy ETF dostępnych dla klientów w Europie. Konkretne produkty
                wybierasz samodzielnie, u własnego brokera.
              </span>
            </p>
          </Sheet>

          <Sheet title="Jak powstał ten portfel">
            <p>
              {proposal.idea} Algorytm rozkłada pieniądze między grupy instrumentów tak, by żadna nie dominowała, mieszcząc
              się w limitach Twojego profilu. To przykład do analizy — nie zalecenie.
            </p>
          </Sheet>

          <Sheet title="Jak ten portfel zachowywałby się w przeszłości">
            <QueryState query={backtest} loading="Liczymy symulację wsteczną…">
              {(bt) => <History bt={bt} name={proposal.name} />}
            </QueryState>
          </Sheet>

          <Sheet
            title="Co by było w kryzysach"
            sub="Jak ten portfel zachowałby się w trzech trudnych okresach, w porównaniu z samymi akcjami USA."
          >
            {assumptions ? (
              <Crises weights={proposal.weights} assumptions={assumptions} name={proposal.name} startPLN={plan.startPLN} />
            ) : (
              <Loading label="Wczytujemy scenariusze…" />
            )}
          </Sheet>
        </div>

        <aside className="layout__aside" aria-label="Podsumowanie wyboru">
          <div className="pick">
            <div className="pick__head">
              <p className="pick__eyebrow">Twój wybór</p>
              <p className="pick__name">{proposal.name}</p>
            </div>
            <div className="pick__body">
              <RiskScale level={proposal.sri} word={proposal.sriWord} />
              <KvList
                items={[
                  {
                    label: `Typowy wynik po ${yearsLabel(plan.years)}`,
                    value: zl(proposal.medianPLN),
                    sub: `zakres ${Math.round(proposal.p10PLN / 1000)}–${Math.round(proposal.p90PLN / 1000)} tys. zł`,
                  },
                  ...(plan.targetPLN !== null && proposal.goalProbability !== null
                    ? [{ label: `Szansa na ${zl(plan.targetPLN, 1000)}`, value: percentRound(proposal.goalProbability) }]
                    : []),
                  { label: 'Najgorszy rok w symulacji', value: pct(proposal.worstYear, 1) },
                  { label: 'Koszt roczny', value: `ok. ${pct(proposal.annualCost, 2)}` },
                ]}
              />

              <div className="pick__block">
                <h3>{limits && !limits.ok ? 'Wychodzi poza limity Twojego profilu' : 'Mieści się w limitach Twojego profilu'}</h3>
                {limits ? <LimitList check={limits} /> : <Loading label="Sprawdzamy limity…" />}
              </div>

              <div className="pick__actions">
                <button type="button" className="btn btn--primary btn--block" onClick={choose}>
                  Wybieram i dopasowuję udziały
                  <Icon name="arrowRight" size={20} strokeWidth={2.2} />
                </button>
                <Link to="/portfele" className="btn btn--secondary btn--block">
                  Porównaj z innymi portfelami
                </Link>
                <button type="button" className="link-button link-button--center" onClick={() => window.print()}>
                  <Icon name="print" size={16} /> Wydrukuj lub zapisz jako PDF
                </button>
              </div>
              <DataNote asOf={data.asOf} validUntil={data.validUntil} />
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function History({ bt, name }: { bt: BacktestResponse; name: string }) {
  const series: HistorySeries[] = [
    { id: 'portfolio', label: name, color: CHART_COLORS.portfolio, values: bt.portfolio, width: 3 },
    { id: 'sp500', label: 'S&P 500 (same akcje USA)', color: CHART_COLORS.sp500, values: bt.sp500, width: 2 },
    {
      id: 'inflation',
      label: 'Inflacja (tyle trzeba, by nie tracić)',
      color: CHART_COLORS.inflation,
      values: bt.inflation,
      dash: '2 4',
      width: 2.4,
    },
    { id: 'deposit', label: 'Lokata bankowa', color: CHART_COLORS.deposit, values: bt.deposit, dash: '6 4', width: 2 },
  ];
  const ends = [bt.stats.portfolioEnd, bt.stats.sp500End, bt.stats.inflationEnd, bt.stats.depositEnd];
  const firstYear = Number(bt.dates[1]?.slice(0, 4) ?? bt.dates[0]?.slice(0, 4));
  const description =
    `Wartość ${zl(bt.startPLN, 1)} w czasie. ` +
    series.map((s, i) => `${s.label}: ${zl(ends[i] ?? 0)}`).join('; ') +
    '.';

  return (
    <>
      <p className="sheet__sub">
        Symulacja wsteczna: co stałoby się z {zl(bt.startPLN, 1)} wpłaconymi na początku {firstYear} roku. Jasne pasy to
        kryzysy.
      </p>
      <HistoryChart dates={bt.dates} series={series} crises={bt.crises} label={description} />
      <ul className="series-legend">
        {series.map((s, i) => (
          <li key={s.id}>
            <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
              <line
                x1="1"
                x2="29"
                y1="5"
                y2="5"
                stroke={s.color}
                strokeWidth={s.width ?? 2}
                strokeDasharray={s.dash}
                strokeLinecap="round"
              />
            </svg>
            <span>{s.label}</span>
            <b>{zl(ends[i] ?? 0)}</b>
          </li>
        ))}
      </ul>
      <p className="note-line">
        Największy spadek od szczytu: <b>{pct(bt.stats.portfolioMaxDrawdown, 1)}</b> (S&amp;P 500:{' '}
        <b>{pct(bt.stats.sp500MaxDrawdown, 1)}</b>)
      </p>
      <p className="datanote">{bt.source} Wyniki z przeszłości nie gwarantują wyników w przyszłości.</p>
    </>
  );
}

function Crises({
  weights,
  assumptions,
  name,
  startPLN,
}: {
  weights: readonly number[];
  assumptions: MarketAssumptions;
  name: string;
  startPLN: number;
}) {
  return (
    <ul className="crisis-grid">
      {assumptions.scenarios.map((scenario) => {
        const mine = scenarioReturn(weights, scenario);
        const usa = scenario.returns[1] ?? 0; // „Akcje USA” jako odpowiednik S&P 500
        const bar = (x: number) => `${Math.min(100, (Math.abs(x) / 0.6) * 100)}%`;
        return (
          <li key={scenario.id} className="crisis">
            <p className="crisis__period">{scenario.period}</p>
            <h3>{scenario.name}</h3>
            <div className="crisis__row">
              <span>{name}</span>
              <b>{pct(mine, 1)}</b>
            </div>
            <span className="crisis__track" aria-hidden="true">
              <i className="crisis__fill crisis__fill--mine" style={{ width: bar(mine) }} />
            </span>
            <div className="crisis__row">
              <span>S&amp;P 500</span>
              <b>{pct(usa, 0)}</b>
            </div>
            <span className="crisis__track" aria-hidden="true">
              <i className="crisis__fill crisis__fill--ref" style={{ width: bar(usa) }} />
            </span>
            <p className="crisis__left">
              Z {zl(startPLN, 100)} zostałoby ok. <b>{zl(startPLN * (1 + mine), 100)}</b>.
            </p>
          </li>
        );
      })}
    </ul>
  );
}

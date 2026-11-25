import { Link } from 'react-router-dom';
import { useProposals } from '@/api/hooks';
import type { ProposalView, ProposalsResponse } from '@/api/types';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { Donut } from '@/components/charts/Donut';
import { GroupLegend } from '@/components/charts/GroupLegend';
import { RangeComparison } from '@/components/charts/RangeComparison';
import { RiskScale } from '@/components/charts/RiskScale';
import { KvList, type KvItem } from '@/components/ui/Kv';
import { PageHead } from '@/components/ui/PageHead';
import { Pill } from '@/components/ui/Pill';
import { QueryState } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { usePageTitle } from '@/components/usePageTitle';
import { formatDatePl } from '@/domain/dates';
import { plain, percentRound, zl } from '@/domain/portfolio/format';
import { GOAL_OPTIONS, labelOf } from '@/domain/questionnaire';
import { pct } from '@/domain/profiles';
import { yearsLabel } from '@/components/charts/geometry';
import { useSession } from '@/session/SessionProvider';

/** Ekran 4: trzy propozycje portfeli w granicach profilu. */
export function ProposalsPage() {
  usePageTitle('Trzy propozycje portfeli');
  const { profile, request, level, riskProfile } = useSession();
  const query = useProposals(profile?.profileId ?? null, level);
  if (!profile || !request || !level || !riskProfile) return null; // pilnuje tego RequireProfile

  const plan = query.data?.plan ?? profile.plan;
  const goalText = labelOf(GOAL_OPTIONS, request.goal).toLowerCase();

  return (
    <AppShell stage={2}>
      <main className="page">
        <PageHead
          eyebrow="Krok 2 · Propozycje"
          title="Trzy przykładowe portfele w granicach Twojego profilu"
          lead="Ułożone od najmniejszego do największego ryzyka. Żaden nie jest „najlepszy” — różnią się tym, ile wahań wartości oznaczają po drodze. Wybór należy do Ciebie."
        />

        <ul className="pills" aria-label="Założenia, na których liczymy">
          <li>
            <Pill>
              Profil: <b>{riskProfile.name} ({level} z 5)</b>
            </Pill>
          </li>
          <li>
            <Pill>
              Cel: <b>{plan.targetPLN ? `${goalText}, ${plain(plan.targetPLN)} zł` : goalText}</b>
            </Pill>
          </li>
          <li>
            <Pill>
              Start: <b>{plain(plan.startPLN)} zł + {plain(plan.monthlyPLN)} zł miesięcznie</b>
            </Pill>
          </li>
          <li>
            <Pill>
              Horyzont: <b>{yearsLabel(plan.years)}</b>
            </Pill>
          </li>
          <li>
            <Link to="/profil" className="pills__change">
              Zmień
            </Link>
          </li>
        </ul>

        <QueryState query={query} loading="Układamy trzy propozycje dla Twojego profilu…">
          {(data) => <ProposalsView data={data} />}
        </QueryState>
      </main>
    </AppShell>
  );
}

function ProposalsView({ data }: { data: ProposalsResponse }) {
  const { plan, proposals } = data;
  const paidIn = plan.startPLN + plan.monthlyPLN * Math.round(12 * plan.years);

  return (
    <>
      <ul className="proposal-grid">
        {proposals.map((proposal) => (
          <li key={proposal.id}>
            <ProposalCard proposal={proposal} years={plan.years} goal={plan.targetPLN} />
          </li>
        ))}
      </ul>

      <Sheet
        title={`Gdzie możesz się znaleźć za ${yearsLabel(plan.years)}`}
        sub="Zakres obejmuje 8 z 10 symulowanych scenariuszy, ciemna kreska to wynik typowy. Im szerszy zakres, tym większa niepewność — w obie strony."
      >
        <RangeComparison
          rows={proposals.map((p) => ({
            id: p.id,
            name: p.name,
            p10: p.p10PLN,
            median: p.medianPLN,
            p90: p.p90PLN,
          }))}
          paidIn={paidIn}
          goal={plan.targetPLN}
        />
      </Sheet>

      <div className="callout callout--amber">
        <Icon name="alert" size={22} />
        <div>
          <p>
            <b>To przykłady do analizy, nie zalecenie. Decyzja należy do Ciebie.</b>
          </p>
          <p>
            Wyniki to symulacja na danych historycznych i prognoza modelu, a nie obietnica. Liczone dla wpłaty{' '}
            {zl(plan.startPLN, 100)} na start i {zl(plan.monthlyPLN, 50)} miesięcznie, w złotówkach. Propozycje ważne do{' '}
            {formatDatePl(data.validUntil)} (dane z {formatDatePl(data.asOf)}).
          </p>
          <p>
            <Link to="/info/model">Jak powstały te portfele</Link> · <Link to="/info/zrodla">Źródła danych</Link>
          </p>
        </div>
      </div>
    </>
  );
}

function ProposalCard({ proposal, years, goal }: { proposal: ProposalView; years: number; goal: number | null }) {
  const featured = proposal.kind === 'rownowaga';
  const items: KvItem[] = [
    { label: `Typowy wynik po ${yearsLabel(years)}`, value: zl(proposal.medianPLN) },
    { label: 'Najgorszy rok w symulacji', value: pct(proposal.worstYear, 1) },
  ];
  if (goal !== null && proposal.goalProbability !== null) {
    items.push({ label: `Szansa na ${zl(goal, 1000)}`, value: percentRound(proposal.goalProbability) });
  }
  items.push({ label: 'Koszt roczny', value: `ok. ${pct(proposal.annualCost, 2)}` });

  return (
    <article className={`proposal${featured ? ' proposal--featured' : ''}`} aria-labelledby={`${proposal.id}-name`}>
      <header className="proposal__head">
        <h2 id={`${proposal.id}-name`}>{proposal.name}</h2>
        <Pill tone={featured ? 'teal' : 'neutral'}>{proposal.tag}</Pill>
      </header>
      <p className="proposal__idea">{proposal.idea}</p>
      <RiskScale level={proposal.sri} word={proposal.sriWord} />
      <div className="proposal__mix">
        <Donut totals={proposal.groupTotals} size={128} />
        <GroupLegend totals={proposal.groupTotals} />
      </div>
      <KvList items={items} />
      <Link to={`/portfele/${proposal.id}`} className="btn btn--secondary btn--block">
        Wybieram ten portfel
        <Icon name="arrowRight" size={18} />
      </Link>
      <p className="datanote">Przykład do analizy, nie zalecenie</p>
    </article>
  );
}

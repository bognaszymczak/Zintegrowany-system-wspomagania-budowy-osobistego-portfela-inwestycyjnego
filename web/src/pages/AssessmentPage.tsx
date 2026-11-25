import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { humanizeError } from '@/api/client';
import { useDeleteChoice, useRiskAssessment, useSaveChoice } from '@/api/hooks';
import type { RiskAssessmentRequest, RiskAssessmentResponse, SavedChoice } from '@/api/types';
import { AppShell } from '@/components/AppShell';
import { Icon, type IconName } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { ContributionBars } from '@/components/charts/ContributionBars';
import { DotGrid } from '@/components/charts/DotGrid';
import { FanChart } from '@/components/charts/FanChart';
import { RiskScale } from '@/components/charts/RiskScale';
import { Waterfall } from '@/components/charts/Waterfall';
import { yearsLabel } from '@/components/charts/geometry';
import { PageHead } from '@/components/ui/PageHead';
import { Pill } from '@/components/ui/Pill';
import { QueryState } from '@/components/ui/QueryState';
import { Sheet } from '@/components/ui/Sheet';
import { usePageTitle } from '@/components/usePageTitle';
import { formatDatePl } from '@/domain/dates';
import type { Takeaway } from '@/domain/portfolio/assessment';
import { groupTotals } from '@/domain/portfolio/engine';
import { dec, percentRound, plain, zl } from '@/domain/portfolio/format';
import { GROUPS } from '@/domain/portfolio/instruments';
import { pct } from '@/domain/profiles';
import { useSession } from '@/session/SessionProvider';

const TAKEAWAY_ICON: Record<Takeaway['tone'], IconName> = {
  ok: 'check',
  up: 'trendUp',
  down: 'trendDown',
  warn: 'alert',
};

/** Ekran 7: ocena ryzyka wyboru użytkownika przez model (w demo: model zastępczy, w produkcji: ML z backendu). */
export function AssessmentPage() {
  usePageTitle('Ocena ryzyka');
  const { profile, level, proposalId, weights } = useSession();
  const request = useMemo(
    () => (profile && level && proposalId && weights ? { profileId: profile.profileId, level, proposalId, weights } : null),
    [profile, level, proposalId, weights],
  );
  const query = useRiskAssessment(request);
  if (!request) return null; // pilnuje tego RequireChoice

  return (
    <AppShell stage={5}>
      <main className="page">
        <PageHead
          back={{ to: '/dopasowanie', label: 'Wróć do suwaków' }}
          eyebrow="Krok 5 · Ocena ryzyka"
          title="Ocena ryzyka Twojego wyboru"
          lead="Model sprawdził Twoją wersję portfela na tle historii rynku i obecnych warunków. To ocena statystyczna — nie prognoza ani zalecenie."
        />
        <QueryState query={query} loading="Model sprawdza Twój portfel na tle historii rynku…">
          {(data) => <AssessmentView data={data} request={request} />}
        </QueryState>
      </main>
    </AppShell>
  );
}

function AssessmentView({
  data,
  request,
}: {
  data: RiskAssessmentResponse;
  request: RiskAssessmentRequest;
}) {
  const { assessment: a, plan, weights, baseName } = data;
  const totals = groupTotals(weights);
  const isDemo = a.model.kind !== 'ml';
  const worstPct = Math.abs(a.worstYear * 100).toFixed(0);

  return (
    <>
      <section className="verdict-head" aria-label="Wynik oceny">
        <div>
          <p className="verdict-head__eyebrow">
            {isDemo ? 'Ocena modelu (wersja demonstracyjna)' : 'Ocena modelu uczenia maszynowego'}
          </p>
          <h2>Twoja wersja portfela</h2>
        </div>
        <p className="verdict-head__mix">
          {GROUPS.map((group, index) => `${group.name} ${Math.round(totals[index] ?? 0)}%`).join(' · ')}
        </p>
        <Pill tone="amber">{isDemo ? 'Dane przykładowe' : `Dane z ${formatDatePl(data.asOf)}`}</Pill>
      </section>

      <div className="triple">
        <Sheet className="metric">
          <p className="metric__label">Poziom ryzyka</p>
          <p className="metric__big">
            {a.sri} <small>z 7</small>
            <Pill tone="amber">{a.sriWord}</Pill>
          </p>
          <RiskScale level={a.sri} word={a.sriWord} bare />
          <p className="metric__ref">
            Propozycja „{baseName}”: {a.baseSri} z 7 · {a.baseSriWord}
          </p>
          <p className="metric__small">
            Skala 1–7 to własna skala narzędzia: 1 oznacza bardzo niskie ryzyko, 7 najwyższe.
          </p>
        </Sheet>

        <Sheet className="metric">
          <p className="metric__label">Szansa na dużą stratę</p>
          <DotGrid
            count={a.per100}
            label={`${a.per100} na 100 lat ze stratą ponad 10 procent w ciągu roku`}
          />
          <p className="metric__big">
            {a.per100} <small>na 100</small>
          </p>
          <p className="metric__ref">lat ze stratą ponad 10%</p>
          <p className="metric__small">
            Wyobraź sobie 100 podobnych lat na rynku. W około {a.per100} z nich ta wersja portfela straciłaby w ciągu roku
            ponad 10%.
            {a.changed ? ` Propozycja „${baseName}”: ${a.per100Base} na 100.` : ''}
          </p>
        </Sheet>

        <Sheet className="metric" title="Co to znaczy po ludzku">
          <ul className="takeaways">
            {a.takeaways.map((item, index) => (
              <li key={index} data-tone={item.tone}>
                <Icon name={TAKEAWAY_ICON[item.tone]} size={20} />
                <span>{item.text}</span>
              </li>
            ))}
            <li data-tone="info">
              <Icon name="info" size={20} />
              <span>Zadaj sobie pytanie: czy zachowasz spokój przy takim spadku i nic nie sprzedasz?</span>
            </li>
          </ul>
        </Sheet>
      </div>

      <div className="duo">
        <Sheet
          title="Co zmienia Twój wybór"
          sub="Szansa na stratę ponad 10% w ciągu roku: od propozycji do Twojej wersji (w punktach procentowych)."
        >
          <Waterfall steps={a.waterfall} />
          <p className="note note--soft">
            <Icon name="info" size={18} />
            <span>{a.tradeOff}</span>
          </p>
        </Sheet>

        <Sheet title="Skąd bierze się ryzyko" sub="Udział każdej grupy w pieniądzach i w ryzyku portfela.">
          <ContributionBars items={a.contributions} />
          <p className="note note--soft">
            <Icon name="info" size={18} />
            <span>{a.contributionNote}</span>
          </p>
        </Sheet>
      </div>

      <Sheet
        title="Jak by to wyglądało w kryzysach"
        sub={`Trzy trudne okresy z przeszłości: Twoja wersja na tle propozycji „${baseName}”.`}
      >
        <ul className="crisis-grid">
          {a.crises.map((crisis) => {
            const bar = (x: number) => `${Math.min(100, (Math.abs(x) / 0.6) * 100)}%`;
            return (
              <li key={crisis.id} className="crisis">
                <p className="crisis__period">{crisis.period}</p>
                <h3>{crisis.name}</h3>
                <div className="crisis__row">
                  <span>Twoja wersja</span>
                  <b>{pct(crisis.mine, 1)}</b>
                </div>
                <span className="crisis__track" aria-hidden="true">
                  <i className="crisis__fill crisis__fill--mine" style={{ width: bar(crisis.mine) }} />
                </span>
                <div className="crisis__row">
                  <span>{baseName}</span>
                  <b>{pct(crisis.base, 1)}</b>
                </div>
                <span className="crisis__track" aria-hidden="true">
                  <i className="crisis__fill crisis__fill--ref" style={{ width: bar(crisis.base) }} />
                </span>
                <p className="crisis__left">
                  Z {zl(plan.startPLN, 100)} zostałoby ok. <b>{zl(crisis.leftPLN, 100)}</b>
                  <br />
                  <span>
                    ({baseName}: {zl(crisis.leftBasePLN, 100)})
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <Sheet
        title={`Zakres możliwych wyników za ${yearsLabel(a.summary.years)}`}
        sub={`Start ${zl(plan.startPLN, 100)} i ${zl(plan.monthlyPLN, 50)} miesięcznie. Model pokazuje, że przyszłość to nie jedna liczba, tylko pas możliwości.`}
      >
        <div className="fan">
          <div className="fan__chart">
            <FanChart
              fan={a.fan}
              goal={a.summary.goalPLN}
              label={`Wykres możliwych wyników. Typowy wynik po ${yearsLabel(a.summary.years)}: ${plain(a.summary.median)} zł; 8 na 10 wyników mieści się między ${plain(a.summary.p10)} a ${plain(a.summary.p90)} zł; suma wpłat: ${plain(a.summary.paidIn)} zł.`}
            />
            <ul className="fan__legend" aria-hidden="true">
              <li>
                <i className="key key--median" /> typowy wynik
              </li>
              <li>
                <i className="key key--band" /> 8 na 10 możliwych wyników
              </li>
              <li>
                <i className="key key--paid" /> suma wpłat
              </li>
              {a.summary.goalPLN !== null ? (
                <li>
                  <i className="key key--goal" /> cel
                </li>
              ) : null}
            </ul>
          </div>
          <dl className="fan__stats">
            <div>
              <dt>Typowy wynik (mediana)</dt>
              <dd className="fan__big">{zl(a.summary.median, 100)}</dd>
            </div>
            <div>
              <dt>Zakres 8 na 10 wyników</dt>
              <dd>
                <b>
                  {zl(a.summary.p10, 100)} – {zl(a.summary.p90, 100)}
                </b>
              </dd>
            </div>
            <div>
              <dt>Suma Twoich wpłat</dt>
              <dd>
                <b>{zl(a.summary.paidIn, 100)}</b>
              </dd>
            </div>
            {a.summary.goalPLN !== null && a.summary.goalProbability !== null ? (
              <div>
                <dt>Szansa na {zl(a.summary.goalPLN, 1000)}</dt>
                <dd>
                  <b>{percentRound(a.summary.goalProbability)}</b>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <p className="note note--soft">
          <Icon name="info" size={18} />
          <span>
            W jednym przypadku na dziesięć wynik może być niższy niż dolna granica zakresu, a w jednym na dziesięć wyższy
            niż górna.
          </span>
        </p>
      </Sheet>

      <ModelExplanation data={data} isDemo={isDemo} />

      <NextSteps data={data} request={request} worstPct={worstPct} />

      <div className="callout callout--amber">
        <Icon name="alert" size={22} />
        <p>
          <b>Ważne.</b> Tę ocenę przygotował automatycznie {isDemo ? 'prosty model statystyczny (wersja demonstracyjna)' : 'model uczenia maszynowego'} i
          może się on mylić. To nie jest porada inwestycyjna ani rekomendacja. Wyniki z przeszłości nie gwarantują wyników w
          przyszłości. Decyzję podejmujesz samodzielnie i na własną odpowiedzialność.{' '}
          {isDemo ? 'Dane w wersji demonstracyjnej są przykładowe. ' : ''}Ważne do {formatDatePl(data.validUntil)} (dane z{' '}
          {formatDatePl(data.asOf)}).
        </p>
      </div>
    </>
  );
}

const RELIABILITY = {
  niska: { label: 'niska', filled: 1 },
  srednia: { label: 'średnia', filled: 2 },
  wysoka: { label: 'wysoka', filled: 3 },
} as const;

function ModelExplanation({ data, isDemo }: { data: RiskAssessmentResponse; isDemo: boolean }) {
  const { model } = data.assessment;
  const a = data.assessment;
  const reliability = RELIABILITY[model.reliability];

  return (
    <Sheet title="Jak model doszedł do tej oceny" sub="Bez tajemnic: z czego korzysta, co robi i czego nie potrafi.">
      {isDemo ? (
        <Notice tone="info">
          W tej wersji demonstracyjnej oceny nie liczy jeszcze wytrenowany model uczenia maszynowego, tylko prosty model
          statystyczny ({model.name}). Prawdziwy model podłączamy w backendzie w tym samym miejscu — ten ekran się nie zmieni.
        </Notice>
      ) : null}
      <ol className="model-cards">
        <li className="model-card">
          <span className="model-card__n" aria-hidden="true">
            1
          </span>
          <h3>Uczy się z historii</h3>
          <p>
            {isDemo
              ? `Korzysta z założeń rynkowych na dzień ${formatDatePl(data.asOf)}: oczekiwanych zwrotów, wahań i korelacji instrumentów (${model.trainedOn}).`
              : `Model przeanalizował ${model.trainedOn}: ceny, zmienność, inflację i stopy procentowe. Źródła: Alpha Vantage, FMP, FRED.`}
          </p>
        </li>
        <li className="model-card">
          <span className="model-card__n" aria-hidden="true">
            2
          </span>
          <h3>Rozpoznaje klimat rynku</h3>
          <p>
            {model.regime.volMultiplier > 1
              ? `Obecnie: ${model.regime.label} (przykład: wskaźnik VIX ${model.regime.vix}). W takich okresach straty bywały głębsze, więc ocena ryzyka została podniesiona: z ${dec(model.pLossWithoutRegime, 1)}% do ${dec(a.lossChancePct, 1)}%.`
              : `Obecnie: ${model.regime.label}, więc nie korygujemy oceny ryzyka.`}
          </p>
        </li>
        <li className="model-card model-card--warn">
          <span className="model-card__n" aria-hidden="true">
            3
          </span>
          <h3>Czego model nie wie</h3>
          <ul>
            <li>Nie przewiduje przyszłości, tylko ją szacuje.</li>
            <li>Nie uwzględnia podatków ani kosztów transakcji.</li>
            <li>Rzadkie zdarzenia mogą być groźniejsze niż w historii.</li>
          </ul>
        </li>
      </ol>
      <div className="reliability">
        <p className="reliability__title">
          Wiarygodność tej oceny: <b>{reliability.label}</b>
        </p>
        <span className="reliability__bar" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <i key={n} data-on={n <= reliability.filled ? 'true' : 'false'} />
          ))}
        </span>
        <p className="reliability__note">{model.reliabilityNote}</p>
      </div>
      <p className="datanote">
        Model: {model.name} (wersja {model.version}).{' '}
        <Link to="/info/model">Pełny opis modelu</Link>
      </p>
    </Sheet>
  );
}

function NextSteps({
  data,
  request,
  worstPct,
}: {
  data: RiskAssessmentResponse;
  request: RiskAssessmentRequest;
  worstPct: string;
}) {
  const navigate = useNavigate();
  const save = useSaveChoice();
  const remove = useDeleteChoice();
  const [saved, setSaved] = useState<SavedChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    try {
      setSaved(await save.mutateAsync({ ...request, weights: [...data.weights] }));
    } catch (e) {
      setError(humanizeError(e));
    }
  };
  const onUndo = async () => {
    if (!saved) return;
    setError(null);
    try {
      await remove.mutateAsync(saved.id);
      setSaved(null);
    } catch (e) {
      setError(humanizeError(e));
    }
  };

  return (
    <section className="next" aria-labelledby="next-title">
      <div className="next__copy">
        <h2 id="next-title">Co dalej?</h2>
        <p>
          Możesz zapisać ten wybór albo wrócić i go zmienić. Nic nie kupujesz: to symulacja, którą w każdej chwili poprawisz.
        </p>
        <p className="next__worst">
          Przypominamy: w złym roku ta wersja może stracić ok. {worstPct}% wartości.
        </p>
      </div>

      <div className="next__actions">
        {saved ? (
          <div className="next__saved" role="status">
            <p>
              <Icon name="check" size={18} strokeWidth={2.6} /> <b>Zapisano w Twoim panelu</b>
            </p>
            <p>Możesz do niego wrócić i go zmienić bez żadnych skutków finansowych.</p>
            <button type="button" className="link-button link-button--light" onClick={onUndo} disabled={remove.isPending}>
              Cofnij zapis
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--amber btn--block" onClick={onSave} disabled={save.isPending}>
            {save.isPending ? <span className="spinner" aria-hidden="true" /> : <Icon name="check" size={20} strokeWidth={2.4} />}
            {save.isPending ? 'Zapisujemy…' : 'Zapisz ten wybór'}
          </button>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <div className="next__row">
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/dopasowanie')}>
            Zmień udziały
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/portfele')}>
            Porównaj propozycje
          </button>
        </div>
        <button type="button" className="link-button link-button--light link-button--center" onClick={() => window.print()}>
          <Icon name="print" size={16} /> Wydrukuj lub zapisz raport jako PDF
        </button>
      </div>
    </section>
  );
}

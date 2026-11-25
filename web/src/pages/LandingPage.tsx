import { Link } from 'react-router-dom';
import { useMe } from '@/api/hooks';
import { Icon, type IconName } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Donut } from '@/components/charts/Donut';
import { GroupLegend } from '@/components/charts/GroupLegend';
import { StatTile } from '@/components/ui/Kv';
import { Pill } from '@/components/ui/Pill';
import { usePageTitle } from '@/components/usePageTitle';
import { SKETCH_PLAN } from '@/domain/plan';
import { evaluateProposals } from '@/domain/portfolio/proposals';
import { pct } from '@/domain/profiles';
import { plain, zl } from '@/domain/portfolio/format';

/**
 * Przykładowy portfel z karty na stronie startowej. Liczymy go lokalnym silnikiem na danych
 * przykładowych — strona startowa jest publiczna i nie potrzebuje backendu ani logowania.
 */
const EXAMPLE = (() => {
  const proposal = evaluateProposals(3, SKETCH_PLAN).find((p) => p.kind === 'rownowaga')!;
  return proposal;
})();

const STEPS: { icon: IconName; title: string; text: string; foot: string }[] = [
  {
    icon: 'target',
    title: 'Opowiedz o sobie',
    text: 'Krótki formularz: cel, czas, sytuacja i podejście do ryzyka. Odpowiedzi możesz zmienić w każdej chwili.',
    foot: 'ok. 3 minuty',
  },
  {
    icon: 'pie',
    title: 'Zobacz trzy propozycje',
    text: 'Trzy przykładowe portfele od najmniejszego do największego ryzyka, każdy w granicach Twojego profilu. Żaden nie jest „najlepszy”.',
    foot: 'wybierasz sam',
  },
  {
    icon: 'sliders',
    title: 'Dopasuj suwakami',
    text: 'Zmień udział akcji, obligacji czy złota i od razu zobacz, jak zmieniają się ryzyko i typowy wynik w złotówkach.',
    foot: 'podgląd na żywo',
  },
  {
    icon: 'shieldCheck',
    title: 'Sprawdź ocenę ryzyka',
    text: 'Model uczenia maszynowego ocenia Twoją wersję portfela i pokazuje, co składa się na ryzyko oraz jak wyglądałaby w kryzysach.',
    foot: 'z wyjaśnieniem, jak działa',
  },
];

const FAQ: { icon: IconName; question: string; answer: string }[] = [
  {
    icon: 'info',
    question: 'Czy to jest doradztwo inwestycyjne?',
    answer:
      'Nie. Horyzont to narzędzie do nauki i symulacji: pokazuje przykładowe portfele i ocenę ryzyka, ale nie mówi, co kupić ani sprzedać. Nie łączymy się z kontem maklerskim, a decyzja zawsze należy do Ciebie.',
  },
  {
    icon: 'lock',
    question: 'Jakie dane o mnie zbieracie?',
    answer:
      'Adres e-mail i odpowiedzi z krótkiego formularza. Nie prosimy o PESEL, datę urodzenia, numer karty ani hasła do konta maklerskiego — konto jest dla osób pełnoletnich i wystarczy oświadczenie o ukończeniu 18 lat. Masz prawo wglądu w swoje dane i ich usunięcia — opisujemy to w polityce prywatności.',
  },
  {
    icon: 'bars',
    question: 'Skąd są liczby na wykresach?',
    answer:
      'Notowania pochodzą z publicznych źródeł (Alpha Vantage, Financial Modeling Prep), kursy walut z NBP, a dane makroekonomiczne z FRED. Przy każdym wykresie widać źródło i datę aktualizacji.',
  },
  {
    icon: 'pulse',
    question: 'Czy mogę ufać ocenie modelu?',
    answer:
      'Model ma publiczny opis: na czym się uczył, jak go testowaliśmy i czego nie potrafi. To informacja pomocnicza, nie obietnica wyniku — dlatego zawsze pokazujemy też niepewność.',
  },
];

export function LandingPage() {
  usePageTitle('Twój osobisty portfel inwestycyjny');
  const me = useMe();
  const loggedIn = Boolean(me.data);
  const startTo = loggedIn ? '/formularz' : '/konto';

  return (
    <div className="lp">
      {/* ---------- góra strony ---------- */}
      <section className="lp-hero">
        <div className="lp-wrap">
          <nav className="lp-nav" aria-label="Główna nawigacja">
            <Link to="/" className="lp-brand">
              <Logo size={32} />
              <span>Horyzont</span>
            </Link>
            <div className="lp-nav__links">
              <a href="#jak">Jak to działa</a>
              <a href="#watpliwosci">Pytania i wątpliwości</a>
              <a href="#start">Zacznij</a>
            </div>
            <div className="lp-nav__actions">
              {loggedIn ? (
                <Link to="/formularz" className="lp-btn lp-btn--amber lp-btn--small">
                  Przejdź do aplikacji
                </Link>
              ) : (
                <>
                  <Link to="/konto?tryb=logowanie" className="lp-btn lp-btn--ghost lp-btn--small">
                    Zaloguj się
                  </Link>
                  <Link to="/konto" className="lp-btn lp-btn--amber lp-btn--small">
                    Załóż konto
                  </Link>
                </>
              )}
            </div>
          </nav>

          <div className="lp-hero__body">
            <div className="lp-hero__copy">
              <span className="lp-badge">
                <Icon name="info" size={16} />
                Narzędzie do nauki i symulacji — to nie jest doradztwo inwestycyjne
              </span>
              <h1>Zbuduj portfel inwestycyjny, który pasuje do Twoich celów</h1>
              <p className="lp-hero__lead">
                Odpowiedz na kilka pytań, zobacz trzy przykładowe portfele, dopasuj je suwakami i sprawdź, jak wygląda
                ryzyko. Bez żargonu i bez wysyłania pieniędzy gdziekolwiek.
              </p>
              <div className="lp-hero__cta">
                <Link to={startTo} className="lp-btn lp-btn--amber">
                  Zacznij — to ok. 3 minuty
                  <Icon name="arrowRight" size={20} strokeWidth={2.2} />
                </Link>
                <a href="#jak" className="lp-btn lp-btn--ghost">
                  Zobacz, jak to działa
                </a>
              </div>
              <ul className="lp-hero__points">
                {['Bez PESEL-u i danych karty', 'Bez łączenia z kontem maklerskim', 'Nic nie kupujesz ani nie sprzedajesz'].map(
                  (text) => (
                    <li key={text}>
                      <Icon name="check" size={18} strokeWidth={2.4} />
                      {text}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="lp-hero__card-wrap">
              <div className="lp-example">
                <div className="lp-example__top">
                  <span>Przykładowy portfel</span>
                  <Pill tone="amber">Dane przykładowe</Pill>
                </div>
                <div className="lp-example__name">{EXAMPLE.name}</div>
                <div className="lp-example__mix">
                  <Donut totals={EXAMPLE.groupTotals} center={{ big: `${EXAMPLE.metrics.sri}/7`, small: 'ryzyko' }} />
                  <GroupLegend totals={EXAMPLE.groupTotals} />
                </div>
                <div className="lp-example__stats">
                  <StatTile label={`Typowy wynik po ${SKETCH_PLAN.years} latach`} value={zl(EXAMPLE.metrics.median)} />
                  <StatTile label="Najgorszy rok w symulacji" value={pct(EXAMPLE.metrics.worstYear, 1)} />
                </div>
                <p className="lp-example__note">
                  Przy wpłacie {plain(SKETCH_PLAN.startPLN)}&nbsp;zł na start i {plain(SKETCH_PLAN.monthlyPLN)}&nbsp;zł
                  miesięcznie. Przykład do analizy, nie zalecenie.
                </p>
              </div>
              <div className="lp-example__badge">
                <Icon name="shieldCheck" size={26} />
                <span>Ocena modelu: ryzyko mieści się w granicach Twojego profilu</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- jak to działa ---------- */}
      <section id="jak" className="lp-section lp-section--white">
        <div className="lp-wrap lp-stack">
          <div className="lp-heading">
            <h2>Od pytań do oceny ryzyka w czterech krokach</h2>
            <p>Cała ścieżka zajmuje kilkanaście minut. Nic nie kupujesz ani nie sprzedajesz — to symulacja i nauka.</p>
          </div>
          <ol className="lp-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="lp-step">
                <div className="lp-step__top">
                  <span className="lp-step__icon">
                    <Icon name={step.icon} size={24} strokeWidth={1.8} />
                  </span>
                  <span className="lp-step__n">Krok {index + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="lp-step__foot">{step.foot}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- pytania ---------- */}
      <section id="watpliwosci" className="lp-section">
        <div className="lp-wrap lp-stack">
          <div className="lp-heading">
            <h2>Pytania, które warto zadać, zanim założysz konto</h2>
            <p>Odpowiadamy wprost, bez drobnego druku.</p>
          </div>
          <div className="lp-faq">
            {FAQ.map((item) => (
              <article key={item.question} className="lp-faq__item">
                <span className="lp-faq__icon">
                  <Icon name={item.icon} size={22} strokeWidth={1.8} />
                </span>
                <div>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- zaproszenie ---------- */}
      <section id="start" className="lp-section lp-section--tight">
        <div className="lp-wrap">
          <div className="lp-band">
            <div>
              <h2>Zacznij od trzech minut pytań</h2>
              <p>Konto jest bezpłatne, a o usunięcie swoich danych możesz poprosić w każdej chwili.</p>
            </div>
            <div className="lp-band__actions">
              <Link to={startTo} className="lp-btn lp-btn--amber">
                {loggedIn ? 'Przejdź do formularza' : 'Załóż konto'}
                <Icon name="arrowRight" size={20} strokeWidth={2.2} />
              </Link>
              {loggedIn ? null : (
                <Link to="/konto?tryb=logowanie" className="lp-btn lp-btn--ghost">
                  Mam już konto
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- stopka ---------- */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer__inner">
          <div className="lp-footer__row">
            <span className="lp-brand lp-brand--small">
              <Logo size={26} />
              <span>Horyzont</span>
            </span>
            <nav className="lp-footer__links" aria-label="Informacje prawne i o aplikacji">
              <Link to="/info/regulamin">Regulamin</Link>
              <Link to="/info/prywatnosc">Polityka prywatności</Link>
              <Link to="/info/cookies">Polityka cookies</Link>
              <Link to="/info/model">Jak działa model</Link>
              <Link to="/info/zrodla">Źródła danych</Link>
            </nav>
          </div>
          <p>
            Horyzont to narzędzie do nauki i symulacji. Nie jest doradztwem inwestycyjnym ani ofertą kupna lub sprzedaży
            instrumentów finansowych. Wyniki z przeszłości i symulacje nie gwarantują wyników w przyszłości, a wartość
            inwestycji może spaść. Liczby w wersji demonstracyjnej są przykładowe.
          </p>
          <p className="lp-footer__credits">
            Dane: Alpha Vantage, Financial Modeling Prep, NBP, FRED®. This product uses the FRED® API but is not endorsed
            or certified by the Federal Reserve Bank of St. Louis.
          </p>
        </div>
      </footer>
    </div>
  );
}

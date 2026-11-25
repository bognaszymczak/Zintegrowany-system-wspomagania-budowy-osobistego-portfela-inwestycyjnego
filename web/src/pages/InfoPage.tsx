import { Link, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Notice } from '@/components/Notice';
import { PageHead } from '@/components/ui/PageHead';
import { usePageTitle } from '@/components/usePageTitle';

interface Doc {
  title: string;
  lead: string;
  /** dokument prawny w wersji roboczej — pokazujemy ostrzeżenie, że wymaga weryfikacji prawnika */
  draft?: boolean;
  sections: { heading: string; paragraphs: string[] }[];
}

const DRAFT_WARNING =
  'To wersja robocza przygotowana na potrzeby projektu. Przed uruchomieniem serwisu dla prawdziwych użytkowników treść musi sprawdzić prawnik; miejsca oznaczone w nawiasach kwadratowych trzeba uzupełnić.';

/**
 * Strony informacyjne podlinkowane w stopce i w formularzu konta.
 * Treść trzymamy w jednym miejscu, żeby łatwo ją poprawić (np. po uwagach promotora albo prawnika).
 */
const DOCS: Record<string, Doc> = {
  regulamin: {
    title: 'Regulamin',
    lead: 'Zasady korzystania z narzędzia Horyzont.',
    draft: true,
    sections: [
      {
        heading: '1. Czym jest Horyzont',
        paragraphs: [
          'Horyzont to narzędzie do nauki i symulacji. Pokazuje przykładowe portfele inwestycyjne i szacuje związane z nimi ryzyko na podstawie podanych przez Ciebie odpowiedzi oraz danych rynkowych.',
          'Horyzont nie świadczy usług doradztwa inwestycyjnego, nie wydaje rekomendacji, nie przyjmuje ani nie przekazuje zleceń i nie łączy się z rachunkami maklerskimi.',
        ],
      },
      {
        heading: '2. Konto użytkownika',
        paragraphs: [
          'Konto mogą założyć wyłącznie osoby, które ukończyły 18 lat. Przy zakładaniu konta prosimy o oświadczenie o ukończeniu 18 lat; nie pytamy o datę urodzenia ani o dokument.',
          'Do zapisania wyników potrzebne jest konto (adres e-mail i hasło). Użytkownik odpowiada za zachowanie hasła w tajemnicy. O usunięcie konta można wnioskować w każdej chwili (sposób opisuje Polityka prywatności).',
          'Jeśli okaże się, że konto założyła osoba poniżej 18 lat, usuniemy je wraz z danymi.',
        ],
      },
      {
        heading: '3. Charakter wyników',
        paragraphs: [
          'Wszystkie wyniki są symulacjami opartymi na danych historycznych i modelach statystycznych. Wyniki z przeszłości nie gwarantują wyników w przyszłości, a wartość inwestycji może spaść.',
          'Decyzje inwestycyjne użytkownik podejmuje samodzielnie i na własną odpowiedzialność.',
        ],
      },
      {
        heading: '4. Kontakt i reklamacje',
        paragraphs: ['[Dane usługodawcy i adres e-mail do kontaktu — do uzupełnienia.]'],
      },
    ],
  },
  prywatnosc: {
    title: 'Polityka prywatności',
    lead: 'Jakie dane zbieramy, po co i jak możesz nimi zarządzać.',
    draft: true,
    sections: [
      {
        heading: 'Administrator danych',
        paragraphs: ['[Nazwa i dane kontaktowe administratora — do uzupełnienia.]'],
      },
      {
        heading: 'Jakie dane przetwarzamy',
        paragraphs: [
          'Adres e-mail, opcjonalne imię oraz odpowiedzi z formularza wstępnego (cel, horyzont, przedziały kwot, podejście do ryzyka). Odpowiedzi dotyczące sytuacji finansowej zbieramy w przedziałach, a nie jako dokładne kwoty.',
          'Zapisujemy też datę, w której przy zakładaniu konta złożyłeś(-aś) obowiązkowe oświadczenia (ukończone 18 lat, akceptacja Regulaminu, świadomość, że to narzędzie do nauki, a nie doradztwo), oraz informację o dobrowolnej zgodzie na e-maile.',
          'Nigdy nie prosimy o numer PESEL, datę urodzenia, numer karty ani rachunku bankowego, hasła do kont maklerskich ani dokładne zarobki.',
        ],
      },
      {
        heading: 'Cele i podstawy',
        paragraphs: [
          'Prowadzenie konta i działanie narzędzia — wykonanie umowy (art. 6 ust. 1 lit. b RODO). Wiadomości o nowościach — wyłącznie za Twoją zgodą (art. 6 ust. 1 lit. a RODO), którą możesz wycofać w każdej chwili. Przechowywanie daty złożenia oświadczeń — nasz uzasadniony interes polegający na możliwości wykazania, że zostały złożone (art. 6 ust. 1 lit. f RODO).',
        ],
      },
      {
        heading: 'Osoby poniżej 18 lat',
        paragraphs: [
          'Horyzont jest przeznaczony dla osób pełnoletnich. Nie zbieramy świadomie danych osób poniżej 18 lat; przy zakładaniu konta pytamy o oświadczenie o ukończeniu 18 lat, a nie o datę urodzenia. Jeśli dowiemy się, że konto założyła osoba niepełnoletnia, usuniemy je wraz z danymi.',
        ],
      },
      {
        heading: 'Twoje prawa',
        paragraphs: [
          'Masz prawo wglądu w dane, ich sprostowania, usunięcia, przenoszenia i sprzeciwu wobec przetwarzania, a także prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych. Z tych praw skorzystasz, pisząc do administratora (dane kontaktowe powyżej). [Samodzielne pobieranie i usuwanie danych w ustawieniach konta — funkcja do dodania w kolejnej wersji aplikacji.]',
        ],
      },
      {
        heading: 'Okres przechowywania',
        paragraphs: ['[Okres przechowywania danych i polityka usuwania nieaktywnych kont — do uzupełnienia.]'],
      },
    ],
  },
  cookies: {
    title: 'Polityka cookies',
    lead: 'Z jakich plików cookies i pamięci przeglądarki korzysta serwis.',
    draft: true,
    sections: [
      {
        heading: 'Niezbędne',
        paragraphs: [
          'Plik sesyjny, który utrzymuje zalogowanie, oraz tymczasowa pamięć przeglądarki z Twoimi odpowiedziami (szkic formularza i wyniki bieżącej sesji). Bez nich serwis nie działa, więc nie wymagają zgody.',
        ],
      },
      {
        heading: 'Statystyczne',
        paragraphs: [
          'Pliki pomagające zrozumieć, które ekrany sprawiają kłopot. Włączamy je wyłącznie za Twoją zgodą. W wersji demonstracyjnej serwis w ogóle ich nie używa.',
        ],
      },
    ],
  },
  model: {
    title: 'Jak działa model',
    lead: 'Skąd się biorą profil, propozycje portfeli i ocena ryzyka — bez tajemnic.',
    sections: [
      {
        heading: 'Profil inwestora',
        paragraphs: [
          'Z odpowiedzi w formularzu liczymy trzy wyniki od 1 do 5: zdolność do poniesienia straty (poduszka finansowa, stabilność dochodu, raty), tolerancję ryzyka (akceptowany spadek, reakcja na spadki, wybory A/B) i horyzont. Profil to najniższy z nich — gdy odpowiedzi się rozchodzą, wybieramy ostrożniejszy wynik. Możesz go zmienić o jeden poziom w obie strony.',
        ],
      },
      {
        heading: 'Propozycje portfeli',
        paragraphs: [
          'Dla każdego profilu przygotowujemy trzy portfele (Stabilność, Równowaga, Wzrost), które mieszczą się w jego granicach: wahania, największy spadek w kryzysach, udział akcji i udział jednej pozycji. Żaden nie jest „najlepszy” — różnią się ilością wahań po drodze.',
        ],
      },
      {
        heading: 'Prognoza wyników',
        paragraphs: [
          'Wynik portfela po kilku latach szacujemy na podstawie oczekiwanych zwrotów, wahań i wzajemnych powiązań instrumentów. Pokazujemy zakres (8 z 10 scenariuszy) i wynik typowy, a nie jedną liczbę, bo przyszłość jest niepewna.',
        ],
      },
      {
        heading: 'Ocena ryzyka',
        paragraphs: [
          'Poziom ryzyka na skali 1–7 wynika z typowych rocznych wahań portfela. Szansę na stratę większą niż 10% w ciągu roku szacuje model; podnosi ją w okresach podwyższonej zmienności rynku. Pod oceną zawsze widać, na czym model się opiera i czego nie wie.',
        ],
      },
      {
        heading: 'Ograniczenia',
        paragraphs: [
          'Model nie przewiduje przyszłości, nie uwzględnia podatków ani kosztów transakcji, a rzadkie zdarzenia mogą być groźniejsze niż w historii. W wersji demonstracyjnej wszystkie liczby są przykładowe, a ocenę liczy prosty model statystyczny zamiast wytrenowanego modelu uczenia maszynowego.',
        ],
      },
    ],
  },
  zrodla: {
    title: 'Źródła danych',
    lead: 'Skąd pochodzą liczby na wykresach.',
    sections: [
      {
        heading: 'Notowania i dane o spółkach',
        paragraphs: ['Publiczne interfejsy danych giełdowych: Alpha Vantage oraz Financial Modeling Prep.'],
      },
      {
        heading: 'Kursy walut',
        paragraphs: ['Narodowy Bank Polski (tabele kursów średnich).'],
      },
      {
        heading: 'Dane makroekonomiczne',
        paragraphs: [
          'FRED® (Federal Reserve Bank of St. Louis): stopy procentowe, inflacja i wskaźnik zmienności VIX. This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.',
        ],
      },
      {
        heading: 'Wersja demonstracyjna',
        paragraphs: [
          'W wersji demonstracyjnej wszystkie liczby są przykładowe i nie pochodzą z żadnego z powyższych źródeł. Przy każdym wykresie widać datę, z której pochodzą dane.',
        ],
      },
    ],
  },
};

export function InfoPage() {
  const { slug } = useParams();
  const doc = slug ? DOCS[slug] : undefined;
  usePageTitle(doc?.title ?? 'Nie znaleziono strony');

  return (
    <AppShell>
      <main className="page page--narrow">
        {doc ? (
          <>
            <PageHead title={doc.title} lead={doc.lead} back={{ to: '/', label: 'Wróć na stronę główną' }} />
            {doc.draft ? <Notice tone="warn">{DRAFT_WARNING}</Notice> : null}
            <article className="prose">
              {doc.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </section>
              ))}
            </article>
          </>
        ) : (
          <>
            <PageHead title="Nie ma takiej strony" back={{ to: '/', label: 'Wróć na stronę główną' }} />
            <p>
              Sprawdź adres albo wróć na <Link to="/">stronę główną</Link>.
            </p>
          </>
        )}
      </main>
    </AppShell>
  );
}

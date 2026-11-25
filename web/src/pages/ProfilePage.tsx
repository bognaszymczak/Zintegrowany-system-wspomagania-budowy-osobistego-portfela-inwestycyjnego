import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { PageHead } from '@/components/ui/PageHead';
import { Pill } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { usePageTitle } from '@/components/usePageTitle';
import { PROFILES, pct, profileByLevel } from '@/domain/profiles';
import { lowestScoreNote, manualChangeNote, profileSummary, scoreCards } from '@/features/profile/explain';
import { saveDraft } from '@/features/onboarding/draft';
import { useSession, type LevelShift } from '@/session/SessionProvider';

const FIT_OPTIONS: { shift: LevelShift; label: string }[] = [
  { shift: -1, label: 'Ostrożniej' },
  { shift: 0, label: 'Tak jest dobrze' },
  { shift: 1, label: 'Odważniej' },
];

/** Ekran 3: wynik formularza — profil inwestora, jego granice ryzyka i wyjaśnienie, skąd się wziął. */
export function ProfilePage() {
  usePageTitle('Twój profil');
  const session = useSession();
  const navigate = useNavigate();
  const { profile, request, level, riskProfile, levelShift, answers } = session;
  if (!profile || !request || !level || !riskProfile) return null; // pilnuje tego RequireProfile

  const formProfile = profileByLevel(profile.level);
  const cards = scoreCards(request, profile.scores, profile.behaviorCapApplied);

  // „Zmień odpowiedzi”: odtwarzamy zapisane odpowiedzi jako szkic, żeby formularz otworzył się wypełniony.
  const editAnswers = () => {
    if (answers) saveDraft({ values: answers, step: 1, maxStep: 5 });
    navigate('/formularz');
  };

  const limits = [
    {
      title: 'Wahania w typowym roku',
      value: `do ok. ±${pct(riskProfile.volatility)}`,
      text: 'Tyle może zmieniać się wartość portfela w zwykłym roku.',
    },
    {
      title: 'Największy spadek od szczytu',
      value: `do ${pct(riskProfile.maxDrawdown)}`,
      text: 'Sprawdzamy to na kryzysach z 2008, 2020 i 2022 roku.',
    },
    {
      title: 'Udział akcji',
      value: `do ${pct(riskProfile.maxEquity)}`,
      text: 'Reszta to obligacje, złoto i gotówka.',
    },
    {
      title: 'Jeden instrument',
      value: `do ${pct(riskProfile.maxPosition)}`,
      text: 'Żadna pojedyncza pozycja nie przekroczy tego udziału.',
    },
  ];

  return (
    <AppShell stage={1}>
      <main className="page">
        <PageHead
          eyebrow="Wynik formularza · Twój profil"
          title={riskProfile.name}
          badge={<Pill tone="teal">{level} z 5</Pill>}
        />

        <Sheet>
          <ol className="pscale" aria-label="Skala profili od najostrożniejszego do najodważniejszego">
            {PROFILES.map((p) => (
              <li key={p.level} data-on={p.level <= level ? 'true' : 'false'} aria-current={p.level === level ? 'true' : undefined}>
                <span className="pscale__bar" aria-hidden="true" />
                <span className="pscale__label">{p.name}</span>
              </li>
            ))}
          </ol>

          <p className="profile__summary">{profileSummary(request, riskProfile.rangeWord)}</p>

          <fieldset className="fit">
            <legend>Czy to brzmi jak Ty?</legend>
            <div className="segmented">
              {FIT_OPTIONS.map((option) => {
                const target = profile.level + option.shift;
                const unavailable = option.shift !== 0 && (target < 1 || target > 5);
                return (
                  <label key={option.shift} className="segmented__item" data-disabled={unavailable ? 'true' : undefined}>
                    <input
                      type="radio"
                      name="fit"
                      checked={levelShift === option.shift}
                      disabled={unavailable}
                      onChange={() => session.setLevelShift(option.shift)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
            {levelShift !== 0 ? (
              <p className="fit__note" role="status">
                {manualChangeNote(formProfile.name, profile.level)}
              </p>
            ) : null}
          </fieldset>
        </Sheet>

        <Sheet
          title="Granice, w których zmieszczą się propozycje"
          sub="Portfele z kolejnego kroku nie przekroczą żadnej z nich."
        >
          <ul className="limit-grid">
            {limits.map((item) => (
              <li key={item.title} className="limit-card">
                <h3>{item.title}</h3>
                <p className="limit-card__value">{item.value}</p>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </Sheet>

        <Sheet title="Skąd wziął się ten wynik">
          <ul className="score-grid">
            {cards.map((card) => (
              <li key={card.key} className="score-card">
                <div className="score-card__top">
                  <h3>{card.title}</h3>
                  <span className="score-card__n">
                    {card.score} <small>z 5</small>
                  </span>
                </div>
                <p>{card.text}</p>
              </li>
            ))}
          </ul>
          <p className="profile__why">{lowestScoreNote(profile.scores, profile.level, profile.goalCapApplied)}</p>
        </Sheet>

        <div className="actions">
          <div className="actions__side">
            <button type="button" className="btn btn--secondary" onClick={editAnswers}>
              <Icon name="arrowLeft" size={18} />
              Zmień odpowiedzi
            </button>
            <p>Profil możesz zmienić w każdej chwili, wracając do formularza.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/portfele')}>
            Pokaż trzy propozycje portfeli
            <Icon name="arrowRight" size={20} strokeWidth={2.2} />
          </button>
        </div>
      </main>
    </AppShell>
  );
}

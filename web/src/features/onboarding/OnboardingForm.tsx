/**
 * Kreator formularza wstępnego (5 kroków) — najważniejszy ekran aplikacji.
 *
 * Jak to działa:
 *  1. react-hook-form trzyma wszystkie odpowiedzi; walidację robi schemat Zod (schema.ts).
 *  2. „Dalej” sprawdza TYLKO pola bieżącego kroku (trigger). Dopiero ostatni krok sprawdza całość.
 *  3. Odpowiedzi zapisują się same w localStorage (draft.ts) — można zamknąć kartę i wrócić.
 *  4. Po ostatnim kroku odpowiedzi zamieniamy na kontrakt API (request.ts), wysyłamy hookiem
 *     useSubmitProfile i zapisujemy wynik w sesji (SessionProvider). Potem idziemy do /profil.
 *
 * GDZIE PODŁĄCZYĆ PRAWDZIWY BACKEND: nigdzie tutaj. Ten plik woła useSubmitProfile(),
 * a ten hook woła src/api/endpoints.ts → POST /api/profile. Zmieniasz tylko VITE_USE_MOCKS.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { FormProvider, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { USE_MOCKS, humanizeError } from '@/api/client';
import { useSubmitProfile } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { useSession } from '@/session/SessionProvider';
import { notesForStep } from './consistency';
import { clearDraft, loadDraft, useDraftAutosave, type SaveStatus } from './draft';
import { toProfileRequest } from './request';
import { DEMO_VALUES, EMPTY_VALUES, formSchema, type FormValues } from './schema';
import { STEPS, STEP_COUNT, firstStepWithError, stepDef, type StepNumber } from './steps';
import { StepGoal } from './steps/StepGoal';
import { StepKnowledge } from './steps/StepKnowledge';
import { StepPreferences } from './steps/StepPreferences';
import { StepRisk } from './steps/StepRisk';
import { StepSituation } from './steps/StepSituation';

interface WizardStart {
  values: Partial<FormValues>;
  step: StepNumber;
  maxStep: StepNumber;
}

/** Przyciski „przykładowe odpowiedzi” pokazujemy tylko w trybie demo/developerskim. */
const SHOW_DEMO_TOOLS = import.meta.env.DEV || USE_MOCKS;

export function OnboardingForm() {
  const session = useSession();
  // Zmiana `key` montuje kreator od zera — najprostszy, niezawodny sposób na „wyczyść/uzupełnij”.
  const [instance, setInstance] = useState<{ key: number; start: WizardStart }>(() => ({
    key: 0,
    start: initialStart(session.answers),
  }));

  const restart = (start: WizardStart) => setInstance((prev) => ({ key: prev.key + 1, start }));

  return <Wizard key={instance.key} start={instance.start} onRestart={restart} />;
}

/** Skąd startujemy: z odpowiedzi w sesji (powrót z profilu), z szkicu albo od zera. */
function initialStart(answers: FormValues | null): WizardStart {
  if (answers) return { values: answers, step: 1, maxStep: STEP_COUNT as StepNumber };
  const draft = loadDraft();
  if (draft) return { values: draft.values, step: draft.step, maxStep: draft.maxStep };
  return { values: {}, step: 1, maxStep: 1 };
}

function Wizard({ start, onRestart }: { start: WizardStart; onRestart: (s: WizardStart) => void }) {
  const navigate = useNavigate();
  const session = useSession();
  const submit = useSubmitProfile();

  const methods = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...EMPTY_VALUES, ...start.values },
    // Walidujemy na żądanie: przy „Dalej” (trigger) i przy wysłaniu. Nie walidujemy przy opuszczeniu
    // pola, bo znikający komunikat przesuwa układ w trakcie kliknięcia i "gubi" kolejny klik.
    // Poprawianie błędów obsługują pola (patrz ChoiceGroup, TargetAmountField).
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const {
    control,
    trigger,
    handleSubmit,
    formState: { errors },
  } = methods;

  const [step, setStep] = useState<StepNumber>(start.step);
  const [maxStep, setMaxStep] = useState<StepNumber>(start.maxStep);
  const [triedNext, setTriedNext] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const values = useWatch({ control }) as Partial<FormValues>;
  const saveStatus = useDraftAutosave(values, step, maxStep, !done);
  const notes = useMemo(() => notesForStep(values, step), [values, step]);

  // Na telefonie lewy panel jest poziomym paskiem — przewijamy go tak, by bieżący krok był widoczny.
  const railRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = railRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !current) return;
    const shift = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollLeft += shift - (list.clientWidth - current.offsetWidth) / 2;
  }, [step]);

  // Po zmianie kroku przenosimy fokus na nagłówek — czytnik ekranu ogłasza nowy krok.
  // Porównujemy z poprzednim krokiem (a nie z flagą „pierwszy raz”), bo w trybie dev React uruchamia efekty
  // dwa razy przy starcie — przy samym wejściu na formularz fokus ma zostać tam, gdzie był.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const announcedStep = useRef(step);
  useEffect(() => {
    if (announcedStep.current === step) return;
    announcedStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  const def = stepDef(step);
  const isLast = step === STEP_COUNT;
  const stepHasErrors = def.fields.some((field) => Boolean(errors[field]));

  const goTo = (n: StepNumber) => {
    if (n > maxStep) return; // nie przeskakujemy do kroków, do których jeszcze nie doszliśmy
    setTriedNext(false);
    setStep(n);
  };

  const next = async () => {
    const ok = await trigger([...def.fields], { shouldFocus: true });
    if (!ok) {
      setTriedNext(true);
      return;
    }
    const target = Math.min(STEP_COUNT, step + 1) as StepNumber;
    setMaxStep((m) => Math.max(m, target) as StepNumber);
    setTriedNext(false);
    setStep(target);
  };

  const back = () => goTo(Math.max(1, step - 1) as StepNumber);

  const onValid = async (data: FormValues) => {
    setSubmitError(null);
    try {
      const request = toProfileRequest(data);
      const profile = await submit.mutateAsync(request);
      setDone(true); // wyłącza autozapis, żeby nie odtworzył szkicu
      clearDraft();
      session.saveOnboarding({ answers: data, request, profile });
      navigate('/profil');
    } catch (error) {
      setSubmitError(humanizeError(error));
    }
  };

  const onInvalid = (errors: FieldErrors<FormValues>) => {
    const target = firstStepWithError(errors as Record<string, unknown>);
    if (target) {
      setMaxStep((m) => Math.max(m, target) as StepNumber);
      setStep(target);
      setTriedNext(true);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLast) void handleSubmit(onValid, onInvalid)(event);
    else void next(); // Enter w polu tekstowym ma działać jak „Dalej”
  };

  const fillDemo = () => onRestart({ values: DEMO_VALUES, step: 1, maxStep: STEP_COUNT as StepNumber });
  const clearAll = () => {
    clearDraft();
    onRestart({ values: {}, step: 1, maxStep: 1 });
  };

  return (
    <div className="wizard">
      <aside className="wizard__rail" aria-label="Postęp formularza">
        <div className="wizard__rail-head">
          <h2>Pytania wstępne</h2>
          <p>Około 3 minut. Możesz wracać i zmieniać odpowiedzi.</p>
        </div>

        <nav aria-label="Kroki formularza">
          <ol className="rail" ref={railRef}>
            {STEPS.map((s) => {
              const state = s.n < step ? 'done' : s.n === step ? 'now' : 'todo';
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    className={`rail__item rail__item--${state}`}
                    aria-current={s.n === step ? 'step' : undefined}
                    disabled={s.n > maxStep}
                    onClick={() => goTo(s.n)}
                  >
                    <span className="rail__dot">
                      {state === 'done' ? <Icon name="check" size={16} strokeWidth={3} /> : s.n}
                    </span>
                    <span className="rail__text">
                      <span className="rail__title">{s.title}</span>
                      <span className="rail__sub">{s.sub}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="why-box">
          <div className="why-box__title">
            <Icon name="info" size={18} />
            <span>Po co pytamy?</span>
          </div>
          <p>
            Odpowiedzi służą tylko do ustawienia granic ryzyka w propozycjach. Nie pytamy o PESEL ani
            o dokładne kwoty.
          </p>
        </div>

        <div className="rail-tools">
          {SHOW_DEMO_TOOLS ? (
            <button type="button" className="link-button" onClick={fillDemo}>
              Uzupełnij przykładowe odpowiedzi (demo)
            </button>
          ) : null}
          <button type="button" className="link-button" onClick={clearAll}>
            Wyczyść odpowiedzi i zacznij od nowa
          </button>
        </div>
      </aside>

      <section className="card wizard__card">
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} noValidate aria-labelledby="wizard-heading">
            <div className="wizard__top">
              <div className="wizard__top-row">
                <span className="eyebrow">
                  Krok {step} z {STEP_COUNT}
                </span>
                <SaveBadge status={saveStatus} />
              </div>
              <div
                className="progress"
                role="progressbar"
                aria-label="Postęp formularza"
                aria-valuemin={0}
                aria-valuemax={STEP_COUNT}
                aria-valuenow={step}
                aria-valuetext={`Krok ${step} z ${STEP_COUNT}`}
              >
                <div className="progress__bar" style={{ width: `${(step / STEP_COUNT) * 100}%` }} />
              </div>
            </div>

            <div className="wizard__body">
              <header className="wizard__intro">
                <h1 id="wizard-heading" ref={headingRef} tabIndex={-1}>
                  {def.heading}
                </h1>
                <p>{def.intro}</p>
              </header>

              {step === 1 && <StepGoal notes={notes} />}
              {step === 2 && <StepSituation notes={notes} />}
              {step === 3 && <StepRisk notes={notes} />}
              {step === 4 && <StepKnowledge />}
              {step === 5 && <StepPreferences />}

              {triedNext && stepHasErrors ? (
                <Notice tone="error">
                  Uzupełnij zaznaczone odpowiedzi, aby przejść dalej. Pola z błędami są oznaczone na
                  czerwono.
                </Notice>
              ) : null}
              {submitError ? (
                <Notice tone="error">
                  {submitError} Twoje odpowiedzi są zapisane — możesz spróbować jeszcze raz.
                </Notice>
              ) : null}
            </div>

            <div className="wizard__footer">
              <button type="button" className="btn btn--secondary" onClick={back} disabled={step === 1}>
                <Icon name="arrowLeft" size={18} strokeWidth={2.2} />
                <span>Wstecz</span>
              </button>
              <button type="submit" className="btn btn--primary" disabled={submit.isPending}>
                <span>{isLast ? (submit.isPending ? 'Liczymy Twój profil…' : 'Zobacz mój profil') : 'Dalej'}</span>
                {submit.isPending ? null : <Icon name="arrowRight" size={20} strokeWidth={2.2} />}
              </button>
            </div>
          </form>
        </FormProvider>
      </section>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  const text =
    status === 'saving'
      ? 'Zapisywanie…'
      : status === 'unavailable'
        ? 'Zapis roboczy niedostępny w tej przeglądarce'
        : 'Zapisano automatycznie';
  return (
    <span className={`save-badge save-badge--${status}`} role="status" aria-live="polite">
      {status === 'saving' || status === 'unavailable' ? null : <Icon name="check" size={16} />}
      <span>{text}</span>
    </span>
  );
}

import { useState, type KeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { USE_MOCKS, humanizeError } from '@/api/client';
import { useLogin, useMe, useRegister } from '@/api/hooks';
import { Icon } from '@/components/Icon';
import { Logo } from '@/components/Logo';
import { Notice } from '@/components/Notice';
import { usePageTitle } from '@/components/usePageTitle';
import { DEMO_ACCOUNT } from '@/features/auth/demo';
import { CheckField, PasswordField, TextField } from '@/features/auth/fields';
import {
  LOGIN_DEFAULTS,
  MIN_AGE,
  REGISTER_DEFAULTS,
  loginSchema,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from '@/features/auth/schema';
import { PASSWORD_TIP } from '@/features/auth/password';
import { useSession } from '@/session/SessionProvider';

type Mode = 'register' | 'login';

const NEVER_COLLECTED = [
  'Numeru PESEL ani daty urodzenia',
  'Numeru karty ani rachunku bankowego',
  'Haseł do konta maklerskiego',
  'Dokładnych zarobków i sald na kontach',
];

const YOU_GET = [
  'Profil w 3 minuty — krótki formularz z możliwością cofania i autozapisem',
  'Trzy propozycje portfeli ułożone od najmniejszego do największego ryzyka',
  'Suwaki z podglądem na żywo — ryzyko i wynik w złotówkach zmieniają się od razu',
  'Ocenę ryzyka Twojego wyboru przez model uczenia maszynowego, z wyjaśnieniem',
];

/** Ekran 2: założenie konta albo logowanie. */
export function AuthPage() {
  usePageTitle('Konto');
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('tryb') === 'logowanie' ? 'login' : 'register');
  const me = useMe();
  const session = useSession();
  const navigate = useNavigate();

  // Zalogowany użytkownik nie potrzebuje tego ekranu.
  if (me.data) return <Navigate to={session.profile ? '/profil' : '/formularz'} replace />;

  const goOn = () => navigate(session.profile ? '/profil' : '/formularz');

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setMode((m) => (m === 'register' ? 'login' : 'register'));
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-top">
        <Link to="/" className="brand">
          <Logo />
          <span>Horyzont</span>
        </Link>
        <Link to="/" className="backlink">
          <Icon name="arrowLeft" size={18} />
          Wróć na stronę główną
        </Link>
      </header>

      <main className="auth">
        <section className="auth__card card">
          <div role="tablist" aria-label="Konto" className="tabs" onKeyDown={onTabKey}>
            {(
              [
                ['register', 'Załóż konto'],
                ['login', 'Zaloguj się'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`tab-${value}`}
                aria-selected={mode === value}
                aria-controls={`panel-${value}`}
                tabIndex={mode === value ? 0 : -1}
                className="tabs__tab"
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'register' ? (
            <div role="tabpanel" id="panel-register" aria-labelledby="tab-register" className="auth__panel">
              <RegisterForm onDone={goOn} />
            </div>
          ) : (
            <div role="tabpanel" id="panel-login" aria-labelledby="tab-login" className="auth__panel">
              <LoginForm onDone={goOn} />
            </div>
          )}
        </section>

        <aside className="auth__aside" aria-label="Informacje o koncie">
          <div className="auth__box">
            <h2>Co dostaniesz</h2>
            <ul className="ticks">
              {YOU_GET.map((text) => (
                <li key={text}>
                  <Icon name="check" size={20} strokeWidth={2.4} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="auth__box auth__box--soft">
            <h2>Czego nigdy nie zbieramy</h2>
            <ul className="ticks ticks--no">
              {NEVER_COLLECTED.map((text) => (
                <li key={text}>
                  <Icon name="x" size={20} strokeWidth={2.4} />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="auth__small">
              Masz prawo wglądu w swoje dane i ich usunięcia — szczegóły w{' '}
              <Link to="/info/prywatnosc" target="_blank" rel="noopener">
                polityce prywatności
              </Link>
              .
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const signUp = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: REGISTER_DEFAULTS,
    // Walidacja przy wysłaniu; po pierwszym błędzie pola poprawiają się na bieżąco (jak w formularzu wstępnym).
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onValid = async (values: RegisterValues) => {
    setServerError(null);
    try {
      await signUp.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
        adultConfirmed: true,
        acceptTerms: true,
        acceptSimulation: true,
        marketingOptIn: values.marketingOptIn,
      });
      onDone();
    } catch (error) {
      setServerError(humanizeError(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="auth__form">
      <div className="auth__intro">
        <h1>Załóż konto</h1>
        <p>Zajmie to minutę. Potem krótki formularz o Twoich celach.</p>
      </div>

      {serverError ? <Notice tone="error">{serverError}</Notice> : null}

      <TextField
        id="reg-name"
        label="Jak mamy się do Ciebie zwracać?"
        note="opcjonalnie"
        placeholder="np. Anna"
        autoComplete="given-name"
        registration={register('name')}
        error={errors.name?.message}
      />
      <TextField
        id="reg-email"
        label="Adres e-mail"
        type="email"
        placeholder="imie@przyklad.pl"
        autoComplete="email"
        registration={register('email')}
        error={errors.email?.message}
      />
      <div className="field-group">
        <PasswordField
          id="reg-password"
          placeholder="Co najmniej 10 znaków"
          autoComplete="new-password"
          registration={register('password')}
          error={errors.password?.message}
          strengthOf={watch('password')}
        />
        <p className="field__hint">{PASSWORD_TIP}</p>
      </div>

      <div className="consents">
        <CheckField id="reg-adult" registration={register('adultConfirmed')} error={errors.adultConfirmed?.message}>
          Mam ukończone {MIN_AGE} lat <span className="consents__req">(wymagane)</span>
        </CheckField>
        <CheckField id="reg-terms" registration={register('acceptTerms')} error={errors.acceptTerms?.message}>
          Akceptuję{' '}
          <Link to="/info/regulamin" target="_blank" rel="noopener">
            Regulamin<span className="visually-hidden"> (otwiera się w nowej karcie)</span>
          </Link>{' '}
          i{' '}
          <Link to="/info/prywatnosc" target="_blank" rel="noopener">
            Politykę prywatności<span className="visually-hidden"> (otwiera się w nowej karcie)</span>
          </Link>{' '}
          <span className="consents__req">(wymagane)</span>
        </CheckField>
        <CheckField id="reg-sim" registration={register('acceptSimulation')} error={errors.acceptSimulation?.message}>
          Rozumiem, że Horyzont to narzędzie do nauki i symulacji, a nie doradztwo inwestycyjne{' '}
          <span className="consents__req">(wymagane)</span>
        </CheckField>
        <CheckField id="reg-marketing" registration={register('marketingOptIn')}>
          Chcę dostawać e-maile o nowościach{' '}
          <span className="consents__opt">(opcjonalnie, możesz zrezygnować w każdej chwili)</span>
        </CheckField>
      </div>

      <button type="submit" className="btn btn--primary btn--block" disabled={signUp.isPending}>
        {signUp.isPending ? <span className="spinner spinner--light" aria-hidden="true" /> : null}
        {signUp.isPending ? 'Zakładamy konto…' : 'Załóż konto i przejdź do pytań'}
      </button>

      <p className="auth__small">
        {USE_MOCKS ? null : 'Wyślemy e-mail z potwierdzeniem adresu. '}
        Pliki cookies: niezbędne zawsze, statystyczne tylko za Twoją zgodą (
        <Link to="/info/cookies">ustawienia cookies</Link>).
      </p>

      {USE_MOCKS ? (
        <p className="auth__demo">
          Tryb pokazowy: możesz też{' '}
          <Link to="/formularz">przejść do formularza bez zakładania konta</Link>.
        </p>
      ) : null}
    </form>
  );
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const signIn = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: LOGIN_DEFAULTS,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onValid = async (values: LoginValues) => {
    setServerError(null);
    try {
      await signIn.mutateAsync(values);
      onDone();
    } catch (error) {
      setServerError(humanizeError(error));
    }
  };

  const fillDemo = () => {
    setValue('email', DEMO_ACCOUNT.email);
    setValue('password', DEMO_ACCOUNT.password);
  };

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="auth__form">
      <div className="auth__intro">
        <h1>Zaloguj się</h1>
        <p>Wróć do swoich symulacji i portfeli.</p>
      </div>

      {serverError ? <Notice tone="error">{serverError}</Notice> : null}

      {USE_MOCKS ? (
        <Notice tone="info">
          <p>
            Tryb pokazowy — konto demonstracyjne: <b>{DEMO_ACCOUNT.email}</b>, hasło <b>{DEMO_ACCOUNT.password}</b>.
          </p>
          <button type="button" className="link-button" onClick={fillDemo}>
            Wpisz dane konta demonstracyjnego
          </button>
        </Notice>
      ) : null}

      <TextField
        id="login-email"
        label="Adres e-mail"
        type="email"
        placeholder="imie@przyklad.pl"
        autoComplete="email"
        registration={register('email')}
        error={errors.email?.message}
      />
      <PasswordField
        id="login-password"
        placeholder="Twoje hasło"
        autoComplete="current-password"
        registration={register('password')}
        error={errors.password?.message}
        aside={
          <button type="button" className="link-button" aria-expanded={forgot} onClick={() => setForgot((v) => !v)}>
            Nie pamiętasz hasła?
          </button>
        }
      />
      {forgot ? (
        <Notice tone="info">
          Odzyskiwanie hasła wymaga wysyłki e-maili, którą włączy backend (endpoint <code>/auth/forgot-password</code>).
          W wersji pokazowej użyj konta demonstracyjnego albo załóż nowe.
        </Notice>
      ) : null}

      <button type="submit" className="btn btn--primary btn--block" disabled={signIn.isPending}>
        {signIn.isPending ? <span className="spinner spinner--light" aria-hidden="true" /> : null}
        {signIn.isPending ? 'Logujemy…' : 'Zaloguj się'}
      </button>

      <p className="auth__small">
        {USE_MOCKS
          ? 'Wersja pokazowa: odpowiedzi i wybory zapamiętuje tylko ta przeglądarka, a po zamknięciu karty znikają.'
          : 'Wracasz po przerwie? Odpowiedzi z formularza i Twoje portfele czekają tak, jak je zostawiłeś lub zostawiłaś.'}
      </p>
    </form>
  );
}

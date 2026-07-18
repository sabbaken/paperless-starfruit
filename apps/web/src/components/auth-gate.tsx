import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import {
  loginInputSchema,
  registerInputSchema,
  type LoginInput,
  type RegisterInput,
  type TFunction,
} from '@paperless-starfruit/shared';
import { useAuthStatus, useLogin, useRegister } from '@/api/auth';
import { useTranslation } from '@/i18n/I18nProvider';
import { getToken, subscribeToken } from '@/lib/auth-token';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AuthStatusQuery = ReturnType<typeof useAuthStatus>;

/**
 * Auth layout route. Wraps the whole app so nothing, including the paperless
 * connection check, is reachable unauthenticated. It redirects to the right
 * auth route rather than rendering forms inline:
 *   - no admin yet  → /register (first-run setup)
 *   - no/expired token → /login
 *   - authenticated → the child route (the app chrome, or the bare onboarding flow)
 * Reacts instantly to a 401 clearing the token mid-session.
 */
export function ProtectedLayout() {
  const { t } = useTranslation();
  const token = useSyncExternalStore(subscribeToken, getToken);
  const status = useAuthStatus();

  const fallback = bootstrapFallback(status, t);
  if (fallback) return fallback;

  const { initialized, authenticated } = status.data!;
  if (!initialized) return <Navigate to="/register" replace />;
  if (!token || !authenticated) return <Navigate to="/login" replace />;

  return <Outlet />;
}

type Mode = 'setup' | 'login';

/** The /login and /register pages: render the card, or redirect if the route
 *  doesn't apply (already authenticated, signup closed, or setup not done). */
export function AuthRoute({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const token = useSyncExternalStore(subscribeToken, getToken);
  const status = useAuthStatus();

  const fallback = bootstrapFallback(status, t);
  if (fallback) return fallback;

  const { initialized, authenticated } = status.data!;
  // A fresh registration lands in the guided setup; a returning login goes
  // straight to the app.
  if (token && authenticated) {
    return <Navigate to={mode === 'setup' ? '/onboarding' : '/dashboard'} replace />;
  }
  // Instance not claimed yet → setup is the only valid route.
  if (!initialized && mode === 'login') return <Navigate to="/register" replace />;
  // Already claimed → registration is closed.
  if (initialized && mode === 'setup') return <Navigate to="/login" replace />;

  return (
    <Shell>
      <AuthCard mode={mode} />
    </Shell>
  );
}

/** Spinner while status loads, or a retry on backend error; null once ready. */
function bootstrapFallback(status: AuthStatusQuery, t: TFunction): ReactNode | null {
  if (status.isError) {
    return (
      <Shell>
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="font-medium">{t('auth.backendUnreachable')}</p>
          <p className="text-sm text-muted-foreground">
            {status.error instanceof Error ? status.error.message : t('auth.unknownError')}
          </p>
          <Button
            variant="outline"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
          >
            {status.isFetching && <Loader2 className="animate-spin" />}
            {t('common.retry')}
          </Button>
        </div>
      </Shell>
    );
  }
  if (status.isLoading || !status.data) {
    return (
      <Shell>
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-label={t('auth.loading')}
        />
      </Shell>
    );
  }
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-2 px-6 py-4">
        <img src="/paperless-starfruit.png" alt="" className="size-5 shrink-0" />
        <span className="text-sm font-semibold tracking-tight">Paperless Starfruit</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">{children}</main>
    </div>
  );
}

type Credentials = { username: string; password: string };

const buildCopy = (
  t: TFunction,
): Record<Mode, { title: string; description: string; cta: string }> => ({
  setup: {
    title: t('auth.setup.title'),
    description: t('auth.setup.description'),
    cta: t('auth.setup.cta'),
  },
  login: {
    title: t('auth.login.title'),
    description: t('auth.login.description'),
    cta: t('auth.login.cta'),
  },
});

function AuthCard({ mode }: { mode: Mode }) {
  const { t } = useTranslation();
  const copy = buildCopy(t)[mode];
  const [showPassword, setShowPassword] = useState(false);

  const register = useRegister();
  const login = useLogin();
  const mutation = mode === 'setup' ? register : login;

  const form = useForm<Credentials>({
    resolver: zodResolver(mode === 'setup' ? registerInputSchema : loginInputSchema),
    defaultValues: { username: '', password: '' },
  });
  const { register: field, handleSubmit, formState } = form;

  const onSubmit = handleSubmit((values) =>
    mode === 'setup'
      ? register.mutate(values as RegisterInput)
      : login.mutate(values as LoginInput),
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form id="auth-form" onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="username">{t('auth.username')}</Label>
            <div className="relative">
              <User className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                id="username"
                className="pl-9"
                autoComplete="username"
                autoFocus
                spellCheck={false}
                aria-invalid={!!formState.errors.username}
                {...field('username')}
              />
            </div>
            {formState.errors.username && (
              <p className="text-sm text-destructive">{formState.errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="px-9"
                autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
                aria-invalid={!!formState.errors.password}
                {...field('password')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {formState.errors.password ? (
              <p className="text-sm text-destructive">{formState.errors.password.message}</p>
            ) : (
              mode === 'setup' && (
                <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
              )
            )}
          </div>

          {mutation.error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>
                {mode === 'setup' ? t('auth.createAccountError') : t('auth.signInError')}
              </AlertTitle>
              <AlertDescription>
                {mutation.error instanceof Error ? mutation.error.message : t('auth.genericError')}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>

      <CardFooter>
        <Button type="submit" form="auth-form" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {copy.cta}
        </Button>
      </CardFooter>
    </Card>
  );
}

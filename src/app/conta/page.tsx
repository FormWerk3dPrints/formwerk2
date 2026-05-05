'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type AuthError,
  type OAuthCredential,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';

type ProfileFormState = {
  fullName: string;
  phone: string;
  documentType: 'cpf' | 'cnpj';
  document: string;
  city: string;
  educationInstitution: string;
  birthday: string;
  consentAccepted: boolean;
};

type LoadedProfile = Omit<ProfileFormState, 'consentAccepted'> & {
  email: string;
  updatedAt?: string;
};

const INITIAL_FORM: ProfileFormState = {
  fullName: '',
  phone: '',
  documentType: 'cpf',
  document: '',
  city: '',
  educationInstitution: '',
  birthday: '',
  consentAccepted: false,
};

async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit, user: User) {
  const idToken = await user.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(init.headers ?? {}),
    },
  });
}

async function parseApiJson<T>(response: Response, context: string): Promise<T> {
  const status = response.status;
  const contentType = response.headers.get('content-type') ?? '';
  const rawBody = await response.text();

  try {
    return JSON.parse(rawBody) as T;
  } catch (error) {
    console.error(`[ContaPage] ${context}: resposta nao-JSON da API`, {
      status,
      contentType,
      bodyPreview: rawBody.slice(0, 400),
      parseError: error instanceof Error ? error.message : String(error),
    });

    throw new Error(
      'A API retornou um formato inesperado (nao-JSON). Veja o console para detalhes.'
    );
  }
}

export default function ContaPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [authTab, setAuthTab] = useState<'google' | 'email'>('google');
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [emailForm, setEmailForm] = useState({ email: '', password: '', confirm: '' });
  const [pendingGoogleCred, setPendingGoogleCred] = useState<OAuthCredential | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [emailVerifiedFlag, setEmailVerifiedFlag] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [form, setForm] = useState<ProfileFormState>(INITIAL_FORM);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [phoneDuplicateWarning, setPhoneDuplicateWarning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!authUser) {
        setForm(INITIAL_FORM);
        setLastUpdatedAt(null);
        return;
      }

      setLoadingProfile(true);
      setErrorMessage(null);
      setStatusMessage(null);

      try {
        const response = await fetchWithAuth('/api/user-profile', { method: 'GET' }, authUser);
        const body = await parseApiJson<{ profile?: LoadedProfile | null; error?: string }>(
          response,
          'loadProfile'
        );

        if (!response.ok) {
          throw new Error(body.error || 'Não foi possível carregar o perfil.');
        }

        if (!body.profile) {
          setForm((prev) => ({
            ...prev,
            fullName: authUser.displayName || '',
          }));
          setLastUpdatedAt(null);
          return;
        }

        setForm((prev) => ({
          ...prev,
          fullName: body.profile?.fullName || '',
          phone: body.profile?.phone || '',
          documentType: (body.profile?.documentType as 'cpf' | 'cnpj') || 'cpf',
          document: body.profile?.document || '',
          city: body.profile?.city || '',
          educationInstitution: body.profile?.educationInstitution || '',
          birthday: body.profile?.birthday || '',
        }));
        setLastUpdatedAt(body.profile.updatedAt || null);
      } catch (error) {
        console.error('[ContaPage] Falha ao carregar perfil', error);
        const message = error instanceof Error ? error.message : 'Erro ao carregar perfil.';
        setErrorMessage(message);
      } finally {
        setLoadingProfile(false);
      }
    }

    void loadProfile();
  }, [authUser]);

  const formattedLastUpdate = useMemo(() => {
    if (!lastUpdatedAt) return null;
    const date = new Date(lastUpdatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('pt-BR');
  }, [lastUpdatedAt]);

  async function handleGoogleLogin() {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'auth/account-exists-with-different-credential') {
        const cred = GoogleAuthProvider.credentialFromError(authError);
        const email = authError.customData?.email as string | undefined;
        if (cred && email) {
          setPendingGoogleCred(cred);
          setLinkEmail(email);
          setErrorMessage('Este e-mail já tem conta com e-mail/senha. Digite sua senha para vinculá-la ao Google.');
          return;
        }
      }
      const message = error instanceof Error ? error.message : 'Falha no login com Google.';
      setErrorMessage(message);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const { email, password, confirm } = emailForm;
    if (emailMode === 'register' && password !== confirm) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    try {
      if (emailMode === 'register') {
        const userCred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await sendEmailVerification(userCred.user);
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
    } catch (error) {
      const code = (error as AuthError).code ?? '';
      if (code === 'auth/email-already-in-use') {
        // Email registrado via Google — redireciona para o tab correto
        setAuthTab('google');
        setErrorMessage('Este e-mail já está associado a uma conta Google. Clique em "Entrar com Google" para acessar.');
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setErrorMessage('E-mail ou senha incorretos.');
      } else if (code === 'auth/user-not-found') {
        setErrorMessage('Nenhuma conta encontrada com este e-mail.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('Senha fraca. Use pelo menos 6 caracteres.');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao autenticar.');
      }
    }
  }

  async function handleLinkWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!pendingGoogleCred || !linkEmail) return;

    try {
      const userCred = await signInWithEmailAndPassword(firebaseAuth, linkEmail, linkPassword);
      await linkWithCredential(userCred.user, pendingGoogleCred);
      setPendingGoogleCred(null);
      setLinkEmail('');
      setLinkPassword('');
      setStatusMessage('Conta Google vinculada com sucesso!');
    } catch (error) {
      const code = (error as AuthError).code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setErrorMessage('Senha incorreta.');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao vincular contas.');
      }
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, resetEmail.trim().toLowerCase());
      setResetSent(true);
    } catch (error) {
      const code = (error as AuthError).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        // Não revelamos se o email existe ou não (segurança)
        setResetSent(true);
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao enviar e-mail.');
      }
    }
  }

  async function handleResendVerification() {
    if (!authUser) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await sendEmailVerification(authUser);
      setStatusMessage('E-mail de verificação reenviado. Verifique sua caixa de entrada.');
    } catch (error) {
      const code = (error as AuthError).code ?? '';
      if (code === 'auth/too-many-requests') {
        setErrorMessage('Muitas tentativas. Aguarde alguns minutos antes de reenviar.');
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Erro ao reenviar e-mail.');
      }
    }
  }

  async function handleCheckVerification() {
    if (!authUser) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await authUser.reload();
      const fresh = firebaseAuth.currentUser;
      if (fresh?.emailVerified) {
        setEmailVerifiedFlag(true);
      } else {
        setErrorMessage('E-mail ainda não verificado. Clique no link no e-mail e tente novamente.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao verificar status.');
    }
  }

  async function handleDeleteAccount() {
    if (!authUser) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      const response = await fetchWithAuth('/api/user-profile', { method: 'DELETE' }, authUser);
      const body = await parseApiJson<{ ok?: boolean; error?: string }>(response, 'deleteAccount');
      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Erro ao excluir conta.');
      }
      // Auth user foi deletado no servidor — desloga localmente e redireciona
      await signOut(firebaseAuth);
      router.push('/');
    } catch (error) {
      console.error('[ContaPage] Falha ao excluir conta', error);
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao excluir conta.');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await signOut(firebaseAuth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sair da conta.';
      setErrorMessage(message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser) {
      setErrorMessage('Faça login para salvar seu perfil.');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetchWithAuth(
        '/api/user-profile',
        {
          method: 'POST',
          body: JSON.stringify(form),
        },
        authUser
      );

      const body = await parseApiJson<{ ok?: boolean; error?: string; phoneDuplicate?: boolean }>(
        response,
        'saveProfile'
      );

      if (!response.ok || !body.ok) {
        throw new Error(body.error || 'Erro ao salvar os dados.');
      }

      setPhoneDuplicateWarning(body.phoneDuplicate === true);

      if (!lastUpdatedAt) {
        // Primeiro cadastro — redireciona para a home
        router.push('/');
        return;
      }

      setStatusMessage('Cadastro atualizado com sucesso.');
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      console.error('[ContaPage] Falha ao salvar perfil', error);
      const message = error instanceof Error ? error.message : 'Erro ao salvar dados.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <section className="max-w-2xl mx-auto bg-white border rounded-xl shadow-sm p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Minha Conta</h1>
        <p className="text-sm text-gray-600 mt-2">
          Cadastre-se ou acesse sua conta.
        </p>

        {authLoading ? (
          <div className="mt-6 text-sm text-gray-500">Verificando autenticação...</div>
        ) : !authUser ? (
          <div className="mt-6">
            {/* Tabs de provedor */}
            {!pendingGoogleCred && (
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
                {(['google', 'email'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setAuthTab(tab); setErrorMessage(null); }}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      authTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab === 'google' ? 'Google' : 'E-mail / Senha'}
                  </button>
                ))}
              </div>
            )}

            {/* Google */}
            {authTab === 'google' && !pendingGoogleCred && (
              <>
                <p className="text-sm text-gray-600 mb-4">Entre com sua conta Google para preencher seu cadastro.</p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="rounded-lg bg-black text-white px-4 py-2.5 hover:opacity-90 transition-opacity"
                >
                  Entrar com Google
                </button>
              </>
            )}

            {/* Vincular Google a conta email/senha existente */}
            {pendingGoogleCred && (
              <form onSubmit={handleLinkWithPassword} className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Vincular conta Google</p>
                  <p className="text-sm text-gray-500">Este e-mail já tem conta com e-mail/senha. Digite sua senha para vinculá-la ao Google.</p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                  <input value={linkEmail} disabled className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Senha</label>
                  <input
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                    required
                    autoFocus
                  />
                </div>
                {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-black text-white px-4 py-2.5 text-sm hover:opacity-90 transition-opacity">
                    Vincular e entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPendingGoogleCred(null); setLinkEmail(''); setLinkPassword(''); setErrorMessage(null); }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {/* E-mail / Senha */}
            {authTab === 'email' && !pendingGoogleCred && (
              <div className="space-y-4">
                {!resetMode ? (
                  <>
                    <div className="flex gap-1 bg-gray-50 border rounded-lg p-1">
                      {(['login', 'register'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => { setEmailMode(mode); setErrorMessage(null); }}
                          className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                            emailMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {mode === 'login' ? 'Entrar' : 'Criar conta'}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={handleEmailAuth} className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                        <input
                          type="email"
                          value={emailForm.email}
                          onChange={(e) => setEmailForm((p) => ({ ...p, email: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                          required
                          autoComplete="email"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs text-gray-500">Senha</label>
                          {emailMode === 'login' && (
                            <button
                              type="button"
                              onClick={() => { setResetEmail(emailForm.email); setResetSent(false); setResetMode(true); setErrorMessage(null); }}
                              className="text-xs text-gray-400 hover:text-black underline underline-offset-2 cursor-pointer transition-colors"
                            >
                              Esqueceu a senha?
                            </button>
                          )}
                        </div>
                        <input
                          type="password"
                          value={emailForm.password}
                          onChange={(e) => setEmailForm((p) => ({ ...p, password: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                          required
                          minLength={6}
                          autoComplete={emailMode === 'register' ? 'new-password' : 'current-password'}
                        />
                      </div>
                      {emailMode === 'register' && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Confirmar senha</label>
                          <input
                            type="password"
                            value={emailForm.confirm}
                            onChange={(e) => setEmailForm((p) => ({ ...p, confirm: e.target.value }))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                            required
                            minLength={6}
                            autoComplete="new-password"
                          />
                        </div>
                      )}
                      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-black text-white px-4 py-2.5 text-sm cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-md active:scale-95"
                      >
                        {emailMode === 'login' ? 'Entrar' : 'Criar conta'}
                      </button>
                    </form>
                  </>
                ) : (
                  /* Modo recuperação de senha */
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Recuperar senha</p>
                      <p className="text-xs text-gray-500 mt-0.5">Enviaremos um link para redefinir sua senha.</p>
                    </div>
                    {resetSent ? (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                        Se este e-mail estiver cadastrado, você receberá um link em instantes. Verifique também a caixa de spam.
                      </div>
                    ) : (
                      <form onSubmit={handlePasswordReset} className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                          <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-black/20"
                            required
                            autoComplete="email"
                            autoFocus
                          />
                        </div>
                        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-black text-white px-4 py-2.5 text-sm cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-md active:scale-95"
                        >
                          Enviar link de recuperação
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      onClick={() => { setResetMode(false); setResetSent(false); setErrorMessage(null); }}
                      className="text-xs text-gray-400 hover:text-black underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      ← Voltar ao login
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Erro Google (fora do linking) */}
            {authTab === 'google' && !pendingGoogleCred && errorMessage && (
              <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
            )}
          </div>
        ) : !authUser.emailVerified && !emailVerifiedFlag ? (
          <div className="mt-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-2xl">✉</div>
            <div>
              <p className="font-semibold text-gray-900">Confirme seu e-mail</p>
              <p className="text-sm text-gray-500 mt-1">
                Enviamos um link de confirmação para <span className="font-medium text-gray-800">{authUser.email}</span>.
                Clique no link para ativar sua conta. <span className="font-medium text-gray-800">Cheque sua caixa de spam.</span>.
              </p>
            </div>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                type="button"
                onClick={handleCheckVerification}
                className="rounded-lg bg-black text-white px-4 py-2.5 text-sm cursor-pointer transition-all duration-150 hover:scale-105 hover:shadow-md active:scale-95"
              >
                Já verifiquei
              </button>
              <button
                type="button"
                onClick={handleResendVerification}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 cursor-pointer transition-all duration-150 hover:scale-105 hover:bg-gray-100 hover:shadow-sm active:scale-95"
              >
                Reenviar e-mail
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-500 cursor-pointer transition-all duration-150 hover:scale-105 hover:bg-gray-100 hover:shadow-sm active:scale-95"
              >
                Sair
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-lg border bg-gray-50 p-4 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">Logado como:</span> {authUser.email}
              </p>
              {formattedLastUpdate ? (
                <p className="text-gray-500 mt-1">Última atualização de perfil: {formattedLastUpdate}</p>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-800 mb-1">
                  Nome completo *
                </label>
                <input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-800 mb-1">
                  Telefone *
                </label>
                <input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
                  placeholder="(49) 99999-9999"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-800 mb-1">
                  E-mail (Google)
                </label>
                <input
                  id="email"
                  value={authUser.email || ''}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500"
                  disabled
                />
              </div>

              {/* CPF / CNPJ */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Documento *</label>
                <div className="flex gap-2 mb-2">
                  {(['cpf', 'cnpj'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, documentType: type, document: '' }))}
                      className={`flex-1 py-1.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                        form.documentType === type
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
                <input
                  id="document"
                  value={form.document}
                  onChange={(e) => setForm((prev) => ({ ...prev, document: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
                  placeholder={form.documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                  required
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-800 mb-1">
                  Cidade *
                </label>
                <input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
                  required
                />
              </div>

              <div>
                <label htmlFor="educationInstitution" className="block text-sm font-medium text-gray-800 mb-1">
                  Instituição de ensino (opcional)
                </label>
                <input
                  id="educationInstitution"
                  value={form.educationInstitution}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, educationInstitution: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
                />
              </div>

              <div>
                <label htmlFor="birthday" className="block text-sm font-medium text-gray-800 mb-1">
                  Aniversário (opcional)
                </label>
                <input
                  id="birthday"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm((prev) => ({ ...prev, birthday: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black/20 text-black"
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  checked={form.consentAccepted}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, consentAccepted: e.target.checked }))
                  }
                  className="mt-0.5"
                  required
                />
                <span className="text-sm text-gray-700">
                  Concordo com o tratamento dos meus dados pessoais para cadastro e relacionamento, conforme LGPD.
                </span>
              </label>

              {errorMessage ? (
                <p className="text-sm text-red-600">{errorMessage}</p>
              ) : null}

              {statusMessage ? (
                <p className="text-sm text-emerald-700">{statusMessage}</p>
              ) : null}

              {phoneDuplicateWarning ? (
                <p className="text-sm text-amber-600">⚠ Este número de telefone já está associado a outra conta. Verifique seus dados.</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || loadingProfile}
                  className="rounded-lg bg-black text-white px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : lastUpdatedAt ? 'Atualizar cadastro' : 'Salvar cadastro'}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-gray-700 hover:bg-gray-50"
                >
                  Sair
                </button>
              </div>

              {/* Exclusão de conta (LGPD) */}
              {!showDeleteConfirm ? (
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-400 mb-2">Pela LGPD, você pode solicitar a exclusão de todos os seus dados a qualquer momento.</p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-red-500 hover:text-red-700 underline underline-offset-2 cursor-pointer transition-colors"
                  >
                    Excluir minha conta e dados pessoais
                  </button>
                </div>
              ) : (
                <div className="mt-8 pt-6 border-t border-red-200 rounded-lg bg-red-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-800">Tem certeza que deseja excluir sua conta?</p>
                  <p className="text-xs text-red-600">
                    Esta ação é permanente e irreversível. Todos os seus dados pessoais serão removidos do nosso sistema, conforme exigido pela LGPD.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm cursor-pointer transition-all duration-150 hover:bg-red-700 active:scale-95 disabled:opacity-50"
                    >
                      {deleting ? 'Excluindo...' : 'Sim, excluir minha conta'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 cursor-pointer transition-all duration-150 hover:bg-gray-100 active:scale-95 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </form>
          </>
        )}
      </section>
    </main>
  );
}

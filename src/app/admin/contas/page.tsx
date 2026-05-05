'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase/client';
import { AdminShell } from '../_components/AdminShell';
import { ShieldCheck, ShieldOff, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

type UserProfileRow = {
  uid: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  documentType: string | null;
  document: string | null;
  city: string | null;
  educationInstitution: string | null;
  birthday: string | null;
  verified: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  lgpdAccepted: boolean;
  lgpdAcceptedAt: string | null;
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

export default function AdminContasPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      setAuthUser(user);
    });
    return () => unsub();
  }, []);

  const loadProfiles = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/admin/user-profiles', { method: 'GET' }, authUser);
      const json = (await res.json()) as { profiles?: UserProfileRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar contas.');
      setProfiles(json.profiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (authUser) void loadProfiles();
  }, [authUser, loadProfiles]);

  async function handleToggleVerified(uid: string, currentVerified: boolean) {
    if (!authUser || togglingUid) return;
    setTogglingUid(uid);
    try {
      const res = await fetchWithAuth(
        '/api/admin/user-profiles',
        {
          method: 'PATCH',
          body: JSON.stringify({ uid, verified: !currentVerified }),
        },
        authUser
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar.');
      setProfiles((prev) =>
        prev.map((p) => (p.uid === uid ? { ...p, verified: !currentVerified } : p))
      );
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao atualizar conta.');
    } finally {
      setTogglingUid(null);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contas de Usuários</h1>
        <button
          type="button"
          onClick={() => void loadProfiles()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500">
          Nenhuma conta cadastrada ainda.
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-6" />
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">
                  Cadastro
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">
                  LGPD
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Verificada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((profile) => {
                const isExpanded = expandedUid === profile.uid;
                return (
                  <Fragment key={profile.uid}>
                    <tr
                      key={profile.uid}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedUid(isExpanded ? null : profile.uid)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {profile.fullName ?? <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {profile.email ?? <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {formatDate(profile.createdAt)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            profile.lgpdAccepted
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {profile.lgpdAccepted ? 'Aceita' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          title={profile.verified ? 'Desmarcar conta verificada' : 'Marcar como conta oficial'}
                          disabled={togglingUid === profile.uid}
                          onClick={() => void handleToggleVerified(profile.uid, profile.verified)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                            profile.verified
                              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {profile.verified ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Verificada
                            </>
                          ) : (
                            <>
                              <ShieldOff className="h-3.5 w-3.5" />
                              Não verificada
                            </>
                          )}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${profile.uid}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                            <Detail label="Telefone" value={profile.phone} />
                            <Detail
                              label={profile.documentType ? profile.documentType.toUpperCase() : 'Documento'}
                              value={profile.document}
                            />
                            <Detail label="Cidade" value={profile.city} />
                            <Detail label="Instituição de ensino" value={profile.educationInstitution} />
                            <Detail
                              label="Aniversário"
                              value={
                                profile.birthday
                                  ? new Date(profile.birthday + 'T12:00:00').toLocaleDateString('pt-BR')
                                  : null
                              }
                            />
                            <Detail label="Última atualização" value={formatDate(profile.updatedAt)} />
                            <Detail
                              label="Consentimento LGPD em"
                              value={formatDate(profile.lgpdAcceptedAt)}
                            />
                            <div className="col-span-2 md:col-span-3">
                              <span className="text-gray-400 text-xs">UID: </span>
                              <span className="text-gray-500 text-xs font-mono">{profile.uid}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="border-t px-4 py-3 text-xs text-gray-400">
            {profiles.length} conta{profiles.length !== 1 ? 's' : ''} no total
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-gray-800">{value ?? <span className="text-gray-400 italic">—</span>}</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { AdminShell } from "../_components/AdminShell";
import {
  BarChart2,
  Users,
  Eye,
  MousePointerClick,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { GA4Report } from "@/lib/analytics/ga4";

// ---------- helpers ----------

function fmtDate(s: string): string {
  // YYYYMMDD → DD/MM
  return `${s.slice(6, 8)}/${s.slice(4, 6)}`;
}

// ---------- mini bar-chart ----------

function BarChart({ data }: { data: GA4Report["dailyData"] }) {
  const max = Math.max(...data.map((d) => d.users), 1);
  const W = 700;
  const H = 100;
  const bw = W / data.length;
  const pad = 1.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = Math.max((d.users / max) * (H - 4), 2);
        return (
          <rect
            key={d.date}
            x={i * bw + pad}
            y={H - bh}
            width={bw - pad * 2}
            height={bh}
            rx={2}
            className="fill-gray-800 opacity-80 hover:opacity-100 transition-opacity"
          />
        );
      })}
    </svg>
  );
}

// ---------- setup guide ----------

const SETUP_STEPS = [
  <>
    Acesse{" "}
    <a
      href="https://analytics.google.com"
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
    >
      analytics.google.com
    </a>{" "}
    → Admin → Configurações da propriedade
  </>,
  "Copie o ID da Propriedade (número, ex: 123456789) — diferente do Measurement ID",
  <>
    Adicione a linha abaixo no arquivo{" "}
    <code className="bg-amber-100 rounded px-1">.env.local</code> e reinicie o servidor
  </>,
  <>
    Em GA4 → Admin → Gerenciamento de acesso à propriedade, adicione o e-mail{" "}
    <strong>firebase-adminsdk-fbsvc@formwerk-dea3f.iam.gserviceaccount.com</strong> com papel{" "}
    <strong>Leitor</strong>
  </>,
];

function SetupGuide() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-amber-900 mb-1">
            Conecte o GA4 para ver os dados aqui
          </h2>
          <p className="text-sm text-amber-700 mb-5">
            Siga os passos abaixo uma única vez para habilitar o painel.
          </p>
          <ol className="space-y-3">
            {SETUP_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-amber-800">
                <span className="flex-shrink-0 w-5 h-5 bg-amber-200 text-amber-900 rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 bg-amber-100 rounded-lg p-3 font-mono text-xs text-amber-900 whitespace-pre">
            {"# .env.local\nGA4_PROPERTY_ID=123456789"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- main page ----------

export default function AdminAnalyticsPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [data, setData] = useState<GA4Report | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, setAuthUser);
  }, []);

  useEffect(() => {
    if (!authUser) return;

    async function load() {
      try {
        const idToken = await authUser!.getIdToken();
        const res = await fetch("/api/admin/analytics", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.status === 503) {
          setNotConfigured(true);
          return;
        }

        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          setApiError(json.error ?? "Erro desconhecido.");
          return;
        }

        setData((await res.json()) as GA4Report);
      } catch (e) {
        setApiError(e instanceof Error ? e.message : "Erro desconhecido.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [authUser]);

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Últimos 30 dias — Google Analytics 4</p>
        </div>
        <a
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <BarChart2 className="h-4 w-4" />
          Abrir GA4
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
        </div>
      )}

      {/* Not configured */}
      {!loading && notConfigured && <SetupGuide />}

      {/* API error */}
      {!loading && apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-2">
          <p className="text-sm font-semibold text-red-700">Erro ao consultar o GA4</p>
          <pre className="text-xs text-red-600 whitespace-pre-wrap break-all bg-red-100 rounded p-3">
            {apiError}
          </pre>
          <p className="text-xs text-red-500">
            Causas comuns: service account sem acesso à propriedade GA4 (passo 4), property ID incorreto, ou credenciais Firebase Admin inválidas.
          </p>
        </div>
      )}

      {/* Data */}
      {!loading && data && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Users,
                label: "Usuários ativos",
                value: data.summary.totalUsers,
              },
              {
                icon: Eye,
                label: "Visualizações",
                value: data.summary.totalPageViews,
              },
              {
                icon: MousePointerClick,
                label: "Sessões",
                value: data.summary.totalSessions,
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white border rounded-xl p-5">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {value.toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>

          {/* Daily users chart */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Usuários por dia</h2>
            <BarChart data={data.dailyData} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{fmtDate(data.dailyData[0]?.date ?? "")}</span>
              <span>{fmtDate(data.dailyData[data.dailyData.length - 1]?.date ?? "")}</span>
            </div>
          </div>

          {/* Top pages + channels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top pages */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Páginas mais visitadas
              </h2>
              <div className="space-y-2">
                {data.topPages.map((page) => (
                  <div key={page.path} className="flex items-center justify-between gap-3">
                    <span
                      className="text-sm text-gray-700 truncate"
                      title={page.path}
                    >
                      {page.path}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {page.views.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Traffic channels */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Canais de tráfego
              </h2>
              <div className="space-y-3">
                {(() => {
                  const total =
                    data.channels.reduce((s, c) => s + c.sessions, 0) || 1;
                  return data.channels.map((ch) => {
                    const pct = Math.round((ch.sessions / total) * 100);
                    return (
                      <div key={ch.channel}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">
                            {ch.channel || "Direto"}
                          </span>
                          <span className="text-gray-500 text-xs">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div
                            className="h-1.5 bg-black rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

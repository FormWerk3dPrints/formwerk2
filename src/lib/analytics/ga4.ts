/**
 * Cliente GA4 Data API usando JWT + fetch nativo.
 * Sem dependências extras — usa o crypto nativo do Node.js.
 * Requer as mesmas credenciais da service account do Firebase Admin.
 */
import crypto from "crypto";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GA4_BASE = "https://analyticsdata.googleapis.com/v1beta";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
      scope: SCOPE,
    })
  );

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = base64url(sign.sign(privateKey));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 token error: ${text}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// ---------- tipos públicos ----------

export type DailyPoint = {
  date: string; // YYYYMMDD
  users: number;
  pageViews: number;
  sessions: number;
};

export type TopPage = { path: string; views: number };
export type Channel = { channel: string; sessions: number };

export type GA4Report = {
  summary: { totalUsers: number; totalPageViews: number; totalSessions: number };
  dailyData: DailyPoint[];
  topPages: TopPage[];
  channels: Channel[];
};

// ---------- helper ----------

function toInt(v: string | undefined): number {
  return Number(v ?? 0);
}

// ---------- função principal ----------

export async function fetchGA4Report(propertyId: string): Promise<GA4Report> {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!clientEmail || !rawKey) {
    throw new Error("missing-credentials");
  }

  const privateKey = rawKey.replace(/\\n/g, "\n");
  const accessToken = await getAccessToken(clientEmail, privateKey);

  const property = `properties/${propertyId}`;
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  async function runReport(body: object) {
    const res = await fetch(`${GA4_BASE}/${property}:runReport`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GA4 API error: ${text}`);
    }
    return res.json() as Promise<{
      rows?: Array<{
        dimensionValues?: Array<{ value?: string }>;
        metricValues?: Array<{ value?: string }>;
      }>;
    }>;
  }

  const [dailyRes, topPagesRes, channelsRes] = await Promise.all([
    runReport({
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "sessions" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    runReport({
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      limit: 10,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    }),
    runReport({
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    }),
  ]);

  const dailyData: DailyPoint[] = (dailyRes.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    users: toInt(row.metricValues?.[0]?.value),
    pageViews: toInt(row.metricValues?.[1]?.value),
    sessions: toInt(row.metricValues?.[2]?.value),
  }));

  const totalUsers = dailyData.reduce((s, d) => s + d.users, 0);
  const totalPageViews = dailyData.reduce((s, d) => s + d.pageViews, 0);
  const totalSessions = dailyData.reduce((s, d) => s + d.sessions, 0);

  const topPages: TopPage[] = (topPagesRes.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? "",
    views: toInt(row.metricValues?.[0]?.value),
  }));

  const channels: Channel[] = (channelsRes.rows ?? []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value ?? "Direto",
    sessions: toInt(row.metricValues?.[0]?.value),
  }));

  return { summary: { totalUsers, totalPageViews, totalSessions }, dailyData, topPages, channels };
}

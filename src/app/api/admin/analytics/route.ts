import { NextResponse } from "next/server";
import { firebaseAdminAuth, firebaseAdminDb } from "@/lib/firebase/adminServer";
import { fetchGA4Report } from "@/lib/analytics/ga4";

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

async function assertAdminAccess(req: Request): Promise<void> {
  const token = getBearerToken(req);
  if (!token) throw new Error("missing-token");
  const decoded = await firebaseAdminAuth.verifyIdToken(token);
  const email = decoded.email?.trim().toLowerCase();
  if (!email) throw new Error("forbidden");
  const adminDoc = await firebaseAdminDb.collection("admins").doc(email).get();
  if (!adminDoc.exists || adminDoc.data()?.active !== true) throw new Error("forbidden");
}

export async function GET(req: Request) {
  try {
    await assertAdminAccess(req);

    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      return NextResponse.json({ error: "not-configured" }, { status: 503 });
    }

    const report = await fetchGA4Report(propertyId);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof Error && error.message === "missing-token") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "forbidden") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "missing-credentials") {
      return NextResponse.json({ error: "not-configured" }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/admin/analytics][GET]", message);
    // Retorna a mensagem real para o admin (endpoint protegido por auth)
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

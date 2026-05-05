import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import { decryptProfilePayload, type EncryptedBlob } from '@/lib/security/userProfileCrypto';

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function assertAdminAccess(req: Request): Promise<void> {
  const token = getBearerToken(req);
  if (!token) throw new Error('missing-token');

  const decoded = await firebaseAdminAuth.verifyIdToken(token);
  const email = decoded.email?.trim().toLowerCase();
  if (!email) throw new Error('forbidden');

  const adminDoc = await firebaseAdminDb.collection('admins').doc(email).get();
  if (!adminDoc.exists || adminDoc.data()?.active !== true) throw new Error('forbidden');
}

type RawProfileDoc = {
  uid?: string;
  encryptedProfile?: EncryptedBlob;
  verified?: boolean;
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
  lgpd?: { accepted?: boolean; acceptedAt?: { toDate?: () => Date } };
};

type DecryptedProfile = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  documentType: string | null;
  document: string | null;
  city: string | null;
  educationInstitution: string | null;
  birthday: string | null;
};

function safeDecrypt(encryptedProfile: EncryptedBlob): DecryptedProfile {
  try {
    const d = decryptProfilePayload<Record<string, unknown>>(encryptedProfile);
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    return {
      email: str(d.email),
      fullName: str(d.fullName),
      phone: str(d.phone),
      documentType: str(d.documentType),
      document: str(d.document),
      city: str(d.city),
      educationInstitution: str(d.educationInstitution),
      birthday: str(d.birthday),
    };
  } catch {
    return { email: null, fullName: null, phone: null, documentType: null, document: null, city: null, educationInstitution: null, birthday: null };
  }
}

// GET /api/admin/user-profiles — lista todos os perfis
export async function GET(req: Request) {
  try {
    await assertAdminAccess(req);

    const snapshot = await firebaseAdminDb
      .collection('userProfiles')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const profiles = snapshot.docs.map((doc) => {
      const data = doc.data() as RawProfileDoc;
      const decrypted = data.encryptedProfile
        ? safeDecrypt(data.encryptedProfile)
        : { email: null, fullName: null, phone: null, documentType: null, document: null, city: null, educationInstitution: null, birthday: null };

      return {
        uid: doc.id,
        ...decrypted,
        verified: data.verified === true,
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : null,
        updatedAt:
          typeof data.updatedAt?.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : null,
        lgpdAccepted: data.lgpd?.accepted === true,
        lgpdAcceptedAt:
          typeof data.lgpd?.acceptedAt?.toDate === 'function'
            ? data.lgpd.acceptedAt.toDate().toISOString()
            : null,
      };
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    console.error('[api/admin/user-profiles][GET]', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

// PATCH /api/admin/user-profiles — alterna verified de um perfil
export async function PATCH(req: Request) {
  try {
    await assertAdminAccess(req);

    const body = (await req.json()) as { uid?: unknown; verified?: unknown };
    const uid = typeof body.uid === 'string' ? body.uid.trim() : null;
    const verified = typeof body.verified === 'boolean' ? body.verified : null;

    if (!uid) {
      return NextResponse.json({ error: 'uid é obrigatório.' }, { status: 400 });
    }
    if (verified === null) {
      return NextResponse.json({ error: 'verified (boolean) é obrigatório.' }, { status: 400 });
    }

    await firebaseAdminDb.collection('userProfiles').doc(uid).update({
      verified,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, uid, verified });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    console.error('[api/admin/user-profiles][PATCH]', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}

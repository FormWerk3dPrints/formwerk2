import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import { decryptProfilePayload, hashForSearch, type EncryptedBlob } from '@/lib/security/userProfileCrypto';

type SearchField =
  | 'fullName'
  | 'phone'
  | 'email'
  | 'city'
  | 'educationInstitution'
  | 'birthday';

const SEARCH_HASH_FIELD_BY_INPUT: Record<SearchField, string> = {
  fullName: 'searchHashes.fullNameHash',
  phone: 'searchHashes.phoneHash',
  email: 'searchHashes.emailHash',
  city: 'searchHashes.cityHash',
  educationInstitution: 'searchHashes.educationInstitutionHash',
  birthday: 'searchHashes.birthdayHash',
};

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

async function getDecodedToken(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('missing-token');
  }
  return firebaseAdminAuth.verifyIdToken(token);
}

async function assertAdminAccess(req: Request): Promise<void> {
  const decoded = await getDecodedToken(req);
  const email = decoded.email?.trim().toLowerCase();

  if (!email) {
    throw new Error('forbidden');
  }

  const adminDoc = await firebaseAdminDb.collection('admins').doc(email).get();
  const active = adminDoc.exists && adminDoc.data()?.active === true;
  if (!active) {
    throw new Error('forbidden');
  }
}

function parseField(value: string | null): SearchField | null {
  if (!value) return null;

  const normalized = value.trim();
  if (
    normalized === 'fullName'
    || normalized === 'phone'
    || normalized === 'email'
    || normalized === 'city'
    || normalized === 'educationInstitution'
    || normalized === 'birthday'
  ) {
    return normalized;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    await assertAdminAccess(req);

    const { searchParams } = new URL(req.url);
    const field = parseField(searchParams.get('field'));
    const value = (searchParams.get('value') ?? '').trim();

    if (!field || !value) {
      return NextResponse.json(
        { error: 'Informe field e value para pesquisar.' },
        { status: 400 }
      );
    }

    const hashField = SEARCH_HASH_FIELD_BY_INPUT[field];
    const targetHash = hashForSearch(value);

    const snapshot = await firebaseAdminDb
      .collection('userProfiles')
      .where(hashField, '==', targetHash)
      .limit(20)
      .get();

    const matches = snapshot.docs.map((doc) => {
      const data = doc.data() as {
        encryptedProfile?: EncryptedBlob;
        updatedAt?: { toDate?: () => Date };
        lgpd?: { accepted?: unknown };
      };

      let email: string | null = null;
      if (data.encryptedProfile) {
        try {
          const decrypted = decryptProfilePayload<{ email?: string }>(data.encryptedProfile);
          email = typeof decrypted.email === 'string' ? decrypted.email : null;
        } catch {
          // se falhar a descriptografia, mantém null
        }
      }

      return {
        uid: doc.id,
        email,
        lgpdAccepted: data.lgpd?.accepted === true,
        updatedAt:
          typeof data.updatedAt?.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : null,
      };
    });

    return NextResponse.json({
      field,
      total: matches.length,
      matches,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'forbidden') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Falha na busca de perfis.' }, { status: 500 });
  }
}

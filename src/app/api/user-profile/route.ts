import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';
import {
  decryptProfilePayload,
  encryptProfilePayload,
  hashForSearch,
  type EncryptedBlob,
} from '@/lib/security/userProfileCrypto';

type UserProfilePayload = {
  fullName: string;
  phone: string;
  documentType: 'cpf' | 'cnpj';
  document: string;
  city: string;
  educationInstitution?: string;
  birthday?: string;
  consentAccepted: boolean;
};

type DecryptedUserProfile = {
  fullName: string;
  phone: string;
  email: string;
  documentType: string;
  document: string;
  city: string;
  educationInstitution: string;
  birthday: string;
};

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function sanitizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizePhone(value: unknown): string {
  const raw = sanitizeText(value);
  return raw.replace(/[^\d+()\-\s]/g, '').trim();
}

function sanitizeBirthday(value: unknown): string {
  const raw = sanitizeText(value);
  if (!raw) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  return raw;
}

function sanitizeDocument(value: unknown): string {
  const raw = sanitizeText(value);
  return raw.replace(/[^\d.\-/]/g, '').trim();
}

function validatePayload(payload: unknown):
  | { ok: true; value: UserProfilePayload }
  | { ok: false; message: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, message: 'Payload inválido.' };
  }

  const source = payload as Record<string, unknown>;
  const fullName = sanitizeText(source.fullName);
  const phone = sanitizePhone(source.phone);
  const documentType = source.documentType === 'cnpj' ? 'cnpj' : 'cpf';
  const document = sanitizeDocument(source.document);
  const city = sanitizeText(source.city);
  const educationInstitution = sanitizeText(source.educationInstitution);
  const birthday = sanitizeBirthday(source.birthday);
  const consentAccepted = source.consentAccepted === true;

  if (!fullName) return { ok: false, message: 'Nome é obrigatório.' };
  if (!phone) return { ok: false, message: 'Telefone é obrigatório.' };
  if (!document) return { ok: false, message: 'CPF/CNPJ é obrigatório.' };
  if (!city) return { ok: false, message: 'Cidade é obrigatória.' };
  if (!consentAccepted) {
    return { ok: false, message: 'É necessário aceitar o tratamento de dados (LGPD).' };
  }

  return {
    ok: true,
    value: {
      fullName,
      phone,
      documentType,
      document,
      city,
      educationInstitution,
      birthday,
      consentAccepted,
    },
  };
}

async function getUidFromRequest(req: Request): Promise<string> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('missing-token');
  }

  const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
  return decodedToken.uid;
}

export async function GET(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    const docSnap = await firebaseAdminDb.collection('userProfiles').doc(uid).get();

    if (!docSnap.exists) {
      return NextResponse.json({ profile: null });
    }

    const data = docSnap.data() as {
      encryptedProfile?: EncryptedBlob;
      updatedAt?: { toDate?: () => Date };
    };

    if (!data.encryptedProfile) {
      return NextResponse.json({ profile: null });
    }

    const decrypted = decryptProfilePayload<DecryptedUserProfile>(data.encryptedProfile);

    if (!decrypted.email) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        ...decrypted,
        updatedAt:
          typeof data.updatedAt?.toDate === 'function'
            ? data.updatedAt.toDate().toISOString()
            : undefined,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    console.error('[api/user-profile][GET] erro interno', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: 'Falha ao carregar perfil.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const uid = await getUidFromRequest(req);
    const decodedToken = await firebaseAdminAuth.getUser(uid);
    const email = decodedToken.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Usuário sem e-mail válido.' }, { status: 400 });
    }

    const payloadValidation = validatePayload(await req.json());
    if (!payloadValidation.ok) {
      return NextResponse.json({ error: payloadValidation.message }, { status: 400 });
    }

    const payload = payloadValidation.value;

    const encryptedProfile = encryptProfilePayload({
      fullName: payload.fullName,
      phone: payload.phone,
      email,
      documentType: payload.documentType,
      document: payload.document,
      city: payload.city,
      educationInstitution: payload.educationInstitution || '',
      birthday: payload.birthday || '',
    });

    const searchHashes = {
      fullNameHash: hashForSearch(payload.fullName),
      phoneHash: hashForSearch(payload.phone),
      emailHash: hashForSearch(email),
      documentHash: hashForSearch(payload.document),
      cityHash: hashForSearch(payload.city),
      educationInstitutionHash: payload.educationInstitution
        ? hashForSearch(payload.educationInstitution)
        : null,
      birthdayHash: payload.birthday ? hashForSearch(payload.birthday) : null,
    };

    await firebaseAdminDb.collection('userProfiles').doc(uid).set(
      {
        uid,
        encryptedProfile,
        searchHashes,
        lgpd: {
          accepted: true,
          acceptedAt: FieldValue.serverTimestamp(),
          version: '1.0',
        },
        auth: {
          provider: decodedToken.providerData?.[0]?.providerId ?? 'unknown',
          emailVerified: decodedToken.emailVerified,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Verifica se o telefone já está associado a outra conta
    const phoneHash = searchHashes.phoneHash;
    const dupSnap = await firebaseAdminDb
      .collection('userProfiles')
      .where('searchHashes.phoneHash', '==', phoneHash)
      .limit(2)
      .get();
    const phoneDuplicate = dupSnap.docs.some((doc) => doc.id !== uid);

    return NextResponse.json({ ok: true, phoneDuplicate });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    console.error('[api/user-profile][POST] erro interno', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: 'Falha ao salvar perfil.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const uid = await getUidFromRequest(req);

    // Apaga o documento de perfil no Firestore
    await firebaseAdminDb.collection('userProfiles').doc(uid).delete();

    // Apaga o usuário do Firebase Authentication
    await firebaseAdminAuth.deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing-token') {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    console.error('[api/user-profile][DELETE] erro interno', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: 'Falha ao excluir conta.' }, { status: 500 });
  }
}

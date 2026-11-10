import { firebaseAdminAuth, firebaseAdminDb } from '@/lib/firebase/adminServer';

/**
 * Confere que o pedido traz o token de um admin ativo.
 *
 * Lança 'missing-token' ou 'forbidden', que as rotas traduzem em 401 e 403.
 */

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

export async function assertAdminAccess(req: Request): Promise<void> {
  const token = getBearerToken(req);
  if (!token) throw new Error('missing-token');

  const decoded = await firebaseAdminAuth.verifyIdToken(token);
  const email = decoded.email?.trim().toLowerCase();
  if (!email) throw new Error('forbidden');

  const adminDoc = await firebaseAdminDb.collection('admins').doc(email).get();
  if (!adminDoc.exists || adminDoc.data()?.active !== true) throw new Error('forbidden');
}

/** Status HTTP correspondente ao erro lançado acima. */
export function statusDoErro(erro: unknown): number {
  const motivo = erro instanceof Error ? erro.message : '';
  if (motivo === 'missing-token') return 401;
  if (motivo === 'forbidden') return 403;
  return 500;
}

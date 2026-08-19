import { firebaseAuth } from '@/lib/firebase/client';

export type AuditEntity = 'produto' | 'kit' | 'categoria';
export type AuditAction = 'cadastro' | 'alteracao' | 'delecao';

/**
 * Registra a operação no log de auditoria (logs/admin-audit.txt).
 *
 * Deliberadamente "à prova de falha": se o log não puder ser gravado, a
 * operação do admin não é afetada — perder uma linha de log é bem menos grave
 * que impedir um cadastro. O e-mail não é enviado pelo cliente; o servidor o
 * extrai do ID token, então não dá para forjar autoria.
 */
export async function logAdminAction(
  entity: AuditEntity,
  name: string,
  action: AuditAction
): Promise<void> {
  try {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/admin/audit-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ entity, name, action }),
    });
  } catch {
    // silencioso de propósito — ver comentário acima
  }
}

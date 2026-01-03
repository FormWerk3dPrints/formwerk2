export const ADMIN_EMAILS = [
  'fernandovedana03@gmail.com',
  'formwerklages@gmail.com',
] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email);
}

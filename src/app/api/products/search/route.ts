import { NextResponse } from 'next/server';
import { getProductSuggestions, searchProductsByTokens } from '@/lib/products/search';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();
    const mode = (searchParams.get('mode') ?? 'suggest').toLowerCase();

    if (!q) {
      return NextResponse.json(
        mode === 'full'
          ? { q, tokens: [], nameMatches: [], keywordMatches: [] }
          : { q, tokens: [], suggestions: [] }
      );
    }

    if (mode === 'full') {
      const { tokens, nameMatches, keywordMatches } = await searchProductsByTokens({
        q,
        maxTokens: 10,
        maxPerGroup: 200,
      });

      return NextResponse.json({ q, tokens, nameMatches, keywordMatches });
    }

    const { tokens, suggestions } = await getProductSuggestions({ q, limit: 10 });
    return NextResponse.json({ q, tokens, suggestions });
  } catch (err: unknown) {
    // Ajuda a diagnosticar erros de índice/regras no Firestore durante dev.
    // Mantém resposta genérica em produção.
    console.error('[api/products/search] error', err);
    const details =
      err && typeof err === 'object'
        ? {
            name: (err as { name?: unknown }).name,
            code: (err as { code?: unknown }).code,
            message: (err as { message?: unknown }).message,
          }
        : { message: String(err) };

    return NextResponse.json(
      {
        error: 'Erro ao buscar produtos',
        details: process.env.NODE_ENV === 'production' ? undefined : details,
      },
      { status: 500 }
    );
  }
}

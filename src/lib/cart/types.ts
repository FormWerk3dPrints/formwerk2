/**
 * Carrinho de orçamento.
 *
 * Não é um carrinho de compra: ninguém paga pelo site. O visitante junta itens
 * e quantidades, preenche os dados e o resultado vira um PDF de orçamento
 * enviado pelo WhatsApp da empresa.
 *
 * O carrinho guarda apenas o necessário para remontar o item depois (tipo e
 * identificador). Nome, imagem e preço são sempre buscados de novo no servidor
 * na hora de gerar o PDF: o que vem do navegador não decide preço.
 */

/** De qual catálogo o item veio. */
export type CartKind = 'produto' | 'kit' | 'painel';

export type CartItem = {
  kind: CartKind;
  /** Id do documento no Firestore (products, kits ou wall-panels). */
  id: string;
  quantity: number;
  /** Só para exibir no carrinho sem precisar buscar tudo de novo. */
  name: string;
  pluralName?: string;
  imageUrl?: string;
};

/** Linha enviada à API: o servidor confere o resto. */
export type CartLine = Pick<CartItem, 'kind' | 'id' | 'quantity'>;

/** Dados do cliente, iguais aos campos do orçamento em PDF. */
export type CustomerData = {
  cliente: string;
  documento: string;
  endereco: string;
  contato: string;
  email: string;
};

export const EMPTY_CUSTOMER: CustomerData = {
  cliente: '',
  documento: '',
  endereco: '',
  contato: '',
  email: '',
};

/** Coleção do Firestore de cada tipo de item. */
export const COLLECTION_BY_KIND: Record<CartKind, string> = {
  produto: 'products',
  kit: 'kits',
  painel: 'wall-panels',
};

/** Caminho público de cada tipo, para o carrinho linkar de volta. */
export function hrefForItem(kind: CartKind, id: string): string {
  if (kind === 'kit') return `/kits/${id}`;
  if (kind === 'painel') return `/paineis`;
  return `/catalogo/${id}`;
}

export const MAX_QUANTITY = 9999;

/** Mantém a quantidade num intervalo são, mesmo vindo de localStorage adulterado. */
export function sanitizeQuantity(value: unknown): number {
  const numero = Math.floor(Number(value));
  if (!Number.isFinite(numero) || numero < 1) return 1;
  return Math.min(numero, MAX_QUANTITY);
}

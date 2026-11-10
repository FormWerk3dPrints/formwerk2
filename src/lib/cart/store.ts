import { sanitizeQuantity, type CartItem, type CartKind } from './types';

/**
 * Estado do carrinho fora do React.
 *
 * É um store externo (useSyncExternalStore) em vez de estado dentro de um
 * efeito: o conteúdo mora no localStorage, que não existe no servidor, e esse
 * é o jeito que o React oferece para ler uma fonte externa sem quebrar a
 * hidratação. De quebra, duas abas abertas ficam em sincronia.
 */

const STORAGE_KEY = 'formwerk:cart';

type Estado = { items: CartItem[]; isOpen: boolean };

/** Snapshot do servidor: sempre o mesmo objeto, senão o React re-renderiza à toa. */
const ESTADO_VAZIO: Estado = { items: [], isOpen: false };

let estado: Estado = ESTADO_VAZIO;
let carregado = false;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function definir(novo: Partial<Estado>) {
  estado = { ...estado, ...novo };
  avisar();
}

function lerDoNavegador(): CartItem[] {
  try {
    const bruto = window.localStorage.getItem(STORAGE_KEY);
    if (!bruto) return [];
    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) return [];
    return dados
      .filter((i) => i && typeof i.id === 'string' && typeof i.kind === 'string')
      .map((i) => ({
        kind: i.kind as CartKind,
        id: i.id as string,
        quantity: sanitizeQuantity(i.quantity),
        name: typeof i.name === 'string' ? i.name : '',
        pluralName: typeof i.pluralName === 'string' ? i.pluralName : undefined,
        imageUrl: typeof i.imageUrl === 'string' ? i.imageUrl : undefined,
      }));
  } catch {
    // localStorage bloqueado (janela anônima) ou JSON torto: começa vazio.
    return [];
  }
}

function gravar(items: CartItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sem persistência o carrinho ainda funciona nesta aba.
  }
}

function aoMudarOutraAba(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  definir({ items: lerDoNavegador() });
}

export function subscribe(ouvinte: () => void): () => void {
  // A primeira inscrição acontece no cliente, depois da hidratação: é aqui
  // que o localStorage entra, sem efeito nenhum chamando setState.
  if (!carregado) {
    carregado = true;
    estado = { items: lerDoNavegador(), isOpen: false };
    window.addEventListener('storage', aoMudarOutraAba);
  }

  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function getSnapshot(): Estado {
  return estado;
}

export function getServerSnapshot(): Estado {
  return ESTADO_VAZIO;
}

function mesmoItem(a: { kind: CartKind; id: string }, b: { kind: CartKind; id: string }) {
  return a.kind === b.kind && a.id === b.id;
}

function atualizarItens(items: CartItem[]) {
  gravar(items);
  definir({ items });
}

export function addItem(item: Omit<CartItem, 'quantity'>, quantity = 1) {
  const qtd = sanitizeQuantity(quantity);
  const existente = estado.items.find((i) => mesmoItem(i, item));
  const items = existente
    ? estado.items.map((i) =>
        mesmoItem(i, item) ? { ...i, ...item, quantity: sanitizeQuantity(i.quantity + qtd) } : i,
      )
    : [...estado.items, { ...item, quantity: qtd }];

  // Não abre a gaveta: quem está montando uma lista adiciona vários itens
  // seguidos, e o retorno fica por conta do número no ícone do cabeçalho.
  gravar(items);
  definir({ items });
}

export function setQuantity(kind: CartKind, id: string, quantity: number) {
  atualizarItens(
    estado.items.map((i) =>
      mesmoItem(i, { kind, id }) ? { ...i, quantity: sanitizeQuantity(quantity) } : i,
    ),
  );
}

export function removeItem(kind: CartKind, id: string) {
  atualizarItens(estado.items.filter((i) => !mesmoItem(i, { kind, id })));
}

export function clear() {
  atualizarItens([]);
}

export function openCart() {
  definir({ isOpen: true });
}

export function closeCart() {
  definir({ isOpen: false });
}

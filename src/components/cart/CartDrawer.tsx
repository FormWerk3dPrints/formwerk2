'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase/client';
import { useCart } from '@/lib/cart/useCart';
import { hrefForItem, MAX_QUANTITY } from '@/lib/cart/types';
import {
  dadosDoPerfil,
  formatarContato,
  FORMULARIO_VAZIO,
  type DadosFormulario,
  type PerfilDaConta,
  type TipoDocumento,
} from '@/lib/cart/perfil';

const WHATSAPP_NUMERO = '554999159142';

type Etapa = 'itens' | 'dados' | 'pronto';

/**
 * Gaveta do orçamento. Tem três etapas: a lista de itens, o formulário com os
 * dados do cliente (que é o que aparece no lugar de um checkout) e o envio,
 * que abre o WhatsApp da empresa com a mensagem e o link do PDF prontos.
 */
export default function CartDrawer() {
  const { items, count, isOpen, closeCart, setQuantity, removeItem, clear } = useCart();
  const [etapa, setEtapa] = useState<Etapa>('itens');
  const [cliente, setCliente] = useState<DadosFormulario>(FORMULARIO_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ numero: string; url: string } | null>(null);
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('cpf');
  const [perfil, setPerfil] = useState<PerfilDaConta | null>(null);

  // Cadastro de quem está logado, para já entregar o formulário preenchido.
  useEffect(() => {
    if (!isOpen || perfil) return;
    let cancelado = false;

    (async () => {
      const usuario = firebaseAuth.currentUser;
      if (!usuario) return;
      try {
        const idToken = await usuario.getIdToken();
        const res = await fetch('/api/user-profile', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const dados = await res.json();
        if (cancelado || !dados?.profile) return;

        const carregado: PerfilDaConta = dados.profile;
        const tipo: TipoDocumento = carregado.documentType === 'cnpj' ? 'cnpj' : 'cpf';
        setPerfil(carregado);
        setTipoDoc(tipo);
        // Só preenche campo vazio: o que já foi digitado nesta sessão fica.
        setCliente((atual) => {
          const doPerfil = dadosDoPerfil(carregado, tipo);
          return {
            cliente: atual.cliente || doPerfil.cliente,
            documento: atual.documento || doPerfil.documento,
            endereco: atual.endereco || doPerfil.endereco,
            contatoNome: atual.contatoNome || doPerfil.contatoNome,
            contatoTelefone: atual.contatoTelefone || doPerfil.contatoTelefone,
            email: atual.email || doPerfil.email,
          };
        });
      } catch {
        // Sem cadastro carregado, o formulário segue em branco.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [isOpen, perfil]);

  /** Troca entre pessoa física e jurídica, remontando o que vem do cadastro. */
  function trocarTipo(tipo: TipoDocumento) {
    setTipoDoc(tipo);
    if (perfil) setCliente(dadosDoPerfil(perfil, tipo));
  }

  // Fecha com Esc e trava a rolagem do fundo enquanto a gaveta está aberta.
  useEffect(() => {
    if (!isOpen) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [isOpen, closeCart]);

  // Carrinho esvaziado: volta para a primeira etapa.
  useEffect(() => {
    if (!items.length && etapa !== 'pronto') setEtapa('itens');
  }, [items.length, etapa]);

  if (!isOpen) return null;

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      // Token só se houver login: é ele que libera preço no PDF.
      let token: string | null = null;
      const usuario = firebaseAuth.currentUser;
      if (usuario) token = await usuario.getIdToken();

      const resposta = await fetch('/api/orcamento', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((i) => ({ kind: i.kind, id: i.id, quantity: i.quantity })),
          // O formulário tem nome e telefone separados; o documento final
          // recebe os dois na mesma linha.
          customer: {
            cliente: cliente.cliente,
            documento: cliente.documento,
            endereco: cliente.endereco,
            contato: formatarContato(cliente, tipoDoc),
            email: cliente.email,
          },
        }),
      });

      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados?.error || 'Falha ao gerar o orçamento.');

      setResultado({ numero: dados.numero, url: dados.url });
      setEtapa('pronto');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar o orçamento.');
    } finally {
      setEnviando(false);
    }
  }

  function mensagemWhatsApp(): string {
    if (!resultado) return '';
    const linhas = [
      `Olá! Gostaria de solicitar este orçamento (nº ${resultado.numero}).`,
      '',
      `Cliente: ${cliente.cliente}`,
      cliente.documento ? `${tipoDoc === 'cnpj' ? 'CNPJ' : 'CPF'}: ${cliente.documento}` : '',
      formatarContato(cliente, tipoDoc) ? `Contato: ${formatarContato(cliente, tipoDoc)}` : '',
      '',
      'Itens:',
      ...items.map((i) => `• ${i.quantity} un — ${i.quantity > 1 && i.pluralName ? i.pluralName : i.name}`),
      '',
      `PDF do orçamento: ${resultado.url}`,
    ];
    return linhas.filter((l) => l !== '').join('\n');
  }

  // Instituição também precisa do nome de quem responde pelo pedido.
  const podeEnviar =
    cliente.cliente.trim() &&
    cliente.contatoTelefone.trim() &&
    (tipoDoc === 'cpf' || cliente.contatoNome.trim());

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Orçamento">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar orçamento"
        onClick={closeCart}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {etapa === 'itens' && 'Seu orçamento'}
              {etapa === 'dados' && 'Dados do cliente'}
              {etapa === 'pronto' && 'Orçamento pronto'}
            </h2>
            {etapa === 'itens' && (
              <p className="text-xs text-gray-500">
                {count === 0 ? 'Nenhum item ainda' : `${count} ${count === 1 ? 'item' : 'itens'}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </header>

        {/* data-lenis-prevent: sem isto o Lenis captura a roda do mouse e rola
            a página atrás, em vez do conteúdo da gaveta. */}
        <div className="flex-1 overflow-y-auto px-5 py-4" data-lenis-prevent>
          {etapa === 'itens' && (
            items.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-500">
                <p>Seu orçamento está vazio.</p>
                <Link
                  href="/catalogo"
                  onClick={closeCart}
                  className="mt-3 inline-block font-semibold"
                  style={{ color: '#0D6AA7' }}
                >
                  Ver o catálogo
                </Link>
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex gap-3 border-b pb-4 last:border-b-0">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      {item.imageUrl && (
                        <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={hrefForItem(item.kind, item.id)}
                        onClick={closeCart}
                        className="block truncate text-sm font-semibold text-gray-900 hover:underline"
                      >
                        {item.quantity > 1 && item.pluralName ? item.pluralName : item.name}
                      </Link>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.kind, item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="rounded-md border p-1.5 text-gray-600 disabled:opacity-40"
                          aria-label={`Diminuir quantidade de ${item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={MAX_QUANTITY}
                          value={item.quantity}
                          onChange={(e) => setQuantity(item.kind, item.id, Number(e.target.value))}
                          className="w-16 rounded-md border px-2 py-1 text-center text-sm text-gray-900"
                          aria-label={`Quantidade de ${item.name}`}
                        />
                        <span className="text-xs text-gray-500">un</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.kind, item.id, item.quantity + 1)}
                          className="rounded-md border p-1.5 text-gray-600"
                          aria-label={`Aumentar quantidade de ${item.name}`}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.kind, item.id)}
                          className="ml-auto rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          aria-label={`Remover ${item.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}

          {etapa === 'dados' && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
              {/* Pessoa física ou jurídica: muda os rótulos e o que vem do
                  cadastro. aria-pressed também pinta de amarelo no alto
                  contraste, igual aos outros botões de alternância do site. */}
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                {([
                  ['cpf', 'Pessoa física'],
                  ['cnpj', 'Instituição'],
                ] as Array<[TipoDocumento, string]>).map(([tipo, rotulo]) => (
                  <button
                    key={tipo}
                    type="button"
                    aria-pressed={tipoDoc === tipo}
                    onClick={() => trocarTipo(tipo)}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      tipoDoc === tipo ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {perfil && (
                <p className="text-xs text-gray-500">
                  Preenchemos com os dados da sua conta. Confira e complete o que faltar.
                </p>
              )}

              {/* No modo instituição, responsável e telefone são dois campos;
                  o orçamento junta os dois numa linha só. */}
              {([
                ['cliente', tipoDoc === 'cnpj' ? 'Cliente (instituição)' : 'Cliente', true],
                ['documento', tipoDoc === 'cnpj' ? 'CNPJ' : 'CPF', false],
                ['endereco', 'Endereço', false],
                ...(tipoDoc === 'cnpj'
                  ? ([['contatoNome', 'Responsável', true]] as Array<[keyof DadosFormulario, string, boolean]>)
                  : []),
                ['contatoTelefone', 'Telefone', true],
                ['email', 'E-mail', false],
              ] as Array<[keyof DadosFormulario, string, boolean]>).map(([campo, rotulo, obrigatorio]) => (
                <div key={campo}>
                  <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor={`cart-${campo}`}>
                    {rotulo}
                    {obrigatorio && <span className="text-red-600"> *</span>}
                  </label>
                  <input
                    id={`cart-${campo}`}
                    type={campo === 'email' ? 'email' : campo === 'contatoTelefone' ? 'tel' : 'text'}
                    value={cliente[campo]}
                    onChange={(e) => setCliente((prev) => ({ ...prev, [campo]: e.target.value }))}
                    className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
                    required={obrigatorio}
                  />
                </div>
              ))}
              {erro && <p className="text-sm text-red-600">{erro}</p>}
            </form>
          )}

          {etapa === 'pronto' && resultado && (
            <div className="space-y-4 py-4 text-sm text-gray-700">
              <p>
                Orçamento <strong>nº {resultado.numero}</strong> gerado. O próximo passo abre o WhatsApp da
                FormWerk com a mensagem e o link do PDF prontos — é só enviar.
              </p>
              <a
                href={resultado.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-semibold"
                style={{ color: '#0D6AA7' }}
              >
                Ver o PDF
              </a>
              <p className="text-xs text-gray-500">O arquivo fica disponível por 30 dias.</p>
            </div>
          )}
        </div>

        <footer className="border-t px-5 py-4">
          {etapa === 'itens' && (
            <button
              type="button"
              disabled={!items.length}
              onClick={() => setEtapa('dados')}
              className="w-full rounded-lg py-3 font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#0D6AA7' }}
            >
              Fechar orçamento
            </button>
          )}

          {etapa === 'dados' && (
            <div className="space-y-2">
              <button
                type="button"
                disabled={!podeEnviar || enviando}
                onClick={() => void enviar()}
                className="w-full rounded-lg py-3 font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: '#0D6AA7' }}
              >
                {enviando ? 'Gerando o PDF...' : 'Gerar orçamento'}
              </button>
              <button
                type="button"
                onClick={() => setEtapa('itens')}
                className="w-full rounded-lg border py-2 text-sm font-medium text-gray-700"
              >
                Voltar aos itens
              </button>
            </div>
          )}

          {etapa === 'pronto' && resultado && (
            <div className="space-y-2">
              <a
                href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagemWhatsApp())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-green-600 py-3 text-center font-semibold text-white hover:bg-green-700"
              >
                Encaminhar no WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  clear();
                  setCliente(FORMULARIO_VAZIO);
                  setResultado(null);
                  setEtapa('itens');
                  closeCart();
                }}
                className="w-full rounded-lg border py-2 text-sm font-medium text-gray-700"
              >
                Começar um novo orçamento
              </button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}

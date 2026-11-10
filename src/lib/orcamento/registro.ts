import {
  decryptProfilePayload,
  encryptProfilePayload,
  type EncryptedBlob,
} from '@/lib/security/userProfileCrypto';

/**
 * Orçamento guardado no Firestore, com os dados pessoais cifrados.
 *
 * Usa a mesma chave dos perfis (USER_PROFILE_ENCRYPTION_SECRET), AES-256-GCM.
 * Quem abrir a coleção pelo console vê números e datas, mas não o nome do
 * cliente, o CNPJ, o endereço, os itens, os valores nem o link do PDF.
 *
 * Fica em claro só o que o banco precisa consultar ou ordenar:
 *
 * | Campo           | Por quê                                              |
 * |-----------------|------------------------------------------------------|
 * | numero          | é o id do documento                                   |
 * | solicitanteUid  | filtro do histórico em Minha Conta                    |
 * | criadoEm        | ordenação da lista do admin                           |
 * | expiraEm        | filtro da rotina que apaga os PDFs vencidos           |
 * | pdfPath         | caminho no Storage, para a rotina apagar sem decifrar |
 * | comPreco        | booleano sem valor, marca o aviso do DOCX             |
 *
 * O `pdfUrl` vai cifrado porque carrega o token de download: com ele qualquer
 * um baixaria o PDF, que tem os dados do cliente.
 */

export type ItemRegistrado = {
  kind?: string;
  id?: string;
  nome?: string;
  quantidade?: number;
  precoUnitarioCents?: number;
};

export type ClienteRegistrado = {
  cliente: string;
  documento: string;
  endereco: string;
  contato: string;
  email: string;
};

/** O que é cifrado antes de ir para o banco. */
export type ConteudoOrcamento = {
  cliente: ClienteRegistrado;
  itens: ItemRegistrado[];
  totalCents: number;
  pdfUrl: string | null;
  solicitanteEmail: string | null;
};

/** O documento inteiro, do jeito que fica no Firestore. */
export type OrcamentoArmazenado = {
  numero: string;
  solicitanteUid: string | null;
  comPreco: boolean;
  criadoEm: Date;
  expiraEm: Date;
  pdfPath: string | null;
  conteudo: EncryptedBlob;
};

export function montarRegistro(dados: {
  numero: string;
  solicitanteUid: string | null;
  comPreco: boolean;
  criadoEm: Date;
  expiraEm: Date;
  pdfPath: string | null;
  conteudo: ConteudoOrcamento;
}): OrcamentoArmazenado {
  return {
    numero: dados.numero,
    solicitanteUid: dados.solicitanteUid,
    comPreco: dados.comPreco,
    criadoEm: dados.criadoEm,
    expiraEm: dados.expiraEm,
    pdfPath: dados.pdfPath,
    conteudo: encryptProfilePayload(dados.conteudo as unknown as Record<string, unknown>),
  };
}

const CONTEUDO_VAZIO: ConteudoOrcamento = {
  cliente: { cliente: '', documento: '', endereco: '', contato: '', email: '' },
  itens: [],
  totalCents: 0,
  pdfUrl: null,
  solicitanteEmail: null,
};

/**
 * Lê o conteúdo de um documento do Firestore.
 *
 * Aceita também o formato antigo, em claro, dos orçamentos gravados antes da
 * criptografia; e devolve o conteúdo vazio se a decifragem falhar, para uma
 * chave trocada não derrubar a lista inteira.
 */
export function lerConteudo(dados: Record<string, unknown> | undefined): ConteudoOrcamento {
  if (!dados) return CONTEUDO_VAZIO;

  const blob = dados.conteudo as EncryptedBlob | undefined;
  if (blob && typeof blob === 'object' && 'ciphertext' in blob) {
    try {
      return { ...CONTEUDO_VAZIO, ...decryptProfilePayload<ConteudoOrcamento>(blob) };
    } catch {
      return CONTEUDO_VAZIO;
    }
  }

  // Formato antigo: campos soltos em claro.
  return {
    cliente: {
      cliente: String((dados.cliente as ClienteRegistrado)?.cliente ?? ''),
      documento: String((dados.cliente as ClienteRegistrado)?.documento ?? ''),
      endereco: String((dados.cliente as ClienteRegistrado)?.endereco ?? ''),
      contato: String((dados.cliente as ClienteRegistrado)?.contato ?? ''),
      email: String((dados.cliente as ClienteRegistrado)?.email ?? ''),
    },
    itens: Array.isArray(dados.itens) ? (dados.itens as ItemRegistrado[]) : [],
    totalCents: typeof dados.totalCents === 'number' ? dados.totalCents : 0,
    pdfUrl: typeof dados.pdfUrl === 'string' ? dados.pdfUrl : null,
    solicitanteEmail: typeof dados.solicitanteEmail === 'string' ? dados.solicitanteEmail : null,
  };
}

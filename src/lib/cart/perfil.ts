/**
 * Dados do formulário de orçamento, e como o cadastro os preenche.
 *
 * O formulário guarda nome do responsável e telefone separados, porque é mais
 * fácil de digitar e de validar. O documento final junta os dois numa linha
 * só, como no modelo da empresa:
 *
 *     Contato / Responsável:  Dani Rodrigues (49) 98875-3319
 *
 * Em pessoa física não há responsável: o nome já está no campo Cliente, então
 * o contato é só o telefone.
 */

export type TipoDocumento = 'cpf' | 'cnpj';

/** Campos do cadastro que interessam ao orçamento. */
export type PerfilDaConta = {
  fullName?: string;
  phone?: string;
  documentType?: string;
  document?: string;
  /** CNPJ da instituição, campo opcional do cadastro. */
  cnpj?: string;
  city?: string;
  educationInstitution?: string;
  email?: string;
};

/** O que o formulário da gaveta mantém enquanto é preenchido. */
export type DadosFormulario = {
  cliente: string;
  documento: string;
  endereco: string;
  /** Só usado no modo instituição. */
  contatoNome: string;
  contatoTelefone: string;
  email: string;
};

export const FORMULARIO_VAZIO: DadosFormulario = {
  cliente: '',
  documento: '',
  endereco: '',
  contatoNome: '',
  contatoTelefone: '',
  email: '',
};

/** Monta a linha "Contato / Responsável" do orçamento. */
export function formatarContato(dados: DadosFormulario, tipo: TipoDocumento): string {
  const nome = dados.contatoNome.trim();
  const telefone = dados.contatoTelefone.trim();
  if (tipo === 'cnpj') return [nome, telefone].filter(Boolean).join(' ');
  return telefone;
}

export function dadosDoPerfil(perfil: PerfilDaConta, tipo: TipoDocumento): DadosFormulario {
  const nome = perfil.fullName?.trim() ?? '';
  // O documento principal só serve se for do tipo pedido. No modo instituição
  // vale primeiro o campo de CNPJ do cadastro, que existe justamente para
  // quem tem CPF próprio e compra em nome de uma instituição.
  const principal = perfil.documentType === tipo ? (perfil.document?.trim() ?? '') : '';
  const documento = tipo === 'cnpj' ? perfil.cnpj?.trim() || principal : principal;

  return {
    cliente: tipo === 'cnpj' ? perfil.educationInstitution?.trim() || nome : nome,
    documento,
    // O cadastro guarda só a cidade; o resto do endereço fica para o visitante.
    endereco: perfil.city?.trim() ?? '',
    contatoNome: nome,
    contatoTelefone: perfil.phone?.trim() ?? '',
    email: perfil.email?.trim() ?? '',
  };
}

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';

/**
 * Monta o PDF do orçamento com o mesmo desenho do modelo da empresa:
 * cabeçalho azul, dados do cliente, tabela de itens com miniatura, condições
 * e responsável.
 *
 * Quem não tem acesso a preço recebe o mesmo documento sem as colunas de
 * valor — a decisão é do servidor, nunca do navegador.
 */

// Cores do modelo (tema azul do Word usado no orçamento original).
const AZUL_ESCURO = rgb(0.12, 0.22, 0.39);
const AZUL_TEXTO = rgb(0.12, 0.31, 0.47);
const CINZA_BLOCO = rgb(0.85, 0.85, 0.85);
const AZUL_CLARO = rgb(0.87, 0.92, 0.96);
const BORDA = rgb(0.72, 0.76, 0.82);
const TEXTO = rgb(0.1, 0.1, 0.1);
const BRANCO = rgb(1, 1, 1);

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;
const LARGURA_UTIL = A4.largura - MARGEM * 2;

export const EMPRESA = {
  nome: 'FORMWERK',
  subtitulo: 'Materiais Educacionais Lúdicos',
  cnpj: '63.806.709/0001-07',
  endereco: 'Av. Castelo Branco, nº170, Bairro Universitário MIDILages/Sala 13',
  cidade: 'Lages / SC — CEP: 88509-900',
  telefone: '(49) 99915-9142',
  site: 'https://formwerk.com.br',
};

const CONDICOES: Array<[string, string]> = [
  ['Prazo de execução / entrega:', '40 dias corridos após confirmação do 1º pagamento'],
  ['Frete:', 'Entrega gratuita'],
  ['Validade do orçamento:', '30 dias a partir da data de emissão'],
  ['Forma de pagamento:', 'A combinar'],
];

export type QuoteCustomer = {
  cliente: string;
  documento: string;
  endereco: string;
  contato: string;
  email: string;
};

export type QuoteItem = {
  descricao: string;
  quantidade: number;
  unidade: string;
  /** Ausente quando o pedido vem de quem não enxerga preço. */
  precoUnitarioCents?: number;
  imagem?: Uint8Array;
};

export type QuoteData = {
  numero: string;
  emitidoEm: Date;
  cliente: QuoteCustomer;
  itens: QuoteItem[];
  mostrarPrecos: boolean;
  logo?: Uint8Array;
};

function formatarMoeda(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatarData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Helvetica só aceita WinAnsi. Caracteres fora disso (emoji, aspas curvas de
 * fontes exóticas) derrubariam a geração, então viram equivalentes simples.
 */
function limparTexto(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/[^\x00-\xff]/g, '');
}

/** Quebra o texto na largura disponível, devolvendo as linhas. */
function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = limparTexto(texto).split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
      atual = tentativa;
    } else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

type Fontes = { regular: PDFFont; negrito: PDFFont };

function escrever(
  page: PDFPage,
  texto: string,
  x: number,
  y: number,
  fonte: PDFFont,
  tamanho: number,
  cor = TEXTO,
) {
  page.drawText(limparTexto(texto), { x, y, size: tamanho, font: fonte, color: cor });
}

function desenharCabecalho(page: PDFPage, fontes: Fontes, dados: QuoteData, logo?: PDFImage) {
  let y = A4.altura - MARGEM;

  if (logo) {
    const alturaLogo = 34;
    const escala = alturaLogo / logo.height;
    page.drawImage(logo, {
      x: MARGEM,
      y: y - alturaLogo,
      width: logo.width * escala,
      height: alturaLogo,
    });
  }

  y -= 64;

  const alturaFaixa = 86;
  const larguraDireita = 170;
  const larguraEsquerda = LARGURA_UTIL - larguraDireita;

  page.drawRectangle({
    x: MARGEM,
    y: y - alturaFaixa,
    width: larguraEsquerda,
    height: alturaFaixa,
    color: AZUL_ESCURO,
  });
  page.drawRectangle({
    x: MARGEM + larguraEsquerda,
    y: y - alturaFaixa,
    width: larguraDireita,
    height: alturaFaixa,
    color: CINZA_BLOCO,
  });

  escrever(page, EMPRESA.nome, MARGEM + 16, y - 26, fontes.negrito, 20, BRANCO);
  escrever(page, EMPRESA.subtitulo, MARGEM + 16, y - 40, fontes.regular, 7.5, BRANCO);
  escrever(page, `CNPJ: ${EMPRESA.cnpj}`, MARGEM + 16, y - 52, fontes.regular, 7, BRANCO);
  escrever(page, EMPRESA.endereco, MARGEM + 16, y - 62, fontes.regular, 7, BRANCO);
  escrever(page, EMPRESA.cidade, MARGEM + 16, y - 72, fontes.regular, 7, BRANCO);
  escrever(page, EMPRESA.telefone, MARGEM + 16, y - 82, fontes.regular, 7, BRANCO);

  const centroDireita = MARGEM + larguraEsquerda + larguraDireita / 2;
  const titulo = 'ORÇAMENTO';
  const larguraTitulo = fontes.negrito.widthOfTextAtSize(titulo, 15);
  escrever(page, titulo, centroDireita - larguraTitulo / 2, y - 28, fontes.negrito, 15, AZUL_TEXTO);

  const linhasDireita: Array<[string, PDFFont]> = [
    ['Data de emissão:', fontes.negrito],
    [formatarData(dados.emitidoEm), fontes.regular],
    ['Válido por 30 dias', fontes.regular],
  ];
  let yDireita = y - 48;
  for (const [texto, fonte] of linhasDireita) {
    const larguraTexto = fonte.widthOfTextAtSize(limparTexto(texto), 7.5);
    escrever(page, texto, centroDireita - larguraTexto / 2, yDireita, fonte, 7.5, AZUL_TEXTO);
    yDireita -= 11;
  }

  return y - alturaFaixa - 34;
}

function desenharTituloSecao(page: PDFPage, fontes: Fontes, texto: string, y: number): number {
  escrever(page, texto, MARGEM, y, fontes.negrito, 9.5, AZUL_TEXTO);
  return y - 20;
}

function desenharDadosCliente(page: PDFPage, fontes: Fontes, cliente: QuoteCustomer, yInicial: number) {
  let y = desenharTituloSecao(page, fontes, 'DADOS DO CLIENTE', yInicial);

  const larguraRotulo = 200;
  const larguraValor = LARGURA_UTIL - larguraRotulo;
  const linhas: Array<[string, string]> = [
    ['Cliente:', cliente.cliente],
    ['CNPJ / CPF:', cliente.documento],
    ['Endereço:', cliente.endereco],
    ['Contato / Responsável:', cliente.contato],
    ['E-mail:', cliente.email],
  ];

  for (const [rotulo, valor] of linhas) {
    const linhasValor = quebrarLinhas(valor || '', fontes.regular, 8, larguraValor - 16);
    const altura = Math.max(22, 10 + linhasValor.length * 11);

    page.drawRectangle({
      x: MARGEM,
      y: y - altura,
      width: larguraRotulo,
      height: altura,
      color: AZUL_CLARO,
      borderColor: BORDA,
      borderWidth: 0.5,
    });
    page.drawRectangle({
      x: MARGEM + larguraRotulo,
      y: y - altura,
      width: larguraValor,
      height: altura,
      borderColor: BORDA,
      borderWidth: 0.5,
    });

    escrever(page, rotulo, MARGEM + 10, y - 14, fontes.negrito, 8, AZUL_TEXTO);
    let yValor = y - 14;
    for (const linha of linhasValor) {
      escrever(page, linha, MARGEM + larguraRotulo + 8, yValor, fontes.regular, 8);
      yValor -= 11;
    }

    y -= altura;
  }

  return y - 30;
}

/** Colunas da tabela de itens, que mudam conforme o acesso a preço. */
function colunas(mostrarPrecos: boolean) {
  const imagem = 92;
  const num = 32;
  const unidade = 44;
  if (!mostrarPrecos) {
    return {
      num,
      descricao: LARGURA_UTIL - num - unidade - imagem,
      unidade,
      unitario: 0,
      total: 0,
      imagem,
    };
  }
  const unitario = 70;
  const total = 70;
  return {
    num,
    descricao: LARGURA_UTIL - num - unidade - unitario - total - imagem,
    unidade,
    unitario,
    total,
    imagem,
  };
}

function desenharCabecalhoTabela(page: PDFPage, fontes: Fontes, y: number, mostrarPrecos: boolean) {
  const col = colunas(mostrarPrecos);
  const altura = 20;

  page.drawRectangle({
    x: MARGEM,
    y: y - altura,
    width: LARGURA_UTIL,
    height: altura,
    color: AZUL_ESCURO,
  });

  const titulos: Array<[string, number, number]> = [
    ['Nº', MARGEM, col.num],
    ['Descrição do Item', MARGEM + col.num, col.descricao],
    ['Un.', MARGEM + col.num + col.descricao, col.unidade],
  ];
  if (mostrarPrecos) {
    titulos.push(
      ['R$ Unitário', MARGEM + col.num + col.descricao + col.unidade, col.unitario],
      ['R$ Total', MARGEM + col.num + col.descricao + col.unidade + col.unitario, col.total],
    );
  }

  for (const [texto, x, largura] of titulos) {
    const larguraTexto = fontes.negrito.widthOfTextAtSize(limparTexto(texto), 7.5);
    escrever(page, texto, x + (largura - larguraTexto) / 2, y - 13, fontes.negrito, 7.5, BRANCO);
  }

  return y - altura;
}

export async function buildQuotePdf(dados: QuoteData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Orçamento ${dados.numero} - FORMWERK`);
  pdf.setProducer('formwerk.com.br');

  const fontes: Fontes = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  let logo: PDFImage | undefined;
  if (dados.logo) {
    try {
      logo = await pdf.embedPng(dados.logo);
    } catch {
      logo = undefined;
    }
  }

  let page = pdf.addPage([A4.largura, A4.altura]);
  let y = desenharCabecalho(page, fontes, dados, logo);
  y = desenharDadosCliente(page, fontes, dados.cliente, y);

  y = desenharTituloSecao(page, fontes, 'ITENS DO ORÇAMENTO', y);
  y = desenharCabecalhoTabela(page, fontes, y, dados.mostrarPrecos);

  const col = colunas(dados.mostrarPrecos);
  let subtotalCents = 0;

  for (let i = 0; i < dados.itens.length; i++) {
    const item = dados.itens[i];
    const linhasDescricao = quebrarLinhas(item.descricao, fontes.regular, 8, col.descricao - 16);
    const altura = Math.max(62, 24 + linhasDescricao.length * 11);

    // Página nova quando não cabe mais uma linha inteira.
    if (y - altura < MARGEM + 90) {
      page = pdf.addPage([A4.largura, A4.altura]);
      y = A4.altura - MARGEM;
      y = desenharCabecalhoTabela(page, fontes, y, dados.mostrarPrecos);
    }

    page.drawRectangle({
      x: MARGEM,
      y: y - altura,
      width: LARGURA_UTIL,
      height: altura,
      borderColor: BORDA,
      borderWidth: 0.5,
    });

    const centroY = y - altura / 2;
    const numero = String(i + 1).padStart(2, '0');
    const larguraNum = fontes.regular.widthOfTextAtSize(numero, 8);
    escrever(page, numero, MARGEM + (col.num - larguraNum) / 2, centroY - 3, fontes.regular, 8);

    let yDescricao = centroY + ((linhasDescricao.length - 1) * 11) / 2 - 3;
    for (const linha of linhasDescricao) {
      escrever(page, linha, MARGEM + col.num + 8, yDescricao, fontes.regular, 8);
      yDescricao -= 11;
    }

    const xUnidade = MARGEM + col.num + col.descricao;
    const qtd = String(item.quantidade);
    const larguraQtd = fontes.regular.widthOfTextAtSize(qtd, 8);
    const larguraUn = fontes.regular.widthOfTextAtSize(item.unidade, 8);
    escrever(page, qtd, xUnidade + (col.unidade - larguraQtd) / 2, centroY + 3, fontes.regular, 8);
    escrever(page, item.unidade, xUnidade + (col.unidade - larguraUn) / 2, centroY - 8, fontes.regular, 8);

    if (dados.mostrarPrecos && typeof item.precoUnitarioCents === 'number') {
      const totalItem = item.precoUnitarioCents * item.quantidade;
      subtotalCents += totalItem;

      const xUnitario = xUnidade + col.unidade;
      const xTotal = xUnitario + col.unitario;
      const unitarioTexto = formatarMoeda(item.precoUnitarioCents);
      const totalTexto = formatarMoeda(totalItem);
      const larguraUnitario = fontes.regular.widthOfTextAtSize(unitarioTexto, 8);
      const larguraTotal = fontes.regular.widthOfTextAtSize(totalTexto, 8);
      escrever(page, unitarioTexto, xUnitario + (col.unitario - larguraUnitario) / 2, centroY - 3, fontes.regular, 8);
      escrever(page, totalTexto, xTotal + (col.total - larguraTotal) / 2, centroY - 3, fontes.regular, 8);
    }

    if (item.imagem) {
      try {
        const img = await pdf.embedJpg(item.imagem);
        const caixa = { largura: col.imagem - 12, altura: altura - 12 };
        const escala = Math.min(caixa.largura / img.width, caixa.altura / img.height);
        const largura = img.width * escala;
        const alturaImg = img.height * escala;
        page.drawImage(img, {
          x: A4.largura - MARGEM - col.imagem + (col.imagem - largura) / 2,
          y: y - altura + (altura - alturaImg) / 2,
          width: largura,
          height: alturaImg,
        });
      } catch {
        // Imagem corrompida ou fora do padrão: a linha sai sem miniatura.
      }
    }

    y -= altura;
  }

  // Rodapé da tabela: subtotal e total.
  const alturaTotal = 20;
  for (const [rotulo, valor] of dados.mostrarPrecos
    ? ([
        ['SUBTOTAL', formatarMoeda(subtotalCents)],
        ['TOTAL FINAL', formatarMoeda(subtotalCents)],
      ] as Array<[string, string]>)
    : []) {
    if (y - alturaTotal < MARGEM + 60) {
      page = pdf.addPage([A4.largura, A4.altura]);
      y = A4.altura - MARGEM;
    }
    page.drawRectangle({
      x: MARGEM,
      y: y - alturaTotal,
      width: LARGURA_UTIL,
      height: alturaTotal,
      color: CINZA_BLOCO,
      borderColor: BORDA,
      borderWidth: 0.5,
    });
    const xRotulo = MARGEM + col.num + col.descricao + col.unidade;
    escrever(page, rotulo, xRotulo, y - 13, fontes.negrito, 8, AZUL_TEXTO);
    escrever(page, valor, xRotulo + col.unitario, y - 13, fontes.negrito, 8, AZUL_TEXTO);
    y -= alturaTotal;
  }

  y -= 34;

  // Condições e responsável, na mesma página se couber.
  if (y < MARGEM + 200) {
    page = pdf.addPage([A4.largura, A4.altura]);
    y = A4.altura - MARGEM;
  }

  y = desenharTituloSecao(page, fontes, 'PRAZO DE ENTREGA E CONDIÇÕES', y);
  const larguraRotulo = 200;
  for (const [rotulo, valor] of CONDICOES) {
    const linhasValor = quebrarLinhas(valor, fontes.regular, 8, LARGURA_UTIL - larguraRotulo - 16);
    const altura = Math.max(22, 10 + linhasValor.length * 11);
    page.drawRectangle({
      x: MARGEM,
      y: y - altura,
      width: larguraRotulo,
      height: altura,
      color: AZUL_CLARO,
      borderColor: BORDA,
      borderWidth: 0.5,
    });
    page.drawRectangle({
      x: MARGEM + larguraRotulo,
      y: y - altura,
      width: LARGURA_UTIL - larguraRotulo,
      height: altura,
      borderColor: BORDA,
      borderWidth: 0.5,
    });
    escrever(page, rotulo, MARGEM + 10, y - 14, fontes.negrito, 8, AZUL_TEXTO);
    let yValor = y - 14;
    for (const linha of linhasValor) {
      escrever(page, linha, MARGEM + larguraRotulo + 8, yValor, fontes.regular, 8);
      yValor -= 11;
    }
    y -= altura;
  }

  y -= 40;
  y = desenharTituloSecao(page, fontes, 'ORÇAMENTO GERADO PELO SISTEMA', y);
  escrever(page, EMPRESA.site, MARGEM, y, fontes.regular, 8, AZUL_TEXTO);

  // Rodapé legal em todas as páginas.
  const paginas = pdf.getPages();
  for (const p of paginas) {
    const linha1 = `${EMPRESA.nome} | CNPJ: ${EMPRESA.cnpj} | ${EMPRESA.telefone} | LAGES/SC`;
    const linha2 = 'Este documento é um orçamento sem valor fiscal.';
    const l1 = fontes.regular.widthOfTextAtSize(limparTexto(linha1), 7);
    const l2 = fontes.regular.widthOfTextAtSize(limparTexto(linha2), 7);
    escrever(p, linha1, (A4.largura - l1) / 2, MARGEM - 18, fontes.regular, 7, AZUL_TEXTO);
    escrever(p, linha2, (A4.largura - l2) / 2, MARGEM - 28, fontes.regular, 7, TEXTO);
  }

  return pdf.save();
}

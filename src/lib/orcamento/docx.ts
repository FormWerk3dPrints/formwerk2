import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { EMPRESA, type QuoteCustomer, type QuoteItem } from './pdf';

/**
 * Mesma informação do PDF, em Word editável.
 *
 * Existe para o caso de um orçamento pedido por quem não enxerga preço: o
 * documento sai com as colunas de valor em branco, para serem preenchidas à
 * mão antes de mandar ao cliente. Quando o pedido já tinha preço, elas vêm
 * preenchidas.
 */

const AZUL = '1F3864';
const AZUL_TEXTO = '1F4E79';
const AZUL_CLARO = 'DEEAF6';
const CINZA = 'D9D9D9';

export type QuoteDocxData = {
  numero: string;
  emitidoEm: Date;
  cliente: QuoteCustomer;
  itens: QuoteItem[];
  /** Falso deixa R$ Unitário e R$ Total em branco, para preencher no Word. */
  mostrarPrecos: boolean;
};

function moeda(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function celula(opcoes: {
  texto?: string;
  negrito?: boolean;
  cor?: string;
  fundo?: string;
  largura?: number;
  centralizado?: boolean;
  imagem?: Uint8Array;
}): TableCell {
  const { texto = '', negrito, cor, fundo, largura, centralizado, imagem } = opcoes;

  const conteudo = imagem
    ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: imagem,
              transformation: { width: 70, height: 70 },
              type: 'jpg',
            }),
          ],
        }),
      ]
    : [
        new Paragraph({
          alignment: centralizado ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text: texto, bold: negrito, color: cor, size: 18 })],
        }),
      ];

  return new TableCell({
    children: conteudo,
    shading: fundo ? { fill: fundo } : undefined,
    width: largura ? { size: largura, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

function tituloSecao(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text: texto, bold: true, color: AZUL_TEXTO, size: 20 })],
  });
}

export async function buildQuoteDocx(dados: QuoteDocxData): Promise<Buffer> {
  const larguraTotal = { size: 100, type: WidthType.PERCENTAGE };

  const cabecalho = new Table({
    width: larguraTotal,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: AZUL },
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { top: 160, bottom: 160, left: 200, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: EMPRESA.nome, bold: true, color: 'FFFFFF', size: 36 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: EMPRESA.subtitulo, color: 'FFFFFF', size: 16 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `CNPJ: ${EMPRESA.cnpj}`, color: 'FFFFFF', size: 14 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: EMPRESA.endereco, color: 'FFFFFF', size: 14 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: EMPRESA.cidade, color: 'FFFFFF', size: 14 })],
              }),
              new Paragraph({
                children: [new TextRun({ text: EMPRESA.telefone, color: 'FFFFFF', size: 14 })],
              }),
            ],
          }),
          new TableCell({
            shading: { fill: CINZA },
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { top: 160, bottom: 160, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'ORÇAMENTO', bold: true, color: AZUL_TEXTO, size: 28 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Data de emissão:', bold: true, color: AZUL_TEXTO, size: 15 })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: dados.emitidoEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                    color: AZUL_TEXTO,
                    size: 15,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'Válido por 30 dias', color: AZUL_TEXTO, size: 15 })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const dadosCliente = new Table({
    width: larguraTotal,
    rows: (
      [
        ['Cliente:', dados.cliente.cliente],
        ['CNPJ / CPF:', dados.cliente.documento],
        ['Endereço:', dados.cliente.endereco],
        ['Contato / Responsável:', dados.cliente.contato],
        ['E-mail:', dados.cliente.email],
      ] as Array<[string, string]>
    ).map(
      ([rotulo, valor]) =>
        new TableRow({
          children: [
            celula({ texto: rotulo, negrito: true, cor: AZUL_TEXTO, fundo: AZUL_CLARO, largura: 35 }),
            celula({ texto: valor || '', largura: 65 }),
          ],
        }),
    ),
  });

  const colunas = ['Nº', 'Descrição do Item', 'Un.', 'R$ Unitário', 'R$ Total', ''];
  const linhasItens = [
    new TableRow({
      tableHeader: true,
      children: colunas.map((titulo, i) =>
        celula({
          texto: titulo,
          negrito: true,
          cor: 'FFFFFF',
          fundo: AZUL,
          centralizado: true,
          largura: [6, 44, 10, 14, 14, 12][i],
        }),
      ),
    }),
  ];

  let subtotal = 0;
  dados.itens.forEach((item, i) => {
    const temPreco = dados.mostrarPrecos && typeof item.precoUnitarioCents === 'number';
    const total = temPreco ? (item.precoUnitarioCents as number) * item.quantidade : 0;
    subtotal += total;

    linhasItens.push(
      new TableRow({
        children: [
          celula({ texto: String(i + 1).padStart(2, '0'), centralizado: true }),
          celula({ texto: item.descricao }),
          celula({ texto: `${item.quantidade} ${item.unidade}`, centralizado: true }),
          celula({ texto: temPreco ? moeda(item.precoUnitarioCents as number) : '', centralizado: true }),
          celula({ texto: temPreco ? moeda(total) : '', centralizado: true }),
          celula({ imagem: item.imagem, centralizado: true }),
        ],
      }),
    );
  });

  for (const rotulo of ['SUBTOTAL', 'TOTAL FINAL']) {
    linhasItens.push(
      new TableRow({
        children: [
          celula({ fundo: CINZA }),
          celula({ fundo: CINZA }),
          celula({ texto: rotulo, negrito: true, cor: AZUL_TEXTO, fundo: CINZA, centralizado: true }),
          celula({
            texto: dados.mostrarPrecos ? moeda(subtotal) : '',
            negrito: true,
            cor: AZUL_TEXTO,
            fundo: CINZA,
            centralizado: true,
          }),
          celula({ fundo: CINZA }),
          celula({ fundo: CINZA }),
        ],
      }),
    );
  }

  const tabelaItens = new Table({ width: larguraTotal, rows: linhasItens });

  const condicoes = new Table({
    width: larguraTotal,
    rows: (
      [
        ['Prazo de execução / entrega:', '40 dias corridos após confirmação do 1º pagamento'],
        ['Frete:', 'Entrega gratuita'],
        ['Validade do orçamento:', '30 dias a partir da data de emissão'],
        ['Forma de pagamento:', 'A combinar'],
      ] as Array<[string, string]>
    ).map(
      ([rotulo, valor]) =>
        new TableRow({
          children: [
            celula({ texto: rotulo, negrito: true, cor: AZUL_TEXTO, fundo: AZUL_CLARO, largura: 35 }),
            celula({ texto: valor, largura: 65 }),
          ],
        }),
    ),
  });

  const doc = new Document({
    creator: 'FORMWERK',
    title: `Orçamento ${dados.numero}`,
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 200 },
            children: [new TextRun({ text: `Orçamento ${dados.numero}`, bold: true, color: AZUL_TEXTO, size: 24 })],
          }),
          cabecalho,
          tituloSecao('DADOS DO CLIENTE'),
          dadosCliente,
          tituloSecao('ITENS DO ORÇAMENTO'),
          tabelaItens,
          ...(dados.mostrarPrecos
            ? []
            : [
                new Paragraph({
                  spacing: { before: 160 },
                  children: [
                    new TextRun({
                      text: 'Este pedido veio de um visitante sem acesso a preço: preencha R$ Unitário, R$ Total e os totais antes de enviar.',
                      italics: true,
                      color: '9C5700',
                      size: 16,
                    }),
                  ],
                }),
              ]),
          tituloSecao('PRAZO DE ENTREGA E CONDIÇÕES'),
          condicoes,
          // Sem preço, o documento vai ser completado e assinado à mão: entra
          // uma linha para o nome de quem fechou o orçamento, no lugar da
          // assinatura automática do sistema.
          ...(dados.mostrarPrecos
            ? [
                tituloSecao('ORÇAMENTO GERADO PELO SISTEMA'),
                new Paragraph({
                  children: [new TextRun({ text: EMPRESA.site, color: AZUL_TEXTO, size: 16 })],
                }),
              ]
            : [
                tituloSecao('RESPONSÁVEL PELO ORÇAMENTO'),
                new Paragraph({
                  children: [new TextRun({ text: 'XXXXXXXXX', size: 16 })],
                }),
              ]),
          new Paragraph({
            spacing: { before: 400 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: CINZA } },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${EMPRESA.nome} | CNPJ: ${EMPRESA.cnpj} | ${EMPRESA.telefone} | LAGES/SC`,
                color: AZUL_TEXTO,
                size: 14,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Este documento é um orçamento sem valor fiscal.', size: 14 }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

# Formwerk — Design System

Referência técnica dos tokens e componentes definidos em [`src/app/globals.css`](../src/app/globals.css). Extraído do padrão visual já em uso no site (ver auditoria abaixo) e formalizado como tokens do Tailwind v4 (`@theme inline`), para substituir aos poucos os estilos inline/duplicados espalhados pelas páginas.

## Cor de marca

O azul `#0D6AA7` era usado como `style={{ backgroundColor: '#0D6AA7' }}` inline em ~16 arquivos (Header, CTAs, ícones). Agora é um token: `--color-brand` (alias de `--color-brand-600`), com escala completa 50–950 para tints/shades.

| Token | Classe Tailwind | Hex |
|---|---|---|
| `--color-brand-50` | `bg-brand-50` / `text-brand-50` | `#f1f9fe` |
| `--color-brand-100` | `bg-brand-100` | `#def0fc` |
| `--color-brand-200` | `bg-brand-200` | `#b4ddf9` |
| `--color-brand-300` | `bg-brand-300` | `#7bc4f4` |
| `--color-brand-400` | `bg-brand-400` | `#39a6ef` |
| `--color-brand-500` | `bg-brand-500` | `#1289d9` |
| `--color-brand-600` / `--color-brand` | `bg-brand` / `text-brand` / `border-brand` | `#0d6aa7` |
| `--color-brand-700` | `bg-brand-700` | `#0b5484` |
| `--color-brand-800` | `bg-brand-800` | `#084268` |
| `--color-brand-900` | `bg-brand-900` | `#073350` |
| `--color-brand-950` | `bg-brand-950` | `#042134` |

**Migração recomendada (não aplicada ainda):** trocar `style={{ backgroundColor: '#0D6AA7' }}` / `style={{ color: '#0D6AA7' }}` por `bg-brand` / `text-brand` nos arquivos listados na auditoria (Header, `page.tsx`, `assinatura`, `catalogo/*`, `kits/*`, `sobre`, `admin/kits`). Isso é puramente mecânico e pode ser feito em um passo separado.

### Neutros

Mantém a paleta `gray` padrão do Tailwind, que já era usada de forma consistente:
- Títulos: `text-gray-900` / `text-gray-800`
- Corpo: `text-gray-700` / `text-gray-600`
- Secundário/placeholder: `text-gray-500` / `text-gray-400`
- Fundos alternados de seção: `bg-gray-50` / `bg-gray-100`

### Semânticas (novo)

Formaliza o uso disperso de green/amber/red em estados de formulário/admin:

| Papel | Token | Hex | Uso |
|---|---|---|---|
| Sucesso | `--color-success-50/500/600/700` | `#ecfdf5` / `#10b981` / `#059669` / `#047857` | confirmações, badges de status ativo |
| Aviso | `--color-warning-50/500/600/700` | `#fffbeb` / `#f59e0b` / `#d97706` / `#b45309` | alertas, estados pendentes |
| Erro | `--color-error-50/500/600/700` | `#fef2f2` / `#ef4444` / `#dc2626` / `#b91c1c` | erros de validação, exclusão |

## Tipografia

**Correção aplicada:** `Geologica` era carregada em `layout.tsx` só com `weight: ["700"]`, mas `globals.css` definia `font-weight: 100` no `body` — uma contradição (a variação 100 nunca foi carregada, então o navegador tinha que sintetizar ou cair para uma fonte substituta). Geologica é uma fonte variável (suporta 100–900 + eixos `slnt`/`CRSV`/`SHRP`), então:

- `layout.tsx`: `Geologica({ variable: "--font-geologica", subsets: ["latin"] })` — sem `weight` fixo, carrega o range variável completo.

### Uma família só: Geologica

O site usa **Geologica em tudo** — hero, H1, H2, card title, corpo e UI. Já é a fonte padrão do `body` (`globals.css`), então nenhum elemento precisa de classe extra para herdá-la.

- **Poppins e BBB Poppins TN foram avaliadas como fonte secundária e descartadas** (não aprovadas para uso) — não usar nenhuma das duas em nenhum lugar do site ou do design system.
- A classe `font-display` que existiu brevemente (para separar headings de corpo) foi removida — era redundante com uma família só.

`text-sm` é o tamanho mais usado no site inteiro (UI densa de cards/forms) — não é um erro, é o padrão de fato.

## Espaçamento & Layout

Não virou token CSS novo (o scale padrão do Tailwind já resolve), mas documentando a convenção observada para manter consistência daqui pra frente:

- **Container**: `container mx-auto px-4`. Largura de conteúdo varia hoje entre `max-w-2xl` (texto/CTA), `max-w-4xl` (conteúdo misto) e `max-w-6xl` (grids de produto) — escolher conforme o tipo de seção, não misturar arbitrariamente.
- **Ritmo vertical de seção**: `py-12` ou `py-16`.
- **Padding de card**: `p-4` a `p-6`.
- **Gap**: `gap-2`/`gap-4` em listas/flex; `gap-6`/`gap-8` em grids de cards.

## Bordas & Sombras

Convenção observada e agora reforçada pelos componentes abaixo:
- **Cards e botões** → `rounded-lg`
- **Avatares/badges circulares** → `rounded-full`
- **Elementos "premium"/destaque maior** → `rounded-xl` / `rounded-2xl` (ocasional, não padrão)
- **Cards interativos** → `shadow-lg` em repouso, `shadow-xl` no hover, com `transition-shadow`

> Pendência conhecida: `admin/emissao/page.tsx` usa `rounded-md` + `bg-black` num botão, destoando do resto (`rounded-lg` + `bg-brand`). Vale alinhar num passo futuro.

## Componentes utilitários (`@layer components`)

Novas classes em `globals.css`, formalizando os padrões que antes eram copiados manualmente em cada página:

```html
<!-- CTA primário — antes: className="... rounded-lg ..." + style={{backgroundColor:'#0D6AA7'}} -->
<a class="btn-primary">Fale Conosco</a>

<!-- CTA secundário outline -->
<button class="btn-outline">Ver Detalhes</button>

<!-- CTA neutro -->
<button class="btn-secondary">Cancelar</button>

<!-- Card com hover padrão do site -->
<div class="card">...</div>

<!-- Badges de status semântico -->
<span class="badge-success">Ativo</span>
<span class="badge-warning">Pendente</span>
<span class="badge-error">Erro</span>
```

Essas classes já incluem o efeito de hover-scale que antes vinha de `.btn-hover-expand`/`.card-hover-expand` (mantidas como estão, para não quebrar usos existentes — só não são mais reaproveitadas via `@apply` porque o Tailwind v4 não permite `@apply` de uma classe de `@layer components` dentro de outra).

## O que ainda não foi migrado

Os tokens e componentes estão prontos para uso, mas o código existente **não foi reescrito automaticamente** — isso evita um diff gigante e risco de regressão em páginas que eu não testei visualmente uma a uma. Próximo passo natural, se quiser: trocar gradualmente `style={{ backgroundColor: '#0D6AA7' }}` por `bg-brand`, e os botões/cards copiados à mão pelas novas classes `.btn-primary`/`.card`, página por página.

# Firebase

Para conectar o projeto ao Firebase (Auth/Firestore/Storage), crie um arquivo `.env.local` na raiz usando como base o `.env.local.example`.

Os valores ficam em: Firebase Console → Project settings → Your apps → (Web app) → Firebase SDK snippet (Config).

# FORMWERK - Portfólio de Materiais Educacionais 3D

Site de portfólio para a FORMWERK, empresa especializada em criar materiais educacionais personalizados através de impressão 3D.

## 🎯 Características

- **Landing Page**: Apresentação da empresa, missão e diferenciais
- **Categorias de Produtos**: 5 categorias com cores visuais distintas:
  - Matemática (#116CA8)
  - Línguas (#E3423A)
  - Ciências da Natureza (#409337)
  - Ciências Humanas (#F6B22B)
  - Materiais Diversos (#8C52FF)

- **Cards de Produtos**: Exibição de produtos com:
  - Imagem em destaque
  - Nome e descrição
  - Preço
  - Links para detalhes

- **Página de Detalhes**: Com:
  - Carrossel de fotos/imagens
  - Informações completas do produto
  - Botões de contato (WhatsApp e Telefone)
  - Navegação intuitiva

- **API Routes**: Utiliza API Routes do Next.js com dados em JSON local
- **Header e Footer**: Presentes em todas as páginas
  - Header: Logo FORMWERK e menu de navegação
  - Footer: Contato (telefone, WhatsApp e email)

## 🛠️ Tecnologias

- **Next.js 16** - Framework React para produção
- **React 19** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Framework de CSS utilitário
- **Next.js App Router** - Roteamento moderno

## 📦 Instalação

```bash
# Clonar o repositório
git clone <seu-repositorio>
cd formwerk2

# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar versão de produção
npm start
```

## 📂 Estrutura do Projeto

```
src/
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Landing Page
│   ├── categorias/
│   │   └── page.tsx        # Página de Categorias
│   ├── products/
│   │   └── [id]/
│   │       └── page.tsx    # Página de Detalhes do Produto
│   └── api/
│       └── products/
│           └── route.ts    # API Route para produtos
├── components/
│   ├── Header.tsx          # Componente Header
│   ├── Footer.tsx          # Componente Footer
│   └── ProductCard.tsx     # Card de Produto
└── data/
    └── products.json       # Dados dos produtos
```

## 🎨 Cores da Marca

- Primária: #0D6AA7
- Matemática: #116CA8
- Línguas: #E3423A
- Ciências da Natureza: #409337
- Ciências Humanas: #F6B22B
- Materiais Diversos: #8C52FF

## 📞 Contato

- **Telefone**: (11) 3333-4444
- **WhatsApp**: (11) 99999-8888
- **Email**: contato@formwerk.com.br

## 📝 Adicionar Novos Produtos

Para adicionar novos produtos, edite o arquivo `src/data/products.json` e adicione um novo objeto com a seguinte estrutura:

```json
{
  "id": 12,
  "categoryId": "matematica",
  "name": "Nome do Produto",
  "description": "Descrição do produto",
  "price": "R$ XXX,XX",
  "images": [
    "https://url-da-imagem-1",
    "https://url-da-imagem-2"
  ]
}
```

## 🚀 Deploy

O projeto está pronto para ser deployado em plataformas como:
- Vercel (recomendado para Next.js)
- Netlify
- AWS Amplify
- Docker

## 📄 Licença

© 2024 FORMWERK. Todos os direitos reservados.

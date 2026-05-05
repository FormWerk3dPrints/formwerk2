# FORMWERK

Site institucional e catálogo de produtos da **FORMWERK**, empresa especializada em materiais educacionais personalizados através de impressão 3D.

🌐 **[formwerk.com.br](https://formwerk.com.br)**

## Tecnologias

- **Next.js 16** (App Router + Turbopack)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Firebase** (Firestore, Storage, Auth)
- **Three.js** (animações 3D)
- **Vercel** (deploy)

## Configuração

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Firebase

Crie `.env.local` na raiz com as credenciais do Firebase:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin SDK (somente servidor)
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Proteção LGPD de dados pessoais (somente servidor)
USER_PROFILE_ENCRYPTION_SECRET=uma-chave-longa-e-forte
USER_PROFILE_HASH_SECRET=um-segredo-dedicado-para-hash
```

> Valores em: Firebase Console → Project settings → Your apps → Web app → Config

### 3. Executar

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm start        # rodar build
```

### 4. Publicar regras de segurança (Firestore + Storage)

Arquivos versionados no projeto:

- `firestore.rules`
- `storage.rules`
- `firebase.json`

Para aplicar no Firebase (CLI):

```bash
firebase deploy --only firestore:rules,storage
```

Observação de segurança:

- A coleção `userProfiles` fica bloqueada para acesso direto no client.
- Leitura/gravação de perfil ocorre apenas via API server-side (`/api/user-profile`) com Firebase Admin SDK.

## Estrutura

```
src/
├── app/
│   ├── page.tsx            # Landing page
│   ├── catalogo/           # Catálogo público
│   ├── sobre/              # Sobre a empresa
│   ├── products/[id]/      # Detalhes do produto
│   └── admin/              # Painel administrativo
├── components/
│   ├── Header.tsx          # Navegação (mobile hamburger)
│   ├── Footer.tsx          # Rodapé com contatos
│   ├── ProductCard.tsx     # Card de produto
│   ├── ClientsSection.tsx  # Seção de clientes (marquee)
│   └── AnimatedBackground*.tsx  # Animações 3D
└── lib/
    └── firebase/           # Config e utilitários Firebase
```

## Funcionalidades

- **Landing Page**: Top 6 produtos mais vendidos, diferenciais, clientes
- **Catálogo**: Filtro por categoria, busca, ordenação
- **Produtos**: Carrossel de imagens, detalhes, botão WhatsApp
- **Admin**: CRUD de produtos/categorias, autenticação Google
- **Minha Conta**: login com Google e cadastro de dados pessoais
- **LGPD**: dados pessoais salvos criptografados + hashes para buscas internas
- **Responsivo**: Mobile-first com menu hamburger animado

## Busca por hash (admin)

Endpoint server-side para busca exata por hash dos campos de perfil:

- `GET /api/user-profile/search?field=<campo>&value=<valor>`

Campos suportados em `field`:

- `fullName`
- `phone`
- `email`
- `city`
- `educationInstitution`
- `birthday`

Requisitos:

- Header `Authorization: Bearer <Firebase ID Token>`
- Usuário precisa estar ativo em `admins/{emailNormalizado}` com `active: true`

## Deploy

O projeto faz deploy automático na Vercel a cada push no branch `firebase`.

## Licença

© 2026 FORMWERK. Todos os direitos reservados.

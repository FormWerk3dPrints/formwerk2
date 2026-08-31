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

# Analytics (opcionais — ver seção "Analytics")
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_PROPERTY_ID=123456789
```

> Valores em: Firebase Console → Project settings → Your apps → Web app → Config

### 3. Executar

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm start        # rodar build
```

### 4. Regras de segurança (Firestore + Storage)

> **As regras não estão versionadas neste repositório.** Elas existem apenas no
> Firebase Console (Firestore Database → Rules e Storage → Rules), e é lá que
> devem ser lidas e editadas. Não há `firestore.rules`, `storage.rules` nem
> `firebase.json` no projeto — portanto `firebase deploy --only
> firestore:rules,storage` não funciona a partir daqui.

Se um dia quiser versioná-las, rode `firebase init` na raiz e copie o conteúdo
atual do console para os arquivos gerados **antes** do primeiro deploy — caso
contrário o deploy sobrescreve as regras de produção com o template padrão.

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

## Analytics

Duas peças independentes, ambas opcionais — o site funciona sem qualquer uma delas.

### Coleta no site público (gtag.js)

`src/components/GoogleAnalytics.tsx` injeta o script do GA4 nas páginas públicas.
O Measurement ID usado é, nesta ordem:

1. `NEXT_PUBLIC_GA_MEASUREMENT_ID`
2. `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (fallback — o GA4 já vinculado ao projeto Firebase)

Formato `G-XXXXXXXXXX`, obtido em Firebase Console → Project settings → Your apps,
ou em GA4 → Admin → Fluxos de dados. Se as duas estiverem vazias o componente
retorna `null` e **nenhum script de rastreamento é carregado** — o que é o
desejável em desenvolvimento local, para não poluir as métricas de produção.

### Painel `/admin/analytics` (GA4 Data API)

Lê os últimos 30 dias — usuários, pageviews, sessões, top 10 páginas e canais de
aquisição — via `src/lib/analytics/ga4.ts`, que assina um JWT com as credenciais
do **Firebase Admin SDK**. Não requer biblioteca extra nem chave própria.

Requer `GA4_PROPERTY_ID`: o **ID numérico da propriedade** (ex: `123456789`), que
não é o Measurement ID. Fica em GA4 → Admin → Configurações da propriedade.

Configuração, uma única vez:

1. Copie o ID da propriedade em [analytics.google.com](https://analytics.google.com) → Admin → Configurações da propriedade
2. Defina `GA4_PROPERTY_ID` no `.env.local` (e nas env vars da Vercel) e reinicie o servidor
3. Em GA4 → Admin → Gerenciamento de acesso à propriedade, conceda o papel **Leitor**
   ao e-mail da service account (o mesmo de `FIREBASE_ADMIN_CLIENT_EMAIL`)

O endpoint é `GET /api/admin/analytics`, protegido por `Authorization: Bearer
<Firebase ID Token>` + registro ativo em `admins/{emailNormalizado}`. Sem
`GA4_PROPERTY_ID` ou sem as credenciais do Admin SDK ele responde
`503 not-configured` e a página exibe o guia de configuração no lugar dos gráficos.

## Deploy

O projeto faz deploy automático na Vercel a cada push no branch `main`.

As variáveis do `.env.local` precisam ser replicadas em Vercel → Settings →
Environment Variables: o arquivo é ignorado pelo git e nunca chega ao deploy.

## Licença

© 2026 FORMWERK. Todos os direitos reservados.

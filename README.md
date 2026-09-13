# Crazy Chicken Ecommerce

Projeto completo de catálogo/ecommerce leve para Vercel + Supabase.

## O que já está pronto

- Loja responsiva e profissional.
- Produtos vindos do banco de dados, sem editar HTML.
- Pesquisa, categorias, ordenação e estoque.
- Carrinho salvo no navegador.
- Login e cadastro de clientes com Supabase Auth.
- Recuperação de senha.
- Área `Minha conta` com dados de entrega, favoritos e histórico de pedidos.
- Checkout que registra o pedido no banco e abre o WhatsApp com a mensagem pronta.
- Painel `/admin` protegido por autenticação + papel `admin` no banco.
- Admin pode adicionar, editar, ocultar e excluir produtos.
- Upload seguro de imagens para Supabase Storage.
- Admin visualiza clientes e pedidos, atualiza status e frete.
- Row Level Security (RLS) para separar permissões de cliente e administrador.
- Nenhum e-mail/senha de admin fica salvo no HTML/JavaScript.

---

## 1. Criar o projeto no Supabase

1. Entre em https://supabase.com e crie um projeto.
2. Abra **SQL Editor**.
3. Copie todo o conteúdo de `supabase/schema.sql` e execute.
4. Vá em **Project Settings > API**.
5. Copie:
   - Project URL
   - Publishable key (ou anon key, dependendo da interface)
6. Abra `js/config.js` e substitua:

```js
export const SUPABASE_URL = "COLE_AQUI_SUA_SUPABASE_URL";
export const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_SUA_PUBLISHABLE_KEY";
```

### Segurança importante

A Publishable/anon key é feita para uso público no navegador e fica protegida pelas políticas RLS. **Nunca** use a `service_role` no front-end.

---

## 2. Configurar autenticação

No Supabase, abra **Authentication > URL Configuration**.

Quando seu site já estiver publicado, use como **Site URL**:

```text
https://SEU-PROJETO.vercel.app
```

Adicione também como URL permitida de redirecionamento:

```text
https://SEU-PROJETO.vercel.app/login
```

Para testes locais, você pode adicionar a URL do servidor local que estiver usando.

Em **Authentication > Providers > Email**, mantenha Email/Password habilitado. Você pode optar por exigir confirmação de e-mail.

---

## 3. Criar sua conta de administrador

Não existe senha fixa no código.

1. Publique ou abra o site localmente.
2. Vá em `/login`.
3. Crie a sua conta normalmente.
4. Volte ao **SQL Editor** do Supabase e execute, trocando apenas o e-mail:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'SEU_EMAIL_AQUI'
);
```

5. Saia e entre novamente no site.
6. Acesse `/admin`.

Clientes criados normalmente recebem `role = customer` e não conseguem entrar no painel admin.

---

## 4. Publicar na Vercel

Você pode arrastar a pasta para um repositório GitHub e conectar na Vercel.

Este projeto não precisa de build. O `vercel.json` já cria as rotas:

- `/` → loja
- `/login` → login/cadastro
- `/conta` → área do cliente
- `/admin` → painel do dono

Se estiver substituindo o projeto atual, envie estes arquivos como a raiz do projeto da Vercel.

---

## 5. Cadastrar produtos

Depois de entrar como admin:

1. Abra `/admin`.
2. Preencha nome, preço, categoria, estoque e descrição.
3. Escolha uma foto.
4. Marque `Novidade`, `Destaque` ou `Ativo` se quiser.
5. Clique em **Salvar produto**.

O produto aparecerá automaticamente na loja. Não é necessário editar `index.html`.

---

## 6. Como o pedido funciona

1. O cliente adiciona produtos ao carrinho mesmo sem login.
2. Ao finalizar, o site pede login caso necessário.
3. Se faltarem dados de entrega, o cliente é enviado para `/conta`.
4. O banco valida os produtos, estoque e preços usando `create_order()`.
5. O pedido é registrado no Supabase.
6. O WhatsApp é aberto com itens, quantidades, subtotal e endereço.
7. O admin vê o pedido em `/admin` e pode atualizar status/frete.

O preço do pedido é calculado no banco, e não confiado ao valor enviado pelo navegador.

---

## 7. Arquivos principais

```text
crazy-chicken-ecommerce/
├── index.html
├── login.html
├── account.html
├── admin.html
├── vercel.json
├── css/
│   └── styles.css
├── js/
│   ├── config.js
│   ├── supabaseClient.js
│   ├── common.js
│   ├── store.js
│   ├── auth.js
│   ├── account.js
│   └── admin.js
└── supabase/
    └── schema.sql
```

---

## Antes de colocar a loja em produção

- Troque qualquer preço/produto de teste por dados reais.
- Use uma senha forte e exclusiva para a conta admin.
- Ative MFA/2FA no administrador se desejar uma camada extra.
- Confirme as regras comerciais, entrega, trocas e privacidade aplicáveis à sua loja.
- Faça um pedido de teste completo em celular e computador.


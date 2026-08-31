# Instag CRM

CRM para operações de social media: clientes, permissões por designer, calendário mensal, envio de posts únicos/carrosséis, revisão, download dos arquivos originais, legendas copiáveis e financeiro por aprovação.

## Stack de produção

- Next.js 16 (App Router) + React 19
- Supabase Auth (e-mail e senha), Postgres com RLS e Storage privado
- Vercel para build e hospedagem

## Configuração local

1. Copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os valores do projeto Supabase.
3. Execute `npm ci` e `npm run dev`.

O schema completo está em `supabase/migrations/20260831120000_inst_crm.sql` e já foi aplicado ao projeto de produção. O bucket privado `post-assets` guarda os arquivos originais; o acesso é validado pelas políticas RLS.

## Primeiro acesso

O primeiro usuário que criar conta no Supabase Auth recebe o papel de administrador por meio do trigger `handle_new_user`. Os próximos recebem o papel de designer. O administrador confirma o e-mail do designer no menu Equipe e depois atribui os clientes.

## Deploy na Vercel

Importe este repositório (`afucuhara/instag-crm`) na Vercel, configure as duas variáveis `NEXT_PUBLIC_SUPABASE_*` nos ambientes Preview e Production e faça o deploy. O `vercel.json` já define `npm ci` e `npm run build`.

Nunca coloque uma chave `service_role` no navegador ou em variáveis `NEXT_PUBLIC_*`.

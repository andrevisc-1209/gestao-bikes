# Spec original (fornecida pelo usuário em 2026-11-23)

Quero transformar o protótipo HTML/React anexo (`bikecondo-mockup.html`) em uma aplicação web funcional e responsiva (PWA-ready) para gestão de bicicletas elétricas em condomínios.

## Stack & Arquitetura
- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Lucide React (ícones).
- **Backend / Banco / Storage:** Supabase (PostgreSQL + Storage para fotos das bikes e ocorrências + Auth para o painel do síndico).
- **Roteamento:** React Router DOM com rotas limpas e suporte a URLs curtas para impressão nos QR Codes (ex: `/b/:tagNumber`).

## Estrutura de Dados (migration SQL para o Supabase)
1. **`condo_settings`**: `id` (uuid, pk), `condo_name` (text), `total_capacity` (int, default 50), `next_tag_number` (int, default 1)
2. **`bikes`**: `id` (uuid, pk), `tag_number` (text, unique, nullable), `unit_block` (text), `owner_name` (text), `owner_whatsapp` (text), `brand_model` (text), `color` (text), `photo_url` (text), `status` (`'pending'|'active'|'inactive'`), `created_at` (timestamptz)
3. **`incidents`**: `id` (uuid, pk), `bike_id` (uuid, fk), `reason` (text), `notes` (text, nullable), `photo_url` (text, nullable), `reporter_info` (text, nullable), `status` (`'open'|'resolved'`), `created_at` (timestamptz), `resolved_at` (timestamptz, nullable)

## Requisitos Funcionais por Rota

1. **`/b/:tagNumber`** — Tela pública de leitura do QR Code (mobile-first, sem login): busca a bike ativa pelo `tag_number`; exibe apenas tag, modelo, cor e foto (LGPD: nunca expor nome, bloco/apto ou telefone na API pública); permite abrir ocorrência com motivo pré-definido, observação opcional e foto opcional; ao salvar, dispara notificação WhatsApp ao proprietário (mockada/hook) e exibe confirmação.

2. **`/cadastro`** — Formulário público do morador (sem login): mobile-first, upload obrigatório de foto com compressão client-side antes do upload para o bucket `bike-photos`; salva com `status = 'pending'`.

3. **`/admin` e `/login`** — Painel do síndico (protegido por Supabase Auth):
   - KPIs: ocupação (`ativas / total_capacity` com barra), ocorrências abertas, cadastros pendentes.
   - Aba Ocorrências: abertas + histórico resolvidas, foto da ocorrência, "Marcar como Resolvida".
   - Aba Aprovações: cadastros `pending`, aprovar vinculando o próximo `tag_number` (incrementando), gerar/exibir QR Code (`qrcode.react`).
   - Aba Frota: busca por adesivo/unidade/modelo, dados completos do morador (autenticado), inativar cadastro (libera vaga), modal para ajustar capacidade total.

## Segurança (RLS)
- `INSERT` público permitido em `bikes` (apenas `status = 'pending'`) e em `incidents`.
- `SELECT` público em `bikes` bloqueado — RPC `get_public_bike_by_tag(p_tag text)` `SECURITY DEFINER` retornando apenas `id, tag_number, brand_model, color, photo_url`.
- Acesso total (`SELECT/UPDATE/DELETE`) só para autenticados (admin).

## Entregáveis Esperados
1. Projeto Vite + React + TypeScript completo, mantendo visual/paleta emerald/slate do mockup anexo.
2. `supabase/schema.sql` com tabelas, triggers, buckets de storage e políticas RLS/RPC prontos.
3. `.env.example` e README curto com setup e deploy.

Analisar o código do mockup anexo (`mockup_interativo_bikecondo.html`) para reaproveitar textos, fluxos e componentes de UI.

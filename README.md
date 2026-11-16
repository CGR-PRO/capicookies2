# Agenda & Finanças

Aplicativo web pessoal para **controle financeiro manual** e **agenda de compromissos**, com interface em
Glassmorphism (dashboard) e Liquid Glass (barra lateral). Interface em português, responsivo para desktop e celular.

## Como executar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # gera a versão de produção em dist/
npm run preview    # serve a versão de produção
npm test           # testes unitários (saldo, recorrências, fuso horário, câmbio, armazenamento)
```

A pasta `dist/` é estática e pode ser publicada em qualquer hospedagem (Netlify, Vercel, GitHub Pages…).
As rotas usam `HashRouter`, então não é preciso configurar o servidor.

## Funcionalidades

| Seção | O que faz |
|---|---|
| **Dashboard** | Filtro por conta (ou todas), saldo disponível e equivalente na moeda secundária, **ganhos do mês** (verde), **gastos do mês** (vermelho) e **resultado líquido** (sobrou/faltou) com seletor de mês e ano, seção **Minhas Contas** (principal, secundárias e total consolidado), vencimentos em aberto, gráficos de entradas × despesas e evolução do saldo, próximos vencimentos, últimas movimentações, próximos compromissos e despesas por categoria. |
| **Agenda** | Calendário mensal, semanal e diário; compromissos e tarefas; lembretes; marcar tarefas como concluídas; fuso horário configurável (padrão `Europe/Dublin`). |
| **Contas** | Contas manuais (Conta Principal, secundárias, reserva, dinheiro em espécie…) com nome, saldo inicial, moeda, cor e ícone; histórico individual com saldo após cada movimento; transferências entre contas; editar, arquivar e reativar (excluir só contas sem movimentações). |
| **Entradas / Despesas** | Registrar, editar e excluir lançamentos em uma conta (inclusive em datas anteriores), filtro por conta, mês, categoria e busca. |
| **Gastos Fixos** | Despesas recorrentes (semanal a anual) com situação **pendente**, **paga** ou **vencida**. Só afetam o saldo quando o pagamento é registrado; o pagamento pode ser desfeito. |
| **Histórico Financeiro** | Consulta por período e categoria, saldo no início/fim do período, resumo mensal e exportação CSV. |
| **Conversor de Moedas** | Cotação intradiária EUR/BRL (AwesomeAPI; reservas: BCE via Frankfurter e ExchangeRate-API), consultada ao abrir o dashboard, a cada 5 minutos e no botão Atualizar, sem cache. Mostra o horário de referência da API separado do horário da consulta e identifica a “última cotação disponível” em fins de semana e feriados. Sem histórico e sem segunda conta. Se a consulta falhar, o app avisa e não exibe cotação antiga. |
| **Configurações** | Fundo do dashboard (padrão, foto, carrossel ou vídeo, com enquadramento e escurecimento), tema claro/escuro, saldo inicial, moedas, fuso horário, notificações, categorias, PIN de acesso e backup/restauração. |

### Regras financeiras

- O saldo **nunca é armazenado**: o de cada conta é sempre `saldo inicial + entradas − despesas + transferências recebidas − enviadas`.
  Assim, editar ou excluir um lançamento recalcula tudo automaticamente, sem duplicações.
- Valores são guardados em **centavos inteiros** (sem erros de arredondamento).
- Todos os campos monetários usam máscara automática: digita-se só números e a vírgula entra sozinha (`12345` → `€ 123,45`), com teclado numérico no celular.
- Cada vencimento de gasto fixo aceita **um único** pagamento (chave `gasto + data de vencimento`); só reduz o saldo da conta escolhida quando é pago.
- **Transferências** movem dinheiro entre contas e não são ganho nem gasto: o total consolidado e o resultado mensal não mudam.
- **Resultado mensal** = entradas − despesas do mês escolhido. É diferente do saldo disponível, que acumula todos os meses.
- Contas em outras moedas entram no total consolidado convertidas pela cotação mais recente (data exibida, sem histórico). Sem cotação, a conta fica de fora do total e o app avisa.
- **Migração**: ao atualizar, o app cria a *Conta Principal* com o saldo inicial e a moeda já configurados e associa a ela todos os lançamentos antigos. Nada é apagado (banco IndexedDB v1 → v2) e backups antigos também são migrados ao importar.

## Arquitetura

```
src/
  lib/           Lógica pura e testada (sem React)
    finance.ts     resumos mensais, filtros
    accounts.ts    contas, transferências, consolidação, histórico e migração
    recurrence.ts  vencimentos e situação dos gastos fixos
    dates.ts       datas de calendário e conversão de fuso horário
    currency.ts    serviço de câmbio com provedores de reserva
    storage.ts     interface DataStore + implementação IndexedDB
  store/         Estado global (DataProvider, RatesProvider, ToastProvider)
  auth/          AuthProvider (PIN local) com interface AuthService para provedores remotos
  components/
    ui/          Componentes reutilizáveis (Button, Toggle, Modal, Field, GlassCard, Segmented…)
    layout/      Sidebar, fundo personalizável, agendador de lembretes
    charts/      Gráficos SVG acessíveis (com tabela para leitores de tela)
    finance/     Formulários e listas financeiras
    agenda/      Formulário de eventos e visualizações do calendário
    settings/    Configuração de fundo
  pages/         Uma página por seção, carregada sob demanda
```

### Persistência e segurança

- Os dados ficam no **IndexedDB** do navegador (inclusive fotos e vídeos de fundo) e sobrevivem a
  recarregamentos e ao fechamento do navegador. O app solicita armazenamento persistente.
- Nenhum dado financeiro fica no código-fonte ou em arquivos públicos.
- O **PIN** opcional é derivado com PBKDF2-SHA-256 (WebCrypto); o PIN em si nunca é gravado.

### Expansão para vários dispositivos

Toda a aplicação usa a interface `DataStore` (`src/lib/storage.ts`) e o hook `useAuth()`.
Para sincronizar entre dispositivos:

1. Implemente `DataStore` sobre um backend autenticado (API própria, Supabase, Firebase…).
2. Implemente `AuthService` (`src/auth/AuthProvider.tsx`) com login remoto.
3. Troque a implementação em `createStore()`.

Enquanto isso, **Configurações → Dados e backup** permite exportar/restaurar um arquivo JSON para levar os dados a outro dispositivo.

Para adicionar uma nova seção: crie a página em `src/pages`, registre a rota em `src/App.tsx` e o item em `NAV_ITEMS` (`src/components/layout/Sidebar.tsx`).

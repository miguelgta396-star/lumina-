# Lumina Finance — Gestão Financeira Inteligente & Premium 💎

Aplicação web Full-Stack de alta conversão e retenção projetada para gestão financeira pessoal com design visual refinado, velocidade de registro extrema e suporte assistido por inteligência artificial.

---

## 🌟 Destaques de UI/UX e Funcionalidades

### 1. 🔐 Tela de Login & Autenticação Elegante
- Layout com identidade visual marcante em estilo fintech contemporâneo (Dark Slate, Esmeralda, Ciano e acentos sutis).
- Alternância suave entre **Entrar** e **Criar Conta**.
- **Acesso Demonstração (1 Clique):** Botão instantâneo que carrega o perfil de **Ana Silva (Tech Lead)** com histórico financeiro pré-carregado e metas ativas.
- Feedback visual com validação e visibilidade de senha alternável.

### 2. ⚡ Dashboard Principal com Lançamento Rápido em Destaque
- **Ação Principal Imediata:** Botão destacado `+ Nova Transação` no topo (e atalho universal pela tecla `N`), permitindo registrar novos gastos ou receitas em menos de 5 segundos.
- **Painel Focado & Minimalista (Novidade v1.1):**
  - A seção **"Metas & Reservas Financeiras"** agora vem **oculta por padrão**, garantindo foco total no fluxo diário de receitas e despesas.
  - **Toggle Discreto "Mostrar Metas":** Botão switch moderno no canto superior da Topbar (e também na Central de Ajuda) que permite exibir ou recolher as metas com 1 clique.
  - A preferência do usuário é salva no `localStorage`, mantendo o layout limpo de forma persistente.
- **Microinterações:** Efeito comemorativo de confete (`canvas-confetti`) a cada registro e atualização em tempo real sem recarregar a página.
- **KPIs Vitais:**
  - Saldo Líquido atual (com botão de ocultar/mostrar para privacidade em locais públicos).
  - Entradas e Receitas acumuladas.
  - Saídas e Despesas totais.
  - **Taxa de Poupança Automática** com meta recomendada de 20%+.
- **Gráficos Interativos (Chart.js):**
  - **Fluxo Financeiro Recente:** Gráfico de linha com gradiente de preenchimento comparando receitas e despesas.
  - **Despesas por Categoria:** Gráfico de rosca (*doughnut*) com cálculo percentual e legenda dinâmica.
- **Metas de Economia:** Acompanhamento visual de objetivos com barra de progresso e botão de aporte rápido quando ativado.
- **Tabela de Histórico:** Filtros por tipo (Receita/Despesa), busca instantânea por texto e botão de **Exportar CSV** compatível com Excel/Google Sheets.

### 3. 🧭 Tutorial Interativo Guiado (Onboarding)
- Passo a passo visual de 5 etapas com destaque luminoso (*spotlight* nos cards da interface).
- Explica o fluxo de trabalho, atalhos de teclado e os principais recursos.
- Pode ser pulado ou reiniciado a qualquer momento através do menu ou da central de ajuda.

### 4. 💬 Assistente de Ajuda & Suporte Flutuante
- Botão flutuante estilizado no canto inferior direito com animação de pulso e tooltip convidativo: *"Precisa de ajuda com suas finanças?"*.
- Gaveta lateral (*Drawer*) com 3 abas:
  - **FinBot IA:** Chat com inteligência financeira integrada que consulta os dados reais do usuário (saldo, maiores gastos, taxa de poupança e explicações da regra 50-30-20).
  - **FAQ Interativo:** Acordeão de perguntas frequentes com campo de busca em tempo real.
  - **Ações Rápidas:** Reiniciar onboarding, restaurar base de demonstração e contato de suporte.

---

## 🛠️ Stack Tecnológica

- **Backend:** Python 3.12 + Flask 3.1 (RESTful API, sessões seguras, CORS, hash de senhas).
- **Banco de Dados:** SQLite3 (`finance.db`) com transações, metas financeiras e usuários persistentes.
- **Frontend:** SPA moderna em HTML5 semântico, JavaScript ES6+ assíncrono.
- **Estilização:** Tailwind CSS (via CDN) + CSS customizado com Glassmorphism e animações fluidas.
- **Ícones & Gráficos:** Lucide Icons, Chart.js, Canvas Confetti.

---

## 🚀 Como Executar

No terminal, navegue até a pasta do projeto e inicie o servidor:

```powershell
cd C:\Users\Administrator\.gemini\antigravity\scratch\lumina-finance
python app.py
```

Abra o navegador em:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

### 🔑 Credenciais de Teste
- **Acesso com 1 clique:** Basta clicar em *"Acessar como Usuário Demonstração"*.
- **Ou use:**
  - **E-mail:** `ana.silva@exemplo.com`
  - **Senha:** `lumina123`
- **Ou crie uma nova conta** na aba *"Criar Conta"*.

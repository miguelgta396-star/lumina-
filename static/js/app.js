/**
 * Lumina Finance — Client-side Application Logic
 * Full-Stack Financial Management Suite
 */

// Application State
const state = {
    currentUser: null,
    isPrivacyMode: false,
    showGoals: localStorage.getItem('lumina_show_goals') === 'true', // false por padrão
    currentTransType: 'expense',
    selectedCategory: 'Alimentação',
    timelineChart: null,
    categoryChart: null,
    onboardingStep: 0,
    transactions: [],
    searchQuery: '',
    filterType: ''
};

// Category Definitions with Icons and Colors
const CATEGORIES_DATA = {
    expense: [
        { name: 'Alimentação', icon: 'utensils', color: '#f59e0b' },
        { name: 'Moradia', icon: 'home', color: '#8b5cf6' },
        { name: 'Transporte', icon: 'car', color: '#3b82f6' },
        { name: 'Lazer', icon: 'film', color: '#ec4899' },
        { name: 'Saúde', icon: 'heart-pulse', color: '#10b981' },
        { name: 'Educação', icon: 'graduation-cap', color: '#06b6d4' },
        { name: 'Compras', icon: 'shopping-bag', color: '#eab308' },
        { name: 'Outros', icon: 'package', color: '#64748b' }
    ],
    income: [
        { name: 'Salário', icon: 'briefcase', color: '#10b981' },
        { name: 'Freelance', icon: 'laptop', color: '#06b6d4' },
        { name: 'Investimentos', icon: 'trending-up', color: '#8b5cf6' },
        { name: 'Vendas', icon: 'tag', color: '#f59e0b' },
        { name: 'Outros', icon: 'coins', color: '#64748b' }
    ]
};

// Onboarding Steps Configuration
const ONBOARDING_STEPS = [
    {
        targetId: 'tourStepKPIs',
        title: 'Visão Geral e Saúde Financeira',
        description: 'Aqui você acompanha seus números vitais em tempo real: Saldo Líquido atual, total de receitas, total de despesas e sua Taxa de Poupança calculada automaticamente.',
        icon: 'bar-chart-3'
    },
    {
        targetId: 'tourStepQuickAction',
        title: 'Ação Principal: Lançamento em Segundos',
        description: 'Mantenha suas contas sempre em dia! Clique no botão pulsante "+ Nova Transação" ou apenas aperte a tecla "N" no teclado para lançar novos gastos ou receitas num piscar de olhos.',
        icon: 'zap'
    },
    {
        targetId: 'tourStepCharts',
        title: 'Inteligência Visual & Padrões de Consumo',
        description: 'Descubra exatamente para onde vai seu dinheiro. O gráfico de fluxo compara entradas e saídas, enquanto o gráfico de rosca detalha o peso de cada categoria no seu orçamento.',
        icon: 'pie-chart'
    },
    {
        targetId: 'btnToggleShowGoals',
        title: 'Metas & Reservas (Personalizável)',
        description: 'Para manter seu painel limpo e focado no fluxo de despesas diárias, as Metas ficam ocultas por padrão. Ative ou desative a seção quando desejar através deste botão "Mostrar Metas".',
        icon: 'target'
    },
    {
        targetId: 'tourStepHelpWidget',
        title: 'FinBot IA e Suporte Sempre à Mão',
        description: 'Surgiu alguma dúvida? O botão flutuante no canto inferior conecta você ao FinBot (nosso assistente IA que analisa seus dados reais) e a um FAQ completo sobre finanças!',
        icon: 'sparkles'
    }
];

// Helper: Format BRL Currency
function formatCurrency(val) {
    if (state.isPrivacyMode) return 'R$ ••••••••';
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setupEventListeners();
    renderQuickCategories();
    checkAuth();
});

// Check Authentication Status
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (data.authenticated && data.user) {
            handleAuthSuccess(data.user);
        } else {
            showAuthSection();
        }
    } catch (err) {
        console.error('Erro na checagem de autenticação:', err);
        showAuthSection();
    }
}

function handleAuthSuccess(user) {
    state.currentUser = user;
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');

    // Update User Profile Displays
    const nameInitial = (user.name || 'U').charAt(0).toUpperCase();
    const avatarEl = document.getElementById('userAvatar');
    avatarEl.textContent = nameInitial;
    if (user.avatar_color) avatarEl.style.backgroundColor = user.avatar_color;

    document.getElementById('userNameDisplay').textContent = user.name;
    document.getElementById('userEmailDisplay').textContent = user.email;

    // Greeting by time of day
    const hour = new Date().getHours();
    let greeting = 'Olá';
    if (hour >= 5 && hour < 12) greeting = 'Bom dia';
    else if (hour >= 12 && hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';
    document.getElementById('topGreeting').textContent = `${greeting}, ${user.name.split(' ')[0]} 👋`;

    // Load Dashboard Data
    loadDashboardData();

    // Check if onboarding is needed
    if (!user.has_seen_onboarding) {
        setTimeout(() => startOnboarding(), 600);
    }

    lucide.createIcons();
}

function showAuthSection() {
    state.currentUser = null;
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    lucide.createIcons();
}

// ================= DASHBOARD DATA LOADER =================
async function loadDashboardData() {
    applyGoalsVisibility();
    const tasks = [
        loadAnalytics(),
        loadTransactions()
    ];
    if (state.showGoals) {
        tasks.push(loadGoals());
    }
    await Promise.all(tasks);
}

async function loadAnalytics() {
    try {
        const res = await fetch('/api/analytics/summary');
        if (!res.ok) return;
        const data = await res.json();

        // Update KPIs
        document.getElementById('kpiBalance').textContent = formatCurrency(data.balance);
        document.getElementById('kpiIncome').textContent = formatCurrency(data.total_income);
        document.getElementById('kpiExpense').textContent = formatCurrency(data.total_expense);
        
        const savingsRate = data.savings_rate || 0;
        document.getElementById('kpiSavingsRate').textContent = `${savingsRate.toFixed(1)}%`;
        const barWidth = Math.min(savingsRate, 100);
        document.getElementById('kpiSavingsBar').style.width = `${barWidth}%`;

        // Render Charts
        renderTimelineChart(data.timeline || []);
        renderCategoryChart(data.categories || []);

    } catch (err) {
        console.error('Erro ao carregar métricas:', err);
    }
}

// ================= CHART RENDERING =================
function renderTimelineChart(timeline) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // Sort and format timeline labels
    const labels = timeline.map(item => {
        const [year, month] = item.month.split('-');
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[parseInt(month, 10) - 1]}/${year.slice(2)}`;
    });
    const incomeData = timeline.map(item => item.income);
    const expenseData = timeline.map(item => item.expense);

    if (state.timelineChart) {
        state.timelineChart.destroy();
    }

    // Modern Dark Gradient Line Chart
    const gradientIncome = ctx.createLinearGradient(0, 0, 0, 240);
    gradientIncome.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradientIncome.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const gradientExpense = ctx.createLinearGradient(0, 0, 0, 240);
    gradientExpense.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
    gradientExpense.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

    state.timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['Mês Atual'],
            datasets: [
                {
                    label: 'Receitas',
                    data: incomeData.length ? incomeData : [0],
                    borderColor: '#10b981',
                    backgroundColor: gradientIncome,
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#10b981',
                    pointHoverRadius: 6
                },
                {
                    label: 'Despesas',
                    data: expenseData.length ? expenseData : [0],
                    borderColor: '#f43f5e',
                    backgroundColor: gradientExpense,
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#f43f5e',
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111726',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11 },
                        callback: val => `R$ ${val}`
                    }
                }
            }
        }
    });
}

function renderCategoryChart(categories) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const legendContainer = document.getElementById('categoryLegends');
    legendContainer.innerHTML = '';

    if (!categories || categories.length === 0) {
        if (state.categoryChart) state.categoryChart.destroy();
        legendContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Nenhuma despesa registrada ainda.</p>';
        return;
    }

    const labels = categories.map(c => c.category);
    const dataValues = categories.map(c => c.total);

    const modernPalette = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#64748b'];
    const colors = categories.map((_, i) => modernPalette[i % modernPalette.length]);

    if (state.categoryChart) {
        state.categoryChart.destroy();
    }

    state.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colors,
                borderColor: '#111726',
                borderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111726',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });

    // Populate Dynamic Legend Items with Percentages
    categories.forEach((cat, i) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-none';
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${colors[i]}"></span>
                <span class="text-slate-300 font-medium">${cat.category}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-slate-400 font-mono">${formatCurrency(cat.total)}</span>
                <span class="text-[11px] font-bold text-slate-500 w-9 text-right">${cat.percentage}%</span>
            </div>
        `;
        legendContainer.appendChild(item);
    });
}

// ================= FINANCIAL GOALS =================
async function loadGoals() {
    try {
        const res = await fetch('/api/goals');
        if (!res.ok) return;
        const data = await res.json();
        const container = document.getElementById('goalsContainer');
        container.innerHTML = '';

        if (!data.goals || data.goals.length === 0) {
            container.innerHTML = `
                <div class="col-span-3 text-center py-6 text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl">
                    Nenhuma meta cadastrada ainda. Clique em "+ Nova Meta" acima para criar sua primeira conquista!
                </div>
            `;
            return;
        }

        data.goals.forEach(goal => {
            const card = document.createElement('div');
            card.id = `goal-card-${goal.id}`;
            card.className = 'p-4 rounded-2xl bg-dark-900/60 border border-white/10 hover:border-white/20 transition-all duration-300 flex flex-col justify-between relative group';
            card.innerHTML = `
                <div>
                    <!-- Header do Card com Título e Botão de Remover 'X' no Canto Superior Direito -->
                    <div class="flex items-start justify-between mb-2 gap-2">
                        <div class="flex-1 min-w-0 pr-1">
                            <span class="text-xs font-semibold text-white truncate block" title="${escapeHtml(goal.title)}">${escapeHtml(goal.title)}</span>
                            <span class="text-xs font-bold text-emerald-400">${goal.progress_percentage}%</span>
                        </div>
                        <button onclick="deleteGoalCard(${goal.id}, '${goal.title.replace(/'/g, "\\'")}')" 
                                class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-70 group-hover:opacity-100 flex-shrink-0" 
                                title="Remover esta meta">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="flex items-baseline justify-between text-xs text-slate-400 mb-2.5">
                        <span>Atual: <strong class="text-white">${formatCurrency(goal.current_amount)}</strong></span>
                        <span>Alvo: ${formatCurrency(goal.target_amount)}</span>
                    </div>
                    <!-- Progress Bar -->
                    <div class="w-full bg-dark-700 h-2 rounded-full overflow-hidden mb-3">
                        <div class="h-full rounded-full transition-all duration-500" style="width: ${goal.progress_percentage}%; background-color: ${goal.color || '#10b981'};"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-white/5">
                    <span class="text-[11px] text-slate-500">${goal.category || 'Geral'}</span>
                    <button onclick="openDepositModal(${goal.id}, '${goal.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/20 transition-colors flex items-center gap-1">
                        <i data-lucide="plus" class="w-3 h-3"></i> Aportar
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        lucide.createIcons();
    } catch (err) {
        console.error('Erro ao carregar metas:', err);
    }
}

// Remover Card de Meta da Tela e do Estado
async function deleteGoalCard(goalId, title) {
    if (!confirm(`Deseja remover a meta "${title}"?`)) return;

    const cardEl = document.getElementById(`goal-card-${goalId}`);
    if (cardEl) {
        cardEl.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.92)';
    }

    try {
        const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
        if (res.ok) {
            setTimeout(() => {
                if (cardEl) cardEl.remove();
                const container = document.getElementById('goalsContainer');
                if (container && container.children.length === 0) {
                    container.innerHTML = `
                        <div class="col-span-3 text-center py-6 text-xs text-slate-400 border border-dashed border-white/10 rounded-2xl animate-fade-in">
                            Nenhuma meta cadastrada no momento. Clique em "+ Nova Meta" para adicionar.
                        </div>
                    `;
                }
            }, 250);
        } else {
            if (cardEl) {
                cardEl.style.opacity = '1';
                cardEl.style.transform = 'scale(1)';
            }
            alert('Não foi possível remover a meta.');
        }
    } catch (err) {
        console.error('Erro ao excluir meta:', err);
        if (cardEl) {
            cardEl.style.opacity = '1';
            cardEl.style.transform = 'scale(1)';
        }
    }
}

// ================= GOALS VISIBILITY TOGGLE (v1.1) =================
function applyGoalsVisibility() {
    const goalsSection = document.getElementById('tourStepGoals');
    const track = document.getElementById('goalsSwitchTrack');
    const thumb = document.getElementById('goalsSwitchThumb');
    const icon = document.getElementById('goalsToggleIcon');
    const btnDrawer = document.getElementById('btnDrawerGoalsToggle');

    if (!goalsSection) return;

    if (state.showGoals) {
        // Exibir seção de metas
        goalsSection.classList.remove('hidden');
        
        // Atualizar switch da topbar para ativo (verde esmeralda)
        if (track && thumb) {
            track.className = 'w-7 h-4 bg-emerald-500 rounded-full p-0.5 transition-colors relative flex items-center shadow-sm shadow-emerald-500/20';
            thumb.className = 'w-3 h-3 bg-white rounded-full transition-transform transform translate-x-3 shadow';
        }
        if (icon) {
            icon.classList.remove('text-slate-400');
            icon.classList.add('text-emerald-400');
        }

        // Atualizar botão do drawer de ajuda
        if (btnDrawer) {
            btnDrawer.textContent = 'Ativo';
            btnDrawer.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border border-emerald-500/30 bg-emerald-500/20 text-emerald-400';
        }

        loadGoals();
    } else {
        // Ocultar seção de metas mantendo o espaço do dashboard limpo
        goalsSection.classList.add('hidden');

        // Atualizar switch da topbar para inativo (escuro)
        if (track && thumb) {
            track.className = 'w-7 h-4 bg-dark-700 rounded-full p-0.5 transition-colors relative flex items-center';
            thumb.className = 'w-3 h-3 bg-slate-400 rounded-full transition-transform transform translate-x-0';
        }
        if (icon) {
            icon.classList.remove('text-emerald-400');
            icon.classList.add('text-slate-400');
        }

        // Atualizar botão do drawer de ajuda
        if (btnDrawer) {
            btnDrawer.textContent = 'Oculto';
            btnDrawer.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all border border-white/10 bg-dark-700 text-slate-400';
        }
    }

    localStorage.setItem('lumina_show_goals', state.showGoals);
}

function toggleGoalsVisibility() {
    state.showGoals = !state.showGoals;
    applyGoalsVisibility();
}

// ================= TRANSACTIONS TABLE =================
async function loadTransactions() {
    try {
        let url = '/api/transactions?';
        if (state.filterType) url += `type=${state.filterType}&`;
        if (state.searchQuery) url += `search=${encodeURIComponent(state.searchQuery)}&`;

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        state.transactions = data.transactions || [];

        renderTransactionsTable();
    } catch (err) {
        console.error('Erro ao carregar transações:', err);
    }
}

function renderTransactionsTable() {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = '';

    if (state.transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-xs text-slate-400">
                    Nenhuma transação encontrada com os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    state.transactions.forEach(t => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-none';
        
        const isExpense = t.type === 'expense';
        const amountFormatted = isExpense ? `- ${formatCurrency(t.amount)}` : `+ ${formatCurrency(t.amount)}`;
        const amountColor = isExpense ? 'text-coral-400' : 'text-emerald-400';
        const typeBadge = isExpense 
            ? '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-coral-500/10 text-coral-400 border border-coral-500/20">Despesa</span>'
            : '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Receita</span>';

        tr.innerHTML = `
            <td class="p-3.5 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${isExpense ? 'bg-coral-400' : 'bg-emerald-400'}"></span>
                <span class="font-medium text-slate-200">${t.category}</span>
            </td>
            <td class="p-3.5 text-slate-300 font-medium">${t.description}</td>
            <td class="p-3.5 text-slate-400">${t.date}</td>
            <td class="p-3.5 text-slate-400">
                <span class="px-2 py-0.5 rounded-lg bg-dark-800 text-[11px] text-slate-300 border border-white/5">${t.payment_method || 'PIX'}</span>
            </td>
            <td class="p-3.5 text-right font-extrabold font-heading ${amountColor}">${amountFormatted}</td>
            <td class="p-3.5 text-center">
                <button onclick="deleteTransaction(${t.id})" title="Excluir Transação" class="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    lucide.createIcons();
}

async function deleteTransaction(id) {
    if (!confirm('Deseja realmente excluir este registro financeiro?')) return;

    try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadDashboardData();
        }
    } catch (err) {
        console.error('Erro ao deletar transação:', err);
    }
}

// ================= QUICK ADD / NEW TRANSACTION MODAL =================
function renderQuickCategories() {
    const grid = document.getElementById('quickCategoriesGrid');
    grid.innerHTML = '';
    const categories = CATEGORIES_DATA[state.currentTransType];

    categories.forEach((cat, idx) => {
        const isSelected = cat.name === state.selectedCategory || (idx === 0 && !categories.some(c => c.name === state.selectedCategory));
        if (isSelected) state.selectedCategory = cat.name;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
            isSelected 
            ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md shadow-emerald-500/10' 
            : 'bg-dark-900 border-white/5 text-slate-400 hover:text-white hover:bg-dark-800'
        }`;
        
        btn.innerHTML = `
            <i data-lucide="${cat.icon}" class="w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}"></i>
            <span class="text-[11px] font-medium leading-tight">${cat.name}</span>
        `;

        btn.onclick = () => {
            state.selectedCategory = cat.name;
            renderQuickCategories();
        };

        grid.appendChild(btn);
    });

    lucide.createIcons();
}

function openNewTransactionModal() {
    const modal = document.getElementById('modalNewTransaction');
    modal.classList.remove('hidden');
    // Set default date to today
    document.getElementById('inputTransDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inputTransAmount').value = '';
    document.getElementById('inputTransDescription').value = '';
    document.getElementById('inputTransAmount').focus();
    renderQuickCategories();
}

function closeNewTransactionModal() {
    document.getElementById('modalNewTransaction').classList.add('hidden');
}

// ================= DEPOSIT MODAL =================
function openDepositModal(goalId, title) {
    document.getElementById('depositGoalId').value = goalId;
    document.getElementById('depositGoalTitle').textContent = `Meta: ${title}`;
    document.getElementById('inputDepositAmount').value = '';
    document.getElementById('modalDepositGoal').classList.remove('hidden');
    document.getElementById('inputDepositAmount').focus();
}

function closeDepositModal() {
    document.getElementById('modalDepositGoal').classList.add('hidden');
}

// ================= GOAL MODAL =================
function openNewGoalModal() {
    document.getElementById('inputGoalTitle').value = '';
    document.getElementById('inputGoalTarget').value = '';
    document.getElementById('inputGoalCurrent').value = '';
    document.getElementById('modalNewGoal').classList.remove('hidden');
}

function closeNewGoalModal() {
    document.getElementById('modalNewGoal').classList.add('hidden');
}

// ================= INTERACTIVE ONBOARDING TUTORIAL =================
function startOnboarding() {
    state.onboardingStep = 0;
    document.getElementById('onboardingOverlay').classList.remove('hidden');
    updateOnboardingStep();
}

function closeOnboarding() {
    document.getElementById('onboardingOverlay').classList.add('hidden');
    clearAllHighlights();

    // Mark as completed in backend
    fetch('/api/auth/onboarding-complete', { method: 'POST' }).catch(err => console.error(err));
}

function clearAllHighlights() {
    document.querySelectorAll('.onboarding-highlight').forEach(el => {
        el.classList.remove('onboarding-highlight');
    });
}

function updateOnboardingStep() {
    clearAllHighlights();
    const step = ONBOARDING_STEPS[state.onboardingStep];
    if (!step) return;

    // Update Counter and Content
    document.getElementById('onboardingStepCounter').textContent = `Passo ${state.onboardingStep + 1} de ${ONBOARDING_STEPS.length}`;
    document.getElementById('onboardingTitle').textContent = step.title;
    document.getElementById('onboardingDescription').textContent = step.description;

    // Update Step Bars
    const bars = document.querySelectorAll('.step-bar');
    bars.forEach((bar, index) => {
        if (index <= state.onboardingStep) {
            bar.classList.remove('bg-dark-700');
            bar.classList.add('bg-emerald-500');
        } else {
            bar.classList.remove('bg-emerald-500');
            bar.classList.add('bg-dark-700');
        }
    });

    // Update Next/Finish Button Text
    const nextBtn = document.getElementById('btnNextOnboarding');
    if (state.onboardingStep === ONBOARDING_STEPS.length - 1) {
        nextBtn.innerHTML = `<span>Concluir Tutorial! 🎉</span>`;
    } else {
        nextBtn.innerHTML = `<span>Próximo Passo</span> <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>`;
    }

    // Prev Button Visibility
    const prevBtn = document.getElementById('btnPrevOnboarding');
    prevBtn.style.visibility = state.onboardingStep === 0 ? 'hidden' : 'visible';

    // Highlight the target element on the dashboard
    const targetEl = document.getElementById(step.targetId);
    if (targetEl) {
        targetEl.classList.add('onboarding-highlight');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    lucide.createIcons();
}

// ================= AI ASSISTANT & SUPPORT DRAWER =================
function toggleHelpDrawer(open) {
    const drawer = document.getElementById('helpDrawer');
    if (open) {
        drawer.classList.remove('translate-x-full');
        document.getElementById('helpBubbleTooltip').classList.add('hidden');
    } else {
        drawer.classList.add('translate-x-full');
    }
}

async function sendAiMessage(messageText) {
    const input = document.getElementById('aiChatInput');
    const msg = messageText || input.value.trim();
    if (!msg) return;

    input.value = '';
    const chatContainer = document.getElementById('aiChatMessages');

    // Append User Message
    const userMsgEl = document.createElement('div');
    userMsgEl.className = 'flex justify-end';
    userMsgEl.innerHTML = `
        <div class="bg-emerald-500 text-slate-950 font-medium rounded-2xl rounded-tr-none p-3 max-w-[85%] leading-relaxed shadow-sm">
            ${escapeHtml(msg)}
        </div>
    `;
    chatContainer.appendChild(userMsgEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Typing Indicator
    const typingEl = document.createElement('div');
    typingEl.className = 'flex gap-2.5 items-start typing-indicator';
    typingEl.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="bg-dark-800 border border-white/10 rounded-2xl p-3 text-slate-400 text-xs italic">
            FinBot está analisando seus dados...
        </div>
    `;
    chatContainer.appendChild(typingEl);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    lucide.createIcons();

    try {
        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        typingEl.remove();

        // Format markdown basic bold/bullets
        let formattedReply = escapeHtml(data.reply || '')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');

        const botMsgEl = document.createElement('div');
        botMsgEl.className = 'flex gap-2.5 items-start animate-fade-in';
        botMsgEl.innerHTML = `
            <div class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <i data-lucide="bot" class="w-4 h-4"></i>
            </div>
            <div class="bg-dark-800 border border-white/10 rounded-2xl p-3 text-slate-200 leading-relaxed shadow-sm">
                ${formattedReply}
            </div>
        `;
        chatContainer.appendChild(botMsgEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        lucide.createIcons();

    } catch (err) {
        typingEl.remove();
        console.error('Erro no chat com IA:', err);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================= EVENT LISTENERS SETUP =================
function setupEventListeners() {
    
    // Auth Tabs
    let isRegisterMode = false;
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const fieldNameGroup = document.getElementById('fieldNameGroup');
    const btnSubmitText = document.getElementById('btnSubmitText');
    const authAlert = document.getElementById('authAlert');

    tabLogin.addEventListener('click', () => {
        isRegisterMode = false;
        tabLogin.className = 'flex-1 py-2 text-sm font-semibold rounded-lg transition-all text-white bg-dark-750 shadow';
        tabRegister.className = 'flex-1 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg transition-all';
        fieldNameGroup.classList.add('hidden');
        btnSubmitText.textContent = 'Entrar no Lumina';
        authAlert.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
        isRegisterMode = true;
        tabRegister.className = 'flex-1 py-2 text-sm font-semibold rounded-lg transition-all text-white bg-dark-750 shadow';
        tabLogin.className = 'flex-1 py-2 text-sm font-medium text-slate-400 hover:text-white rounded-lg transition-all';
        fieldNameGroup.classList.remove('hidden');
        btnSubmitText.textContent = 'Criar Minha Conta Gratuita';
        authAlert.classList.add('hidden');
    });

    // Password Visibility Toggle
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const authPasswordInput = document.getElementById('authPassword');
    togglePasswordBtn.addEventListener('click', () => {
        const isPass = authPasswordInput.type === 'password';
        authPasswordInput.type = isPass ? 'text' : 'password';
        togglePasswordBtn.innerHTML = isPass ? '<i data-lucide="eye-off" class="w-4 h-4"></i>' : '<i data-lucide="eye" class="w-4 h-4"></i>';
        lucide.createIcons();
    });

    // Auth Form Submission
    document.getElementById('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        authAlert.classList.add('hidden');

        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value.trim();
        const name = document.getElementById('authName').value.trim();

        const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
        const payload = isRegisterMode ? { name, email, password } : { email, password };

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.success) {
                handleAuthSuccess(data.user);
            } else {
                authAlert.textContent = data.message || 'Erro ao processar autenticação.';
                authAlert.className = 'mb-4 p-3 rounded-xl text-xs font-medium border bg-rose-500/10 border-rose-500/20 text-rose-400 block';
            }
        } catch (err) {
            authAlert.textContent = 'Erro ao conectar ao servidor.';
            authAlert.className = 'mb-4 p-3 rounded-xl text-xs font-medium border bg-rose-500/10 border-rose-500/20 text-rose-400 block';
        }
    });

    // 1-Click Demo Login
    document.getElementById('btnDemoLogin').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/auth/demo', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                handleAuthSuccess(data.user);
            }
        } catch (err) {
            console.error('Erro no login demo:', err);
        }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        showAuthSection();
    });

    // Privacy Mode Toggle (Show/Hide Balance)
    document.getElementById('btnToggleBalancePrivacy').addEventListener('click', () => {
        state.isPrivacyMode = !state.isPrivacyMode;
        const icon = document.getElementById('balancePrivacyIcon');
        icon.setAttribute('data-lucide', state.isPrivacyMode ? 'eye-off' : 'eye');
        loadAnalytics();
        renderTransactionsTable();
        loadGoals();
        lucide.createIcons();
    });

    // Global Keyboard Shortcut: 'N' opens Quick Add, 'ESC' closes modals
    window.addEventListener('keydown', (e) => {
        if (state.currentUser && (e.key === 'n' || e.key === 'N') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            e.preventDefault();
            openNewTransactionModal();
        }
        if (e.key === 'Escape') {
            closeNewTransactionModal();
            closeNewGoalModal();
            closeDepositModal();
            toggleHelpDrawer(false);
        }
    });

    // Open/Close New Transaction Modal
    document.getElementById('btnOpenNewTransaction').addEventListener('click', openNewTransactionModal);
    document.getElementById('btnCloseModalTransaction').addEventListener('click', closeNewTransactionModal);

    // Toggle Expense vs Income in Modal
    const toggleExpense = document.getElementById('toggleTypeExpense');
    const toggleIncome = document.getElementById('toggleTypeIncome');

    toggleExpense.addEventListener('click', () => {
        state.currentTransType = 'expense';
        toggleExpense.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all bg-coral-500 text-white shadow-lg shadow-coral-500/20';
        toggleIncome.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all text-slate-400 hover:text-white';
        renderQuickCategories();
    });

    toggleIncome.addEventListener('click', () => {
        state.currentTransType = 'income';
        toggleIncome.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
        toggleExpense.className = 'py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all text-slate-400 hover:text-white';
        renderQuickCategories();
    });

    // Submit New Transaction Form (with Confetti!)
    document.getElementById('formNewTransaction').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('inputTransAmount').value);
        const description = document.getElementById('inputTransDescription').value.trim();
        const date = document.getElementById('inputTransDate').value;
        const payment_method = document.getElementById('inputTransPayment').value;

        if (!amount || amount <= 0) return;

        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: state.currentTransType,
                    amount,
                    category: state.selectedCategory,
                    description,
                    date,
                    payment_method
                })
            });

            if (res.ok) {
                closeNewTransactionModal();
                
                // Trigger delightful celebratory confetti!
                confetti({
                    particleCount: 50,
                    spread: 60,
                    origin: { y: 0.7 },
                    colors: state.currentTransType === 'income' ? ['#10b981', '#34d399', '#059669'] : ['#f43f5e', '#fb7185', '#fda4af']
                });

                loadDashboardData();
            }
        } catch (err) {
            console.error('Erro ao salvar transação:', err);
        }
    });

    // Goals Modals
    document.getElementById('btnOpenNewGoal').addEventListener('click', openNewGoalModal);
    document.getElementById('btnCloseModalGoal').addEventListener('click', closeNewGoalModal);
    document.getElementById('btnCloseModalDeposit').addEventListener('click', closeDepositModal);

    document.getElementById('formNewGoal').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('inputGoalTitle').value.trim();
        const target_amount = parseFloat(document.getElementById('inputGoalTarget').value);
        const current_amount = parseFloat(document.getElementById('inputGoalCurrent').value) || 0;
        const category = document.getElementById('inputGoalCategory').value;

        try {
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, target_amount, current_amount, category })
            });
            if (res.ok) {
                closeNewGoalModal();
                loadGoals();
            }
        } catch (err) {
            console.error('Erro ao criar meta:', err);
        }
    });

    document.getElementById('formDepositGoal').addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalId = document.getElementById('depositGoalId').value;
        const amount = parseFloat(document.getElementById('inputDepositAmount').value);

        try {
            const res = await fetch(`/api/goals/${goalId}/deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            if (res.ok) {
                closeDepositModal();
                confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
                loadGoals();
            }
        } catch (err) {
            console.error('Erro ao depositar na meta:', err);
        }
    });

    // Reset Demo Data
    document.getElementById('btnResetDemoData').addEventListener('click', async () => {
        if (!confirm('Deseja restaurar as transações e metas padrão de demonstração?')) return;
        await fetch('/api/demo/reset', { method: 'POST' });
        loadDashboardData();
    });

    // Filter and Search Transactions
    document.getElementById('searchTransactionsInput').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        loadTransactions();
    });

    document.getElementById('filterTypeSelect').addEventListener('change', (e) => {
        state.filterType = e.target.value;
        loadTransactions();
    });

    // Onboarding Actions
    document.getElementById('btnStartTour').addEventListener('click', startOnboarding);
    document.getElementById('btnSkipOnboarding').addEventListener('click', closeOnboarding);

    document.getElementById('btnNextOnboarding').addEventListener('click', () => {
        if (state.onboardingStep < ONBOARDING_STEPS.length - 1) {
            state.onboardingStep++;
            updateOnboardingStep();
        } else {
            closeOnboarding();
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        }
    });

    document.getElementById('btnPrevOnboarding').addEventListener('click', () => {
        if (state.onboardingStep > 0) {
            state.onboardingStep--;
            updateOnboardingStep();
        }
    });

    // Help Widget & Drawer
    document.getElementById('btnFloatingHelp').addEventListener('click', () => toggleHelpDrawer(true));
    document.getElementById('btnCloseHelpDrawer').addEventListener('click', () => toggleHelpDrawer(false));
    document.getElementById('btnCloseHelpBubble').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('helpBubbleTooltip').classList.add('hidden');
    });

    // Help Drawer Tabs
    const tabHelpAi = document.getElementById('tabHelpAi');
    const tabHelpFaq = document.getElementById('tabHelpFaq');
    const tabHelpGuide = document.getElementById('tabHelpGuide');
    const contentHelpAi = document.getElementById('contentHelpAi');
    const contentHelpFaq = document.getElementById('contentHelpFaq');
    const contentHelpGuide = document.getElementById('contentHelpGuide');

    function switchHelpTab(activeTab, activeContent) {
        [tabHelpAi, tabHelpFaq, tabHelpGuide].forEach(t => {
            t.className = 'flex-1 py-2 text-center rounded-lg text-slate-400 hover:text-white';
        });
        [contentHelpAi, contentHelpFaq, contentHelpGuide].forEach(c => c.classList.add('hidden'));

        activeTab.className = 'flex-1 py-2 text-center rounded-lg bg-dark-750 text-emerald-400 shadow';
        activeContent.classList.remove('hidden');
    }

    tabHelpAi.addEventListener('click', () => switchHelpTab(tabHelpAi, contentHelpAi));
    tabHelpFaq.addEventListener('click', () => switchHelpTab(tabHelpFaq, contentHelpFaq));
    tabHelpGuide.addEventListener('click', () => switchHelpTab(tabHelpGuide, contentHelpGuide));

    // Toggle Mostrar Metas (v1.1)
    const btnToggleGoals = document.getElementById('btnToggleShowGoals');
    if (btnToggleGoals) {
        btnToggleGoals.addEventListener('click', toggleGoalsVisibility);
    }
    const btnDrawerGoals = document.getElementById('btnDrawerGoalsToggle');
    if (btnDrawerGoals) {
        btnDrawerGoals.addEventListener('click', toggleGoalsVisibility);
    }
    const btnCloseGoals = document.getElementById('btnCloseGoalsSection');
    if (btnCloseGoals) {
        btnCloseGoals.addEventListener('click', () => {
            state.showGoals = false;
            applyGoalsVisibility();
        });
    }

    // Drawer Quick Actions
    document.getElementById('btnDrawerRestartTour').addEventListener('click', () => {
        toggleHelpDrawer(false);
        startOnboarding();
    });

    document.getElementById('btnDrawerResetDemo').addEventListener('click', async () => {
        await fetch('/api/demo/reset', { method: 'POST' });
        loadDashboardData();
        toggleHelpDrawer(false);
    });

    // AI Chat Form & Quick Suggestions
    document.getElementById('aiChatForm').addEventListener('submit', (e) => {
        e.preventDefault();
        sendAiMessage();
    });

    document.querySelectorAll('.chat-quick-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            sendAiMessage(btn.textContent.trim());
        });
    });

    // FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(btn => {
        btn.addEventListener('click', () => {
            const answer = btn.nextElementSibling;
            const chevron = btn.querySelector('[data-lucide="chevron-down"]');
            const isHidden = answer.classList.contains('hidden');
            
            // Close other items
            document.querySelectorAll('.faq-answer').forEach(a => a.classList.add('hidden'));
            document.querySelectorAll('.faq-question [data-lucide="chevron-down"]').forEach(i => i.classList.remove('rotate-180'));

            if (isHidden) {
                answer.classList.remove('hidden');
                if (chevron) chevron.classList.add('rotate-180');
            }
        });
    });

    // FAQ Search Filter
    document.getElementById('faqSearchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.faq-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? 'block' : 'none';
        });
    });
}

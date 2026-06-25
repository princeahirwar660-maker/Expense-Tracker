/* ============================================
   SpendSmart – app.js
   Pure JS, localStorage, no dependencies
   ============================================ */

// ── STATE ─────────────────────────────────────
let currentUser = null;
let charts = {};
const ITEMS_PER_PAGE = 10;
let expensePage = 1;
let incomePage = 1;

// ── STORAGE HELPERS ────────────────────────────
const key = (k) => `ss_${currentUser}_${k}`;
const load = (k) => JSON.parse(localStorage.getItem(key(k)) || '[]');
const save = (k, v) => localStorage.setItem(key(k), JSON.stringify(v));
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ── INIT ───────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('ss_session');
  if (stored) {
    currentUser = stored;
    enterApp();
  }
  // set today as default for expense/income date
  const today = new Date().toISOString().split('T')[0];
  ['expenseDate','incomeDate','goalStart'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
});

// ── AUTH ───────────────────────────────────────
function switchAuth(type) {
  document.getElementById('loginForm').classList.toggle('active', type === 'login');
  document.getElementById('registerForm').classList.toggle('active', type === 'register');
  clearErr();
}

function clearErr() {
  ['loginError','registerError'].forEach(id => { document.getElementById(id).textContent = ''; });
}

function handleLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!username || !password) { showErr('loginError','Fill in all fields.'); return; }
  const users = JSON.parse(localStorage.getItem('ss_users') || '{}');
  if (!users[username] || users[username] !== btoa(password)) {
    showErr('loginError','Incorrect username or password.'); return;
  }
  currentUser = username;
  localStorage.setItem('ss_session', username);
  enterApp();
}

function handleRegister() {
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  if (!username || !password) { showErr('registerError','Fill in all fields.'); return; }
  if (password.length < 4) { showErr('registerError','Password must be at least 4 characters.'); return; }
  const users = JSON.parse(localStorage.getItem('ss_users') || '{}');
  if (users[username]) { showErr('registerError','Username already taken.'); return; }
  users[username] = btoa(password);
  localStorage.setItem('ss_users', JSON.stringify(users));
  currentUser = username;
  localStorage.setItem('ss_session', username);
  seedDemoData();
  enterApp();
}

function handleLogout() {
  localStorage.removeItem('ss_session');
  currentUser = null;
  destroyCharts();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  switchAuth('login');
}

function showErr(id, msg) {
  document.getElementById(id).textContent = msg;
}

function enterApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userName').textContent = currentUser;
  document.getElementById('userAvatar').textContent = currentUser[0].toUpperCase();
  navigate('dashboard');
}

// ── SEED DEMO DATA ─────────────────────────────
function seedDemoData() {
  const now = new Date();
  const expenses = [];
  const income = [];
  const cats = ['Food & Dining','Transport','Shopping','Entertainment','Health','Utilities','Education'];
  const srcs = ['Salary','Freelance','Investment'];

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const count = Math.floor(Math.random() * 3) + 1;
    for (let j = 0; j < count; j++) {
      expenses.push({ id: uid(), amount: +(Math.random()*800+50).toFixed(2), description: randomDesc('expense'), category: cats[Math.floor(Math.random()*cats.length)], date: ds });
    }
    if (d.getDate() === 1 || i % 30 === 0) {
      income.push({ id: uid(), amount: +(Math.random()*15000+20000).toFixed(2), description: 'Monthly salary', source: 'Salary', date: ds });
    }
    if (Math.random() > 0.85) {
      income.push({ id: uid(), amount: +(Math.random()*5000+1000).toFixed(2), description: randomDesc('income'), source: srcs[Math.floor(Math.random()*2)+1], date: ds });
    }
  }
  save('expenses', expenses);
  save('income', income);
  save('goals', [
    { id: uid(), name: 'New Laptop', target: 80000, saved: 32000, start: fmtDate(-60), end: fmtDate(90) },
    { id: uid(), name: 'Emergency Fund', target: 100000, saved: 45000, start: fmtDate(-30), end: fmtDate(180) }
  ]);
}

function fmtDate(offsetDays) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

const expDescs = ['Lunch','Coffee','Groceries','Uber','Metro','Amazon','Zomato','Netflix','Gym','Medicine','Book','Electricity','Petrol'];
const incDescs = ['Project payment','Consulting','Dividend','Bonus','Part-time'];
function randomDesc(type) {
  const arr = type === 'expense' ? expDescs : incDescs;
  return arr[Math.floor(Math.random()*arr.length)];
}

// ── NAVIGATION ─────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  const titles = { dashboard:'Dashboard', expenses:'Expenses', income:'Income', goals:'Goals', stats:'Analytics', report:'Report' };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  expensePage = 1; incomePage = 1;
  destroyCharts();

  if (page === 'dashboard') renderDashboard();
  if (page === 'expenses')  { renderExpenseTable(); populateCatFilter(); }
  if (page === 'income')    renderIncomeTable();
  if (page === 'goals')     renderGoals();
  if (page === 'stats')     renderStats();
  if (page === 'report')    { setDefaultReportDates(); }

  // close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function toggleSidebar() {
  const wrapper = document.querySelector('.app');
  if (window.innerWidth <= 640) {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  } else {
    wrapper.classList.toggle('sidebar-collapsed');
  }
}

// ── MODAL ──────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}

// ── TOAST ──────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 2800);
}

// ── CHARTS UTILS ───────────────────────────────
function destroyCharts() {
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  charts = {};
}

function chartColors(n) {
  const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#a855f7'];
  return Array.from({length:n}, (_,i) => palette[i % palette.length]);
}

// ── DATE HELPERS ───────────────────────────────
function periodFilter(items, period) {
  const now = new Date();
  return items.filter(item => {
    const d = new Date(item.date);
    if (period === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 7);
      return d >= start;
    }
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'year')  return d.getFullYear() === now.getFullYear();
    return true; // all
  });
}

function sum(arr) { return arr.reduce((a,b) => a + b, 0); }
function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}); }

// ── DASHBOARD ──────────────────────────────────
function renderDashboard() {
  const period = document.getElementById('dashPeriod').value;
  const expenses = periodFilter(load('expenses'), period);
  const income   = periodFilter(load('income'),   period);

  const totalExp = sum(expenses.map(e => e.amount));
  const totalInc = sum(income.map(i => i.amount));
  const balance  = totalInc - totalExp;

  const grid = document.getElementById('statGrid');
  grid.innerHTML = `
    <div class="stat-card income">
      <div class="stat-label">Total Income</div>
      <div class="stat-value positive">${fmt(totalInc)}</div>
    </div>
    <div class="stat-card expense">
      <div class="stat-label">Total Expenses</div>
      <div class="stat-value negative">${fmt(totalExp)}</div>
    </div>
    <div class="stat-card balance">
      <div class="stat-label">Net Balance</div>
      <div class="stat-value ${balance >= 0 ? 'positive' : 'negative'}">${fmt(balance)}</div>
    </div>
    <div class="stat-card count">
      <div class="stat-label">Transactions</div>
      <div class="stat-value">${expenses.length + income.length}</div>
    </div>
  `;

  // Line chart – last 30 days spending grouped by day
  const last30 = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last30[d.toISOString().split('T')[0]] = 0;
  }
  load('expenses').forEach(e => { if (last30[e.date] !== undefined) last30[e.date] += e.amount; });
  const days = Object.keys(last30).map(d => d.slice(5)); // MM-DD
  const vals = Object.values(last30);

  const lCtx = document.getElementById('lineChart').getContext('2d');
  charts.line = new Chart(lCtx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{ label: 'Daily Spend', data: vals, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', tension: 0.4, fill: true, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: {size:11} } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font:{size:11}, callback: v => '₹'+v.toLocaleString('en-IN') } }
      }
    }
  });

  // Donut chart – by category
  const catMap = {};
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category]||0) + e.amount; });
  const catKeys = Object.keys(catMap);
  const dCtx = document.getElementById('donutChart').getContext('2d');
  if (catKeys.length) {
    charts.donut = new Chart(dCtx, {
      type: 'doughnut',
      data: { labels: catKeys, datasets: [{ data: catKeys.map(k => catMap[k]), backgroundColor: chartColors(catKeys.length), borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { font: {size:11}, padding: 12 } } }
      }
    });
  } else {
    dCtx.canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-desc">No data yet</div></div>';
  }

  // Recent list
  const allTx = [
    ...load('expenses').map(e => ({...e, type:'expense'})),
    ...load('income').map(i => ({...i, type:'income'}))
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0,8);

  const rl = document.getElementById('recentList');
  if (!allTx.length) { rl.innerHTML = '<div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">No transactions yet</div><div class="empty-desc">Add an expense or income to get started</div></div>'; return; }
  rl.innerHTML = allTx.map(tx => `
    <div class="recent-item">
      <div class="recent-icon ${tx.type}">
        <i class="fa ${tx.type === 'expense' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
      </div>
      <div class="recent-info">
        <div class="recent-desc">${esc(tx.description)}</div>
        <div class="recent-meta">${tx.date} · ${esc(tx.category || tx.source)}</div>
      </div>
      <div class="recent-amount ${tx.type}">${tx.type === 'expense' ? '-' : '+'}${fmt(tx.amount)}</div>
    </div>
  `).join('');
}

// ── EXPENSES ────────────────────────────────────
function populateCatFilter() {
  const sel = document.getElementById('expenseCatFilter');
  const cats = [...new Set(load('expenses').map(e => e.category))].sort();
  sel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
}

function renderExpenseTable() {
  const q     = document.getElementById('expenseSearch').value.toLowerCase();
  const cat   = document.getElementById('expenseCatFilter').value;
  const sort  = document.getElementById('expenseSort').value;
  let data    = load('expenses');

  if (q)   data = data.filter(e => e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  if (cat) data = data.filter(e => e.category === cat);

  data = sortBy(data, sort);
  renderTable(data, 'expenseTableBody', 'expenseCount', 'expensePagination', expensePage,
    e => `<tr>
      <td>${e.date}</td>
      <td>${esc(e.description)}</td>
      <td><span class="badge badge-cat">${esc(e.category)}</span></td>
      <td style="font-weight:600; color:var(--danger);">${fmt(e.amount)}</td>
      <td><div class="action-btns"><button class="btn-outline btn-sm" onclick="editExpense('${e.id}')"><i class="fa fa-pen"></i></button></div></td>
    </tr>`,
    () => '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💸</div><div class="empty-title">No expenses found</div></div></td></tr>',
    (p) => { expensePage = p; renderExpenseTable(); }
  );
}

function openExpenseModal(reset = true) {
  if (reset) {
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expenseCat').value = 'Food & Dining';
    document.getElementById('expenseModalTitle').textContent = 'Add Expense';
    document.getElementById('expenseDeleteBtn').classList.add('hidden');
  }
  openModal('expenseModal');
}

function editExpense(id) {
  const e = load('expenses').find(x => x.id === id);
  if (!e) return;
  document.getElementById('expenseId').value = id;
  document.getElementById('expenseAmount').value = e.amount;
  document.getElementById('expenseDesc').value = e.description;
  document.getElementById('expenseDate').value = e.date;
  document.getElementById('expenseCat').value = e.category;
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseDeleteBtn').classList.remove('hidden');
  openModal('expenseModal');
}

function saveExpense() {
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const desc   = document.getElementById('expenseDesc').value.trim();
  const date   = document.getElementById('expenseDate').value;
  const cat    = document.getElementById('expenseCat').value;
  const id     = document.getElementById('expenseId').value;
  if (!amount || amount <= 0 || !desc || !date) { toast('Fill in all fields.','error'); return; }
  let data = load('expenses');
  if (id) {
    data = data.map(e => e.id === id ? {...e, amount, description:desc, date, category:cat} : e);
    toast('Expense updated.');
  } else {
    data.push({ id: uid(), amount, description: desc, date, category: cat });
    toast('Expense added.');
  }
  save('expenses', data);
  closeModal('expenseModal');
  renderExpenseTable();
  populateCatFilter();
}

function deleteExpense() {
  const id = document.getElementById('expenseId').value;
  if (!id || !confirm('Delete this expense?')) return;
  save('expenses', load('expenses').filter(e => e.id !== id));
  closeModal('expenseModal');
  toast('Expense deleted.');
  renderExpenseTable();
  populateCatFilter();
}

// ── INCOME ─────────────────────────────────────
function renderIncomeTable() {
  const q    = document.getElementById('incomeSearch').value.toLowerCase();
  const sort = document.getElementById('incomeSort').value;
  let data   = load('income');
  if (q) data = data.filter(i => i.description.toLowerCase().includes(q) || i.source.toLowerCase().includes(q));
  data = sortBy(data, sort);
  renderTable(data, 'incomeTableBody', 'incomeCount', 'incomePagination', incomePage,
    i => `<tr>
      <td>${i.date}</td>
      <td>${esc(i.description)}</td>
      <td><span class="badge badge-src">${esc(i.source)}</span></td>
      <td style="font-weight:600; color:var(--success);">+${fmt(i.amount)}</td>
      <td><div class="action-btns"><button class="btn-outline btn-sm" onclick="editIncome('${i.id}')"><i class="fa fa-pen"></i></button></div></td>
    </tr>`,
    () => '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💰</div><div class="empty-title">No income recorded yet</div></div></td></tr>',
    (p) => { incomePage = p; renderIncomeTable(); }
  );
}

function editIncome(id) {
  const i = load('income').find(x => x.id === id);
  if (!i) return;
  document.getElementById('incomeId').value = id;
  document.getElementById('incomeAmount').value = i.amount;
  document.getElementById('incomeDesc').value = i.description;
  document.getElementById('incomeDate').value = i.date;
  document.getElementById('incomeSrc').value = i.source;
  document.getElementById('incomeModalTitle').textContent = 'Edit Income';
  document.getElementById('incomeDeleteBtn').classList.remove('hidden');
  openModal('incomeModal');
}

function saveIncome() {
  const amount = parseFloat(document.getElementById('incomeAmount').value);
  const desc   = document.getElementById('incomeDesc').value.trim();
  const date   = document.getElementById('incomeDate').value;
  const source = document.getElementById('incomeSrc').value;
  const id     = document.getElementById('incomeId').value;
  if (!amount || amount <= 0 || !desc || !date) { toast('Fill in all fields.','error'); return; }
  let data = load('income');
  if (id) {
    data = data.map(i => i.id === id ? {...i, amount, description:desc, date, source} : i);
    toast('Income updated.');
  } else {
    data.push({ id: uid(), amount, description: desc, date, source });
    toast('Income added.');
  }
  save('income', data);
  closeModal('incomeModal');
  renderIncomeTable();
}

function deleteIncome() {
  const id = document.getElementById('incomeId').value;
  if (!id || !confirm('Delete this income entry?')) return;
  save('income', load('income').filter(i => i.id !== id));
  closeModal('incomeModal');
  toast('Income deleted.');
  renderIncomeTable();
}

// Reset income modal on open
document.getElementById('incomeModal').addEventListener('click', () => {});
function openIncomeModalFresh() {
  document.getElementById('incomeId').value = '';
  document.getElementById('incomeAmount').value = '';
  document.getElementById('incomeDesc').value = '';
  document.getElementById('incomeDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('incomeSrc').value = 'Salary';
  document.getElementById('incomeModalTitle').textContent = 'Add Income';
  document.getElementById('incomeDeleteBtn').classList.add('hidden');
  openModal('incomeModal');
}

// Patch the Add Income button
document.querySelector('[onclick="openModal(\'incomeModal\')"]') &&
  document.querySelector('[onclick="openModal(\'incomeModal\')"]').setAttribute('onclick', 'openIncomeModalFresh()');

function openExpenseModalFresh() {
  document.getElementById('expenseId').value = '';
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseDesc').value = '';
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expenseCat').value = 'Food & Dining';
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('expenseDeleteBtn').classList.add('hidden');
  openModal('expenseModal');
}

document.querySelector('[onclick="openModal(\'expenseModal\')"]') &&
  document.querySelector('[onclick="openModal(\'expenseModal\')"]').setAttribute('onclick', 'openExpenseModalFresh()');

// ── GOALS ──────────────────────────────────────
function renderGoals() {
  const goals = load('goals');
  const grid  = document.getElementById('goalsGrid');
  if (!goals.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🎯</div><div class="empty-title">No goals yet</div><div class="empty-desc">Set a savings goal to stay on track</div></div>`;
    return;
  }
  grid.innerHTML = goals.map(g => {
    const pct  = Math.min(100, Math.round((g.saved / g.target) * 100));
    const days = g.end ? Math.ceil((new Date(g.end) - new Date()) / 86400000) : null;
    return `
      <div class="goal-card">
        <div class="goal-name">${esc(g.name)}</div>
        <div class="goal-dates">${g.start || '–'} → ${g.end || '–'} ${days !== null ? `· <strong>${days > 0 ? days + ' days left' : 'Overdue'}</strong>` : ''}</div>
        <div class="goal-amounts">
          <div class="goal-amt-block">
            <div class="goal-amt-label">Target</div>
            <div class="goal-amt-val">${fmt(g.target)}</div>
          </div>
          <div class="goal-amt-block saved">
            <div class="goal-amt-label">Saved</div>
            <div class="goal-amt-val">${fmt(g.saved)}</div>
          </div>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="goal-pct">${pct}% complete</div>
        <div class="goal-actions">
          <button class="btn-primary btn-sm" onclick="openAddToGoal('${g.id}')"><i class="fa fa-plus"></i> Add</button>
          <button class="btn-outline btn-sm" onclick="editGoal('${g.id}')"><i class="fa fa-pen"></i> Edit</button>
          <button class="btn-danger btn-sm" onclick="deleteGoalById('${g.id}')"><i class="fa fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
}

function openGoalModalFresh() {
  document.getElementById('goalId').value = '';
  document.getElementById('goalName').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalSaved').value = '0';
  document.getElementById('goalStart').value = new Date().toISOString().split('T')[0];
  document.getElementById('goalEnd').value = '';
  document.getElementById('goalModalTitle').textContent = 'Add Goal';
  document.getElementById('goalDeleteBtn').classList.add('hidden');
  openModal('goalModal');
}

document.querySelector('[onclick="openModal(\'goalModal\')"]') &&
  document.querySelector('[onclick="openModal(\'goalModal\')"]').setAttribute('onclick', 'openGoalModalFresh()');

function editGoal(id) {
  const g = load('goals').find(x => x.id === id);
  if (!g) return;
  document.getElementById('goalId').value = id;
  document.getElementById('goalName').value = g.name;
  document.getElementById('goalTarget').value = g.target;
  document.getElementById('goalSaved').value = g.saved;
  document.getElementById('goalStart').value = g.start || '';
  document.getElementById('goalEnd').value = g.end || '';
  document.getElementById('goalModalTitle').textContent = 'Edit Goal';
  document.getElementById('goalDeleteBtn').classList.remove('hidden');
  openModal('goalModal');
}

function saveGoal() {
  const name   = document.getElementById('goalName').value.trim();
  const target = parseFloat(document.getElementById('goalTarget').value);
  const saved  = parseFloat(document.getElementById('goalSaved').value) || 0;
  const start  = document.getElementById('goalStart').value;
  const end    = document.getElementById('goalEnd').value;
  const id     = document.getElementById('goalId').value;
  if (!name || !target || target <= 0) { toast('Fill in name and target amount.','error'); return; }
  let data = load('goals');
  if (id) {
    data = data.map(g => g.id === id ? {...g, name, target, saved, start, end} : g);
    toast('Goal updated.');
  } else {
    data.push({ id: uid(), name, target, saved, start, end });
    toast('Goal added.');
  }
  save('goals', data);
  closeModal('goalModal');
  renderGoals();
}

function deleteGoal() {
  const id = document.getElementById('goalId').value;
  if (!id) return;
  deleteGoalById(id);
  closeModal('goalModal');
}

function deleteGoalById(id) {
  if (!confirm('Delete this goal?')) return;
  save('goals', load('goals').filter(g => g.id !== id));
  toast('Goal deleted.');
  renderGoals();
}

function openAddToGoal(id) {
  document.getElementById('addGoalId').value = id;
  document.getElementById('addGoalAmount').value = '';
  openModal('addGoalAmountModal');
}

function confirmAddToGoal() {
  const id     = document.getElementById('addGoalId').value;
  const amount = parseFloat(document.getElementById('addGoalAmount').value);
  if (!amount || amount <= 0) { toast('Enter a valid amount.','error'); return; }
  let data = load('goals');
  data = data.map(g => g.id === id ? {...g, saved: g.saved + amount} : g);
  save('goals', data);
  closeModal('addGoalAmountModal');
  toast('Amount added to goal!');
  renderGoals();
}

// ── ANALYTICS ──────────────────────────────────
function renderStats() {
  const period   = document.getElementById('statsPeriod').value;
  const expenses = periodFilter(load('expenses'), period);
  const income   = periodFilter(load('income'),   period);
  const totalExp = sum(expenses.map(e => e.amount));
  const totalInc = sum(income.map(i => i.amount));
  const balance  = totalInc - totalExp;

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card income"><div class="stat-label">Income</div><div class="stat-value positive">${fmt(totalInc)}</div></div>
    <div class="stat-card expense"><div class="stat-label">Expenses</div><div class="stat-value negative">${fmt(totalExp)}</div></div>
    <div class="stat-card balance"><div class="stat-label">Savings</div><div class="stat-value ${balance>=0?'positive':'negative'}">${fmt(balance)}</div></div>
    <div class="stat-card count"><div class="stat-label">Savings Rate</div><div class="stat-value">${totalInc ? Math.round((balance/totalInc)*100) : 0}%</div></div>
  `;

  // Pie chart
  const catMap = {};
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category]||0) + e.amount; });
  const catKeys = Object.keys(catMap);
  const pCtx = document.getElementById('statsPieChart').getContext('2d');
  if (catKeys.length) {
    charts.pie = new Chart(pCtx, {
      type: 'pie',
      data: { labels: catKeys, datasets: [{ data: catKeys.map(k=>catMap[k]), backgroundColor: chartColors(catKeys.length), borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, padding:10 } } } }
    });
  }

  // Bar chart – last 6 months income vs expense
  const months = [];
  const incVals = [], expVals = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString('default',{month:'short'});
    const yr = d.getFullYear(), mn = d.getMonth();
    months.push(label);
    const mInc = load('income').filter(x => { const dd=new Date(x.date); return dd.getFullYear()===yr && dd.getMonth()===mn; });
    const mExp = load('expenses').filter(x => { const dd=new Date(x.date); return dd.getFullYear()===yr && dd.getMonth()===mn; });
    incVals.push(sum(mInc.map(x=>x.amount)));
    expVals.push(sum(mExp.map(x=>x.amount)));
  }
  const bCtx = document.getElementById('statsBarChart').getContext('2d');
  charts.bar = new Chart(bCtx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label:'Income',   data:incVals, backgroundColor:'rgba(16,185,129,0.7)', borderRadius:4 },
        { label:'Expenses', data:expVals, backgroundColor:'rgba(239,68,68,0.7)',  borderRadius:4 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', labels:{ font:{size:11} } } },
      scales:{ y:{ ticks:{ callback: v=>'₹'+v.toLocaleString('en-IN') } } }
    }
  });

  // Category breakdown table
  const tbody = document.getElementById('categoryBreakdown');
  if (!catKeys.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-2);padding:20px;">No data</td></tr>'; return; }
  const sorted = catKeys.sort((a,b) => catMap[b]-catMap[a]);
  tbody.innerHTML = sorted.map(cat => `
    <tr>
      <td><span class="badge badge-cat">${esc(cat)}</span></td>
      <td>${expenses.filter(e=>e.category===cat).length}</td>
      <td style="font-weight:600;">${fmt(catMap[cat])}</td>
      <td>${totalExp ? Math.round((catMap[cat]/totalExp)*100) : 0}%</td>
    </tr>
  `).join('');
}

// ── REPORT ─────────────────────────────────────
function setDefaultReportDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end   = now.toISOString().split('T')[0];
  document.getElementById('reportStart').value = start;
  document.getElementById('reportEnd').value   = end;
}

function generateReport() {
  const start = document.getElementById('reportStart').value;
  const end   = document.getElementById('reportEnd').value;
  if (!start || !end) { toast('Select both dates.','error'); return; }
  const inRange = (d) => d >= start && d <= end;

  const expenses = load('expenses').filter(e => inRange(e.date)).sort((a,b) => a.date.localeCompare(b.date));
  const income   = load('income').filter(i => inRange(i.date)).sort((a,b) => a.date.localeCompare(b.date));
  const totalExp = sum(expenses.map(e=>e.amount));
  const totalInc = sum(income.map(i=>i.amount));
  const net      = totalInc - totalExp;

  const out = document.getElementById('reportOutput');
  out.innerHTML = `
    <div class="report-stat-row">
      <div class="stat-card income"><div class="stat-label">Total Income</div><div class="stat-value positive">${fmt(totalInc)}</div></div>
      <div class="stat-card expense"><div class="stat-label">Total Expenses</div><div class="stat-value negative">${fmt(totalExp)}</div></div>
      <div class="stat-card balance"><div class="stat-label">Net Balance</div><div class="stat-value ${net>=0?'positive':'negative'}">${fmt(net)}</div></div>
    </div>

    ${income.length ? `
    <div class="report-section-title" style="color:var(--success);"><i class="fa fa-arrow-trend-up"></i> Income (${income.length} entries)</div>
    <div class="table-card" style="margin-bottom:20px;">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Description</th><th>Source</th><th>Amount</th></tr></thead>
        <tbody>${income.map(i=>`<tr><td>${i.date}</td><td>${esc(i.description)}</td><td><span class="badge badge-src">${esc(i.source)}</span></td><td style="color:var(--success);font-weight:600;">+${fmt(i.amount)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}

    ${expenses.length ? `
    <div class="report-section-title" style="color:var(--danger);"><i class="fa fa-arrow-trend-down"></i> Expenses (${expenses.length} entries)</div>
    <div class="table-card">
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
        <tbody>${expenses.map(e=>`<tr><td>${e.date}</td><td>${esc(e.description)}</td><td><span class="badge badge-cat">${esc(e.category)}</span></td><td style="color:var(--danger);font-weight:600;">${fmt(e.amount)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}

    ${!income.length && !expenses.length ? '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No data in this range</div></div>' : ''}
  `;
}

function printReport() {
  window.print();
}

// ── TABLE RENDER HELPER ────────────────────────
function renderTable(data, tbodyId, countId, paginId, currentPage, rowFn, emptyFn, onPageChange) {
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const page  = Math.min(currentPage, pages);
  const start = (page - 1) * ITEMS_PER_PAGE;
  const slice = data.slice(start, start + ITEMS_PER_PAGE);

  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = slice.length ? slice.map(rowFn).join('') : emptyFn();

  const countEl = document.getElementById(countId);
  countEl.textContent = total ? `Showing ${start+1}–${Math.min(start+ITEMS_PER_PAGE, total)} of ${total}` : '';

  const pag = document.getElementById(paginId);
  if (pages <= 1) { pag.innerHTML = ''; return; }
  let btns = '';
  if (page > 1) btns += `<button class="pg-btn" onclick="(${onPageChange.toString()})(${page-1})">‹</button>`;
  for (let i = Math.max(1,page-2); i <= Math.min(pages,page+2); i++) {
    btns += `<button class="pg-btn ${i===page?'active':''}" onclick="(${onPageChange.toString()})(${i})">${i}</button>`;
  }
  if (page < pages) btns += `<button class="pg-btn" onclick="(${onPageChange.toString()})(${page+1})">›</button>`;
  pag.innerHTML = btns;
}

function sortBy(arr, sort) {
  return [...arr].sort((a,b) => {
    if (sort === 'date_asc')    return a.date.localeCompare(b.date);
    if (sort === 'date_desc')   return b.date.localeCompare(a.date);
    if (sort === 'amount_asc')  return a.amount - b.amount;
    if (sort === 'amount_desc') return b.amount - a.amount;
    return 0;
  });
}

// ── XSS ESCAPE ─────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── KEYBOARD SHORTCUTS ─────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

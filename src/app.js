
const CATS = {
	'Água': '💧', 'Luz': '⚡', 'Internet': '📶', 'Gás': '🔥', 'Aluguel/Moradia': '🏠', 'Pets': '🐾',
	'Streaming': '📺', 'Saúde': '💊', 'Alimentação': '🍽️', 'Transporte': '🚗', 'Educação': '📚',
	'Lazer': '🎮', 'Vestuário': '👕', 'Serviços': '🔧', 'Outros': '📦'
};
const COLORS = ['#1D9E75', '#378ADD', '#D85A30', '#7F77DD', '#BA7517', '#D4537E', '#639922', '#E24B4A'];

let state = {
	members: [
		{ id: '1', name: 'Ana', color: '#1D9E75' },
		{ id: '2', name: 'Bruno', color: '#378ADD' }
	],
	expenses: [],
	currentMonth: new Date().toISOString().slice(0, 7)
};

let editingExpenseId = null;
let editingMemberId = null;

function save() { localStorage.setItem('fct_state', JSON.stringify(state)) }
function load() {
	const d = localStorage.getItem('fct_state');
	if (d) try { state = JSON.parse(d) } catch (e) { }
}
load();

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function fmtMonth(ym) { const [y, m] = ym.split('-'); return MONTHS_PT[+m - 1] + ' ' + y }
function fmtMoney(v) { return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') }

function changeMonth(d) {
	const [y, m] = state.currentMonth.split('-').map(Number);
	const dt = new Date(y, m - 1 + d, 1);
	state.currentMonth = dt.toISOString().slice(0, 7);
	renderAll();
}

function setPage(p) {
	document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
	document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
	document.getElementById('page-' + p).classList.add('active');
	const idx = ['dashboard', 'expenses', 'members', 'data'].indexOf(p);
	document.querySelectorAll('.nav-btn')[idx].classList.add('active');
	renderAll();
}

function getMonthExpenses(ym) { return state.expenses.filter(e => e.month === ym) }

function calcBalances(ym) {
	const exps = getMonthExpenses(ym);
	const bal = {};
	state.members.forEach(m => { bal[m.id] = { paid: 0, owed: 0, individual: 0 } });
	exps.forEach(e => {
		if (e.isIndividual) {
			if (bal[e.paidBy]) bal[e.paidBy].individual += e.amount;
		} else {
			const split = e.splitAmong && e.splitAmong.length > 0 ? e.splitAmong : state.members.map(m => m.id);
			const share = e.amount / split.length;
			if (bal[e.paidBy]) bal[e.paidBy].paid += e.amount;
			split.forEach(mid => { if (bal[mid]) bal[mid].owed += share });
		}
	});
	const result = {};
	state.members.forEach(m => {
		const net = bal[m.id].paid - bal[m.id].owed;
		result[m.id] = { paid: bal[m.id].paid, owed: bal[m.id].owed, individual: bal[m.id].individual, net };
	});
	return result;
}

function renderDashboard() {
	const ym = state.currentMonth;
	document.getElementById('month-label').textContent = fmtMonth(ym);
	const exps = getMonthExpenses(ym);
	const shared = exps.filter(e => !e.isIndividual);
	const individual = exps.filter(e => e.isIndividual);
	const totalShared = shared.reduce((a, e) => a + e.amount, 0);
	const totalInd = individual.reduce((a, e) => a + e.amount, 0);
	const total = totalShared + totalInd;

	document.getElementById('summary-metrics').innerHTML = `
    <div class="metric"><div class="metric-label">Total do mês</div><div class="metric-value">${fmtMoney(total)}</div></div>
    <div class="metric"><div class="metric-label">Despesas compartilhadas</div><div class="metric-value">${fmtMoney(totalShared)}</div></div>
    <div class="metric"><div class="metric-label">Despesas individuais</div><div class="metric-value">${fmtMoney(totalInd)}</div></div>
    <div class="metric"><div class="metric-label">Nº de lançamentos</div><div class="metric-value">${exps.length}</div></div>
  `;

	const balances = calcBalances(ym);
	const maxAbs = Math.max(...Object.values(balances).map(b => Math.abs(b.net)), 1);
	let html = '<div class="grid-2">';
	state.members.forEach(m => {
		const b = balances[m.id];
		const pct = Math.min(100, Math.abs(b.net) / maxAbs * 100);
		const cls = b.net >= 0 ? 'positive' : 'negative';
		const tag = b.net > 0.01 ? `<span class="tag tag-credit">crédito ${fmtMoney(b.net)}</span>` : b.net < -0.01 ? `<span class="tag tag-debit">débito ${fmtMoney(Math.abs(b.net))}</span>` : `<span class="tag tag-neutral">quits</span>`;
		html += `<div class="member-balance">
      <div class="member-header">
        <div class="avatar" style="background:${m.color}22;color:${m.color}">${m.name.slice(0, 2).toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:500;font-size:13px">${m.name}</div>
          <div style="font-size:11px;color:var(--color-text-secondary)">Pagou: ${fmtMoney(b.paid)} · Deve: ${fmtMoney(b.owed)}</div>
        </div>
        ${tag}
      </div>
      <div class="balance-bar ${cls}"><div class="balance-fill" style="width:${pct}%"></div></div>
    </div>`;
	});
	html += '</div>';
	document.getElementById('member-balances').innerHTML = html || '<div class="empty">Sem membros cadastrados</div>';

	const catTotals = {};
	shared.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount });
	const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
	const maxVal = sorted.length ? sorted[0][1] : 1;
	let catHtml = sorted.length ? sorted.map(([cat, val]) => {
		const pct = val / maxVal * 100;
		return `<div class="progress-row"><span style="width:90px;flex-shrink:0">${CATS[cat] || '📦'} ${cat}</span>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:#378ADD"></div></div>
      <span style="width:90px;text-align:right;font-size:12px">${fmtMoney(val)}</span></div>`;
	}).join('') : '<div class="empty">Sem despesas compartilhadas</div>';
	document.getElementById('category-chart').innerHTML = catHtml;

	const recent = exps.slice(-6).reverse();
	let rHtml = recent.length ? recent.map(e => {
		const payer = state.members.find(m => m.id === e.paidBy);
		return `<div class="expense-row">
      <div class="cat-icon">${CATS[e.category] || '📦'}</div>
      <div><div style="font-weight:500">${e.desc}</div><div style="font-size:11px;color:var(--color-text-secondary)">${e.isIndividual ? 'Individual' : 'Compartilhada'} · ${payer ? payer.name : '?'}</div></div>
      <span class="cat-badge">${e.category}</span>
      <span style="font-weight:500;white-space:nowrap">${fmtMoney(e.amount)}</span>
    </div>`;
	}).join('') : '<div class="empty">Sem despesas neste mês</div>';
	document.getElementById('recent-expenses').innerHTML = rHtml;
}

function renderExpenses() {
	const ym = state.currentMonth;
	document.getElementById('month-label-2').textContent = fmtMonth(ym);
	const exps = getMonthExpenses(ym);
	let html = exps.length ? exps.map(e => {
		const payer = state.members.find(m => m.id === e.paidBy);
		const splitNames = e.isIndividual ? 'Individual' :
			(e.splitAmong && e.splitAmong.length) ? e.splitAmong.map(id => state.members.find(m => m.id === id)?.name || '?').join(', ') : 'Todos';
		return `<div class="expense-row ${e.isIndividual ? 'individual' : ''}">
      <div class="cat-icon">${CATS[e.category] || '📦'}</div>
      <div>
        <div style="font-weight:500">${e.desc}</div>
        <div style="font-size:11px;color:var(--color-text-secondary)">
          ${payer ? `<span style="color:${payer.color};font-weight:500">${payer.name}</span>` : ''} · ${splitNames}
        </div>
      </div>
      <span class="cat-badge">${e.category}</span>
      <span style="font-weight:500;white-space:nowrap;min-width:80px;text-align:right">${fmtMoney(e.amount)}</span>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm" onclick="editExpense('${e.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteExpense('${e.id}')">🗑</button>
      </div>
    </div>`;
	}).join('') : '<div class="empty">Sem despesas neste mês. Clique em "+ Nova despesa" para adicionar.</div>';
	document.getElementById('expenses-list').innerHTML = html;
}

function renderMembers() {
	let html = state.members.map(m => `
    <div class="member-row">
      <div class="avatar" style="background:${m.color}22;color:${m.color}">${m.name.slice(0, 2).toUpperCase()}</div>
      <div style="flex:1;font-weight:500">${m.name}</div>
      <div class="color-swatch" style="background:${m.color}"></div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm" onclick="editMember('${m.id}')">✏️</button>
        ${state.members.length > 1 ? `<button class="btn btn-sm btn-danger" onclick="deleteMember('${m.id}')">🗑</button>` : ''}
      </div>
    </div>
  `).join('');
	document.getElementById('members-list').innerHTML = html || '<div class="empty">Nenhum membro</div>';
}

function renderAnnualSummary() {
	const year = state.currentMonth.slice(0, 4);
	const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
	let html = `<table class="summary-table"><thead><tr><th>Mês</th><th style="text-align:right">Total</th><th style="text-align:right">Compartilhado</th><th style="text-align:right">Individual</th>`;
	state.members.forEach(m => { html += `<th style="text-align:right;color:${m.color}">${m.name}</th>` });
	html += '</tr></thead><tbody>';
	let totTot = 0, totSh = 0, totInd = 0;
	const totMem = {}; state.members.forEach(m => { totMem[m.id] = 0 });
	months.forEach(ym => {
		const exps = getMonthExpenses(ym);
		if (!exps.length) return;
		const sh = exps.filter(e => !e.isIndividual).reduce((a, e) => a + e.amount, 0);
		const ind = exps.filter(e => e.isIndividual).reduce((a, e) => a + e.amount, 0);
		const tot = sh + ind;
		totTot += tot; totSh += sh; totInd += ind;
		const bal = calcBalances(ym);
		html += `<tr><td>${fmtMonth(ym)}</td><td style="text-align:right">${fmtMoney(tot)}</td><td style="text-align:right">${fmtMoney(sh)}</td><td style="text-align:right">${fmtMoney(ind)}</td>`;
		state.members.forEach(m => {
			const b = bal[m.id];
			const net = b.net;
			totMem[m.id] += net;
			html += `<td style="text-align:right;${net > 0.01 ? 'color:#1D9E75' : net < -0.01 ? 'color:#E24B4A' : ''}">${net > 0.01 ? '+' : ''}${fmtMoney(net)}</td>`;
		});
		html += '</tr>';
	});
	html += `<tr style="font-weight:500;border-top:1px solid var(--color-border-secondary)"><td>Total ${year}</td><td style="text-align:right">${fmtMoney(totTot)}</td><td style="text-align:right">${fmtMoney(totSh)}</td><td style="text-align:right">${fmtMoney(totInd)}</td>`;
	state.members.forEach(m => {
		const net = totMem[m.id];
		html += `<td style="text-align:right;${net > 0.01 ? 'color:#1D9E75' : net < -0.01 ? 'color:#E24B4A' : ''}">${net > 0.01 ? '+' : ''}${fmtMoney(net)}</td>`;
	});
	html += '</tr></tbody></table>';
	document.getElementById('annual-summary').innerHTML = html;
}

function renderAll() {
	renderDashboard();
	renderExpenses();
	renderMembers();
	renderAnnualSummary();
}

function openExpenseModal(id) {
	editingExpenseId = id || null;
	const modal = document.getElementById('expense-modal');
	document.getElementById('expense-modal-title').textContent = id ? 'Editar despesa' : 'Nova despesa';
	const paidSel = document.getElementById('e-paidby');
	paidSel.innerHTML = state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
	const splitDiv = document.getElementById('split-checks');
	splitDiv.innerHTML = state.members.map(m => `<label><input type="checkbox" value="${m.id}" checked> ${m.name}</label>`).join('');
	if (id) {
		const e = state.expenses.find(x => x.id === id);
		document.getElementById('e-desc').value = e.desc;
		document.getElementById('e-amount').value = e.amount;
		document.getElementById('e-cat').value = e.category;
		paidSel.value = e.paidBy;
		document.getElementById('e-type').value = e.isIndividual ? 'individual' : 'shared';
		if (!e.isIndividual && e.splitAmong) {
			splitDiv.querySelectorAll('input[type=checkbox]').forEach(cb => {
				cb.checked = e.splitAmong.includes(cb.value);
			});
		}
		toggleSplit();
	} else {
		document.getElementById('e-desc').value = '';
		document.getElementById('e-amount').value = '';
		document.getElementById('e-cat').value = 'Água';
		document.getElementById('e-type').value = 'shared';
		toggleSplit();
	}
	modal.classList.add('open');
}

function closeExpenseModal() {
	document.getElementById('expense-modal').classList.remove('open');
	editingExpenseId = null;
}

function toggleSplit() {
	const t = document.getElementById('e-type').value;
	document.getElementById('split-section').style.display = t === 'individual' ? 'none' : 'block';
}

function saveExpense() {
	const desc = document.getElementById('e-desc').value.trim();
	const amount = parseFloat(document.getElementById('e-amount').value);
	const category = document.getElementById('e-cat').value;
	const paidBy = document.getElementById('e-paidby').value;
	const isIndividual = document.getElementById('e-type').value === 'individual';
	if (!desc || isNaN(amount) || amount <= 0) { alert('Preencha descrição e valor.'); return }
	const splitAmong = isIndividual ? [] : [...document.getElementById('split-checks').querySelectorAll('input:checked')].map(cb => cb.value);
	if (!isIndividual && splitAmong.length === 0) { alert('Selecione ao menos um membro para dividir.'); return }
	if (editingExpenseId) {
		const idx = state.expenses.findIndex(e => e.id === editingExpenseId);
		state.expenses[idx] = { ...state.expenses[idx], desc, amount, category, paidBy, isIndividual, splitAmong };
	} else {
		state.expenses.push({ id: Date.now() + '', month: state.currentMonth, desc, amount, category, paidBy, isIndividual, splitAmong });
	}
	save(); renderAll(); closeExpenseModal();
}

function deleteExpense(id) {
	if (!confirm('Excluir esta despesa?')) return;
	state.expenses = state.expenses.filter(e => e.id !== id);
	save(); renderAll();
}

function editExpense(id) { openExpenseModal(id) }

function openMemberModal(id) {
	editingMemberId = id || null;
	document.getElementById('member-modal-title').textContent = id ? 'Editar membro' : 'Novo membro';
	if (id) {
		const m = state.members.find(x => x.id === id);
		document.getElementById('m-name').value = m.name;
		document.getElementById('m-color').value = m.color;
	} else {
		document.getElementById('m-name').value = '';
		document.getElementById('m-color').value = COLORS[state.members.length % COLORS.length];
	}
	document.getElementById('member-modal').classList.add('open');
}

function closeMemberModal() {
	document.getElementById('member-modal').classList.remove('open');
	editingMemberId = null;
}

function saveMember() {
	const name = document.getElementById('m-name').value.trim();
	const color = document.getElementById('m-color').value;
	if (!name) { alert('Informe um nome.'); return }
	if (editingMemberId) {
		const idx = state.members.findIndex(m => m.id === editingMemberId);
		state.members[idx] = { ...state.members[idx], name, color };
	} else {
		state.members.push({ id: Date.now() + '', name, color });
	}
	save(); renderAll(); closeMemberModal();
}

function editMember(id) { openMemberModal(id) }

function deleteMember(id) {
	if (!confirm('Excluir membro? As despesas relacionadas não serão excluídas.')) return;
	state.members = state.members.filter(m => m.id !== id);
	save(); renderAll();
}

function buildXLSXMonth(ym) {
	const wb = XLSX.utils.book_new();
	const exps = getMonthExpenses(ym);
	const balances = calcBalances(ym);

	const expRows = [['Descrição', 'Categoria', 'Valor (R$)', 'Pago por', 'Tipo', 'Dividido entre']];
	exps.forEach(e => {
		const payer = state.members.find(m => m.id === e.paidBy)?.name || '?';
		const split = e.isIndividual ? 'Individual' :
			(e.splitAmong?.length ? e.splitAmong.map(id => state.members.find(m => m.id === id)?.name || '?').join(', ') : 'Todos');
		expRows.push([e.desc, e.category, e.amount, payer, e.isIndividual ? 'Individual' : 'Compartilhada', split]);
	});
	const wsExp = XLSX.utils.aoa_to_sheet(expRows);
	XLSX.utils.book_append_sheet(wb, wsExp, 'Despesas');

	const balRows = [['Membro', 'Pagou (R$)', 'Deve (R$)', 'Individual (R$)', 'Saldo (R$)', 'Status']];
	state.members.forEach(m => {
		const b = balances[m.id];
		const status = b.net > 0.01 ? 'Crédito' : b.net < -0.01 ? 'Débito' : 'Quits';
		balRows.push([m.name, b.paid, b.owed, b.individual, b.net, status]);
	});
	const wsBal = XLSX.utils.aoa_to_sheet(balRows);
	XLSX.utils.book_append_sheet(wb, wsBal, 'Balanço');
	return wb;
}

function exportMonthXLSX() {
	const ym = state.currentMonth;
	const wb = buildXLSXMonth(ym);
	XLSX.writeFile(wb, `custos_${ym}.xlsx`);
}

function exportFullXLSX() {
	const wb = XLSX.utils.book_new();
	const months = [...new Set(state.expenses.map(e => e.month))].sort();
	if (!months.length) { alert('Sem dados para exportar.'); return }

	const allRows = [['Mês', 'Descrição', 'Categoria', 'Valor (R$)', 'Pago por', 'Tipo', 'Dividido entre']];
	state.expenses.forEach(e => {
		const payer = state.members.find(m => m.id === e.paidBy)?.name || '?';
		const split = e.isIndividual ? 'Individual' :
			(e.splitAmong?.length ? e.splitAmong.map(id => state.members.find(m => m.id === id)?.name || '?').join(', ') : 'Todos');
		allRows.push([fmtMonth(e.month), e.desc, e.category, e.amount, payer, e.isIndividual ? 'Individual' : 'Compartilhada', split]);
	});
	XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allRows), 'Todas as Despesas');

	const memCols = state.members.map(m => m.name);
	const sumRows = [['Mês', 'Total (R$)', 'Compartilhado (R$)', 'Individual (R$)', ...memCols.map(n => n + ' Saldo')]];
	months.forEach(ym => {
		const exps = getMonthExpenses(ym);
		const sh = exps.filter(e => !e.isIndividual).reduce((a, e) => a + e.amount, 0);
		const ind = exps.filter(e => e.isIndividual).reduce((a, e) => a + e.amount, 0);
		const bal = calcBalances(ym);
		sumRows.push([fmtMonth(ym), sh + ind, sh, ind, ...state.members.map(m => bal[m.id].net)]);
	});
	XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Resumo Mensal');

	months.forEach(ym => {
		const wm = buildXLSXMonth(ym);
		wm.SheetNames.forEach(sn => {
			const name = `${fmtMonth(ym).split(' ')[0].slice(0, 3)}-${ym.slice(0, 4)} ${sn}`.slice(0, 31);
			XLSX.utils.book_append_sheet(wb, wm.Sheets[sn], name);
		});
	});

	XLSX.writeFile(wb, `custos_familia_completo.xlsx`);
}

function exportJSON() {
	const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = 'custos_familia_backup.json';
	a.click();
}

function importData(input) {
	const file = input.files[0];
	if (!file) return;
	const ext = file.name.split('.').pop().toLowerCase();
	const reader = new FileReader();
	reader.onload = e => {
		try {
			if (ext === 'json') {
				const data = JSON.parse(e.target.result);
				if (data.members && data.expenses) {
					if (confirm('Importar dados? Isso substituirá os dados atuais.')) {
						state = { ...state, ...data };
						save(); renderAll(); alert('Dados importados com sucesso!');
					}
				} else { alert('Arquivo JSON inválido.') }
			} else if (ext === 'xlsx') {
				const wb = XLSX.read(e.target.result, { type: 'binary' });
				const ws = wb.Sheets[wb.SheetNames[0]];
				const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
				if (rows.length < 2) { alert('Planilha sem dados.'); return }
				const header = rows[0];
				const descIdx = header.indexOf('Descrição');
				const catIdx = header.indexOf('Categoria');
				const valIdx = header.indexOf('Valor (R$)');
				const payIdx = header.indexOf('Pago por');
				const typeIdx = header.indexOf('Tipo');
				const splitIdx = header.indexOf('Dividido entre');
				const monthIdx = header.indexOf('Mês');
				if (descIdx < 0 || valIdx < 0) { alert('Formato de planilha não reconhecido.\nImporte um arquivo exportado por este sistema.'); return }
				const newExps = [];
				rows.slice(1).forEach(row => {
					const payerName = row[payIdx];
					const payer = state.members.find(m => m.name === payerName);
					if (!payer) return;
					const isInd = row[typeIdx] === 'Individual';
					const splitNames = (row[splitIdx] || '').split(',').map(s => s.trim());
					const splitAmong = isInd ? [] : splitNames.map(n => state.members.find(m => m.name === n)?.id).filter(Boolean);
					const monthStr = monthIdx >= 0 ? row[monthIdx] : null;
					let month = state.currentMonth;
					if (monthStr) {
						const mi = MONTHS_PT.findIndex(x => monthStr.startsWith(x));
						if (mi >= 0) { const yr = monthStr.split(' ')[1]; month = `${yr}-${String(mi + 1).padStart(2, '0')}` }
					}
					newExps.push({ id: Date.now() + '_' + Math.random(), month, desc: row[descIdx], amount: parseFloat(row[valIdx]) || 0, category: row[catIdx] || 'Outros', paidBy: payer.id, isIndividual: isInd, splitAmong });
				});
				if (confirm(`Importar ${newExps.length} despesas da planilha?`)) {
					state.expenses = [...state.expenses, ...newExps];
					save(); renderAll(); alert('Importado com sucesso!');
				}
			}
		} catch (err) { alert('Erro ao importar: ' + err.message) }
	};
	if (ext === 'xlsx') reader.readAsBinaryString(file);
	else reader.readAsText(file);
	input.value = '';
}

document.getElementById('expense-modal').addEventListener('click', function (e) { if (e.target === this) closeExpenseModal() });
document.getElementById('member-modal').addEventListener('click', function (e) { if (e.target === this) closeMemberModal() });

renderAll();
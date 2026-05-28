// public/AdminUserViewPage.js
class AdminUserViewPage {
    constructor(router) {
        this.router       = router;
        this.root         = document.getElementById('root');
        this.targetUserId = null;
        this.targetLogin  = null;
    }

    async render(targetUserId, targetLogin) {
        this.targetUserId = targetUserId;
        this.targetLogin  = targetLogin;

        // Запрашиваем статус заявки и профиль параллельно
        let hasRequest = false, requestDetails = null, isBlocked = false;
        const [reqRes, profileRes] = await Promise.allSettled([
            fetch(`/api/requests/${targetUserId}`).then(r => r.json()),
            fetch(`/api/profile/${targetUserId}`).then(r => r.json())
        ]);
        if (reqRes.status === 'fulfilled')     { hasRequest = reqRes.value.hasRequest; requestDetails = reqRes.value.details; }
        if (profileRes.status === 'fulfilled') { isBlocked  = profileRes.value.is_blocked === true; }

        const accountLabel = hasRequest
            ? (requestDetails?.accountType === 'existing' && requestDetails?.accountId
                ? `привязать к счёту #${requestDetails.accountId}`
                : 'создать новый счёт')
            : '';

        this.root.innerHTML = `
            <div class="admin-shell">

                <!-- Инфо-полоска -->
                <div class="admin-info-bar">
                    <span>👤 <strong>${targetLogin}</strong></span>
                    <span style="color:var(--text-muted)">ID: ${targetUserId}</span>

                    <!-- Статус и кнопка блокировки -->
                    <span class="status-badge ${isBlocked ? 'status-blocked' : 'status-active'}">
                        ${isBlocked ? '🔒 Заблокирован' : '✓ Активен'}
                    </span>
                    <button id="btnBlockToggle" class="${isBlocked ? 'unblock-btn' : 'block-btn'}">
                        ${isBlocked ? '🔓 Разблокировать' : '🔒 Заблокировать'}
                    </button>

                    <!-- Баннер заявки на карту -->
                    <div id="requestArea" style="margin-left:auto; display:flex; align-items:center;">
                        ${hasRequest ? `
                            <div class="request-banner" style="margin:0; gap:12px;">
                                <div>
                                    <span>📋 Запрос на карту</span>
                                    <span style="font-size:11px;color:#555;margin-left:6px;">(${accountLabel})</span>
                                </div>
                                <div style="display:flex;gap:6px;">
                                    <button id="btnApprove" class="approve-btn">✓ Выпустить</button>
                                    <button id="btnReject"  class="reject-btn">✗ Отклонить</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="admin-body">
                    <div id="adminUserContent"></div>
                </div>

                <div class="admin-footer">
                    <button id="btnBackToList" style="background:#6c757d;">⬅ Вернуться к списку</button>
                </div>
            </div>
        `;

        // Кнопки-вкладки в app-bar
        this._setupAppNav();

        // Одобрить → создать карту
        if (hasRequest) {
            document.getElementById('btnApprove').onclick = async () => {
                const btn = document.getElementById('btnApprove');
                btn.disabled = true; btn.textContent = '...';
                try {
                    const res  = await fetch(`/api/requests/${targetUserId}/approve`, { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                        document.getElementById('requestArea').innerHTML =
                            '<span class="badge-ok" style="padding:6px 14px;border-radius:8px;font-size:13px;">✅ Карта выпущена</span>';
                        // Обновляем вкладку карт через секунду
                        setTimeout(() => this.switchTab('cards'), 900);
                    } else {
                        document.getElementById('requestArea').innerHTML =
                            `<span class="badge-err" style="padding:6px 14px;border-radius:8px;font-size:13px;">❌ ${data.message}</span>`;
                    }
                } catch (_) {
                    btn.disabled = false; btn.textContent = '✓ Выпустить';
                }
            };

            // Отклонить → удалить запрос
            document.getElementById('btnReject').onclick = async () => {
                try {
                    await fetch(`/api/requests/${targetUserId}`, { method: 'DELETE' });
                    document.getElementById('requestArea').innerHTML =
                        '<span style="font-size:13px;color:#856404;background:#fff3cd;padding:6px 14px;border-radius:8px;">Запрос отклонён</span>';
                } catch (_) {}
            };
        }

        // Блокировка / разблокировка
        document.getElementById('btnBlockToggle').onclick = async () => {
            const btn      = document.getElementById('btnBlockToggle');
            btn.disabled   = true;
            const endpoint = isBlocked ? 'unblock' : 'block';
            try {
                const res  = await fetch(`/api/users/${targetUserId}/${endpoint}`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    // Перерисовываем страницу с обновлённым статусом
                    await this.render(targetUserId, targetLogin);
                } else {
                    btn.disabled = false;
                }
            } catch (_) { btn.disabled = false; }
        };

        document.getElementById('btnBackToList').onclick = () => {
            this._clearAppNav();
            this.router.navigateTo('/home');
        };

        this.switchTab('cards');
    }

    _setupAppNav() {
        const nav = document.getElementById('appNav');
        if (!nav) return;
        nav.innerHTML = `
            <button class="app-nav-btn" id="appBtnTabCards"> Карты и счета</button>
            <button class="app-nav-btn" id="appBtnTabTransfers"> Последние переводы</button>
        `;
        document.getElementById('appBtnTabCards').onclick     = () => this.switchTab('cards');
        document.getElementById('appBtnTabTransfers').onclick = () => this.switchTab('transfers');
    }

    _clearAppNav() {
        ['appNav','appUserArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    switchTab(tabName) {
        const content = document.getElementById('adminUserContent');
        if (!content) return;
        document.querySelectorAll('.app-nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabName === 'cards' ? 'appBtnTabCards' : 'appBtnTabTransfers')
            ?.classList.add('active');
        if (tabName === 'cards') this.renderCardsAndAccounts(content);
        else                      this.renderTransferHistory(content);
    }

    // ─── Вкладка: карты и счета ───────────────────────────────────────────────
    async renderCardsAndAccounts(content) {
        content.innerHTML = '<p class="loading-text">Загрузка...</p>';
        const [cardsRes, accountsRes] = await Promise.allSettled([
            fetch(`/api/cards/${this.targetUserId}`).then(r => r.json()),
            fetch(`/api/accounts/${this.targetUserId}`).then(r => r.json())
        ]);
        const cardsData    = cardsRes.status    === 'fulfilled' ? cardsRes.value    : null;
        const accountsData = accountsRes.status === 'fulfilled' ? accountsRes.value : null;

        let html = `<h4 class="section-subtitle">Карты</h4>`;
        if (!cardsData?.cards?.length) {
            html += `<p class="empty-hint">Нет активных карт</p>`;
        } else {
            html += `<div class="detail-list">`;
            cardsData.cards.forEach(card => {
                html += `<div class="detail-card">
                    <div class="detail-row">
                        <span class="card-label">Номер карты</span>
                        <span class="card-value mono">${this.formatCard(card.out_card_number)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="card-label">Владелец</span>
                        <span class="card-value">${card.out_card_username ?? '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="card-label">Баланс</span>
                        <span class="card-value balance-positive">${card.out_balance} ₽</span>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        html += `<h4 class="section-subtitle" style="margin-top:14px;">Банковские счета</h4>`;
        if (!accountsData?.accounts?.length) {
            html += `<p class="empty-hint">Нет привязанных счетов</p>`;
        } else {
            html += `<div class="detail-list">`;
            accountsData.accounts.forEach(acc => {
                html += `<div class="detail-card">
                    <div class="detail-row">
                        <span class="card-label">Номер счёта</span>
                        <span class="card-value">${acc.acc_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="card-label">Баланс</span>
                        <span class="card-value balance-positive">${acc.balance} ₽</span>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }
        content.innerHTML = html;
    }

    // ─── Вкладка: последние переводы ──────────────────────────────────────────
    async renderTransferHistory(content) {
        content.innerHTML = '<p class="loading-text">Загрузка переводов...</p>';
        try {
            const data = await fetch(`/api/transfers/${this.targetUserId}`).then(r => r.json());
            if (!data.transfers?.length) {
                content.innerHTML = `<p class="empty-hint" style="margin-top:14px;">Переводов нет</p>`;
                return;
            }
            let html = '<div class="detail-list">';
            data.transfers.forEach(t => {
                const ok   = t.status === 'success';
                const date = new Date(t.created_at).toLocaleString('ru-RU', {
                    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
                });
                html += `<div class="detail-card transfer-row-card ${ok ? 'transfer-ok' : 'transfer-err'}"
                    data-from="${t.from_card}" data-to="${t.to_identifier}"
                    data-type="${t.to_type === 'card' ? 'Карта' : 'Счёт'}"
                    data-amount="${t.amount}" data-date="${date}"
                    data-status="${ok ? 'Успешно' : 'Ошибка'}" data-error="${t.error_msg || '—'}">
                    <div class="detail-row">
                        <span class="card-label">${t.to_type === 'card' ? '💳' : '🏦'} ${t.to_identifier}</span>
                        <span class="card-value" style="color:${ok ? '#28a745' : '#dc3545'};font-weight:700">
                            ${ok ? '−' : ''}${t.amount} ₽
                        </span>
                    </div>
                    <div class="detail-row">
                        <span style="font-size:11px;color:#999">${date}</span>
                        <span class="transfer-badge ${ok ? 'badge-ok' : 'badge-err'}">${ok ? 'Выполнен' : 'Отклонён'}</span>
                    </div>
                </div>`;
            });
            html += '</div>';
            content.innerHTML = html;
            content.querySelectorAll('.transfer-row-card').forEach(card => {
                card.onclick = () => this.showTransferDetails(card.dataset);
            });
        } catch (_) { content.innerHTML = '<p class="error">Ошибка загрузки</p>'; }
    }

    showTransferDetails(d) {
        const ok = d.status === 'Успешно';
        document.getElementById('root').insertAdjacentHTML('afterend', `
            <div class="modal-overlay" id="transferModal">
                <div class="modal-content" style="text-align:left;">
                    <h3 style="text-align:center;margin-bottom:14px;">Детали перевода</h3>
                    <div class="card-row"><span class="card-label">Статус</span>
                        <strong style="color:${ok ? '#28a745' : '#dc3545'}">${d.status}</strong></div>
                    ${!ok && d.error !== '—' ? `<div class="card-row"><span class="card-label">Причина</span><span style="font-size:12px;color:#dc3545">${d.error}</span></div>` : ''}
                    <div class="card-row"><span class="card-label">Дата</span><span class="card-value">${d.date}</span></div>
                    <div class="card-row"><span class="card-label">Сумма</span><span class="card-value" style="font-size:16px;font-weight:700">${d.amount} ₽</span></div>
                    <hr style="border:none;border-top:1px solid #eee;margin:10px 0;">
                    <div class="card-row"><span class="card-label">Карта</span><span class="card-value mono">${this.formatCard(d.from)}</span></div>
                    <div class="card-row"><span class="card-label">Тип</span><span class="card-value">${d.type}</span></div>
                    <div class="card-row"><span class="card-label">Реквизиты</span><span class="card-value">${d.to}</span></div>
                    <div class="modal-actions" style="margin-top:14px;">
                        <button id="closeTransferModal" class="btn-ok" style="width:100%">Закрыть</button>
                    </div>
                </div>
            </div>`);
        const close = () => document.getElementById('transferModal')?.remove();
        document.getElementById('closeTransferModal').onclick = close;
        document.getElementById('transferModal').onclick = (e) => { if (e.target.id === 'transferModal') close(); };
    }

    formatCard(num) { return String(num).padStart(16,'0').replace(/(.{4})/g,'$1 ').trim(); }
}
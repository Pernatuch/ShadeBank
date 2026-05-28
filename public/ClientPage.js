class ClientPage {
    constructor(router) {
        this.router = router;
        this.root   = document.getElementById('root');
        this.userId = null;
    }

    render() {
        this.userId = sessionStorage.getItem('userId');

        this.root.innerHTML = `
            <div class="app-shell">
                <main class="main-panel" id="contentPanel"></main>
            </div>
            <div id="modalTarget"></div>`;

        this.setupAppNav();
        this.setupAppUserArea();
        this.switchPanel('profile');
    }

    setupAppNav() {
        const nav = document.getElementById('appNav');
        if (!nav) return;
        nav.innerHTML = `
            <button class="app-nav-btn" id="appBtnProfile">Личный кабинет</button>
            <button class="app-nav-btn" id="appBtnTransfers">Переводы</button>
            <button class="app-nav-btn" id="appBtnHistory">История</button>`;
        document.getElementById('appBtnProfile').onclick   = () => this.switchPanel('profile');
        document.getElementById('appBtnTransfers').onclick = () => this.switchPanel('transfers');
        document.getElementById('appBtnHistory').onclick   = () => this.switchPanel('history');
    }

    async setupAppUserArea() {
        const area = document.getElementById('appUserArea');
        if (!area) return;
        try {
            const data    = await fetch(`/api/profile/${this.userId}`).then(r => r.json());
            const blocked = data.is_blocked === true;
            area.innerHTML = `
                <span class="app-user-pill">${data.login ?? 'Пользователь'}</span>
                <span class="sidebar-status ${blocked ? 'blocked' : 'active'}">${blocked ? 'Заблокирован' : 'Активен'}</span>
                <button class="app-logout-btn" id="appLogoutBtn">Выйти</button>`;
        } catch (_) {
            area.innerHTML = `<button class="app-logout-btn" id="appLogoutBtn">Выйти</button>`;
        }
        document.getElementById('appLogoutBtn')?.addEventListener('click', () => this.logout());
    }

    switchPanel(panelName) {
        const content = document.getElementById('contentPanel');
        if (!content) return;
        document.querySelectorAll('.app-nav-btn').forEach(b => b.classList.remove('active'));
        const btnMap = { profile: 'appBtnProfile', transfers: 'appBtnTransfers', history: 'appBtnHistory' };
        document.getElementById(btnMap[panelName])?.classList.add('active');
        if      (panelName === 'profile')   this.renderProfilePanel(content);
        else if (panelName === 'transfers') this.renderTransfersPanel(content);
        else if (panelName === 'history')   this.renderHistoryPanel(content);
    }

    async renderProfilePanel(content) {
        content.innerHTML = '<p class="loading-text">Загрузка...</p>';
        try {
            const [cardsRes, accountsRes] = await Promise.allSettled([
                fetch(`/api/cards/${this.userId}`).then(r => r.json()),
                fetch(`/api/accounts/${this.userId}`).then(r => r.json())
            ]);
            const cards    = cardsRes.status    === 'fulfilled' ? cardsRes.value.cards       : null;
            const accounts = accountsRes.status === 'fulfilled' ? accountsRes.value.accounts : null;

            const cardItems = cards?.length
                ? cards.map(card => `
                    <div class="card-item horizontal-card">
                        <div class="card-chip"></div>
                        <div class="card-number">${this.formatCard(card.out_card_number)}</div>
                        <div class="card-footer">
                            <span class="card-balance">${card.out_balance} ₽</span>
                            <span class="card-type">VISA</span>
                        </div>
                    </div>`).join('')
                : '';

            const accItems = accounts?.length
                ? `<div class="detail-list">${accounts.map(acc => `
                    <div class="detail-card">
                        <div class="detail-row"><span class="card-label">Номер счёта</span><span class="card-value">${acc.acc_id}</span></div>
                        <div class="detail-row"><span class="card-label">Баланс</span><span class="card-value balance-positive">${acc.balance} ₽</span></div>
                    </div>`).join('')}</div>`
                : '<p class="empty-hint">Нет привязанных счетов</p>';

            content.innerHTML = `
                <div class="panel-content">
                    <h3>Ваши карты</h3>
                    <div class="cards-wrapper">
                        <div id="cardsScrollContainer" class="cards-scroll-container${!cards?.length ? ' empty' : ''}">${cardItems}</div>
                        <div id="actionButtonContainer" class="action-button-container${!cards?.length ? ' centered' : ''}"></div>
                    </div>
                    <h3 style="margin-top:20px;">Ваши счета</h3>
                    ${accItems}
                </div>`;

            const btn = document.createElement('button');
            btn.className = 'add-feature-btn'; btn.innerHTML = '<span>+</span>';
            btn.onclick = () => this.showPopup();
            document.getElementById('actionButtonContainer').appendChild(btn);
        } catch (_) {
            content.innerHTML = '<p class="error">Ошибка загрузки профиля</p>';
        }
    }

    /* ── ПАНЕЛЬ ПЕРЕВОДОВ — новый визуал ─────────────────────── */
    async renderTransfersPanel(content) {
        try {
            const data = await fetch(`/api/profile/${this.userId}`).then(r => r.json());
            if (data.is_blocked === true) {
                document.querySelectorAll('.app-nav-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('appBtnProfile')?.classList.add('active');
                this.showBlockedPopup();
                return;
            }
        } catch (_) {}

        content.innerHTML = '<p class="loading-text">Загрузка карт...</p>';
        let cards = [];
        try {
            cards = (await fetch(`/api/cards/${this.userId}`).then(r => r.json())).cards || [];
        } catch (_) { content.innerHTML = '<p class="error">Ошибка загрузки карт</p>'; return; }

        if (!cards.length) {
            content.innerHTML = `<div class="info-message">У вас нет карт для переводов.<br>
                Запросите карту в разделе <strong>«Личный кабинет»</strong>.</div>`;
            return;
        }

        /* Вспомогательная функция: HTML визуальной карты */
        const cardVisualHTML = (card) => `
            <div class="trf-card-visual">
                <div class="trf-card-chip"></div>
                <div class="trf-card-number">${this.formatCard(card.out_card_number)}</div>
                <div class="trf-card-footer">
                    <span class="trf-card-balance">${card.out_balance} ₽</span>
                    <span class="trf-card-type">VISA</span>
                </div>
            </div>`;

        content.innerHTML = `
            <div class="panel-content">
                <!-- Заголовок + переключатель на одном уровне -->
                <div class="trf-header">
                    <h3 class="trf-title">Перевод средств</h3>
                    <div class="trf-type-toggle">
                        <button class="trf-tab active" data-type="card">По номеру карты</button>
                        <button class="trf-tab"        data-type="account">По номеру счёта</button>
                    </div>
                </div>

                <div class="transfer-layout">

                    <!-- ИСТОЧНИК -->
                    <div class="trf-side trf-source">
                        <p class="trf-side-label">Карта для операций</p>
                        <div id="sourceCardPreview" class="trf-card-preview-wrap">
                            ${cardVisualHTML(cards[0])}
                        </div>
                        <div id="cardPickerWrap" class="trf-picker-wrap" style="display:none">
                            <select id="fromCardSelect" class="trf-select-picker">
                                ${cards.map(c => `<option
                                    value="${c.out_card_id}"
                                    data-balance="${c.out_balance}"
                                    data-number="${c.out_card_number}">
                                    ${this.formatCard(c.out_card_number)} — ${c.out_balance} ₽
                                </option>`).join('')}
                            </select>
                        </div>
                        <button class="trf-switch-btn" id="switchCardBtn">сменить карту для операций</button>
                        <p id="selectedBalance" class="balance-info trf-balance"></p>
                    </div>

                    <!-- СТРЕЛКА -->
                    <div class="trf-arrow-col">
                        <svg class="trf-arrow-svg" viewBox="0 0 40 64" xmlns="http://www.w3.org/2000/svg">
                            <rect x="14" y="0" width="12" height="42" rx="3"/>
                            <polygon points="0,37 40,37 20,64"/>
                        </svg>
                    </div>

                    <!-- ПОЛУЧАТЕЛЬ -->
                    <div class="trf-side trf-dest">
                        <p class="trf-side-label" id="destLabel">Карта получателя</p>
                        <div class="trf-dest-area" id="destArea">
                            <div class="trf-dest-card-outline"></div>
                        </div>
                        <div class="trf-controls">
                            <input type="text"   id="toIdentifierInput" class="trf-input" placeholder="XXXX XXXX XXXX XXXX">
                            <input type="number" id="amountInput"       class="trf-input" placeholder="Сумма, ₽" min="0.01" step="0.01">
                            <button id="btnSendTransfer" class="trf-send-btn">Перевести</button>
                            <div id="transferStatus"></div>
                        </div>
                    </div>

                </div>
                <!-- Скрытые радио-кнопки: совместимость с executeTransfer() -->
                <div style="display:none">
                    <input type="radio" name="toType" value="card"    id="toTypeCard"    checked>
                    <input type="radio" name="toType" value="account" id="toTypeAccount">
                </div>
            </div>`;

        /* Инициализация баланса */
        this.updateBalanceDisplay();

        /* ── Кнопка смены карты ── */
        const cardPickerWrap = document.getElementById('cardPickerWrap');
        const fromCardSelect = document.getElementById('fromCardSelect');

        document.getElementById('switchCardBtn').onclick = () => {
            const hidden = cardPickerWrap.style.display === 'none';
            cardPickerWrap.style.display = hidden ? 'block' : 'none';
            if (hidden) fromCardSelect.focus();
        };

        fromCardSelect.onchange = () => {
            const opt = fromCardSelect.selectedOptions[0];
            document.getElementById('sourceCardPreview').innerHTML = cardVisualHTML({
                out_card_number: opt.dataset.number,
                out_balance:     opt.dataset.balance,
            });
            this.updateBalanceDisplay();
            cardPickerWrap.style.display = 'none';
        };

        /* ── Переключатель: карта / счёт ── */
        document.querySelectorAll('.trf-tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.trf-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isCard = tab.dataset.type === 'card';

                /* Синхронизируем скрытые радио */
                document.getElementById('toTypeCard').checked    =  isCard;
                document.getElementById('toTypeAccount').checked = !isCard;

                document.getElementById('destLabel').textContent =
                    isCard ? 'Карта получателя' : 'Номер счёта';
                document.getElementById('toIdentifierInput').placeholder =
                    isCard ? 'XXXX XXXX XXXX XXXX' : 'ID счёта';
                document.getElementById('toIdentifierInput').value = '';

                /* Показываем / скрываем заглушку карты */
                document.getElementById('destArea').innerHTML =
                    isCard ? '<div class="trf-dest-card-outline"></div>' : '';
            };
        });

        document.getElementById('btnSendTransfer').onclick = () => this.executeTransfer();
    }

    updateBalanceDisplay() {
        const select = document.getElementById('fromCardSelect');
        const balDiv = document.getElementById('selectedBalance');
        if (!select || !balDiv) return;
        balDiv.textContent = `Доступно: ${select.options[select.selectedIndex]?.getAttribute('data-balance') ?? '—'} ₽`;
    }

    async executeTransfer() {
        const fromCardId   = document.getElementById('fromCardSelect').value;
        const toIdentifier = document.getElementById('toIdentifierInput').value.trim();
        const toType       = document.querySelector('input[name="toType"]:checked').value;
        const amount       = document.getElementById('amountInput').value;
        const statusDiv    = document.getElementById('transferStatus');

        if (!toIdentifier || !amount) { statusDiv.innerHTML = '<div class="error">❌ Заполните все поля</div>'; return; }

        const btn         = document.getElementById('btnSendTransfer');
        const originalTxt = btn.textContent;
        btn.disabled = true; btn.textContent = 'Отправка...'; statusDiv.innerHTML = '';
        try {
            const data = await fetch('/api/transfers', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromCardId, toIdentifier, toType, amount: parseFloat(amount) })
            }).then(r => r.json());

            if (data.success) {
                statusDiv.innerHTML = '<div class="success">✅ Перевод выполнен успешно</div>';
                document.getElementById('toIdentifierInput').value = '';
                document.getElementById('amountInput').value = '';
                await this.refreshCardBalances();
            } else {
                statusDiv.innerHTML = `<div class="error">❌ ${data.message}</div>`;
            }
        } catch (_) { statusDiv.innerHTML = '<div class="error">❌ Ошибка соединения</div>'; }
        finally { btn.disabled = false; btn.textContent = originalTxt; }
    }

    async refreshCardBalances() {
        try {
            const data   = await fetch(`/api/cards/${this.userId}`).then(r => r.json());
            const select = document.getElementById('fromCardSelect');
            if (!data.cards || !select) return;
            data.cards.forEach(card => {
                const opt = select.querySelector(`option[value="${card.out_card_id}"]`);
                if (opt) {
                    opt.setAttribute('data-balance', card.out_balance);
                    opt.textContent = `${this.formatCard(card.out_card_number)} — ${card.out_balance} ₽`;
                }
            });
            /* Обновляем и визуальную карту источника */
            const selOpt = select.selectedOptions[0];
            if (selOpt) {
                document.getElementById('sourceCardPreview').innerHTML = `
                    <div class="trf-card-visual">
                        <div class="trf-card-chip"></div>
                        <div class="trf-card-number">${this.formatCard(selOpt.dataset.number)}</div>
                        <div class="trf-card-footer">
                            <span class="trf-card-balance">${selOpt.dataset.balance} ₽</span>
                            <span class="trf-card-type">VISA</span>
                        </div>
                    </div>`;
            }
            this.updateBalanceDisplay();
        } catch (_) {}
    }

    async renderHistoryPanel(content) {
        content.innerHTML = '<p class="loading-text">Загрузка истории...</p>';
        try {
            const data = await fetch(`/api/transfers/${this.userId}`).then(r => r.json());
            if (!data.transfers?.length) {
                content.innerHTML = '<div class="panel-content"><h3>История переводов</h3><p class="empty-hint" css="margin-top:16px;">Операций пока нет.</p></div>';
                return;
            }
            content.innerHTML = `
                <div class="panel-content"><h3>История переводов</h3>
                <div class="transfers-list">${data.transfers.map(t => {
                const ok   = t.status === 'success';
                const date = new Date(t.created_at).toLocaleString('ru-RU',
                    { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
                return `<div class="transfer-item"
                        data-from="${t.from_card}" data-to="${t.to_identifier}"
                        data-type="${t.to_type === 'card' ? 'Карта' : 'Счёт'}"
                        data-amount="${t.amount}" data-date="${date}"
                        data-status="${ok ? 'Успешно' : 'Ошибка'}" data-error="${t.error_msg || '—'}">
                        <div class="transfer-info">
                            <span class="transfer-to">${t.to_type === 'card' ? 'Карта получателя: ' : 'Счёт получателя: '} ${t.to_identifier}</span>
                            <span class="transfer-date">${date}</span>
                        </div>
                        <div class="transfer-amount" style="text-align:right;color:${ok ? '#28a745' : '#dc3545'}">
                            ${ok ? '−' : ''}${t.amount} ₽
                            <span class="transfer-badge ${ok ? 'badge-ok' : 'badge-err'}" style="margin-left:6px">${ok ? 'OK' : 'ERR'}</span>
                        </div>
                    </div>`;
            }).join('')}</div></div>`;
            content.querySelectorAll('.transfer-item').forEach(item => {
                item.onclick = () => this.showTransferDetailsPopup(item.dataset);
            });
        } catch (_) { content.innerHTML = '<p class="error">Ошибка загрузки</p>'; }
    }

    _modalHtml(inner) {
        return `<div class="modal-overlay" id="modalOverlay"><div class="modal-content" style="text-align:left;">${inner}</div></div>`;
    }

    showTransferDetailsPopup(d) {
        const ok = d.status === 'Успешно';
        document.getElementById('modalTarget').innerHTML = this._modalHtml(`
            <h3 style="text-align:center;margin-bottom:16px;">Детали операции</h3>
            <div class="card-row"><span class="card-label">Статус</span><strong style="color:${ok ? '#28a745' : '#dc3545'}">${d.status}</strong></div>
            ${!ok && d.error !== '—' ? `<div class="card-row"><span class="card-label">Причина</span><span style="font-size:12px;color:#dc3545">${d.error}</span></div>` : ''}
            <div class="card-row"><span class="card-label">Дата</span><span class="card-value">${d.date}</span></div>
            <div class="card-row"><span class="card-label">Сумма</span><span class="card-value" style="font-size:16px;font-weight:700">${d.amount} ₽</span></div>
            <hr style="border:none;border-top:1px solid #eee;margin:10px 0;">
            <div class="card-row"><span class="card-label">Карта списания</span><span class="card-value mono">${this.formatCard(d.from)}</span></div>
            <div class="card-row"><span class="card-label">Тип</span><span class="card-value">${d.type}</span></div>
            <div class="card-row"><span class="card-label">Реквизиты</span><span class="card-value">${d.to}</span></div>
            <div class="modal-actions" style="margin-top:16px;">
                <button id="modalClose" class="btn-ok" style="width:100%">Закрыть</button>
            </div>`);
        document.getElementById('modalClose').onclick = () => this.closePopup();
        document.getElementById('modalOverlay').onclick = e => { if (e.target.id === 'modalOverlay') this.closePopup(); };
    }

    showBlockedPopup() {
        document.getElementById('modalTarget').innerHTML = this._modalHtml(`
            <div style="text-align:center;">
                <div style="font-size:44px;margin-bottom:10px;">🔒</div>
                <h3>Доступ ограничен</h3>
                <p style="margin:12px 0 0;font-size:14px;color:#666;line-height:1.5;">
                    Ваш аккаунт заблокирован.<br>Переводы недоступны.<br>Обратитесь в отделение банка.
                </p>
                <div class="modal-actions" style="margin-top:18px;">
                    <button id="modalClose" class="btn-ok" style="width:100%;">Понятно</button>
                </div>
            </div>`);
        document.getElementById('modalClose').onclick   = () => this.closePopup();
        document.getElementById('modalOverlay').onclick = e => { if (e.target.id === 'modalOverlay') this.closePopup(); };
    }

    async showPopup() {
        document.getElementById('modalTarget').innerHTML = this._modalHtml(`
            <h3 style="text-align:center;">Запрос на выпуск карты</h3>
            <p style="font-size:13px;color:#666;text-align:center;margin:6px 0 14px;">Выберите способ привязки счёта</p>
            <p id="loadingAccounts" style="font-size:13px;color:#999;text-align:center;">Загрузка счетов...</p>
            <div id="accountOptions"></div>
            <div id="popupStatus"></div>
            <div class="modal-actions" style="margin-top:16px;">
                <button id="modalOk" class="btn-ok">Запросить карту</button>
                <button id="modalCancel" class="btn-cancel">Отмена</button>
            </div>`);

        let accounts = [];
        try { accounts = (await fetch(`/api/accounts/${this.userId}`).then(r => r.json())).accounts || []; } catch (_) {}

        document.getElementById('loadingAccounts').style.display = 'none';
        document.getElementById('accountOptions').innerHTML = `
            <label class="popup-radio-label">
                <input type="radio" name="accType" value="new" checked style="accent-color:var(--purple);">
                Создать новый счёт (начальный баланс: 0 ₽)
            </label>
            ${accounts.length ? `
            <label class="popup-radio-label">
                <input type="radio" name="accType" value="existing" style="accent-color:var(--purple);">
                Привязать к существующему счёту
            </label>
            <div id="existingAccDiv" style="display:none;margin-top:8px;">
                <select id="existingAccSelect" class="transfer-select">
                    ${accounts.map(a => `<option value="${a.acc_id}">Счёт #${a.acc_id} — ${a.balance} ₽</option>`).join('')}
                </select>
            </div>` : `<p style="font-size:12px;color:#aaa;margin-top:4px;">(существующих счетов нет)</p>`}`;

        document.querySelectorAll('input[name="accType"]').forEach(radio => {
            radio.onchange = e => {
                const div = document.getElementById('existingAccDiv');
                if (div) div.style.display = e.target.value === 'existing' ? 'block' : 'none';
            };
        });

        document.getElementById('modalOk').onclick = async () => {
            const accountType = document.querySelector('input[name="accType"]:checked')?.value || 'new';
            const accountId   = accountType === 'existing' ? document.getElementById('existingAccSelect')?.value : null;
            const btn = document.getElementById('modalOk');
            btn.disabled = true; btn.textContent = 'Отправка...';
            try {
                const data = await fetch(`/api/requests/${this.userId}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accountType, accountId })
                }).then(r => r.json());
                document.getElementById('popupStatus').innerHTML = data.success
                    ? '<div class="success" css="margin:8px 0 0;">✅ Запрос отправлен администратору</div>'
                    : '<div class="error" css="margin:8px 0 0;">❌ Ошибка отправки</div>';
                if (data.success) setTimeout(() => this.closePopup(), 1400);
                else { btn.disabled = false; btn.textContent = 'Запросить карту'; }
            } catch (_) {
                document.getElementById('popupStatus').innerHTML = '<div class="error" css="margin:8px 0 0;">❌ Ошибка соединения</div>';
                btn.disabled = false; btn.textContent = 'Запросить карту';
            }
        };

        document.getElementById('modalCancel').onclick  = () => this.closePopup();
        document.getElementById('modalOverlay').onclick = e => { if (e.target.id === 'modalOverlay') this.closePopup(); };
    }

    closePopup() { document.getElementById('modalTarget').innerHTML = ''; }

    formatCard(num) { return String(num).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim(); }

    logout() {
        ['appNav', 'appUserArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        sessionStorage.clear();
        this.router.navigateTo('/login');
    }
}
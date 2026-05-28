// public/AuthPage.js
class AuthPage {
    constructor(router) {
        this.router = router;
        this.root   = document.getElementById('root');
    }

    clearAppBar() {
        ['appNav', 'appUserArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    // ── Вход ──────────────────────────────────────────────────────────────────
    renderLogin() {
        this.clearAppBar();
        this.root.innerHTML = `
            <div class="auth-card">
                <h2 class="auth-title">Вход</h2>
                <input type="text"     id="loginInput"    class="auth-input" placeholder="ЛОГИН/ПОЧТА">
                <input type="password" id="passwordInput" class="auth-input" placeholder="ПАРОЛЬ">
                <button id="loginBtn" class="auth-btn-primary">ВОЙТИ</button>
                <div id="statusMessage"></div>
                <a href="#" id="linkToReg" class="auth-link">Зарегистрироваться</a>
            </div>`;

        document.getElementById('loginBtn').onclick    = () => this.login();
        document.getElementById('passwordInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.login();
        });
        document.getElementById('linkToReg').onclick = (e) => {
            e.preventDefault();
            this.router.navigateTo('/register');
        };
    }

    // ── Регистрация ───────────────────────────────────────────────────────────
    renderRegister() {
        this.clearAppBar();
        this.root.innerHTML = `
            <div class="auth-card auth-card--wide">
                <h2 class="auth-title">Регистрация</h2>
                <div class="reg-form">
                    ${this.regRow('*', 'Имя',                   'regFirstName',      'text')}
                    ${this.regRow('*', 'Фамилия',               'regLastName',       'text')}
                    ${this.regRow('',  'Отчество (если есть)',   'regMiddleName',     'text')}
                    ${this.regRow('*', 'E-mail',                 'regEmail',          'email')}
                    ${this.regRow('*', 'Логин',                  'regLogin',          'text')}
                    ${this.regRow('*', 'Пароль',                 'regPassword',       'password')}
                    ${this.regRow('*', 'Повторите пароль',       'regPasswordConfirm','password')}
                </div>
                <div id="regStatusMessage"></div>
                <div class="reg-actions">
                    <button id="btnCancel" class="auth-btn-secondary">Отмена</button>
                    <button id="regBtn"    class="auth-btn-primary">Подтвердить</button>
                </div>
            </div>`;

        document.getElementById('regBtn').onclick    = () => this.register();
        document.getElementById('btnCancel').onclick = () => this.router.navigateTo('/login');
    }

    regRow(req, label, id, type) {
        return `
            <div class="reg-row">
                <label class="reg-label">${req ? `<span class="req">*</span>` : ''}${label}</label>
                <input type="${type}" id="${id}" class="auth-input auth-input--reg">
            </div>`;
    }

    // ── Логика входа ──────────────────────────────────────────────────────────
    async login() {
        const login    = document.getElementById('loginInput').value.trim();
        const password = document.getElementById('passwordInput').value.trim();
        const msg      = document.getElementById('statusMessage');

        if (!login || !password)
            return msg.innerHTML = '<div class="error">❌ Заполните все поля</div>';

        try {
            const data = await this.post('/api/login', { identifier: login, password });
            if (data.success) {
                sessionStorage.setItem('userId', data.userId);
                sessionStorage.setItem('roleId', data.roleId);
                sessionStorage.setItem('isAuthenticated', 'true');
                msg.innerHTML = '<div class="success">✅ Вход выполнен</div>';
                setTimeout(() => this.router.navigateTo('/home'), 900);
            } else {
                msg.innerHTML = '<div class="error">❌ Неверный логин или пароль</div>';
            }
        } catch (_) {
            msg.innerHTML = '<div class="error">❌ Ошибка соединения</div>';
        }
    }

    // ── Логика регистрации ────────────────────────────────────────────────────
    async register() {
        const get = (id) => document.getElementById(id).value.trim();
        const firstName       = get('regFirstName');
        const lastName        = get('regLastName');
        const middleName      = get('regMiddleName');
        const email           = get('regEmail');
        const login           = get('regLogin');
        const password        = get('regPassword');
        const passwordConfirm = get('regPasswordConfirm');
        const msg             = document.getElementById('regStatusMessage');

        if (!firstName || !lastName || !email || !login || !password)
            return msg.innerHTML = '<div class="error">❌ Заполните обязательные поля</div>';

        if (password !== passwordConfirm)
            return msg.innerHTML = '<div class="error">❌ Пароли не совпадают</div>';

        try {
            const data = await this.post('/api/register',
                { lastName, firstName, middleName, email, login, password });
            if (data.success) {
                msg.innerHTML = '<div class="success">✅ Регистрация успешна!</div>';
                setTimeout(() => this.router.navigateTo('/login'), 1200);
            } else {
                msg.innerHTML = `<div class="error">❌ ${data.message}</div>`;
            }
        } catch (_) {
            msg.innerHTML = '<div class="error">❌ Ошибка соединения</div>';
        }
    }

    // ── Утилита: POST + JSON ──────────────────────────────────────────────────
    async post(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return res.json();
    }
}
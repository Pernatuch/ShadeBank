// public/AdminPage.js
class AdminPage {
    constructor(router) {
        this.router = router;
        this.root   = document.getElementById('root');
    }

    render() {
        const userId = sessionStorage.getItem('userId');
        const roleId = sessionStorage.getItem('roleId');

        this.root.innerHTML = `
            <div class="admin-shell">
                <div class="admin-body">
                    <div id="adminContent">
                        <p class="loading-text">Получение списка из БД...</p>
                    </div>
                </div>

            </div>
        `;

        // Заполняем app-bar
        this._setupAppNav(userId, roleId);

        this.loadUsers();
    }

    _setupAppNav(userId, roleId) {
        const nav  = document.getElementById('appNav');
        const area = document.getElementById('appUserArea');
        const login = sessionStorage.getItem('login') || `ID ${userId}`;
        if (nav) {
            nav.innerHTML = `
                <button class="app-nav-btn active" id="appBtnRefresh">🔄 Обновить список</button>
            `;
            document.getElementById('appBtnRefresh').onclick = () => this.loadUsers();
        }
        if (area) {
            area.innerHTML = `
                <span class="app-user-pill">Администратор · ${login}</span>
                <button class="app-logout-btn" id="appLogoutBtn">Выйти</button>
            `;
            document.getElementById('appLogoutBtn').onclick = () => {
                this._clearAppNav();
                sessionStorage.clear();
                this.router.navigateTo('/login');
            };
        }
    }

    _clearAppNav() {
        const nav  = document.getElementById('appNav');
        const area = document.getElementById('appUserArea');
        if (nav)  nav.innerHTML  = '';
        if (area) area.innerHTML = '';
    }

    async loadUsers() {
        const container = document.getElementById('adminContent');
        container.innerHTML = '<p class="loading-text">Получение списка из БД...</p>';
        try {
            const response = await fetch('/api/users');
            const data     = await response.json();
            if (!data.success) { container.innerHTML = '<p class="error">Ошибка доступа</p>'; return; }

            let html = `
                <table class="users-table">
                    <thead><tr>
                        <th>ID</th><th>Логин</th>
                        <th style="text-align:right;">Действие</th>
                    </tr></thead><tbody>`;

            data.users.forEach(user => {
                html += `<tr>
                    <td><strong>${user.user_id}</strong></td>
                    <td>${user.user_login}</td>
                    <td style="text-align:right;">
                        <button class="view-btn" data-id="${user.user_id}"
                            data-login="${encodeURIComponent(user.user_login)}">Профиль</button>
                    </td>
                </tr>`;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;

            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.onclick = (e) => {
                    this.router.navigateTo(
                        `/admin/user/${e.target.dataset.id}/${e.target.dataset.login}`
                    );
                };
            });
        } catch (_) { container.innerHTML = '<p class="error">Ошибка связи с сервером</p>'; }
    }
}
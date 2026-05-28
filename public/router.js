// public/router.js
class Router {
    constructor() {
        this.authPage          = new AuthPage(this);
        this.clientPage        = new ClientPage(this);
        this.adminPage         = new AdminPage(this);
        this.adminUserViewPage = new AdminUserViewPage(this);

        window.addEventListener('popstate', () => this.route());
        this.route();
    }

    navigateTo(path) {
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
            this.route();
        }
    }

    route() {
        const path   = window.location.pathname;
        const isAuth = sessionStorage.getItem('isAuthenticated') === 'true';
        const roleId = sessionStorage.getItem('roleId');

        if (isAuth && (path === '/login' || path === '/register' || path === '/'))
            return this.navigateTo('/home');

        if (!isAuth && path !== '/login' && path !== '/register')
            return this.navigateTo('/login');

        if      (path === '/login' || path === '/')  this.authPage.renderLogin();
        else if (path === '/register')               this.authPage.renderRegister();
        else if (path === '/home') {
            if      (roleId === '1') this.clientPage.render();
            else if (roleId === '2') this.adminPage.render();
        }
        else if (path.startsWith('/admin/user/')) {
            if (roleId !== '2') return this.navigateTo('/home');
            const [,,,id, login] = path.split('/');
            this.adminUserViewPage.render(id, decodeURIComponent(login ?? ''));
        }
    }
}

window.router = new Router();
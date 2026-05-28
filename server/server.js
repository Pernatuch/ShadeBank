// server/server.js
'use strict';

const express   = require('express');
const path      = require('path');
const { Pool }  = require('pg');
const crypto    = require('crypto');

const requestStore = require('./requestService');
const makeAuth     = require('./handlers/AuthHandler');
const makeCards    = require('./handlers/CardHandler');
const makeUsers    = require('./handlers/UserHandler');
const makeRequests = require('./handlers/RequestHandler');
const makeXfers    = require('./handlers/TransferHandler');

const hashPw = (pw) => crypto.createHash('sha256').update(pw).digest('hex');

class Server {
    constructor() {
        this.app  = express();
        this.port = 3000;
        this.pool = new Pool({
            user: 'postgres', host: 'localhost',
            database: 'Роли', password: '1234', port: 5432,
        });
        this.init();
    }

    init() {
        const { app, pool } = this;

        // ── Middleware ────────────────────────────────────────────────────────
        app.use(express.json());
        app.use(express.static(path.join(__dirname, '..', 'public')));

        // ── Handlers (factory-функции, замыкания — .bind() не нужен) ─────────
        const auth     = makeAuth(pool, hashPw);
        const cards    = makeCards(pool);
        const users    = makeUsers(pool);
        const requests = makeRequests(requestStore, pool);
        const xfers    = makeXfers(pool);

        // ── Маршруты ──────────────────────────────────────────────────────────

        // Авторизация
        app.post('/api/login',    auth.handleLogin);
        app.post('/api/register', auth.handleRegister);

        // Карты и счета
        app.get('/api/cards/:userId',    cards.handleGetCards);
        app.get('/api/accounts/:userId', cards.handleGetAccounts);

        // Пользователи
        app.get( '/api/users',                  users.handleGetUsers);
        app.get( '/api/profile/:userId',        users.handleGetProfile);
        app.post('/api/users/:userId/block',    users.handleBlock);
        app.post('/api/users/:userId/unblock',  users.handleUnblock);

        // Запросы на карту
        app.post(  '/api/requests/:userId',         requests.handleCreate);
        app.get(   '/api/requests/:userId',         requests.handleCheck);
        app.delete('/api/requests/:userId',         requests.handleDelete);
        app.post(  '/api/requests/:userId/approve', requests.handleApprove);

        // Переводы
        app.post('/api/transfers',         xfers.handleTransfer);
        app.get( '/api/transfers/:userId', xfers.handleGetHistory);

        // SPA fallback (всегда последний)
        app.get('*', (req, res) =>
            res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
        );

        console.log(` Сервер настроен`);
    }

    start() {
        this.app.listen(this.port, () =>
            console.log(`http://localhost:${this.port}`)
        );
    }
}

new Server().start();
// server/requestService.js
// Хранит активные запросы на выпуск карты.
// Простой модуль без класса — Map + экспортируемые функции.

const _store = new Map();

module.exports = {
    add:    (id, details = { accountType: 'new', accountId: null }) =>
        _store.set(String(id), details),
    has:    (id) => _store.has(String(id)),
    get:    (id) => _store.get(String(id)) ?? null,
    remove: (id) => _store.delete(String(id))
};
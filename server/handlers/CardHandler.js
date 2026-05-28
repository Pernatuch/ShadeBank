// server/handlers/CardHandler.js
module.exports = (pool) => ({

    async handleGetCards(req, res) {
        const userId = parseInt(req.params.userId);
        if (!userId || isNaN(userId))
            return res.status(400).json({ success: false, message: 'Неверный ID пользователя' });
        try {
            const { rows } = await pool.query('SELECT * FROM public.get_user_cards($1)', [userId]);
            res.json({ success: true, cards: rows });
        } catch (err) {
            console.error('Ошибка карт:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    },

    async handleGetAccounts(req, res) {
        const userId = parseInt(req.params.userId);
        if (!userId || isNaN(userId))
            return res.status(400).json({ success: false, message: 'Неверный ID пользователя' });
        try {
            const { rows } = await pool.query('SELECT * FROM public.get_user_accounts($1)', [userId]);
            res.json({ success: true, accounts: rows });
        } catch (err) {
            console.error('Ошибка счетов:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    }
});
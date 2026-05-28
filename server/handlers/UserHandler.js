// server/handlers/UserHandler.js
module.exports = (pool) => ({

    async handleGetUsers(req, res) {
        try {
            const { rows } = await pool.query('SELECT * FROM public.get_users_list()');
            res.json({ success: true, users: rows });
        } catch (err) {
            console.error('Ошибка списка пользователей:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    },

    async handleGetProfile(req, res) {
        const userId = parseInt(req.params.userId);
        if (!userId || isNaN(userId))
            return res.status(400).json({ success: false, message: 'Неверный ID' });

        try {
            // Используем UNION ALL, чтобы найти профиль либо в пользователях, либо в админах
            const { rows } = await pool.query(`
                SELECT last_name, first_name, middle_name, login, is_blocked 
                FROM (
                    SELECT users_pk AS id, last_name, first_name, middle_name, login, is_blocked FROM public.users
                    UNION ALL
                    SELECT admin_pk AS id, last_name, first_name, middle_name, login, false AS is_blocked FROM public."admin"
                ) AS all_accounts
                WHERE id = $1
            `, [userId]);

            if (!rows.length)
                return res.status(404).json({ success: false, message: 'Профиль не найден' });

            const user = rows[0];

            // Возвращаем все необходимые поля для сайдбара
            res.json({
                success: true,
                login: user.login,
                is_blocked: user.is_blocked ?? false,
                last_name: user.last_name,
                first_name: user.first_name,
                middle_name: user.middle_name
            });
        } catch (err) {
            console.error('Ошибка профиля:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    },

    async handleBlock(req, res) {
        const userId = parseInt(req.params.userId);
        if (!userId || isNaN(userId))
            return res.status(400).json({ success: false, message: 'Неверный ID' });
        try {
            await pool.query('UPDATE public.users SET is_blocked = true  WHERE users_pk = $1', [userId]);
            console.log(`Пользователь ${userId} заблокирован`);
            res.json({ success: true });
        } catch (err) {
            console.error('Ошибка блокировки:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    },

    async handleUnblock(req, res) {
        const userId = parseInt(req.params.userId);
        if (!userId || isNaN(userId))
            return res.status(400).json({ success: false, message: 'Неверный ID' });
        try {
            await pool.query('UPDATE public.users SET is_blocked = false WHERE users_pk = $1', [userId]);
            console.log(`Пользователь ${userId} разблокирован`);
            res.json({ success: true });
        } catch (err) {
            console.error('Ошибка разблокировки:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    }
});
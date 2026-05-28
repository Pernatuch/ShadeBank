// server/handlers/AuthHandler.js
// Factory-функция: принимает pool и hashFn, возвращает объект с методами.
// Методы используют замыкание — не нужны this и .bind().

module.exports = (pool, hashFn) => ({

    async handleLogin(req, res) {
        const { identifier, password } = req.body;
        if (!identifier || !password)
            return res.status(400).json({ success: false, message: 'Заполните поля' });
        try {
            const { rows } = await pool.query(
                'SELECT * FROM public.get_user_info_by_auth($1, $2)',
                [identifier, hashFn(password)]
            );
            if (!rows.length || rows[0].out_id === 0)
                return res.json({ success: false, message: 'Неверные данные' });

            // Извлекаем ФИО из ответа базы данных
            const {
                out_id: userId,
                out_role_id: roleId,
                out_last_name: lastName,
                out_first_name: firstName,
                out_middle_name: middleName
            } = rows[0];

            console.log(`Вход: ${identifier} → ID:${userId} Роль:${roleId}`);

            // Отправляем данные на клиент
            res.json({
                success: true,
                userId,
                roleId,
                lastName,
                firstName,
                middleName
            });
        } catch (err) {
            console.error('Ошибка входа:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    },

    async handleRegister(req, res) {
        const { lastName, firstName, middleName, email, login, password } = req.body;
        if (!lastName || !firstName || !email || !login || !password)
            return res.status(400).json({ success: false, message: 'Заполните обязательные поля' });
        try {
            await pool.query(
                'CALL public.create_user($1,$2,$3,$4,$5,$6,$7)',
                [lastName, firstName, middleName || null, email, login, hashFn(password), 1]
            );
            console.log(`Новый пользователь: ${login}`);
            res.json({ success: true, message: 'Регистрация успешна' });
        } catch (err) {
            console.error('Ошибка регистрации:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка при создании аккаунта' });
        }
    }
});
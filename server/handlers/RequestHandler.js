// server/handlers/RequestHandler.js
module.exports = (requests, pool) => ({

    handleCreate(req, res) {
        const { userId } = req.params;
        const { accountType = 'new', accountId = null } = req.body ?? {};
        requests.add(userId, { accountType, accountId });
        console.log(`Запрос на карту: пользователь ${userId}, тип: ${accountType}`);
        res.status(201).json({ success: true });
    },

    handleCheck(req, res) {
        const { userId } = req.params;
        const has = requests.has(userId);
        res.json({ hasRequest: has, details: has ? requests.get(userId) : null });
    },

    handleDelete(req, res) {
        const { userId } = req.params;
        requests.remove(userId);
        console.log(`Запрос пользователя ${userId} отклонён`);
        res.json({ success: true });
    },

    async handleApprove(req, res) {
        const { userId } = req.params;
        const request = requests.get(userId);
        if (!request)
            return res.status(404).json({ success: false, message: 'Активный запрос не найден' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Определяем счёт
            let accountId;
            if (request.accountType === 'existing' && request.accountId) {
                const { rows } = await client.query(
                    'SELECT bank_account_pk FROM public.bank_account WHERE bank_account_pk = $1',
                    [parseInt(request.accountId)]
                );
                if (!rows.length) throw new Error(`Счёт #${request.accountId} не найден`);
                accountId = parseInt(request.accountId);
            } else {
                // Создаём счёт и атомарно получаем его ID через функцию
                // (вместо MAX() — гонка состояний при параллельных запросах)
                const { rows: accRows } = await client.query(
                    'SELECT public.create_bank_account_returning_id($1) AS id', [0.0]
                );
                accountId = accRows[0].id;
            }

            // Генерируем данные карты
            // Два случайных 8-значных числа → 16-значная строка
            // (parseInt/Number не подходят: 16-значные числа превышают Number.MAX_SAFE_INTEGER)
            const part1      = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
            const part2      = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
            const cardNumber = part1 + part2;          // 16 символов, тип varchar
            const cvc        = Math.floor(100 + Math.random() * 900);

            const { rows: ur } = await client.query(
                'SELECT first_name, last_name FROM public.users WHERE users_pk = $1',
                [parseInt(userId)]
            );
            const u = ur[0];
            const cardUsername = u
                ? `${(u.first_name ?? '').toUpperCase()} ${(u.last_name ?? '').toUpperCase()}`.trim()
                : 'CUSTOMER';

            await client.query('CALL public.create_card($1,$2,$3,$4,$5)',
                [cardNumber, cvc, cardUsername, parseInt(userId), accountId]);

            await client.query('COMMIT');
            requests.remove(userId);
            console.log(`Карта выпущена: пользователь ${userId}, счёт ${accountId}`);
            res.json({ success: true, message: 'Карта успешно выпущена' });

        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            console.error('Ошибка выпуска карты:', err.message);
            res.status(500).json({ success: false, message: err.message });
        } finally {
            client.release();
        }
    }
});
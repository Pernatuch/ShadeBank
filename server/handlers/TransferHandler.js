// server/handlers/TransferHandler.js
module.exports = (pool) => ({

    async handleTransfer(req, res) {
        const { fromCardId, toIdentifier, toType, amount } = req.body;

        const cardId    = parseInt(fromCardId);
        const parsedAmt = parseFloat(amount);

        if (!fromCardId || !toIdentifier || !['card', 'account'].includes(toType)
            || isNaN(cardId) || isNaN(parsedAmt) || parsedAmt <= 0)
            return res.status(400).json({ success: false, message: 'Некорректные данные' });

        // Проверяем, что реквизиты — только цифры (без parseInt: 16-значный номер карты
        // превышает Number.MAX_SAFE_INTEGER и теряет точность при преобразовании в число)
        const toStr = String(toIdentifier).trim();
        if (!/^\d+$/.test(toStr))
            return res.status(400).json({ success: false, message: 'Некорректные реквизиты получателя' });

        const client = await pool.connect();
        let ok = false, errMsg = null;

        try {
            await client.query('BEGIN');

            const proc = toType === 'card'
                ? 'CALL public.transfer_to_card($1,$2,$3)'
                : 'CALL public.transfer_to_account($1,$2,$3)';

            await client.query(proc, [cardId, toStr, parsedAmt]);
            await client.query('COMMIT');
            ok = true;
            console.log(`Перевод [${toType}]: карта ${cardId} → ${toIdentifier} | ${parsedAmt} ₽`);

        } catch (err) {
            try { await client.query('ROLLBACK'); } catch (_) {}
            errMsg = err.message;
            console.error('Ошибка перевода:', errMsg);
        }

        // Логируем в историю отдельным autocommit-запросом
        try {
            await client.query(
                `INSERT INTO public.transfers (from_card_fk, to_identifier, to_type, amount, status, error_msg)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [cardId, toStr, toType, parsedAmt, ok ? 'success' : 'failed', errMsg]
            );
        } catch (logErr) {
            console.error('Ошибка записи истории:', logErr.message);
        } finally {
            client.release();
        }

        ok ? res.json({ success: true })
            : res.status(400).json({ success: false, message: errMsg });
    },

    async handleGetHistory(req, res) {
        const userId = parseInt(req.params.userId);
        if (!userId || isNaN(userId))
            return res.status(400).json({ success: false, message: 'Неверный ID' });
        try {
            const { rows } = await pool.query(
                'SELECT * FROM public.get_transfer_history($1)', [userId]
            );
            res.json({ success: true, transfers: rows });
        } catch (err) {
            console.error('Ошибка истории переводов:', err.message);
            res.status(500).json({ success: false, message: 'Ошибка сервера' });
        }
    }
});
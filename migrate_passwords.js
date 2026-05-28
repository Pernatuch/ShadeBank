// Запускать ОДИН РАЗ из корня проекта: node migrate_passwords.js
// Хеширует plain text пароли тем же методом что и server.js

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Роли',
    password: '1234',
    port: 5432,
});

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function migratePasswords() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Получаем всех пользователей
        const users = await client.query('SELECT users_pk, login, "password" FROM public.users');
        console.log(`\nНайдено пользователей: ${users.rows.length}`);

        for (const user of users.rows) {
            // Пропускаем уже захешированные (SHA-256 = 64 символа hex)
            if (user.password && user.password.length === 64) {
                console.log(`⏭  ${user.login} — уже захеширован, пропускаем`);
                continue;
            }

            const hashed = hashPassword(user.password);
            await client.query(
                'UPDATE public.users SET "password" = $1 WHERE users_pk = $2',
                [hashed, user.users_pk]
            );
            console.log(`✅ ${user.login} — захеширован`);
        }

        // Получаем всех администраторов
        const admins = await client.query('SELECT admin_pk, login, "password" FROM public.admin');
        console.log(`\nНайдено администраторов: ${admins.rows.length}`);

        for (const admin of admins.rows) {
            if (admin.password && admin.password.length === 64) {
                console.log(`⏭  ${admin.login} — уже захеширован, пропускаем`);
                continue;
            }

            const hashed = hashPassword(admin.password);
            await client.query(
                'UPDATE public.admin SET "password" = $1 WHERE admin_pk = $2',
                [hashed, admin.admin_pk]
            );
            console.log(`✅ ${admin.login} — захеширован`);
        }

        await client.query('COMMIT');
        console.log('\n✅ Миграция завершена успешно\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Ошибка миграции, изменения откачены:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

migratePasswords();
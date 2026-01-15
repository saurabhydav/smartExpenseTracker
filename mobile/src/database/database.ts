
// Uses react-native-sqlite-storage

import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import {
    CREATE_TABLES_SQL,
    DEFAULT_CATEGORIES,
    DEFAULT_MERCHANT_MAPPINGS,
    type Category,
    type Transaction,
    type MerchantMapping,
    type Subscription,
} from './schema';

SQLite.enablePromise(true);

let db: SQLiteDatabase | null = null;

const DATABASE_NAME = 'expense_tracker.db';

// Initialize the database
export async function initDatabase(): Promise<void> {
    try {
        db = await SQLite.openDatabase({
            name: DATABASE_NAME,
            location: 'default',
        });

        // Create tables
        for (const sql of CREATE_TABLES_SQL) {
            await db.executeSql(sql);
        }

        // Create accounts table
        const { CREATE_ACCOUNTS_TABLE_SQL } = require('./schema');
        await db.executeSql(CREATE_ACCOUNTS_TABLE_SQL);

        // Migration: Add account_id to transactions if not exists
        try {
            await db.executeSql('SELECT account_id FROM transactions LIMIT 1');
        } catch (e) {
            console.log('Migrating: Adding account_id to transactions table');
            await db.executeSql('ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id)');
        }

        // Migration v5: Add original_merchant column and backfill data
        try {
            const [versionResult] = await db.executeSql('PRAGMA user_version');
            const userVersion = versionResult.rows.item(0).user_version;

            if (userVersion < 5) {
                console.log('Migration v5: Adding original_merchant column...');
                await db.executeSql('ALTER TABLE transactions ADD COLUMN original_merchant TEXT');
                await db.executeSql('ALTER TABLE subscriptions ADD COLUMN original_merchant TEXT');

                // HEAL DATA: Backfill original_merchant
                console.log('Healing data: Backfilling original_merchant...');

                // 1. First, set default to current merchant name for all
                await db.executeSql('UPDATE transactions SET original_merchant = merchant WHERE original_merchant IS NULL');
                await db.executeSql('UPDATE subscriptions SET original_merchant = merchant WHERE original_merchant IS NULL');

                // 2. Now use merchant_mapping to restore TRUE original names (sms_name) where possible
                // We iterate through mappings to find transactions that match either the raw name or current display name
                const [mappings] = await db.executeSql('SELECT sms_name, display_name, user_id FROM merchant_mapping');

                for (let i = 0; i < mappings.rows.length; i++) {
                    const m = mappings.rows.item(i);
                    // If transaction matches current display name, set original to sms_name
                    await db.executeSql(
                        'UPDATE transactions SET original_merchant = ? WHERE (merchant = ? OR merchant = ?) AND user_id = ?',
                        [m.sms_name, m.display_name, m.sms_name, m.user_id]
                    );
                    await db.executeSql(
                        'UPDATE subscriptions SET original_merchant = ? WHERE (merchant = ? OR merchant = ?) AND user_id = ?',
                        [m.sms_name, m.display_name, m.sms_name, m.user_id]
                    );
                }
                console.log('Data healing complete.');
                await db.executeSql('PRAGMA user_version = 5');
            }
        } catch (e: any) {
            if (!e.message?.includes('duplicate column')) {
                console.error('Migration v5 failed', e);
            }
        }

        // Migration: Add user_id to all tables if not exists
        try {
            await db.executeSql('SELECT user_id FROM transactions LIMIT 1');
        } catch (e) {
            console.log('Migrating: Adding user_id to tables');
            await db.executeSql('ALTER TABLE transactions ADD COLUMN user_id INTEGER');
            await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)');

            await db.executeSql('ALTER TABLE categories ADD COLUMN user_id INTEGER');
            // We can't easily add UNIQUE constraint to existing table with data in SQLite without recreation
            // For now, we'll just add the column. In production, we'd do a full migration table copy.

            await db.executeSql('ALTER TABLE merchant_mapping ADD COLUMN user_id INTEGER');
            await db.executeSql('ALTER TABLE subscriptions ADD COLUMN user_id INTEGER');
            await db.executeSql('ALTER TABLE accounts ADD COLUMN user_id INTEGER');
        }

        // Migration: Fix UNIQUE constraints by recreating tables if needed
        // SQLite ALTER TABLE cannot change constraints, so we must recreate
        const [schemaResult] = await db.executeSql("SELECT sql FROM sqlite_master WHERE type='table' AND name='categories'");
        const tableSql = schemaResult.rows.item(0)?.sql || '';

        if (!tableSql.includes('UNIQUE(name, user_id)')) {
            console.log('Migrating: Recreating categories table for UNIQUE(name, user_id) constraint');
            await db.transaction(async (tx) => {
                // 1. Rename old table
                await tx.executeSql('ALTER TABLE categories RENAME TO categories_old');

                // 2. Create new table (definition from schema.ts)
                await tx.executeSql(CREATE_TABLES_SQL[0]); // categories is index 0

                // 3. Copy data
                await tx.executeSql(`
                    INSERT INTO categories (id, name, icon, color, budget_limit, user_id, created_at)
                    SELECT id, name, icon, color, budget_limit, user_id, created_at FROM categories_old
                `);

                // 4. Drop old table
                await tx.executeSql('DROP TABLE categories_old');
            });
        }

        // Fix merchant_mapping constraint too
        const [mapSchemaResult] = await db.executeSql("SELECT sql FROM sqlite_master WHERE type='table' AND name='merchant_mapping'");
        const mapTableSql = mapSchemaResult.rows.item(0)?.sql || '';

        if (!mapTableSql.includes('UNIQUE(sms_name, user_id)')) {
            console.log('Migrating: Recreating merchant_mapping table for UNIQUE constraint');
            await db.transaction(async (tx) => {
                await tx.executeSql('ALTER TABLE merchant_mapping RENAME TO merchant_mapping_old');

                // Recreate (definition from schema.ts - index 2)
                // Note: We need to be careful with index. 
                // schema.ts: 0=categories, 1=transactions, 2=merchant_mapping
                await tx.executeSql(CREATE_TABLES_SQL[2]);

                await tx.executeSql(`
                    INSERT INTO merchant_mapping (id, sms_name, display_name, category_id, user_id)
                    SELECT id, sms_name, display_name, category_id, user_id FROM merchant_mapping_old
                `);

                await tx.executeSql('DROP TABLE merchant_mapping_old');
            });
        }

        // Fix accounts UNIQUE constraint
        const [accSchemaResult] = await db.executeSql("SELECT sql FROM sqlite_master WHERE type='table' AND name='accounts'");
        const accTableSql = accSchemaResult.rows.item(0)?.sql || '';

        if (!accTableSql.includes('UNIQUE(bank_name, last_4, user_id)')) {
            console.log('Migrating: Recreating accounts table for UNIQUE(bank_name, last_4, user_id) constraint');
            await db.transaction(async (tx) => {
                await tx.executeSql('ALTER TABLE accounts RENAME TO accounts_old');

                const { CREATE_ACCOUNTS_TABLE_SQL } = require('./schema');
                await tx.executeSql(CREATE_ACCOUNTS_TABLE_SQL);

                await tx.executeSql(`
                    INSERT INTO accounts (id, name, bank_name, last_4, type, balance, user_id, created_at)
                    SELECT id, name, bank_name, last_4, type, balance, user_id, created_at FROM accounts_old
                `);

                await tx.executeSql('DROP TABLE accounts_old');
            });
        }

        // Fix subscriptions UNIQUE constraint
        const [subSchemaResult] = await db.executeSql("SELECT sql FROM sqlite_master WHERE type='table' AND name='subscriptions'");
        const subTableSql = subSchemaResult.rows.item(0)?.sql || '';

        if (!subTableSql.includes('UNIQUE(merchant, user_id)')) {
            console.log('Migrating: Recreating subscriptions table for UNIQUE constraint');
            await db.transaction(async (tx) => {
                await tx.executeSql('ALTER TABLE subscriptions RENAME TO subscriptions_old');

                // Recreate (definition from schema.ts - index 3)
                await tx.executeSql(CREATE_TABLES_SQL[3]);

                // Use INSERT OR IGNORE to handle duplicates during migration
                await tx.executeSql(`
                    INSERT OR IGNORE INTO subscriptions (id, merchant, amount, frequency, next_date, is_active, user_id, created_at)
                    SELECT id, merchant, amount, frequency, next_date, is_active, user_id, created_at FROM subscriptions_old
                `);

                await tx.executeSql('DROP TABLE subscriptions_old');
            });
        }

        // Create user_id index if it doesn't exist (safe to run after migration or on fresh install if table exists)
        // We do this here because putting it in CREATE_TABLES_SQL fails for existing users before migration ran
        await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)');
        await db.executeSql('CREATE INDEX IF NOT EXISTS idx_transactions_merchant_upper ON transactions(UPPER(merchant))');

        // Fix invalid icons from previous seeds
        await db.executeSql("UPDATE categories SET icon = 'directions-car' WHERE icon = 'car'");
        await db.executeSql("UPDATE categories SET icon = 'movie' WHERE icon = 'film'");
        await db.executeSql("UPDATE categories SET icon = 'favorite' WHERE icon = 'heart'");
        await db.executeSql("UPDATE categories SET icon = 'flight' WHERE icon = 'plane'");
        await db.executeSql("UPDATE categories SET icon = 'shopping-basket' WHERE icon = 'basket'");
        await db.executeSql("UPDATE categories SET icon = 'more-horiz' WHERE icon = 'dots-horizontal'");

        // Seed default categories if empty
        const [result] = await db.executeSql('SELECT COUNT(*) as count FROM categories');
        if (result.rows.item(0).count === 0) {
            await seedDefaultData();
        }

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
}

// Seed default categories and merchant mappings
async function seedDefaultData(): Promise<void> {
    if (!db) return;

    // Insert default categories
    for (const category of DEFAULT_CATEGORIES) {
        await db.executeSql(
            'INSERT INTO categories (name, icon, color, budget_limit) VALUES (?, ?, ?, ?)',
            [category.name, category.icon, category.color, category.budgetLimit]
        );
    }

    // Insert default merchant mappings
    for (const mapping of DEFAULT_MERCHANT_MAPPINGS) {
        await db.executeSql(
            'INSERT INTO merchant_mapping (sms_name, display_name, category_id) VALUES (?, ?, ?)',
            [mapping.smsName, mapping.displayName, mapping.categoryId]
        );
    }
}

// Get database instance
export function getDatabase(): SQLiteDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// Close database connection
export async function closeDatabase(): Promise<void> {
    if (db) {
        await db.close();
        db = null;
    }
}

// ============================================
// Transaction Operations
// ============================================

export async function insertTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>, checkDuplicates: boolean = true): Promise<number> {
    const database = getDatabase();

    // DUPLICATE CHECK: Prevent re-inserting the same transaction
    // We check User, Amount, Date, Type, and Merchant.
    // This handles the user's request: "Identify... if it's repeated".
    if (checkDuplicates) {
        const [existing] = await database.executeSql(
            `SELECT id FROM transactions 
             WHERE user_id = ? 
             AND amount = ? 
             AND date = ? 
             AND type = ? 
             AND merchant = ?`,
            [
                transaction.userId,
                transaction.amount,
                transaction.date,
                transaction.type,
                transaction.merchant
            ]
        );

        if (existing.rows.length > 0) {
            console.log(`Skipping duplicate transaction for user ${transaction.userId} (ID: ${existing.rows.item(0).id})`);
            return existing.rows.item(0).id;
        }
    }



    const [result] = await database.executeSql(
        `INSERT INTO transactions (amount, type, merchant, category_id, account_id, user_id, date, raw_sms, notes, original_merchant)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            transaction.amount,
            transaction.type,
            transaction.merchant,
            transaction.categoryId,
            transaction.accountId,
            transaction.userId, // Added userId
            transaction.date,
            transaction.rawSms,
            transaction.notes,
            transaction.originalMerchant,
        ]
    );
    return result.insertId;
}

export async function getTransactions(
    userId: number, // Added userId
    limit: number = 50,
    offset: number = 0,
    startDate?: string,
    endDate?: string,
    categoryId?: number
): Promise<Transaction[]> {
    const database = getDatabase();
    let query = 'SELECT * FROM transactions WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
    }
    if (categoryId) {
        query += ' AND category_id = ?';
        params.push(categoryId);
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [result] = await database.executeSql(query, params);
    const transactions: Transaction[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        transactions.push(mapRowToTransaction(result.rows.item(i)));
    }
    return transactions;
}

export async function getTransactionById(id: number): Promise<Transaction | null> {
    const database = getDatabase();
    const [result] = await database.executeSql('SELECT * FROM transactions WHERE id = ?', [id]);
    return result.rows.length > 0 ? mapRowToTransaction(result.rows.item(0)) : null;
}

// ... (previous code)

export async function updateTransaction(id: number, userId: number, updates: Partial<Transaction>): Promise<void> {
    const database = getDatabase();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
    if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
    if (updates.merchant !== undefined) { fields.push('merchant = ?'); values.push(updates.merchant); }
    if (updates.categoryId !== undefined) { fields.push('category_id = ?'); values.push(updates.categoryId); }
    if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date); }
    if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }

    if (fields.length > 0) {
        values.push(id, userId);
        await database.executeSql(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
    }
}

// ... (initialization code skipped for brevity, user checks it anyway) ...

// ... (category operations) ...





// Initialize user data (categories, mappings) if this is their first time
export async function ensureUserInitialized(userId: number): Promise<void> {
    const db = getDatabase();

    try {
        // Check if user has categories
        const [catResult] = await db.executeSql('SELECT COUNT(*) as count FROM categories WHERE user_id = ?', [userId]);

        if (catResult.rows.item(0).count === 0) {
            console.log(`Initializing categories for user ${userId}`);

            // 1. Get all default categories
            const [defaults] = await db.executeSql('SELECT * FROM categories WHERE user_id IS NULL');
            const categoryMap = new Map<number, number>(); // Old ID -> New ID

            // 2. Insert user copies (Sequential to get IDs safely)
            for (let i = 0; i < defaults.rows.length; i++) {
                const cat = defaults.rows.item(i);
                const [res] = await db.executeSql(
                    'INSERT INTO categories (name, icon, color, budget_limit, user_id) VALUES (?, ?, ?, ?, ?)',
                    [cat.name, cat.icon, cat.color, cat.budget_limit, userId]
                );
                categoryMap.set(cat.id, res.insertId);
            }

            // 3. Migrate existing transactions to use new category IDs
            for (const [oldId, newId] of categoryMap.entries()) {
                await db.executeSql(
                    'UPDATE transactions SET category_id = ? WHERE user_id = ? AND category_id = ?',
                    [newId, userId, oldId]
                );
            }

            // 4. Copy default merchant mappings
            const [mapResult] = await db.executeSql('SELECT COUNT(*) as count FROM merchant_mapping WHERE user_id = ?', [userId]);
            if (mapResult.rows.item(0).count === 0) {
                const [defaultMappings] = await db.executeSql('SELECT * FROM merchant_mapping WHERE user_id IS NULL');
                for (let i = 0; i < defaultMappings.rows.length; i++) {
                    const mapping = defaultMappings.rows.item(i);
                    const newCatId = categoryMap.get(mapping.category_id) || mapping.category_id;

                    await db.executeSql(
                        'INSERT OR IGNORE INTO merchant_mapping (sms_name, display_name, category_id, user_id) VALUES (?, ?, ?, ?)',
                        [mapping.sms_name, mapping.display_name, newCatId, userId]
                    );
                }
            }
            console.log(`Initialization complete for user ${userId}`);
        }
    } catch (error) {
        console.error('Failed to initialize user data', error);
        // Don't throw, just log. This allows app to proceed even if init partly failed.
    }
}

// ============================================
// Category Operations
// ============================================

export async function getCategories(userId?: number): Promise<Category[]> {
    const database = getDatabase();

    // Logic: 
    // 1. If no userId, get defaults (user_id IS NULL).
    // 2. If userId, get ONLY user's categories (defaults are copied on init).
    //    Removing 'OR user_id IS NULL' prevents duplicates.

    let query = 'SELECT * FROM categories';
    const params: (string | number)[] = [];

    if (userId) {
        query += ' WHERE user_id = ?';
        params.push(userId);
    } else {
        query += ' WHERE user_id IS NULL';
    }

    query += ' ORDER BY name ASC';

    const [result] = await database.executeSql(query, params);
    const categories: Category[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        categories.push(mapRowToCategory(result.rows.item(i)));
    }
    return categories;
}

export async function getCategoryById(id: number): Promise<Category | null> {
    const database = getDatabase();
    const [result] = await database.executeSql('SELECT * FROM categories WHERE id = ?', [id]);
    return result.rows.length > 0 ? mapRowToCategory(result.rows.item(0)) : null;
}

export async function insertCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<number> {
    const database = getDatabase();

    // Check for duplicates (Case-insensitive)
    const [existing] = await database.executeSql(
        'SELECT id FROM categories WHERE UPPER(name) = UPPER(?) AND user_id = ?',
        [category.name, category.userId]
    );

    if (existing.rows.length > 0) {
        // Suppress error: Just return the existing ID
        return existing.rows.item(0).id;
    }

    const [result] = await database.executeSql(
        'INSERT INTO categories (name, icon, color, budget_limit, user_id) VALUES (?, ?, ?, ?, ?)',
        [category.name, category.icon, category.color, category.budgetLimit, category.userId]
    );
    return result.insertId;
}

export async function updateCategoryBudget(id: number, userId: number, budgetLimit: number | null): Promise<void> {
    const database = getDatabase();
    await database.executeSql('UPDATE categories SET budget_limit = ? WHERE id = ? AND user_id = ?', [budgetLimit, id, userId]);
}

// ============================================
// Merchant Mapping Operations
// ============================================

export async function getMerchantMapping(smsName: string, userId: number): Promise<MerchantMapping | null> {
    const database = getDatabase();
    // STRICT: Only look for user's mapping. 
    // Defaults are copied to user on initialization, so we don't need to look at NULLs.
    const [result] = await database.executeSql(
        'SELECT * FROM merchant_mapping WHERE UPPER(sms_name) = UPPER(?) AND user_id = ?',
        [smsName, userId]
    );
    return result.rows.length > 0 ? mapRowToMerchantMapping(result.rows.item(0)) : null;
}

export async function insertMerchantMapping(mapping: Omit<MerchantMapping, 'id'>): Promise<number> {
    const database = getDatabase();
    const [result] = await database.executeSql(
        'INSERT INTO merchant_mapping (sms_name, display_name, category_id, user_id) VALUES (?, ?, ?, ?)',
        [mapping.smsName, mapping.displayName, mapping.categoryId, mapping.userId]
    );
    return result.insertId;
}

export async function getAllMerchantMappings(userId: number): Promise<MerchantMapping[]> {
    const database = getDatabase();
    const [result] = await database.executeSql('SELECT * FROM merchant_mapping WHERE user_id = ? ORDER BY display_name', [userId]);
    const mappings: MerchantMapping[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        mappings.push(mapRowToMerchantMapping(result.rows.item(i)));
    }
    return mappings;
}

export async function deleteMerchantMapping(id: number, userId: number): Promise<void> {
    const database = getDatabase();
    await database.executeSql('DELETE FROM merchant_mapping WHERE id = ? AND user_id = ?', [id, userId]);
}

// ============================================
// Analytics & Aggregations
// ============================================

export async function getMonthlySpending(userId: number, year: number, month: number): Promise<number> {
    const database = getDatabase();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const [result] = await database.executeSql(
        `SELECT SUM(amount) as total FROM transactions 
     WHERE user_id = ? AND type = 'debit' AND date BETWEEN ? AND ?`,
        [userId, startDate, endDate]
    );
    return Number(result.rows.item(0)?.total || 0);
}

export async function getCategorySpending(userId: number, year: number, month: number): Promise<{ categoryId: number; total: number }[]> {
    const database = getDatabase();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const [result] = await database.executeSql(
        `SELECT category_id, SUM(amount) as total FROM transactions 
     WHERE user_id = ? AND type = 'debit' AND date BETWEEN ? AND ?
     GROUP BY category_id`,
        [userId, startDate, endDate]
    );

    const spending: { categoryId: number; total: number }[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        spending.push({ categoryId: row.category_id, total: row.total });
    }
    return spending;
}

export async function getDailySpending(userId: number, year: number, month: number): Promise<{ date: string; total: number }[]> {
    const database = getDatabase();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const [result] = await database.executeSql(
        `SELECT date, SUM(amount) as total FROM transactions 
     WHERE user_id = ? AND type = 'debit' AND date BETWEEN ? AND ?
     GROUP BY date ORDER BY date`,
        [userId, startDate, endDate]
    );

    const spending: { date: string; total: number }[] = [];
    for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        spending.push({ date: row.date, total: row.total });
    }
    return spending;
}

// ============================================
// Deletion Operations
// ============================================

export async function deleteCategory(id: number, userId: number): Promise<void> {
    const database = getDatabase();
    try {
        await database.transaction((tx) => {
            // 1. Unlink transactions (ensure they belong to user)
            tx.executeSql('UPDATE transactions SET category_id = NULL WHERE category_id = ? AND user_id = ?', [id, userId]);
            // 2. Unlink merchant mappings (ensure they belong to user)
            tx.executeSql('UPDATE merchant_mapping SET category_id = NULL WHERE category_id = ? AND user_id = ?', [id, userId]);
            // 3. Delete the category (ensure it belongs to user)
            tx.executeSql('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, userId]);
        });
        console.log(`Category ${id} deleted successfully for user ${userId}`);
    } catch (error) {
        console.error('Delete Category Error:', error);
        throw error;
    }
}

export async function deleteTransaction(id: number, userId: number): Promise<void> {
    const database = getDatabase();
    try {
        await database.executeSql('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);
    } catch (error) {
        console.error('Delete Transaction Error:', error);
        throw error;
    }
}

// ============================================
// Row Mappers
// ============================================

function mapRowToTransaction(row: any): Transaction {
    return {
        id: row.id,
        amount: row.amount,
        type: row.type,
        merchant: row.merchant,
        categoryId: row.category_id,
        accountId: row.account_id,
        userId: row.user_id, // Added userId
        date: row.date,
        rawSms: row.raw_sms,
        notes: row.notes,
        originalMerchant: row.original_merchant,
        createdAt: row.created_at,
    };
}

function mapRowToCategory(row: any): Category {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        budgetLimit: row.budget_limit,
        userId: row.user_id, // Added userId
        createdAt: row.created_at,
    };
}

function mapRowToMerchantMapping(row: any): MerchantMapping {
    return {
        id: row.id,
        smsName: row.sms_name,
        displayName: row.display_name,
        categoryId: row.category_id,
        userId: row.user_id, // Added userId
    };
}

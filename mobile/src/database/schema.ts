// Database schema and types for the expense tracker
// Uses react-native-quick-sqlite for high-performance local storage

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  budgetLimit: number | null;
  userId: number; // Added userId
  createdAt: string;
}

export interface Transaction {
  id: number;
  amount: number;
  type: 'debit' | 'credit';
  merchant: string;
  categoryId: number | null;
  accountId: number | null;
  userId: number; // Added userId
  date: string;
  rawSms: string | null;
  notes: string | null;
  createdAt: string;
}

export interface MerchantMapping {
  id: number;
  smsName: string;
  displayName: string;
  categoryId: number | null;
  userId: number; // Added userId
}

export interface Subscription {
  id: number;
  merchant: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
  isActive: boolean;
  userId: number; // Added userId
  createdAt: string;
}

// SQL schemas for table creation
export const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#6366f1',
  budget_limit REAL,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(name, user_id)
)`,

  `CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('debit', 'credit')),
  merchant TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  account_id INTEGER REFERENCES accounts(id),
  user_id INTEGER,
  date TEXT NOT NULL,
  raw_sms TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`,

  `CREATE TABLE IF NOT EXISTS merchant_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sms_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  user_id INTEGER,
  UNIQUE(sms_name, user_id)
)`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  next_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
)`,

  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant)`,
  // idx_transactions_user is created in database.ts after migration to ensure column exists
  `CREATE INDEX IF NOT EXISTS idx_merchant_mapping_sms ON merchant_mapping(sms_name)`
];

export interface Account {
  id: number;
  name: string;
  bankName: string;
  last4: string;
  type: 'debit' | 'credit' | 'wallet';
  balance: number;
  userId: number; // Added userId
  createdAt: string;
}

export const CREATE_ACCOUNTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  last_4 TEXT NOT NULL,
  type TEXT CHECK (type IN ('debit', 'credit', 'wallet')),
  balance REAL DEFAULT 0,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(bank_name, last_4, user_id)
)`;

// Default categories to seed the database
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Food & Dining', icon: 'restaurant', color: '#ef4444', budgetLimit: null },
  { name: 'Shopping', icon: 'shopping-cart', color: '#f97316', budgetLimit: null },
  { name: 'Transportation', icon: 'directions-car', color: '#eab308', budgetLimit: null },
  { name: 'Entertainment', icon: 'movie', color: '#22c55e', budgetLimit: null },
  { name: 'Bills & Utilities', icon: 'receipt', color: '#3b82f6', budgetLimit: null },
  { name: 'Health', icon: 'favorite', color: '#ec4899', budgetLimit: null },
  { name: 'Education', icon: 'book', color: '#8b5cf6', budgetLimit: null },
  { name: 'Travel', icon: 'flight', color: '#06b6d4', budgetLimit: null },
  { name: 'Groceries', icon: 'shopping-basket', color: '#84cc16', budgetLimit: null },
  { name: 'Other', icon: 'more-horiz', color: '#6b7280', budgetLimit: null },
];

// Common merchant to category mappings
export const DEFAULT_MERCHANT_MAPPINGS: Omit<MerchantMapping, 'id' | 'userId'>[] = [
  { smsName: 'ZOMATO', displayName: 'Zomato', categoryId: 1 },
  { smsName: 'SWIGGY', displayName: 'Swiggy', categoryId: 1 },
  { smsName: 'AMAZON', displayName: 'Amazon', categoryId: 2 },
  { smsName: 'FLIPKART', displayName: 'Flipkart', categoryId: 2 },
  { smsName: 'UBER', displayName: 'Uber', categoryId: 3 },
  { smsName: 'OLA', displayName: 'Ola', categoryId: 3 },
  { smsName: 'NETFLIX', displayName: 'Netflix', categoryId: 4 },
  { smsName: 'SPOTIFY', displayName: 'Spotify', categoryId: 4 },
  { smsName: 'BOOKMYSHOW', displayName: 'BookMyShow', categoryId: 4 },
  { smsName: 'AIRTEL', displayName: 'Airtel', categoryId: 5 },
  { smsName: 'JIO', displayName: 'Jio', categoryId: 5 },
  { smsName: 'ELECTRICITY', displayName: 'Electricity', categoryId: 5 },
];

import sqlite3
import os
import hashlib
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'finance.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar_color TEXT DEFAULT '#10b981',
            has_seen_onboarding INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL,
            payment_method TEXT DEFAULT 'PIX',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Financial Goals table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            target_amount REAL NOT NULL,
            current_amount REAL NOT NULL DEFAULT 0,
            category TEXT,
            deadline TEXT,
            icon TEXT DEFAULT 'target',
            color TEXT DEFAULT '#10b981',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    
    # Seed demo user if none exists
    cursor.execute("SELECT id FROM users WHERE email = 'ana.silva@exemplo.com'")
    demo_user = cursor.fetchone()
    
    if not demo_user:
        cursor.execute('''
            INSERT INTO users (name, email, password_hash, avatar_color, has_seen_onboarding)
            VALUES (?, ?, ?, ?, ?)
        ''', ('Ana Silva', 'ana.silva@exemplo.com', hash_password('lumina123'), '#10b981', 0))
        user_id = cursor.lastrowid
        seed_demo_data(user_id, cursor)
        conn.commit()
        
    conn.close()

def seed_demo_data(user_id: int, cursor=None):
    close_at_end = False
    if cursor is None:
        conn = get_db_connection()
        cursor = conn.cursor()
        close_at_end = True
    else:
        conn = None

    # Clear previous user data if reseeding
    cursor.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM goals WHERE user_id = ?", (user_id,))

    now = datetime.now()
    
    # Sample transactions (current month and recent days)
    transactions = [
        # Incomes
        ('income', 8500.00, 'Salário', 'Salário Mensal - Tech Lead', (now - timedelta(days=2)).strftime('%Y-%m-%d'), 'Transferência'),
        ('income', 1800.00, 'Freelance', 'Consultoria UI/UX Design', (now - timedelta(days=5)).strftime('%Y-%m-%d'), 'PIX'),
        ('income', 450.00, 'Investimentos', 'Dividendos FIIs & Ações', (now - timedelta(days=12)).strftime('%Y-%m-%d'), 'Outro'),
        
        # Expenses
        ('expense', 2300.00, 'Moradia', 'Aluguel do Apartamento', (now - timedelta(days=1)).strftime('%Y-%m-%d'), 'PIX'),
        ('expense', 680.50, 'Alimentação', 'Supermercado Mensal Pão de Açúcar', (now - timedelta(days=2)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
        ('expense', 215.00, 'Transporte', 'Combustível Posto Shell', (now - timedelta(days=3)).strftime('%Y-%m-%d'), 'Débito'),
        ('expense', 180.00, 'Lazer', 'Jantar Restaurante Italiano', (now - timedelta(days=4)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
        ('expense', 149.90, 'Saúde', 'Academia Smart Fit Premium', (now - timedelta(days=6)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
        ('expense', 55.90, 'Lazer', 'Assinaturas Netflix & Spotify', (now - timedelta(days=8)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
        ('expense', 320.00, 'Educação', 'Livros & Cursos Alura', (now - timedelta(days=10)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
        ('expense', 125.40, 'Alimentação', 'Feira Orgânica da Semana', (now - timedelta(days=11)).strftime('%Y-%m-%d'), 'PIX'),
        ('expense', 89.00, 'Transporte', 'Corridas Uber', (now - timedelta(days=13)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
        ('expense', 280.00, 'Compras', 'Roupas Básicas Zara', (now - timedelta(days=15)).strftime('%Y-%m-%d'), 'Cartão de Crédito'),
    ]

    for t_type, amount, cat, desc, date_str, method in transactions:
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, category, description, date, payment_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, t_type, amount, cat, desc, date_str, method))

    # Sample goals
    goals = [
        ('Reserva de Emergência (6 meses)', 30000.00, 22500.00, 'Segurança', '2026-12-31', 'shield', '#10b981'),
        ('Viagem de Férias em Noronha', 9000.00, 6100.00, 'Lazer', '2026-11-20', 'plane', '#06b6d4'),
        ('Novo MacBook Pro M4', 16000.00, 11200.00, 'Equipamento', '2027-02-28', 'laptop', '#8b5cf6'),
    ]

    for title, target, current, cat, deadline, icon, color in goals:
        cursor.execute('''
            INSERT INTO goals (user_id, title, target_amount, current_amount, category, deadline, icon, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, title, target, current, cat, deadline, icon, color))

    if close_at_end:
        conn.commit()
        conn.close()

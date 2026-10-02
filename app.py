import os
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, session, Response
from database import init_db, get_db_connection, hash_password, seed_demo_data

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'lumina_finance_super_secret_session_key_2026')
app.json.ensure_ascii = False

# Initialize DB on start
init_db()

import json

def get_current_user_id():
    return session.get('user_id')

def get_json_data():
    try:
        data = request.get_json(silent=True)
        if data is not None:
            return data
        raw = request.get_data()
        if raw:
            try:
                return json.loads(raw.decode('utf-8'))
            except UnicodeDecodeError:
                return json.loads(raw.decode('latin1', errors='replace'))
    except Exception:
        pass
    return {}

@app.route('/')
def index():
    return render_template('index.html')

# ================= AUTHENTICATION ROUTES =================

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'authenticated': False}), 200
    
    conn = get_db_connection()
    user = conn.execute("SELECT id, name, email, avatar_color, has_seen_onboarding FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    
    if not user:
        session.pop('user_id', None)
        return jsonify({'authenticated': False}), 200
        
    return jsonify({
        'authenticated': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'avatar_color': user['avatar_color'],
            'has_seen_onboarding': bool(user['has_seen_onboarding'])
        }
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = get_json_data()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'E-mail e senha são obrigatórios.'}), 400
        
    conn = get_db_connection()
    pwd_hash = hash_password(password)
    user = conn.execute("SELECT * FROM users WHERE email = ? AND password_hash = ?", (email, pwd_hash)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'E-mail ou senha incorretos.'}), 401
        
    session['user_id'] = user['id']
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'avatar_color': user['avatar_color'],
            'has_seen_onboarding': bool(user['has_seen_onboarding'])
        }
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = get_json_data()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    
    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'Preencha todos os campos.'}), 400
        
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'A senha deve ter pelo menos 6 caracteres.'}), 400
        
    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'message': 'Este e-mail já está cadastrado.'}), 409
        
    avatar_colors = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899']
    import random
    color = random.choice(avatar_colors)
    
    pwd_hash = hash_password(password)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO users (name, email, password_hash, avatar_color, has_seen_onboarding)
        VALUES (?, ?, ?, ?, 0)
    ''', (name, email, pwd_hash, color))
    user_id = cursor.lastrowid
    
    # Initialize some starting starter goals
    cursor.execute('''
        INSERT INTO goals (user_id, title, target_amount, current_amount, category, deadline, icon, color)
        VALUES (?, 'Reserva de Emergência', 10000.00, 1500.00, 'Segurança', '2026-12-31', 'shield', '#10b981')
    ''', (user_id,))
    
    conn.commit()
    conn.close()
    
    session['user_id'] = user_id
    return jsonify({
        'success': True,
        'user': {
            'id': user_id,
            'name': name,
            'email': email,
            'avatar_color': color,
            'has_seen_onboarding': False
        }
    })

@app.route('/api/auth/demo', methods=['POST'])
def login_demo():
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = 'ana.silva@exemplo.com'").fetchone()
    conn.close()
    
    if not user:
        init_db()
        conn = get_db_connection()
        user = conn.execute("SELECT * FROM users WHERE email = 'ana.silva@exemplo.com'").fetchone()
        conn.close()
        
    session['user_id'] = user['id']
    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'avatar_color': user['avatar_color'],
            'has_seen_onboarding': bool(user['has_seen_onboarding'])
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'success': True})

@app.route('/api/auth/onboarding-complete', methods=['POST'])
def complete_onboarding():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    conn.execute("UPDATE users SET has_seen_onboarding = 1 WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/auth/onboarding-reset', methods=['POST'])
def reset_onboarding():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    conn.execute("UPDATE users SET has_seen_onboarding = 0 WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ================= TRANSACTIONS ROUTES =================

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    t_type = request.args.get('type')
    category = request.args.get('category')
    search = request.args.get('search', '').strip()
    
    query = "SELECT * FROM transactions WHERE user_id = ?"
    params = [user_id]
    
    if t_type and t_type in ('income', 'expense'):
        query += " AND type = ?"
        params.append(t_type)
        
    if category:
        query += " AND category = ?"
        params.append(category)
        
    if search:
        query += " AND (description LIKE ? OR category LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
        
    query += " ORDER BY date DESC, id DESC"
    
    conn = get_db_connection()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    transactions = [dict(r) for r in rows]
    return jsonify({'transactions': transactions})

@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    data = get_json_data()
    t_type = data.get('type', 'expense')
    amount = data.get('amount')
    category = data.get('category', 'Outros').strip()
    description = data.get('description', '').strip()
    date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    payment_method = data.get('payment_method', 'PIX')
    
    if t_type not in ('income', 'expense'):
        return jsonify({'error': 'Tipo inválido'}), 400
        
    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'O valor deve ser um número positivo maior que zero.'}), 400
        
    if not description:
        description = f"Nova {category}"
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO transactions (user_id, type, amount, category, description, date, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, t_type, amount, category, description, date_str, payment_method))
    t_id = cursor.lastrowid
    conn.commit()
    
    new_t = conn.execute("SELECT * FROM transactions WHERE id = ?", (t_id,)).fetchone()
    conn.close()
    
    return jsonify({'success': True, 'transaction': dict(new_t)}), 201

@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id = ? AND user_id = ?", (transaction_id, user_id))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    
    if deleted == 0:
        return jsonify({'error': 'Transação não encontrada'}), 404
        
    return jsonify({'success': True})

# ================= ANALYTICS & SUMMARY =================

@app.route('/api/analytics/summary', methods=['GET'])
def get_analytics():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    conn = get_db_connection()
    
    # Total Income and Expense
    totals = conn.execute('''
        SELECT 
            type, 
            COALESCE(SUM(amount), 0) as total,
            COUNT(id) as count
        FROM transactions 
        WHERE user_id = ?
        GROUP BY type
    ''', (user_id,)).fetchall()
    
    total_income = 0.0
    total_expense = 0.0
    for row in totals:
        if row['type'] == 'income':
            total_income = float(row['total'])
        elif row['type'] == 'expense':
            total_expense = float(row['total'])
            
    balance = total_income - total_expense
    savings_rate = ((total_income - total_expense) / total_income * 100) if total_income > 0 else 0.0
    if savings_rate < 0:
        savings_rate = 0.0
        
    # Categories Breakdown (Expenses)
    categories = conn.execute('''
        SELECT 
            category, 
            COALESCE(SUM(amount), 0) as total,
            COUNT(id) as count
        FROM transactions 
        WHERE user_id = ? AND type = 'expense'
        GROUP BY category
        ORDER BY total DESC
    ''', (user_id,)).fetchall()
    
    cat_breakdown = []
    for c in categories:
        pct = (float(c['total']) / total_expense * 100) if total_expense > 0 else 0
        cat_breakdown.append({
            'category': c['category'],
            'total': float(c['total']),
            'count': c['count'],
            'percentage': round(pct, 1)
        })
        
    # Timeline Breakdown (Last 6 distinct months or recent days)
    timeline = conn.execute('''
        SELECT 
            strftime('%Y-%m', date) as month,
            type,
            SUM(amount) as total
        FROM transactions
        WHERE user_id = ?
        GROUP BY month, type
        ORDER BY month ASC
    ''', (user_id,)).fetchall()
    
    months_map = {}
    for t in timeline:
        m = t['month']
        if m not in months_map:
            months_map[m] = {'month': m, 'income': 0.0, 'expense': 0.0}
        if t['type'] == 'income':
            months_map[m]['income'] = float(t['total'])
        else:
            months_map[m]['expense'] = float(t['total'])
            
    timeline_data = list(months_map.values())
    
    conn.close()
    
    return jsonify({
        'balance': round(balance, 2),
        'total_income': round(total_income, 2),
        'total_expense': round(total_expense, 2),
        'savings_rate': round(savings_rate, 1),
        'categories': cat_breakdown,
        'timeline': timeline_data
    })

# ================= FINANCIAL GOALS ROUTES =================

@app.route('/api/goals', methods=['GET'])
def get_goals():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    conn = get_db_connection()
    goals = conn.execute("SELECT * FROM goals WHERE user_id = ? ORDER BY id ASC", (user_id,)).fetchall()
    conn.close()
    
    results = []
    for g in goals:
        current = float(g['current_amount'])
        target = float(g['target_amount'])
        pct = (current / target * 100) if target > 0 else 0
        results.append({
            'id': g['id'],
            'title': g['title'],
            'target_amount': target,
            'current_amount': current,
            'category': g['category'],
            'deadline': g['deadline'],
            'icon': g['icon'],
            'color': g['color'],
            'progress_percentage': min(round(pct, 1), 100.0)
        })
        
    return jsonify({'goals': results})

@app.route('/api/goals', methods=['POST'])
def create_goal():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    data = get_json_data()
    title = data.get('title', '').strip()
    target = data.get('target_amount')
    current = data.get('current_amount', 0)
    category = data.get('category', 'Geral')
    deadline = data.get('deadline', '')
    color = data.get('color', '#10b981')
    
    if not title or not target:
        return jsonify({'error': 'Título e valor alvo são obrigatórios'}), 400
        
    try:
        target = float(target)
        current = float(current)
    except (ValueError, TypeError):
        return jsonify({'error': 'Valores numéricos inválidos'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO goals (user_id, title, target_amount, current_amount, category, deadline, color)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, title, target, current, category, deadline, color))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True}), 201

@app.route('/api/goals/<int:goal_id>/deposit', methods=['POST'])
def deposit_goal(goal_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    data = get_json_data()
    amount = data.get('amount')
    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({'error': 'Valor de aporte inválido'}), 400
        
    conn = get_db_connection()
    conn.execute('''
        UPDATE goals 
        SET current_amount = current_amount + ? 
        WHERE id = ? AND user_id = ?
    ''', (amount, goal_id, user_id))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

@app.route('/api/goals/<int:goal_id>', methods=['DELETE'])
def delete_goal(goal_id):
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM goals WHERE id = ? AND user_id = ?", (goal_id, user_id))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    
    if deleted == 0:
        return jsonify({'error': 'Meta não encontrada'}), 404
        
    return jsonify({'success': True, 'message': 'Meta removida com sucesso!'})

# ================= AI ASSISTANT (FinBot) =================

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    data = get_json_data()
    message = data.get('message', '').strip().lower()
    
    if not message:
        return jsonify({'reply': 'Olá! Como posso ajudar você a otimizar suas finanças hoje?'})
        
    # Gather user's actual financial context
    conn = get_db_connection()
    totals = conn.execute('''
        SELECT type, COALESCE(SUM(amount), 0) as total
        FROM transactions WHERE user_id = ?
        GROUP BY type
    ''', (user_id,)).fetchall()
    
    income = 0.0
    expense = 0.0
    for r in totals:
        if r['type'] == 'income':
            income = float(r['total'])
        elif r['type'] == 'expense':
            expense = float(r['total'])
            
    balance = income - expense
    savings_rate = ((income - expense) / income * 100) if income > 0 else 0
    
    top_categories = conn.execute('''
        SELECT category, SUM(amount) as total
        FROM transactions WHERE user_id = ? AND type = 'expense'
        GROUP BY category
        ORDER BY total DESC
        LIMIT 3
    ''', (user_id,)).fetchall()
    
    user = conn.execute("SELECT name FROM users WHERE id = ?", (user_id,)).fetchone()
    user_name = user['name'] if user else 'investidor(a)'
    conn.close()
    
    top_cat_text = ""
    if top_categories:
        top_cat_text = ", ".join([f"**{r['category']}** (R$ {r['total']:,.2f})".replace(',', 'X').replace('.', ',').replace('X', '.') for r in top_categories])
    
    # Intelligent context-aware answers
    if any(k in message for k in ['saldo', 'quanto tenho', 'balanço', 'minhas finanças', 'resumo']):
        reply = (
            f"Olá **{user_name.split()[0]}**! Aqui está o raio-X da sua saúde financeira atual:\n\n"
            f"💰 **Saldo Líquido:** R$ {balance:,.2f}\n"
            f"🟢 **Receitas Totais:** R$ {income:,.2f}\n"
            f"🔴 **Despesas Totais:** R$ {expense:,.2f}\n"
            f"📊 **Taxa de Poupança:** {savings_rate:.1f}% da sua renda bruta.\n\n"
            f"{'🎉 Parabéns! Você está poupando acima da meta saudável (20%).' if savings_rate >= 20 else '💡 Dica: Busque reduzir pequenos custos para aproximar sua taxa de poupança dos 20% recomendados!'}"
        ).replace(',', 'X').replace('.', ',').replace('X', '.')
        
    elif any(k in message for k in ['maior despesa', 'onde gastei', 'gastos', 'categorias', 'mais caro']):
        if top_categories:
            reply = (
                f"Analisando seus registros recentes, suas principais fontes de despesa são:\n\n"
                f"{top_cat_text}\n\n"
                f"💡 **Recomendação Lumina:** Uma boa prática é auditar a categoria de maior peso para identificar custos recorrentes ou assinaturas que não estão sendo 100% aproveitadas."
            )
        else:
            reply = "Você ainda não possui despesas cadastradas! Use o botão rápido **'+ Nova Transação'** para começar a mapear seus custos."
            
    elif any(k in message for k in ['50/30/20', '50 30 20', 'regra']):
        reply = (
            f"A **Regra 50-30-20** é um dos métodos mais eficazes de equilíbrio financeiro pessoal:\n\n"
            f"• **50% Necessidades Essenciais:** Moradia, alimentação básica, saúde, contas de luz/água e transporte.\n"
            f"• **30% Desejos e Estilo de Vida:** Lazer, restaurantes, viagens, compras pessoais e hobbies.\n"
            f"• **20% Metas e Futuro:** Reserva de emergência, investimentos e quitação de dívidas.\n\n"
            f"Com base na sua renda atual de **R$ {income:,.2f}**, a divisão ideal seria aproximadamente:\n"
            f"- Essenciais: até **R$ {income*0.5:,.2f}**\n"
            f"- Lazer: até **R$ {income*0.3:,.2f}**\n"
            f"- Poupança/Investimentos: pelo menos **R$ {income*0.2:,.2f}**"
        ).replace(',', 'X').replace('.', ',').replace('X', '.')
        
    elif any(k in message for k in ['economizar', 'dica', 'poupar', 'guardar dinheiro', 'dicas']):
        reply = (
            f"Aqui estão **3 estratégias de alto impacto** para acelerar seu patrimônio:\n\n"
            f"1. **Pague-se Primeiro:** Assim que sua renda entrar, transfira imediatamente sua cota de investimentos (ex: 20%) antes de começar a gastar.\n"
            f"2. **Regra das 48 Horas:** Antes de qualquer compra por impulso acima de R$ 100, espere dois dias. Na maioria das vezes o desejo esfria.\n"
            f"3. **Auditoria de Micro-Gastos:** Despesas diárias de R$ 15 (cafés, lanches, fretes) somam mais de R$ 450 no final do mês."
        )
        
    elif any(k in message for k in ['reserva de emergência', 'emergencia', 'investir', 'investimento']):
        reply = (
            f"A **Reserva de Emergência** é a base de toda estabilidade financeira:\n\n"
            f"• **Objetivo:** Guardar de 3 a 6 meses do seu custo de vida mensal em um ativo seguro e de liquidez diária (como Tesouro Selic ou CDB 100% CDI).\n"
            f"• Com suas despesas atuais em torno de **R$ {expense:,.2f}**, sua reserva ideal estimada fica entre **R$ {expense*3:,.2f}** e **R$ {expense*6:,.2f}**.\n"
            f"• Você pode acompanhar seu progresso na seção **Metas Financeiras** do dashboard!"
        ).replace(',', 'X').replace('.', ',').replace('X', '.')
        
    elif any(k in message for k in ['como cadastrar', 'como usar', 'tutorial', 'ajuda']):
        reply = (
            f"É muito simples usar o Lumina Finance:\n\n"
            f"1. **Adicionar Gastos:** Clique no botão verde pulsante **'+ Nova Transação'** no topo (ou aperte a tecla **N** no teclado).\n"
            f"2. **Acompanhar Gráficos:** Veja instantaneamente a evolução e a rosca de categorias se atualizarem.\n"
            f"3. **Metas:** Crie metas de economia na seção inferior e registre aportes.\n"
            f"4. **Tour Guiado:** Se desejar rever a apresentação da plataforma, clique na aba **'Tour Guiado'** aqui mesmo nesta janela!"
        )
        
    else:
        reply = (
            f"Compreendi sua mensagem sobre '{message[:40]}...'. Como assistente financeiro do Lumina, "
            f"posso ajudar você a analisar seus gastos, calcular orçamentos ideais (como a regra 50-30-20), "
            f"ou sugerir estratégias personalizadas para seu saldo de **R$ {balance:,.2f}**.\n\n"
            f"Experimente me perguntar:\n"
            f"• *'Qual é a minha maior despesa?'*\n"
            f"• *'Como aplicar a regra 50/30/20?'*\n"
            f"• *'Dicas práticas para economizar mais'*."
        ).replace(',', 'X').replace('.', ',').replace('X', '.')
        
    return jsonify({'reply': reply})

# ================= EXPORT & RESET DATA =================

@app.route('/api/transactions/export', methods=['GET'])
def export_csv():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT date, type, category, description, amount, payment_method, created_at
        FROM transactions WHERE user_id = ?
        ORDER BY date DESC
    ''', (user_id,)).fetchall()
    conn.close()
    
    si = io.StringIO()
    writer = csv.writer(si, delimiter=';')
    writer.writerow(['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Forma de Pagamento', 'Registrado Em'])
    
    for r in rows:
        tipo = 'Receita' if r['type'] == 'income' else 'Despesa'
        valor = f"{r['amount']:.2f}".replace('.', ',')
        writer.writerow([r['date'], tipo, r['category'], r['description'], valor, r['payment_method'], r['created_at']])
        
    output = si.getvalue()
    return Response(
        output,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment;filename=lumina_transacoes.csv"}
    )

@app.route('/api/demo/reset', methods=['POST'])
def reset_demo():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': 'Não autenticado'}), 401
        
    seed_demo_data(user_id)
    return jsonify({'success': True, 'message': 'Dados de demonstração restaurados com sucesso!'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f">> Lumina Finance Server iniciado em http://127.0.0.1:{port}")
    app.run(host='127.0.0.1', port=port, debug=True)

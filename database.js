// database.js - Gerenciador Híbrido de Banco de Dados: PostgreSQL (Neon.tech) e SQLite
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');

const isPg = Boolean(process.env.DATABASE_URL);

let pgPool = null;
let sqliteDb = null;

// Converter placeholders "?" do SQLite para "$1, $2, ..." do PostgreSQL
function convertSqlToPg(sql) {
    let index = 1;
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    // Substituir ILIKE caso seja conveniente para buscas em texto
    converted = converted.replace(/\bLIKE\b/gi, 'ILIKE');
    return converted;
}

// Configurar parser de tipos do PostgreSQL (garantir tipos numéricos como number em vez de string)
if (isPg) {
    const { Pool, types } = require('pg');
    // int8 / count(*)
    types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10)));
    // numeric / decimal / float
    types.setTypeParser(1700, val => (val === null ? null : parseFloat(val)));

    pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    pgPool.on('error', (err) => {
        console.error('Erro inesperado no Pool do PostgreSQL (Neon):', err);
    });
} else {
    const Database = require('better-sqlite3');
    let dbPath = path.join(__dirname, 'rpg_central.db');

    if (process.env.VERCEL) {
        const tmpDbPath = path.join('/tmp', 'rpg_central.db');
        try {
            if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, tmpDbPath);
            }
            dbPath = tmpDbPath;
        } catch (err) {
            console.error('Aviso ao preparar banco em /tmp na Vercel:', err);
        }
    }

    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('foreign_keys = ON');
}

// Inicializador de Esquema para PostgreSQL
async function initPgDatabase() {
    const client = await pgPool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                uuid VARCHAR(255) UNIQUE NOT NULL,
                nome_usuario VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                senha_usuario VARCHAR(255) NOT NULL,
                fotoperfil_link TEXT DEFAULT 'avatar_padrao.svg',
                cidade VARCHAR(255) DEFAULT 'Pelotas',
                nivel_jogador VARCHAR(255) DEFAULT 'Jogador',
                moeda_virtual NUMERIC(10,2) DEFAULT 250.00,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                uuid VARCHAR(255) UNIQUE NOT NULL,
                nome_admin VARCHAR(255) NOT NULL,
                email_admin VARCHAR(255) UNIQUE NOT NULL,
                senha_admin VARCHAR(255) NOT NULL,
                fotoperfil_link TEXT DEFAULT 'avatar_padrao.svg',
                cargo_nivel VARCHAR(255) DEFAULT 'Admin Nível 2',
                permissoes TEXT DEFAULT 'total_sistemas_campanhas_propostas',
                data_promocao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sistemas (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                genero VARCHAR(255) NOT NULL,
                descricao TEXT NOT NULL,
                criador_id INTEGER,
                imagemcapa_link TEXT,
                preco NUMERIC(10,2) NOT NULL DEFAULT 0.00,
                destaque INTEGER DEFAULT 0,
                admin_id INTEGER,
                pdf_link TEXT,
                estado_aprovacao VARCHAR(50) DEFAULT 'aprovado',
                ia_pontos_fortes TEXT,
                ia_pontos_fracos TEXT,
                ia_dicas_mestre TEXT,
                ia_complexidade VARCHAR(100) DEFAULT 'Média (3/5)',
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS biblioteca_sistemas (
                id SERIAL PRIMARY KEY,
                id_usuario INTEGER NOT NULL,
                id_sistema INTEGER NOT NULL,
                data_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS propostas (
                id SERIAL PRIMARY KEY,
                id_usuario INTEGER NOT NULL,
                id_sistema INTEGER NOT NULL,
                proposta_texto TEXT NOT NULL,
                valor_oferecido NUMERIC(10,2) DEFAULT 0.00,
                forma_pagamento VARCHAR(100) DEFAULT 'Moedas',
                status VARCHAR(100) DEFAULT 'Aguardando...',
                resposta_admin TEXT DEFAULT 'Aguardando análise da administração...',
                data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_resposta TIMESTAMP,
                FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS campanhas (
                id SERIAL PRIMARY KEY,
                id_sistema INTEGER,
                mestre_id INTEGER NOT NULL,
                imagemcapa_link TEXT,
                titulo VARCHAR(255) NOT NULL,
                sinopse TEXT NOT NULL,
                visibilidade VARCHAR(50) DEFAULT 'publica',
                estado_aprovacao VARCHAR(50) DEFAULT 'aprovado',
                admin_id INTEGER,
                pdf_link TEXT,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE SET NULL,
                FOREIGN KEY (mestre_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS personagens (
                id SERIAL PRIMARY KEY,
                id_usuario INTEGER NOT NULL,
                id_sistema INTEGER,
                id_campanha INTEGER,
                nome VARCHAR(255) NOT NULL,
                classe_raca VARCHAR(255) NOT NULL,
                nivel INTEGER DEFAULT 1,
                descricao TEXT,
                imagemperfil_link TEXT DEFAULT 'avatar_padrao.svg',
                imagem_link TEXT,
                pdf_link TEXT,
                forca INTEGER DEFAULT 10,
                destreza INTEGER DEFAULT 10,
                constituicao INTEGER DEFAULT 10,
                inteligencia INTEGER DEFAULT 10,
                sabedoria INTEGER DEFAULT 10,
                carisma INTEGER DEFAULT 10,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE SET NULL,
                FOREIGN KEY (id_campanha) REFERENCES campanhas(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS sessoes_episodios (
                id SERIAL PRIMARY KEY,
                id_campanha INTEGER NOT NULL,
                numero_episodio INTEGER NOT NULL,
                titulo_episodio VARCHAR(255) NOT NULL,
                resumo TEXT NOT NULL,
                data_jogo VARCHAR(100) NOT NULL,
                FOREIGN KEY (id_campanha) REFERENCES campanhas(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS transacoes_moedas (
                id SERIAL PRIMARY KEY,
                id_usuario INTEGER NOT NULL,
                quantidade NUMERIC(10,2) NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                descricao TEXT,
                data_transacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
            );
        `);

        // Seed inicial se banco estiver vazio
        const resAdmin = await client.query('SELECT count(*) as count FROM admins');
        const count = parseInt(resAdmin.rows[0].count, 10);
        if (count === 0) {
            console.log('Populando dados iniciais no PostgreSQL (Neon)...');
            const salt = bcrypt.genSaltSync(10);
            const adminPassHash = bcrypt.hashSync('admin123', salt);

            await client.query(`
                INSERT INTO admins (uuid, nome_admin, email_admin, senha_admin, fotoperfil_link, cargo_nivel, permissoes)
                VALUES 
                ($1, 'Administrador Geral', 'admin@rpgcentral.com', $2, 'avatar_padrao.svg', 'Cargo 2 (Administrador Geral)', 'total'),
                ($3, 'Admin Moderador (Cargo 1)', 'admin1@rpgcentral.com', $2, 'avatar_padrao.svg', 'Cargo 1 (Moderador)', 'propostas,conteudo'),
                ($4, 'Admin Supervisor (Cargo 2)', 'admin2@rpgcentral.com', $2, 'avatar_padrao.svg', 'Cargo 2 (Supervisor)', 'total')
            `, [uuidv4(), adminPassHash, uuidv4(), uuidv4()]);

            await client.query(`
                INSERT INTO sistemas (nome, genero, descricao, criador_id, imagemcapa_link, preco, destaque, pdf_link, estado_aprovacao, ia_pontos_fortes, ia_pontos_fracos, ia_dicas_mestre, ia_complexidade)
                VALUES 
                ('Tormenta 20 - Edição Jogo do Ano', 'Fantasia Medieval Heroica', 'O maior RPG do Brasil em sua edição definitiva! Explore o mundo de Arton, combata a terrível tempestade rubra e crie heróis lendários com mais de 35 classes e origens.', NULL, 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600', 75.00, 1, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', 'aprovado', '• Combate altamente dinâmico e tático com pontos de Mana (PM)\n• Rica mitologia com 20 divindades principais\n• Grande variedade de perícias, magias e poderes concedidos', '• Alto número de modificadores numéricos em níveis elevados\n• Requer atenção no balanceamento de encontros para combos fortes', 'Excelente para mestres que gostam de narrativa épica e jogadores que amam customização profunda.', 'Média (3.5/5)'),
                ('Dungeons & Dragons 5ª Edição', 'Alta Fantasia', 'O clássico RPG de mesa mundial. Crie magos, guerreiros, ladinos e clérigos para explorar masmorras antigas e enfrentar dragões colossais.', NULL, 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600', 120.00, 1, 'https://media.wizards.com/2018/dnd/downloads/DnD_BasicRules_2018.pdf', 'aprovado', '• Sistema d20 amplamente conhecido e acessível para novatos\n• Regra de Vantagem/Desvantagem reduz cálculos complexos\n• Vasta comunidade e centenas de suplementos oficiais', '• Custo elevado de aquisição dos livros físicos oficiais\n• Menos opções táticas para classes puramente marciais', 'Recomendado para iniciantes e campanhas longas de evolução de nível 1 a 20.', 'Fácil a Média (2.8/5)'),
                ('Call of Cthulhu 7ª Edição', 'Terror Cósmico & Investigação', 'Entre no mundo sombrio dos anos 1920 investigando mistérios além da compreensão humana e entidades cósmicas ancestrais inspiradas na obra de H.P. Lovecraft.', NULL, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600', 90.00, 1, 'https://www.chaosium.com/content/FreePDFs/CoC/CHA23131%20Call%20of%20Cthulhu%207th%20Edition%20Quick-Start%20Rules.pdf', 'aprovado', '• Mecânica de Sanidade e Pânico inovadora e imersiva\n• Sistema percentual (d100) extremamente intuitivo\n• Foco total em dedução, pistas e investigação investigativa', '• Alta mortalidade de personagens em combates diretos\n• Pouco indicado para quem busca combate heroico', 'Ideal para mestres que privilegiam atmosfera de suspense, mistério e horror psicológico.', 'Média (3.0/5)'),
                ('Ordem Paranormal RPG', 'Investigação & Terror Moderno', 'O fenômeno de RPG de mesa de investigação contemporânea. Assuma o papel de um agente investigando o Outro Lado no mundo atual.', NULL, 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600', 80.00, 1, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', 'aprovado', '• Ambientação contemporânea com rituais sombrios e elementos paranormais\n• Sistema de Nex (Nível de Exposição Paranormal) inovador\n• Fichas ágeis e combate cinematográfico', '• Depende de boa gestão de sanidade pelos jogadores\n• Inimigos de alto Nex exigem trabalho de equipe rigoroso', 'Perfeito para grupos que adoram suspense moderno e narrativa de ação investigativa.', 'Média (3.2/5)'),
                ('Cyberpunk RED', 'Ficção Científica Distópica', 'O futuro sombrio de Night City na Era do Vermelho. Instale implantes cibernéticos, hackeie megacorporações e sobreviva nas ruas mais perigosas do planeta.', NULL, 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600', 65.00, 0, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', 'aprovado', '• Sistema de combate letal e dinâmico com tiroteios intensos\n• Regras aprofundadas de Netrunning (invasão cibernética)\n• Estética visual marcante e atitude urbana', '• Mecânica de armadura e perda de humanidade exige acompanhamento\n• Alta probabilidade de danos críticos severos', 'Excelente para narrativas de conspiração corporativa e mercenários urbanos.', 'Avançada (4.0/5)'),
                ('Vampiro: A Máscara 5ª Edição', 'Horror Pessoal & Política', 'Torne-se um vampiro recém-abraçado no Mundo das Trevas. Equilibre a fome insaciável de sangue com os últimos resquícios de sua humanidade.', NULL, 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600', 85.00, 0, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', 'aprovado', '• Mecânica de Dados de Fome cria tensão a cada rolagem\n• Enorme ênfase em intriga política e dilemas morais profundos\n• Cenário gótico contemporâneo rico em detalhes', '• Combate simplificado não agrada amantes de wargame\n• Exige maturidade dos jogadores para temas sombrios', 'Essencial para sessões baseadas em interpretação dramática e conspirações sociais.', 'Média (3.4/5)')
            `);
            console.log('Tabelas e acervo inicial configurados com sucesso no PostgreSQL (Neon)!');
        }
    } finally {
        client.release();
    }
}

// Inicializador de Esquema para SQLite
function initSqliteDatabase() {
    sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            nome_usuario TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha_usuario TEXT NOT NULL,
            fotoperfil_link TEXT DEFAULT 'avatar_padrao.svg',
            cidade TEXT DEFAULT 'Pelotas',
            nivel_jogador TEXT DEFAULT 'Jogador',
            moeda_virtual REAL DEFAULT 250.00,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            nome_admin TEXT NOT NULL,
            email_admin TEXT UNIQUE NOT NULL,
            senha_admin TEXT NOT NULL,
            fotoperfil_link TEXT DEFAULT 'avatar_padrao.svg',
            cargo_nivel TEXT DEFAULT 'Admin Nível 2',
            permissoes TEXT DEFAULT 'total_sistemas_campanhas_propostas',
            data_promocao DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sistemas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            genero TEXT NOT NULL,
            descricao TEXT NOT NULL,
            criador_id INTEGER,
            imagemcapa_link TEXT,
            preco REAL NOT NULL DEFAULT 0.00,
            destaque INTEGER DEFAULT 0,
            admin_id INTEGER,
            pdf_link TEXT,
            estado_aprovacao TEXT DEFAULT 'aprovado',
            ia_pontos_fortes TEXT,
            ia_pontos_fracos TEXT,
            ia_dicas_mestre TEXT,
            ia_complexidade TEXT DEFAULT 'Média (3/5)',
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS biblioteca_sistemas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER NOT NULL,
            id_sistema INTEGER NOT NULL,
            data_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS propostas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER NOT NULL,
            id_sistema INTEGER NOT NULL,
            proposta_texto TEXT NOT NULL,
            valor_oferecido REAL DEFAULT 0.00,
            forma_pagamento TEXT DEFAULT 'Moedas',
            status TEXT DEFAULT 'Aguardando...',
            resposta_admin TEXT DEFAULT 'Aguardando análise da administração...',
            data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_resposta DATETIME,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS campanhas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_sistema INTEGER,
            mestre_id INTEGER NOT NULL,
            imagemcapa_link TEXT,
            titulo TEXT NOT NULL,
            sinopse TEXT NOT NULL,
            visibilidade TEXT DEFAULT 'publica',
            estado_aprovacao TEXT DEFAULT 'aprovado',
            admin_id INTEGER,
            pdf_link TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE SET NULL,
            FOREIGN KEY (mestre_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS personagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER NOT NULL,
            id_sistema INTEGER,
            id_campanha INTEGER,
            nome TEXT NOT NULL,
            classe_raca TEXT NOT NULL,
            nivel INTEGER DEFAULT 1,
            descricao TEXT,
            imagemperfil_link TEXT DEFAULT 'avatar_padrao.svg',
            imagem_link TEXT,
            pdf_link TEXT,
            forca INTEGER DEFAULT 10,
            destreza INTEGER DEFAULT 10,
            constituicao INTEGER DEFAULT 10,
            inteligencia INTEGER DEFAULT 10,
            sabedoria INTEGER DEFAULT 10,
            carisma INTEGER DEFAULT 10,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (id_sistema) REFERENCES sistemas(id) ON DELETE SET NULL,
            FOREIGN KEY (id_campanha) REFERENCES campanhas(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS sessoes_episodios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_campanha INTEGER NOT NULL,
            numero_episodio INTEGER NOT NULL,
            titulo_episodio TEXT NOT NULL,
            resumo TEXT NOT NULL,
            data_jogo TEXT NOT NULL,
            FOREIGN KEY (id_campanha) REFERENCES campanhas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS transacoes_moedas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER NOT NULL,
            quantidade REAL NOT NULL,
            tipo TEXT NOT NULL,
            descricao TEXT,
            data_transacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
        );
    `);

    const adminCount = sqliteDb.prepare('SELECT count(*) as count FROM admins').get().count;
    if (adminCount === 0) {
        const salt = bcrypt.genSaltSync(10);
        const adminPassHash = bcrypt.hashSync('admin123', salt);

        const insertAdmin = sqliteDb.prepare(`
            INSERT INTO admins (uuid, nome_admin, email_admin, senha_admin, fotoperfil_link, cargo_nivel, permissoes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertAdmin.run(uuidv4(), 'Administrador Geral', 'admin@rpgcentral.com', adminPassHash, 'avatar_padrao.svg', 'Cargo 2 (Administrador Geral)', 'total');
        insertAdmin.run(uuidv4(), 'Admin Moderador (Cargo 1)', 'admin1@rpgcentral.com', adminPassHash, 'avatar_padrao.svg', 'Cargo 1 (Moderador)', 'propostas,conteudo');
        insertAdmin.run(uuidv4(), 'Admin Supervisor (Cargo 2)', 'admin2@rpgcentral.com', adminPassHash, 'avatar_padrao.svg', 'Cargo 2 (Supervisor)', 'total');

        const insertSistema = sqliteDb.prepare(`
            INSERT INTO sistemas (nome, genero, descricao, criador_id, imagemcapa_link, preco, destaque, pdf_link, estado_aprovacao, ia_pontos_fortes, ia_pontos_fracos, ia_dicas_mestre, ia_complexidade)
            VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'aprovado', ?, ?, ?, ?)
        `);

        insertSistema.run('Tormenta 20 - Edição Jogo do Ano', 'Fantasia Medieval Heroica', 'O maior RPG do Brasil em sua edição definitiva! Explore o mundo de Arton, combata a terrível tempestade rubra e crie heróis lendários com mais de 35 classes e origens.', 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600', 75.00, 1, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', '• Combate altamente dinâmico e tático com pontos de Mana (PM)\n• Rica mitologia com 20 divindades principais\n• Grande variedade de perícias, magias e poderes concedidos', '• Alto número de modificadores numéricos em níveis elevados\n• Requer atenção no balanceamento de encontros para combos fortes', 'Excelente para mestres que gostam de narrativa épica e jogadores que amam customização profunda.', 'Média (3.5/5)');
        insertSistema.run('Dungeons & Dragons 5ª Edição', 'Alta Fantasia', 'O clássico RPG de mesa mundial. Crie magos, guerreiros, ladinos e clérigos para explorar masmorras antigas e enfrentar dragões colossais.', 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600', 120.00, 1, 'https://media.wizards.com/2018/dnd/downloads/DnD_BasicRules_2018.pdf', '• Sistema d20 amplamente conhecido e acessível para novatos\n• Regra de Vantagem/Desvantagem reduz cálculos complexos\n• Vasta comunidade e centenas de suplementos oficiais', '• Custo elevado de aquisição dos livros físicos oficiais\n• Menos opções táticas para classes puramente marciais', 'Recomendado para iniciantes e campanhas longas de evolução de nível 1 a 20.', 'Fácil a Média (2.8/5)');
        insertSistema.run('Call of Cthulhu 7ª Edição', 'Terror Cósmico & Investigação', 'Entre no mundo sombrio dos anos 1920 investigando mistérios além da compreensão humana e entidades cósmicas ancestrais inspiradas na obra de H.P. Lovecraft.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600', 90.00, 1, 'https://www.chaosium.com/content/FreePDFs/CoC/CHA23131%20Call%20of%20Cthulhu%207th%20Edition%20Quick-Start%20Rules.pdf', '• Mecânica de Sanidade e Pânico inovadora e imersiva\n• Sistema percentual (d100) extremamente intuitivo\n• Foco total em dedução, pistas e investigação investigativa', '• Alta mortalidade de personagens em combates diretos\n• Pouco indicado para quem busca combate heroico', 'Ideal para mestres que privilegiam atmosfera de suspense, mistério e horror psicológico.', 'Média (3.0/5)');
        insertSistema.run('Ordem Paranormal RPG', 'Investigação & Terror Moderno', 'O fenômeno de RPG de mesa de investigação contemporânea. Assuma o papel de um agente investigando o Outro Lado no mundo atual.', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600', 80.00, 1, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', '• Ambientação contemporânea com rituais sombrios e elementos paranormais\n• Sistema de Nex (Nível de Exposição Paranormal) inovador\n• Fichas ágeis e combate cinematográfico', '• Depende de boa gestão de sanidade pelos jogadores\n• Inimigos de alto Nex exigem trabalho de equipe rigoroso', 'Perfeito para grupos que adoram suspense moderno e narrativa de ação investigativa.', 'Média (3.2/5)');
        insertSistema.run('Cyberpunk RED', 'Ficção Científica Distópica', 'O futuro sombrio de Night City na Era do Vermelho. Instale implantes cibernéticos, hackeie megacorporações e sobreviva nas ruas mais perigosas do planeta.', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600', 65.00, 0, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', '• Sistema de combate letal e dinâmico com tiroteios intensos\n• Regras aprofundadas de Netrunning (invasão cibernética)\n• Estética visual marcante e atitude urbana', '• Mecânica de armadura e perda de humanidade exige acompanhamento\n• Alta probabilidade de danos críticos severos', 'Excelente para narrativas de conspiração corporativa e mercenários urbanos.', 'Avançada (4.0/5)');
        insertSistema.run('Vampiro: A Máscara 5ª Edição', 'Horror Pessoal & Política', 'Torne-se um vampiro recém-abraçado no Mundo das Trevas. Equilibre a fome insaciável de sangue com os últimos resquícios de sua humanidade.', 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600', 85.00, 0, 'https://raw.githubusercontent.com/mozilla/pdf.js/master/examples/learning/helloworld.pdf', '• Mecânica de Dados de Fome cria tensão a cada rolagem\n• Enorme ênfase em intriga política e dilemas morais profundos\n• Cenário gótico contemporâneo rico em detalhes', '• Combate simplificado não agrada amantes de wargame\n• Exige maturidade dos jogadores para temas sombrios', 'Essencial para sessões baseadas em interpretação dramática e conspirações sociais.', 'Média (3.4/5)');
    }
}

// Inicializar banco
if (isPg) {
    initPgDatabase().catch(err => {
        console.error('Erro ao inicializar banco de dados PostgreSQL (Neon):', err);
    });
} else {
    initSqliteDatabase();
}

// Interface Unificada e Amigável do Banco de Dados
function flattenArgs(args) {
    if (args.length === 1 && Array.isArray(args[0])) return args[0];
    return args;
}

const db = {
    isPg,

    async get(sql, ...args) {
        const params = flattenArgs(args);
        if (isPg) {
            const pgSql = convertSqlToPg(sql);
            const res = await pgPool.query(pgSql, params);
            return res.rows[0];
        } else {
            return sqliteDb.prepare(sql).get(...params);
        }
    },

    async all(sql, ...args) {
        const params = flattenArgs(args);
        if (isPg) {
            const pgSql = convertSqlToPg(sql);
            const res = await pgPool.query(pgSql, params);
            return res.rows;
        } else {
            return sqliteDb.prepare(sql).all(...params);
        }
    },

    async run(sql, ...args) {
        const params = flattenArgs(args);
        if (isPg) {
            let pgSql = convertSqlToPg(sql);
            const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
            if (isInsert && !/RETURNING/i.test(sql)) {
                pgSql += ' RETURNING id';
            }
            const res = await pgPool.query(pgSql, params);
            return {
                changes: res.rowCount,
                lastInsertRowid: res.rows[0]?.id
            };
        } else {
            return sqliteDb.prepare(sql).run(...params);
        }
    },

    async exec(sql) {
        if (isPg) {
            return await pgPool.query(sql);
        } else {
            return sqliteDb.exec(sql);
        }
    },

    // Compatibilidade com a sintaxe db.prepare(sql).get / all / run
    prepare(sql) {
        return {
            get: async (...args) => db.get(sql, ...args),
            all: async (...args) => db.all(sql, ...args),
            run: async (...args) => db.run(sql, ...args)
        };
    }
};

module.exports = db;

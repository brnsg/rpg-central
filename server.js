const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { randomUUID: uuidv4 } = require('crypto');
const db = require('./database');
const { gerarAnaliseIASistema, gerarSistemaCompletoDoZero, gerarPersonagemComIA, gerarCampanhaComIA } = require('./ia_service');

// Carregar variáveis de ambiente do .env nativamente no Node.js
if (process.loadEnvFile) {
    try { process.loadEnvFile(); } catch (e) {}
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da aplicação (HTML, CSS, Imagens, JS)
app.use(express.static(__dirname));

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// 1. ROTAS DE AUTENTICAÇÃO E USUÁRIOS
// ==========================================

// Cadastro de Cliente (com bcrypt e UUID)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nome_usuario, email, senha, cidade, fotoperfil_link, nivel_jogador } = req.body;

        if (!nome_usuario || !email || !senha) {
            return res.status(400).json({ erro: 'Nome de usuário, e-mail e senha são obrigatórios.' });
        }

        // Verificar se e-mail já existe
        const usuarioExistente = await db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'Este e-mail já está cadastrado no sistema.' });
        }

        // Criptografia de Senha (bcrypt com 10 salt rounds)
        const salt = bcrypt.genSaltSync(10);
        const senhaHash = bcrypt.hashSync(senha, salt);
        const userUuid = uuidv4();

        const insert = await db.prepare(`
            INSERT INTO usuarios (uuid, nome_usuario, email, senha_usuario, fotoperfil_link, cidade, nivel_jogador, moeda_virtual)
            VALUES (?, ?, ?, ?, ?, ?, ?, 250.00)
        `);

        const result = await insert.run(
            userUuid,
            nome_usuario,
            email,
            senhaHash,
            fotoperfil_link || 'avatar_padrao.svg',
            cidade || 'Pelotas',
            nivel_jogador || 'Mestre & Jogador'
        );

        // Registro de bônus de moedas de boas-vindas
        await db.prepare(`
            INSERT INTO transacoes_moedas (id_usuario, quantidade, tipo, descricao)
            VALUES (?, 250.00, 'BONUS_CADASTRO', 'Bônus de Boas-vindas ao RPG Central')
        `).run(result.lastInsertRowid);

        const novoUsuario = await db.prepare(`
            SELECT id, uuid, nome_usuario, email, fotoperfil_link, cidade, nivel_jogador, moeda_virtual
            FROM usuarios WHERE id = ?
        `).get(result.lastInsertRowid);

        return res.status(201).json({
            mensagem: 'Conta criada com sucesso!',
            usuario: novoUsuario
        });
    } catch (err) {
        console.error('Erro no cadastro:', err);
        return res.status(500).json({ erro: 'Erro interno ao realizar cadastro.' });
    }
});

// Login de Cliente e Administrador (com verificação de hash bcrypt)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

        const emailTratado = email.trim().toLowerCase();

        // 1. Verificar primeiro se é uma Conta de Administrador
        const admin = await db.prepare('SELECT * FROM admins WHERE LOWER(email_admin) = ?').get(emailTratado);
        if (admin && bcrypt.compareSync(senha, admin.senha_admin)) {
            const adminRetorno = {
                id: admin.id,
                uuid: admin.uuid,
                nome_admin: admin.nome_admin,
                email_admin: admin.email_admin,
                fotoperfil_link: admin.fotoperfil_link,
                cargo_nivel: admin.cargo_nivel,
                permissoes: admin.permissoes
            };

            const usuarioRetorno = {
                id: admin.id,
                uuid: admin.uuid,
                nome_usuario: admin.nome_admin,
                email: admin.email_admin,
                fotoperfil_link: admin.fotoperfil_link,
                cidade: 'Pelotas',
                nivel_jogador: admin.cargo_nivel,
                moeda_virtual: 9999.00
            };

            return res.json({
                mensagem: 'Acesso administrativo autorizado!',
                isAdmin: true,
                admin: adminRetorno,
                usuario: usuarioRetorno
            });
        }

        // 2. Verificar se é Usuário / Cliente Comum
        const usuario = await db.prepare('SELECT * FROM usuarios WHERE LOWER(email) = ?').get(emailTratado);
        if (!usuario) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const senhaValida = bcrypt.compareSync(senha, usuario.senha_usuario);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const usuarioRetorno = {
            id: usuario.id,
            uuid: usuario.uuid,
            nome_usuario: usuario.nome_usuario,
            email: usuario.email,
            fotoperfil_link: usuario.fotoperfil_link,
            cidade: usuario.cidade,
            nivel_jogador: usuario.nivel_jogador,
            moeda_virtual: usuario.moeda_virtual
        };

        return res.json({
            mensagem: 'Login realizado com sucesso!',
            usuario: usuarioRetorno
        });
    } catch (err) {
        console.error('Erro no login:', err);
        return res.status(500).json({ erro: 'Erro interno ao realizar login.' });
    }
});

// Recuperar Sessão por UUID (Requisito 5: Manter Conectado via LocalStorage)
app.get('/api/auth/me/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        let usuario = await db.prepare(`
            SELECT id, uuid, nome_usuario, email, fotoperfil_link, cidade, nivel_jogador, moeda_virtual, data_criacao
            FROM usuarios WHERE uuid = ?
        `).get(uuid);

        if (!usuario) {
            const admin = await db.prepare(`
                SELECT id, uuid, nome_admin, email_admin, fotoperfil_link, cargo_nivel, permissoes
                FROM admins WHERE uuid = ?
            `).get(uuid);

            if (admin) {
                usuario = {
                    id: admin.id,
                    uuid: admin.uuid,
                    nome_usuario: admin.nome_admin,
                    email: admin.email_admin,
                    fotoperfil_link: admin.fotoperfil_link,
                    cidade: 'Pelotas',
                    nivel_jogador: admin.cargo_nivel,
                    moeda_virtual: 9999.00,
                    data_criacao: new Date().toISOString()
                };
            }
        }

        if (!usuario) {
            return res.status(404).json({ erro: 'Sessão inválida ou usuário não encontrado.' });
        }

        return res.json({ usuario });
    } catch (err) {
        console.error('Erro ao recuperar sessão:', err);
        return res.status(500).json({ erro: 'Erro ao validar sessão.' });
    }
});

// Atualizar Informações da Conta do Usuário (Nome, Cidade, Foto, Senha)
app.put('/api/auth/me/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { nome_usuario, cidade, fotoperfil_link, nova_senha } = req.body;

        const usuario = await db.prepare('SELECT * FROM usuarios WHERE uuid = ?').get(uuid);
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        let senhaFinal = usuario.senha_usuario;
        if (nova_senha && nova_senha.trim().length >= 6) {
            const salt = bcrypt.genSaltSync(10);
            senhaFinal = bcrypt.hashSync(nova_senha.trim(), salt);
        }

        const update = await db.prepare(`
            UPDATE usuarios
            SET nome_usuario = COALESCE(?, nome_usuario),
                cidade = COALESCE(?, cidade),
                fotoperfil_link = COALESCE(?, fotoperfil_link),
                senha_usuario = ?
            WHERE uuid = ?
        `);

        await update.run(
            nome_usuario ? nome_usuario.trim() : usuario.nome_usuario,
            cidade ? cidade.trim() : usuario.cidade,
            fotoperfil_link ? fotoperfil_link.trim() : usuario.fotoperfil_link,
            senhaFinal,
            uuid
        );

        const usuarioAtualizado = await db.prepare(`
            SELECT id, uuid, nome_usuario, email, fotoperfil_link, cidade, nivel_jogador, moeda_virtual, data_criacao
            FROM usuarios WHERE uuid = ?
        `).get(uuid);

        return res.json({
            mensagem: 'Informações da conta atualizadas com sucesso!',
            usuario: usuarioAtualizado
        });
    } catch (err) {
        console.error('Erro ao atualizar perfil:', err);
        return res.status(500).json({ erro: 'Erro interno ao atualizar perfil.' });
    }
});

// Deletar Conta do Usuário
app.delete('/api/auth/me/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const usuario = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(uuid);
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        await db.prepare('DELETE FROM usuarios WHERE uuid = ?').run(uuid);

        return res.json({ mensagem: 'Sua conta foi excluída definitivamente com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir conta:', err);
        return res.status(500).json({ erro: 'Erro interno ao excluir conta.' });
    }
});

// Login de Administrador (Área Restrita - Requisito 8)
app.post('/api/auth/admin/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
        }

        const admin = await db.prepare('SELECT * FROM admins WHERE email_admin = ?').get(email);
        if (!admin) {
            return res.status(401).json({ erro: 'Credenciais de administrador inválidas.' });
        }

        const senhaValida = bcrypt.compareSync(senha, admin.senha_admin);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Credenciais de administrador inválidas.' });
        }

        const adminRetorno = {
            id: admin.id,
            uuid: admin.uuid,
            nome_admin: admin.nome_admin,
            email_admin: admin.email_admin,
            fotoperfil_link: admin.fotoperfil_link,
            cargo_nivel: admin.cargo_nivel,
            permissoes: admin.permissoes
        };

        return res.json({
            mensagem: 'Acesso administrativo autorizado!',
            admin: adminRetorno
        });
    } catch (err) {
        console.error('Erro no login admin:', err);
        return res.status(500).json({ erro: 'Erro ao autenticar administrador.' });
    }
});

// Recuperar Sessão de Admin por UUID
app.get('/api/auth/admin/me/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const admin = await db.prepare(`
            SELECT id, uuid, nome_admin, email_admin, fotoperfil_link, cargo_nivel, permissoes
            FROM admins WHERE uuid = ?
        `).get(uuid);

        if (!admin) {
            return res.status(404).json({ erro: 'Sessão administrativa expirada.' });
        }

        return res.json({ admin });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao validar admin.' });
    }
});

// ==========================================
// 2. ROTAS DO PRODUTO PRINCIPAL (SISTEMAS)
// Requisitos 1, 2, 3, 10
// ==========================================

// Listar Sistemas com Filtro de Busca, Destaque e Status de Aquisição
app.get('/api/sistemas', async (req, res) => {
    try {
        const { search, genero, destaque, user_uuid, apenas_adquiridos } = req.query;

        let userId = null;
        if (user_uuid) {
            const u = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
            if (u) userId = u.id;
        }

        let query = `
            SELECT s.*, u.nome_usuario AS criador_nome,
                   CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS adquirido
            FROM sistemas s
            LEFT JOIN usuarios u ON s.criador_id = u.id
            LEFT JOIN biblioteca_sistemas b ON s.id = b.id_sistema ${userId ? 'AND b.id_usuario = ?' : 'AND 1=0'}
            WHERE 1=1
        `;
        const params = [];
        if (userId) {
            params.push(userId);
        }

        if (apenas_adquiridos === 'true' || apenas_adquiridos === '1') {
            if (userId) {
                query += ' AND b.id IS NOT NULL';
            } else {
                return res.json({ sistemas: [] });
            }
        }

        if (destaque === 'true' || destaque === '1') {
            query += ' AND s.destaque = 1';
        }

        if (genero && genero !== 'Todos') {
            query += ' AND s.genero = ?';
            params.push(genero);
        }

        if (search && search.trim() !== '') {
            query += ' AND (s.nome LIKE ? OR s.genero LIKE ? OR s.descricao LIKE ?)';
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ' ORDER BY s.destaque DESC, s.id DESC';

        const sistemas = await db.prepare(query).all(...params);
        return res.json({ sistemas });
    } catch (err) {
        console.error('Erro ao buscar sistemas:', err);
        return res.status(500).json({ erro: 'Erro ao consultar sistemas.' });
    }
});

// Obter Detalhes de um Sistema (incluindo status de aquisição e IA)
app.get('/api/sistemas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_uuid } = req.query;

        let userId = null;
        if (user_uuid) {
            const u = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
            if (u) userId = u.id;
        }

        const query = `
            SELECT s.*, u.nome_usuario AS criador_nome,
                   CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END AS adquirido
            FROM sistemas s
            LEFT JOIN usuarios u ON s.criador_id = u.id
            LEFT JOIN biblioteca_sistemas b ON s.id = b.id_sistema ${userId ? 'AND b.id_usuario = ?' : 'AND 1=0'}
            WHERE s.id = ?
        `;

        const sistema = await db.prepare(query).get(...(userId ? [userId, id] : [id]));

        if (!sistema) {
            return res.status(404).json({ erro: 'Sistema não encontrado.' });
        }

        return res.json({ sistema });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao obter sistema.' });
    }
});

// Listar Sistemas Adquiridos pelo Usuário (Biblioteca)
app.get('/api/biblioteca/:user_uuid', async (req, res) => {
    try {
        const { user_uuid } = req.params;
        const usuario = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        const sistemas = await db.prepare(`
            SELECT s.*, b.data_compra, 1 AS adquirido
            FROM biblioteca_sistemas b
            JOIN sistemas s ON b.id_sistema = s.id
            WHERE b.id_usuario = ?
            ORDER BY b.id DESC
        `).all(usuario.id);

        return res.json({ sistemas });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao buscar biblioteca do usuário.' });
    }
});

// Status da Chave do Gemini
app.get('/api/admin/gemini-status', async (req, res) => {
    const key = (process.env.GEMINI_API_KEY || '').trim();
    const configurado = key.length > 5;
    const chavePreview = configurado ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : '';
    return res.json({ configurado, hasKey: configurado, chavePreview });
});

// Testar e Atualizar Chave do Gemini (.env) - Aceita qualquer formato válido (AIzaSy, AQ..., Bearer, etc)
app.post('/api/admin/gemini-key', async (req, res) => {
    try {
        const keyRaw = req.body.chave || req.body.api_key;
        if (!keyRaw || typeof keyRaw !== 'string' || keyRaw.trim().length < 5) {
            return res.status(400).json({ erro: 'Por favor, insira uma chave de API válida.' });
        }
        const key = keyRaw.trim();

        // 1. Testar a chave diretamente contra a API do Google Gemini
        let testOk = false;
        let testErrorMsg = '';

        try {
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;
            const testRes = await fetch(testUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] })
            });

            if (testRes.ok) {
                testOk = true;
            } else {
                const errData = await testRes.json().catch(() => ({}));
                testErrorMsg = errData.error?.message || `HTTP ${testRes.status}`;
            }
        } catch (netErr) {
            testErrorMsg = netErr.message;
        }

        // Se falhou no endpoint direto, tentar no endpoint de listagem de modelos
        if (!testOk) {
            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
                const listRes = await fetch(listUrl);
                if (listRes.ok) {
                    testOk = true;
                }
            } catch (e) {}
        }

        // Se o teste falhou, avisar o usuário mas dar a opção de entender o motivo exato
        if (!testOk) {
            return res.status(400).json({
                erro: `A API do Google recusou esta chave. Resposta do Google: "${testErrorMsg}". Verifique se copiou a chave inteira ou gere uma nova em https://aistudio.google.com/app/apikey`
            });
        }

        // 2. Chave aprovada com sucesso! Gravar no process.env e no arquivo .env
        process.env.GEMINI_API_KEY = key;
        const fs = require('fs');
        fs.writeFileSync(path.join(__dirname, '.env'), `GEMINI_API_KEY=${key}\n`);

        return res.json({
            sucesso: true,
            mensagem: '✨ Chave verificada e conectada com sucesso à API oficial do Google Gemini!'
        });
    } catch (e) {
        return res.status(500).json({ erro: 'Erro ao processar chave: ' + e.message });
    }
});

// Rota de Criação Autônoma de Sistema do Zero por IA (Google Gemini)
app.post('/api/ia/gerar-sistema-completo', async (req, res) => {
    try {
        const { tema } = req.body || {};
        const sistema = await gerarSistemaCompletoDoZero(tema);
        return res.json({ sucesso: true, sistema });
    } catch (err) {
        console.error('Erro ao gerar sistema com IA:', err);
        return res.status(500).json({ erro: err.message || 'Falha ao gerar sistema autônomo com IA.' });
    }
});

// Rota de Análise Assistida por IA (Google Gemini - Requisito 3)
app.post('/api/ia/analisar-sistema', async (req, res) => {
    try {
        const { nome, genero, descricao } = req.body || {};
        const analise = await gerarAnaliseIASistema({
            nome: nome || 'Sistema Inédito',
            genero: genero || 'Fantasia & Aventura',
            descricao: descricao || 'Aventura imersiva com foco em interpretação e regras dinâmicas.'
        });
        return res.json({ sucesso: true, analise });
    } catch (err) {
        console.error('Erro ao gerar análise IA:', err);
        return res.status(500).json({ erro: err.message || 'Falha ao processar análise de IA.' });
    }
});

// Rota de Criação de Personagem com IA (Google Gemini)
app.post('/api/ia/gerar-personagem', async (req, res) => {
    try {
        const { ideia } = req.body || {};
        const personagem = await gerarPersonagemComIA(ideia);
        return res.json({ sucesso: true, personagem });
    } catch (err) {
        console.error('Erro ao gerar personagem com IA:', err);
        return res.status(500).json({ erro: err.message || 'Falha ao gerar personagem com IA.' });
    }
});

// Rota de Criação de Campanha com IA (Google Gemini)
app.post('/api/ia/gerar-campanha', async (req, res) => {
    try {
        const { tema } = req.body || {};
        const campanha = await gerarCampanhaComIA(tema);
        return res.json({ sucesso: true, campanha });
    } catch (err) {
        console.error('Erro ao gerar campanha com IA:', err);
        return res.status(500).json({ erro: err.message || 'Falha ao gerar campanha com IA.' });
    }
});

// Função auxiliar para validar permissões de Cargo 2 (Gerência / Supervisão)
async function verificarPermissaoCargo2(req) {
    const adminUuid = req.headers['x-admin-uuid'] || req.query.admin_uuid || req.body?.admin_uuid;
    if (adminUuid) {
        const admin = await db.prepare('SELECT cargo_nivel FROM admins WHERE uuid = ?').get(adminUuid);
        if (admin && admin.cargo_nivel && admin.cargo_nivel.toLowerCase().includes('cargo 1')) {
            return false; // Cargo 1 não tem permissão para alterar produtos
        }
    }
    return true;
}

// Cadastrar Novo Sistema de Regras (Exclusivo para Administração Cargo 2 - Requisito 10)
app.post('/api/sistemas', async (req, res) => {
    try {
        if (!(await verificarPermissaoCargo2(req))) {
            return res.status(403).json({
                erro: 'Acesso Negado: Administradores Cargo 1 (Moderador) possuem permissão apenas para atendimento de propostas e consulta. O cadastro de novos sistemas no acervo é restrito ao Cargo 2 (Supervisor/Geral).'
            });
        }

        const {
            nome, genero, descricao, criador_id, imagemcapa_link, preco,
            destaque, pdf_link, ia_pontos_fortes, ia_pontos_fracos,
            ia_dicas_mestre, ia_complexidade
        } = req.body;

        if (!nome || !genero || !descricao) {
            return res.status(400).json({ erro: 'Nome, gênero e descrição são obrigatórios.' });
        }

        // Se os dados de IA não foram preenchidos manualmente pelo Admin, consultar a IA automaticamente
        let pontosFortes = ia_pontos_fortes;
        let pontosFracos = ia_pontos_fracos;
        let dicasMestre = ia_dicas_mestre;
        let complexidade = ia_complexidade;

        if (!pontosFortes || !pontosFracos) {
            try {
                const analise = await gerarAnaliseIASistema({ nome, genero, descricao });
                pontosFortes = pontosFortes || analise.pontos_fortes;
                pontosFracos = pontosFracos || analise.pontos_fracos;
                dicasMestre = dicasMestre || analise.dicas_mestre;
                complexidade = complexidade || analise.complexidade;
            } catch (e) {
                console.warn('Fallback na IA ao cadastrar sistema:', e.message);
            }
        }

        const insert = await db.prepare(`
            INSERT INTO sistemas (
                nome, genero, descricao, criador_id, imagemcapa_link, preco,
                destaque, pdf_link, estado_aprovacao, ia_pontos_fortes,
                ia_pontos_fracos, ia_dicas_mestre, ia_complexidade
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aprovado', ?, ?, ?, ?)
        `);

        const result = await insert.run(
            nome,
            genero,
            descricao,
            criador_id || null,
            imagemcapa_link || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
            parseFloat(preco) || 0.00,
            destaque ? 1 : 0,
            pdf_link || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            pontosFortes || '• Sistema dinâmico e flexível\n• Foco em narrativa imersiva',
            pontosFracos || '• Requer leitura das regras básicas',
            dicasMestre || 'Inicie com aventuras introdutórias.',
            complexidade || 'Média (3/5)'
        );

        return res.status(201).json({
            mensagem: 'Sistema cadastrado e analisado com sucesso!',
            id: result.lastInsertRowid,
            ia: {
                pontos_fortes: pontosFortes,
                pontos_fracos: pontosFracos,
                dicas_mestre: dicasMestre,
                complexidade: complexidade
            }
        });
    } catch (err) {
        console.error('Erro ao cadastrar sistema:', err);
        return res.status(500).json({ erro: 'Erro interno ao cadastrar sistema.' });
    }
});

// Alternar Destaque do Sistema (Requisito 10 - Exclusivo Cargo 2)
app.patch('/api/sistemas/:id/destaque', async (req, res) => {
    try {
        if (!(await verificarPermissaoCargo2(req))) {
            return res.status(403).json({
                erro: 'Acesso Negado: Alterar destaques na vitrine principal requer permissão de Cargo 2 (Supervisor/Geral).'
            });
        }

        const { id } = req.params;
        const sistema = await db.prepare('SELECT destaque FROM sistemas WHERE id = ?').get(id);
        if (!sistema) {
            return res.status(404).json({ erro: 'Sistema não encontrado.' });
        }

        const novoDestaque = sistema.destaque === 1 ? 0 : 1;
        await db.prepare('UPDATE sistemas SET destaque = ? WHERE id = ?').run(novoDestaque, id);

        return res.json({
            mensagem: `Destaque alterado para ${novoDestaque === 1 ? 'ATIVADO' : 'DESATIVADO'}.`,
            destaque: novoDestaque
        });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao alternar destaque.' });
    }
});

// Atualizar Sistema (Exclusivo Cargo 2)
app.put('/api/sistemas/:id', async (req, res) => {
    try {
        if (!(await verificarPermissaoCargo2(req))) {
            return res.status(403).json({
                erro: 'Acesso Negado: Edição de sistemas cadastrados é restrita ao Cargo 2 (Supervisor/Geral).'
            });
        }

        const { id } = req.params;
        const { nome, genero, descricao, preco, destaque, imagemcapa_link, pdf_link, ia_pontos_fortes, ia_pontos_fracos, ia_dicas_mestre, ia_complexidade } = req.body;

        await db.prepare(`
            UPDATE sistemas
            SET nome = COALESCE(?, nome),
                genero = COALESCE(?, genero),
                descricao = COALESCE(?, descricao),
                preco = COALESCE(?, preco),
                destaque = COALESCE(?, destaque),
                imagemcapa_link = COALESCE(?, imagemcapa_link),
                pdf_link = COALESCE(?, pdf_link),
                ia_pontos_fortes = COALESCE(?, ia_pontos_fortes),
                ia_pontos_fracos = COALESCE(?, ia_pontos_fracos),
                ia_dicas_mestre = COALESCE(?, ia_dicas_mestre),
                ia_complexidade = COALESCE(?, ia_complexidade)
            WHERE id = ?
        `).run(nome, genero, descricao, preco, destaque !== undefined ? (destaque ? 1 : 0) : null, imagemcapa_link, pdf_link, ia_pontos_fortes, ia_pontos_fracos, ia_dicas_mestre, ia_complexidade, id);

        return res.json({ mensagem: 'Sistema atualizado com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar sistema.' });
    }
});

// Excluir Sistema (Exclusivo Cargo 2 / Admin Geral)
app.delete('/api/sistemas/:id', async (req, res) => {
    try {
        if (!(await verificarPermissaoCargo2(req))) {
            return res.status(403).json({
                erro: 'Acesso Negado: A exclusão de sistemas do catálogo oficial é restrita ao Cargo 2 (Supervisor/Geral).'
            });
        }

        const { id } = req.params;
        const sistema = await db.prepare('SELECT id, nome FROM sistemas WHERE id = ?').get(id);
        if (!sistema) {
            return res.status(404).json({ erro: 'Sistema não encontrado no catálogo.' });
        }

        // Limpar registros vinculados para integridade relacional
        await db.prepare('DELETE FROM biblioteca_sistemas WHERE id_sistema = ?').run(id);
        await db.prepare('DELETE FROM propostas WHERE id_sistema = ?').run(id);
        await db.prepare('UPDATE campanhas SET id_sistema = NULL WHERE id_sistema = ?').run(id);
        await db.prepare('UPDATE personagens SET id_sistema = NULL WHERE id_sistema = ?').run(id);

        // Deletar o sistema
        await db.prepare('DELETE FROM sistemas WHERE id = ?').run(id);

        return res.json({ mensagem: `Sistema "${sistema.nome}" (#${sistema.id}) excluído com sucesso do catálogo!` });
    } catch (err) {
        console.error('Erro ao excluir sistema:', err);
        return res.status(500).json({ erro: 'Erro ao excluir sistema: ' + err.message });
    }
});

// ==========================================
// 3. ROTAS DE INTERAÇÃO / PROPOSTAS
// Requisitos 6, 7 e 11
// ==========================================

// Enviar Proposta sobre um Sistema (Cliente autenticado)
app.post('/api/propostas', async (req, res) => {
    try {
        const { user_uuid, id_sistema, proposta_texto, valor_oferecido, forma_pagamento } = req.body;

        if (!user_uuid || !id_sistema || !proposta_texto) {
            return res.status(400).json({ erro: 'Usuário, sistema e texto da proposta são obrigatórios.' });
        }

        const usuario = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
        if (!usuario) {
            return res.status(401).json({ erro: 'Usuário não autenticado.' });
        }

        const sistema = await db.prepare('SELECT id, nome FROM sistemas WHERE id = ?').get(id_sistema);
        if (!sistema) {
            return res.status(404).json({ erro: 'Sistema não encontrado.' });
        }

        const formaFinal = forma_pagamento ? forma_pagamento.trim() : 'Moedas';

        const insert = await db.prepare(`
            INSERT INTO propostas (id_usuario, id_sistema, proposta_texto, valor_oferecido, forma_pagamento, status, resposta_admin)
            VALUES (?, ?, ?, ?, ?, 'Aguardando...', 'Aguardando análise da administração...')
        `);

        const result = await insert.run(
            usuario.id,
            id_sistema,
            proposta_texto,
            parseFloat(valor_oferecido) || 0.00,
            formaFinal
        );

        return res.status(201).json({
            mensagem: 'Proposta enviada com sucesso! Você pode acompanhar na aba Minhas Propostas.',
            id_proposta: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Erro ao enviar proposta:', err);
        return res.status(500).json({ erro: 'Erro interno ao registrar proposta.' });
    }
});

// Listar Propostas do Usuário Logado (Requisito 7)
app.get('/api/propostas/usuario/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const usuario = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(uuid);
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        const propostas = await db.prepare(`
            SELECT p.*, s.nome AS sistema_nome, s.genero AS sistema_genero, s.imagemcapa_link, s.preco AS sistema_preco
            FROM propostas p
            JOIN sistemas s ON p.id_sistema = s.id
            WHERE p.id_usuario = ?
            ORDER BY p.id DESC
        `).all(usuario.id);

        return res.json({ propostas });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao consultar propostas do usuário.' });
    }
});

// Listar Todas as Propostas (Para a Área Restrita Admin - Requisito 11)
app.get('/api/propostas', async (req, res) => {
    try {
        const propostas = await db.prepare(`
            SELECT p.*,
                   u.nome_usuario AS cliente_nome,
                   u.email AS cliente_email,
                   u.cidade AS cliente_cidade,
                   s.nome AS sistema_nome,
                   s.imagemcapa_link AS foto_sistema,
                   s.preco AS sistema_preco
            FROM propostas p
            JOIN usuarios u ON p.id_usuario = u.id
            JOIN sistemas s ON p.id_sistema = s.id
            ORDER BY p.id DESC
        `).all();

        return res.json({ propostas });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao consultar propostas no admin.' });
    }
});

// Responder Proposta pelo Administrador (Requisito 11)
app.patch('/api/propostas/:id/responder', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resposta_admin } = req.body;

        if (!status || !resposta_admin) {
            return res.status(400).json({ erro: 'Status e resposta são obrigatórios.' });
        }

        await db.prepare(`
            UPDATE propostas
            SET status = ?,
                resposta_admin = ?,
                data_resposta = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, resposta_admin, id);

        // Se a proposta foi aceita pela administração, adiciona o sistema na biblioteca do usuário automaticamente
        if (status.toLowerCase().includes('aceit')) {
            const prop = await db.prepare('SELECT id_usuario, id_sistema FROM propostas WHERE id = ?').get(id);
            if (prop) {
                const jaPossui = await db.prepare('SELECT id FROM biblioteca_sistemas WHERE id_usuario = ? AND id_sistema = ?').get(prop.id_usuario, prop.id_sistema);
                if (!jaPossui) {
                    await db.prepare('INSERT INTO biblioteca_sistemas (id_usuario, id_sistema) VALUES (?, ?)').run(prop.id_usuario, prop.id_sistema);
                }
            }
        }

        return res.json({ mensagem: 'Proposta respondida com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao responder proposta.' });
    }
});

// Excluir Proposta
app.delete('/api/propostas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.prepare('DELETE FROM propostas WHERE id = ?').run(id);
        return res.json({ mensagem: 'Proposta excluída com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao excluir proposta.' });
    }
});

// ==========================================
// 4. ROTAS DE PERSONAGENS (Mockup dos Prints)
// ==========================================

// Listar Personagens do Usuário Logado
app.get('/api/personagens', async (req, res) => {
    try {
        const { user_uuid } = req.query;
        let query = `
            SELECT p.*, s.nome AS sistema_nome, c.titulo AS campanha_titulo
            FROM personagens p
            LEFT JOIN sistemas s ON p.id_sistema = s.id
            LEFT JOIN campanhas c ON p.id_campanha = c.id
        `;
        const params = [];

        if (user_uuid) {
            const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
            if (user) {
                query += ' WHERE p.id_usuario = ?';
                params.push(user.id);
            }
        }

        query += ' ORDER BY p.id DESC';
        const personagens = await db.prepare(query).all(...params);
        return res.json({ personagens });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao buscar personagens.' });
    }
});

// Criar Personagem
app.post('/api/personagens', async (req, res) => {
    try {
        const {
            user_uuid, nome, classe_raca, nivel, descricao,
            imagemperfil_link, imagem_link, pdf_link, id_campanha, id_sistema,
            forca, destreza, constituicao, inteligencia, sabedoria, carisma
        } = req.body;

        if (!user_uuid || !nome || !classe_raca) {
            return res.status(400).json({ erro: 'Usuário, nome e classe/raça são obrigatórios.' });
        }

        const usuario = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
        if (!usuario) {
            return res.status(401).json({ erro: 'Usuário não autenticado.' });
        }

        const insert = await db.prepare(`
            INSERT INTO personagens (
                id_usuario, id_sistema, id_campanha, nome, classe_raca, nivel,
                descricao, imagemperfil_link, imagem_link, pdf_link,
                forca, destreza, constituicao, inteligencia, sabedoria, carisma
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = await insert.run(
            usuario.id,
            id_sistema ? parseInt(id_sistema) : null,
            id_campanha ? parseInt(id_campanha) : null,
            nome,
            classe_raca,
            parseInt(nivel) || 1,
            descricao || 'Sem descrição cadastrada.',
            imagemperfil_link || 'avatar_padrao.svg',
            imagem_link || '',
            pdf_link || '',
            parseInt(forca) || 10,
            parseInt(destreza) || 10,
            parseInt(constituicao) || 10,
            parseInt(inteligencia) || 10,
            parseInt(sabedoria) || 10,
            parseInt(carisma) || 10
        );

        return res.status(201).json({
            mensagem: 'Personagem criado com sucesso!',
            id: result.lastInsertRowid
        });
    } catch (err) {
        console.error('Erro ao criar personagem:', err);
        return res.status(500).json({ erro: 'Erro ao salvar personagem.' });
    }
});

// Atualizar Personagem
app.put('/api/personagens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nome, classe_raca, nivel, descricao, imagem_link, imagemperfil_link, pdf_link
        } = req.body;

        await db.prepare(`
            UPDATE personagens
            SET nome = COALESCE(?, nome),
                classe_raca = COALESCE(?, classe_raca),
                nivel = COALESCE(?, nivel),
                descricao = COALESCE(?, descricao),
                imagem_link = COALESCE(?, imagem_link),
                imagemperfil_link = COALESCE(?, imagemperfil_link),
                pdf_link = COALESCE(?, pdf_link)
            WHERE id = ?
        `).run(
            nome, classe_raca, nivel, descricao, imagem_link, imagemperfil_link,
            pdf_link,
            id
        );

        return res.json({ mensagem: 'Personagem atualizado com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar personagem.' });
    }
});

// Excluir Personagem
app.delete('/api/personagens/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.prepare('DELETE FROM personagens WHERE id = ?').run(id);
        return res.json({ mensagem: 'Personagem excluído com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao excluir personagem.' });
    }
});

// ==========================================
// 5. ROTAS DE CAMPANHAS E SESSÕES/RESUMOS
// ==========================================

// Listar Campanhas
app.get('/api/campanhas', async (req, res) => {
    try {
        const campanhas = await db.prepare(`
            SELECT c.*, u.nome_usuario AS mestre_nome, COALESCE(s.nome, 'Sistema Personalizado') AS sistema_nome,
                   (SELECT COUNT(*) FROM sessoes_episodios se WHERE se.id_campanha = c.id) AS total_episodios,
                   (SELECT COUNT(*) FROM personagens p WHERE p.id_campanha = c.id) AS total_personagens
            FROM campanhas c
            JOIN usuarios u ON c.mestre_id = u.id
            LEFT JOIN sistemas s ON c.id_sistema = s.id
            ORDER BY c.id DESC
        `).all();

        return res.json({ campanhas });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao consultar campanhas.' });
    }
});

// Criar Campanha (Sistemas Adquiridos na Loja ou Sistema Personalizado)
app.post('/api/campanhas', async (req, res) => {
    try {
        const { user_uuid, titulo, sinopse, id_sistema, imagemcapa_link, visibilidade } = req.body;

        if (!user_uuid || !titulo || !sinopse) {
            return res.status(400).json({ erro: 'Mestre, título e sinopse são obrigatórios.' });
        }

        const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(user_uuid);
        if (!user) {
            return res.status(401).json({ erro: 'Usuário não autenticado.' });
        }

        let sistemaIdFinal = null;
        // Se escolheu um sistema oficial da loja, validar que o usuário o adquiriu
        if (id_sistema && id_sistema !== 'custom' && id_sistema !== 'customizado' && id_sistema !== '') {
            const sistemaAdquirido = await db.prepare(`
                SELECT id FROM biblioteca_sistemas WHERE id_usuario = ? AND id_sistema = ?
            `).get(user.id, parseInt(id_sistema));

            if (!sistemaAdquirido) {
                return res.status(403).json({
                    erro: 'Você só pode criar campanhas com sistemas que adquiriu na Loja de Sistemas ou selecionando Sistema Personalizado!'
                });
            }
            sistemaIdFinal = parseInt(id_sistema);
        }

        const insert = await db.prepare(`
            INSERT INTO campanhas (id_sistema, mestre_id, imagemcapa_link, titulo, sinopse, visibilidade, estado_aprovacao)
            VALUES (?, ?, ?, ?, ?, ?, 'aprovado')
        `);

        const result = await insert.run(
            sistemaIdFinal,
            user.id,
            imagemcapa_link || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
            titulo,
            sinopse,
            visibilidade || 'publica'
        );

        return res.status(201).json({
            mensagem: 'Campanha criada com sucesso!',
            id: result.lastInsertRowid
        });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao registrar campanha.' });
    }
});

// Editar Campanha (Mestre Criador ou Administrador)
app.put('/api/campanhas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { user_uuid, titulo, sinopse, id_sistema, imagemcapa_link, visibilidade } = req.body;
        const adminUuid = req.headers['x-admin-uuid'] || req.body.admin_uuid;
        const userUuid = user_uuid || req.headers['x-user-uuid'];

        const campanha = await db.prepare('SELECT * FROM campanhas WHERE id = ?').get(id);
        if (!campanha) {
            return res.status(404).json({ erro: 'Campanha não encontrada.' });
        }

        let autorizado = false;
        if (adminUuid) {
            const admin = await db.prepare('SELECT id FROM admins WHERE uuid = ?').get(adminUuid);
            if (admin) autorizado = true;
        }
        if (!autorizado && userUuid) {
            const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(userUuid);
            if (user && user.id === campanha.mestre_id) autorizado = true;
        }

        if (!autorizado) {
            return res.status(403).json({ erro: 'Apenas o Mestre criador desta campanha ou administradores podem editá-la.' });
        }

        let sistemaIdFinal = campanha.id_sistema;
        if (id_sistema !== undefined) {
            if (id_sistema === 'customizado' || id_sistema === 'custom' || id_sistema === '') {
                sistemaIdFinal = null;
            } else {
                sistemaIdFinal = parseInt(id_sistema);
            }
        }

        await db.prepare(`
            UPDATE campanhas
            SET titulo = COALESCE(?, titulo),
                sinopse = COALESCE(?, sinopse),
                id_sistema = ?,
                visibilidade = COALESCE(?, visibilidade),
                imagemcapa_link = COALESCE(?, imagemcapa_link)
            WHERE id = ?
        `).run(titulo, sinopse, sistemaIdFinal, visibilidade, imagemcapa_link, id);

        return res.json({ mensagem: 'Campanha atualizada com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar campanha.' });
    }
});

// Excluir Campanha (Mestre Criador ou Administrador)
app.delete('/api/campanhas/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const adminUuid = req.headers['x-admin-uuid'] || req.query.admin_uuid || req.body?.admin_uuid;
        const userUuid = req.headers['x-user-uuid'] || req.query.user_uuid || req.body?.user_uuid;

        const campanha = await db.prepare('SELECT * FROM campanhas WHERE id = ?').get(id);
        if (!campanha) {
            return res.status(404).json({ erro: 'Campanha não encontrada.' });
        }

        let autorizado = false;
        if (adminUuid) {
            const admin = await db.prepare('SELECT id FROM admins WHERE uuid = ?').get(adminUuid);
            if (admin) autorizado = true;
        }
        if (!autorizado && userUuid) {
            const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(userUuid);
            if (user && user.id === campanha.mestre_id) autorizado = true;
        }

        if (!autorizado) {
            return res.status(403).json({ erro: 'Apenas o Mestre criador desta campanha ou administradores podem excluí-la.' });
        }

        // Deletar sessoes associadas
        await db.prepare('DELETE FROM sessoes_episodios WHERE id_campanha = ?').run(id);
        // Desvincular personagens desta campanha
        await db.prepare('UPDATE personagens SET id_campanha = NULL WHERE id_campanha = ?').run(id);
        // Deletar a campanha
        await db.prepare('DELETE FROM campanhas WHERE id = ?').run(id);

        return res.json({ mensagem: 'Campanha e crônicas excluídas com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao excluir campanha.' });
    }
});

// Listar Sessões / Episódios (Resumos) - Com filtro por campanha opcional
app.get('/api/sessoes', async (req, res) => {
    try {
        const { campanha } = req.query;
        let sql = `
            SELECT se.*, c.id AS campanha_id, c.titulo AS campanha_titulo, c.mestre_id, u.nome_usuario AS mestre_nome
            FROM sessoes_episodios se
            JOIN campanhas c ON se.id_campanha = c.id
            JOIN usuarios u ON c.mestre_id = u.id
        `;
        let params = [];
        if (campanha) {
            sql += ` WHERE se.id_campanha = ? `;
            params.push(parseInt(campanha));
        }
        sql += ` ORDER BY c.titulo ASC, se.numero_episodio ASC, se.id DESC `;
        const sessoes = await db.prepare(sql).all(...params);

        return res.json({ sessoes });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao carregar sessões.' });
    }
});

// Criar Nova Sessão / Resumo
app.post('/api/sessoes', async (req, res) => {
    try {
        const { id_campanha, numero_episodio, titulo_episodio, resumo, data_jogo, user_uuid } = req.body;
        const userUuid = user_uuid || req.headers['x-user-uuid'];
        const adminUuid = req.headers['x-admin-uuid'];

        if (!id_campanha || !titulo_episodio || !resumo) {
            return res.status(400).json({ erro: 'Campanha, título e resumo são obrigatórios.' });
        }

        const campanha = await db.prepare('SELECT mestre_id FROM campanhas WHERE id = ?').get(parseInt(id_campanha));
        if (!campanha) {
            return res.status(404).json({ erro: 'Campanha não encontrada.' });
        }

        let autorizado = false;
        if (adminUuid) {
            const admin = await db.prepare('SELECT id FROM admins WHERE uuid = ?').get(adminUuid);
            if (admin) autorizado = true;
        }
        if (!autorizado && userUuid) {
            const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(userUuid);
            if (user && user.id === campanha.mestre_id) autorizado = true;
        }

        if (!autorizado) {
            return res.status(403).json({ erro: 'Apenas o Mestre criador desta campanha ou administradores podem registrar novos resumos nela.' });
        }

        const insert = await db.prepare(`
            INSERT INTO sessoes_episodios (id_campanha, numero_episodio, titulo_episodio, resumo, data_jogo)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = await insert.run(
            parseInt(id_campanha),
            parseInt(numero_episodio) || 1,
            titulo_episodio,
            resumo,
            data_jogo || new Date().toLocaleDateString('pt-BR')
        );

        return res.status(201).json({
            mensagem: 'Resumo registrado com sucesso!',
            id: result.lastInsertRowid
        });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao salvar episódio.' });
    }
});

// Editar Sessão / Resumo (Mestre ou Administrador)
app.put('/api/sessoes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { id_campanha, numero_episodio, titulo_episodio, resumo, data_jogo, user_uuid } = req.body;
        const adminUuid = req.headers['x-admin-uuid'] || req.body.admin_uuid;
        const userUuid = user_uuid || req.headers['x-user-uuid'];

        const sessao = await db.prepare(`
            SELECT se.*, c.mestre_id 
            FROM sessoes_episodios se
            JOIN campanhas c ON se.id_campanha = c.id
            WHERE se.id = ?
        `).get(id);

        if (!sessao) {
            return res.status(404).json({ erro: 'Resumo de sessão não encontrado.' });
        }

        let autorizado = false;
        if (adminUuid) {
            const admin = await db.prepare('SELECT id FROM admins WHERE uuid = ?').get(adminUuid);
            if (admin) autorizado = true;
        }
        if (!autorizado && userUuid) {
            const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(userUuid);
            if (user && user.id === sessao.mestre_id) autorizado = true;
        }

        if (!autorizado) {
            return res.status(403).json({ erro: 'Apenas o Mestre da campanha ou administradores podem editar este resumo.' });
        }

        await db.prepare(`
            UPDATE sessoes_episodios
            SET id_campanha = COALESCE(?, id_campanha),
                numero_episodio = COALESCE(?, numero_episodio),
                titulo_episodio = COALESCE(?, titulo_episodio),
                resumo = COALESCE(?, resumo),
                data_jogo = COALESCE(?, data_jogo)
            WHERE id = ?
        `).run(
            id_campanha ? parseInt(id_campanha) : null,
            numero_episodio ? parseInt(numero_episodio) : null,
            titulo_episodio,
            resumo,
            data_jogo,
            id
        );

        return res.json({ mensagem: 'Resumo atualizado com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar resumo.' });
    }
});

// Excluir Sessão / Resumo (Mestre ou Administrador)
app.delete('/api/sessoes/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const adminUuid = req.headers['x-admin-uuid'] || req.query.admin_uuid || req.body?.admin_uuid;
        const userUuid = req.headers['x-user-uuid'] || req.query.user_uuid || req.body?.user_uuid;

        const sessao = await db.prepare(`
            SELECT se.*, c.mestre_id 
            FROM sessoes_episodios se
            JOIN campanhas c ON se.id_campanha = c.id
            WHERE se.id = ?
        `).get(id);

        if (!sessao) {
            return res.status(404).json({ erro: 'Resumo de sessão não encontrado.' });
        }

        let autorizado = false;
        if (adminUuid) {
            const admin = await db.prepare('SELECT id FROM admins WHERE uuid = ?').get(adminUuid);
            if (admin) autorizado = true;
        }
        if (!autorizado && userUuid) {
            const user = await db.prepare('SELECT id FROM usuarios WHERE uuid = ?').get(userUuid);
            if (user && user.id === sessao.mestre_id) autorizado = true;
        }

        if (!autorizado) {
            return res.status(403).json({ erro: 'Apenas o Mestre da campanha ou administradores podem excluir este resumo.' });
        }

        await db.prepare('DELETE FROM sessoes_episodios WHERE id = ?').run(id);

        return res.json({ mensagem: 'Resumo de sessão excluído com sucesso!' });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao excluir resumo.' });
    }
});

// ==========================================
// 6. ROTAS DE MOEDAS E COMPRAS (PAGAMENTO MULTI-MÉTODO: MOEDAS, PIX E CARTÃO)
// ==========================================

// Recarga de Moedas na Loja (via PIX, Cartão ou Boleto)
app.post('/api/moedas/recarregar', async (req, res) => {
    try {
        const { user_uuid, quantidade, pacote_nome, metodo_pagamento } = req.body;
        const qtd = parseFloat(quantidade);
        const metodo = (metodo_pagamento || 'PIX').toUpperCase();

        if (!user_uuid || isNaN(qtd) || qtd <= 0) {
            return res.status(400).json({ erro: 'Usuário e quantidade válida são obrigatórios.' });
        }

        const user = await db.prepare('SELECT id, moeda_virtual FROM usuarios WHERE uuid = ?').get(user_uuid);
        if (!user) {
            return res.status(404).json({ erro: 'Usuário não encontrado.' });
        }

        const novoSaldo = user.moeda_virtual + qtd;
        await db.prepare('UPDATE usuarios SET moeda_virtual = ? WHERE id = ?').run(novoSaldo, user.id);

        await db.prepare(`
            INSERT INTO transacoes_moedas (id_usuario, quantidade, tipo, descricao)
            VALUES (?, ?, ?, ?)
        `).run(user.id, qtd, `RECARGA_${metodo}`, pacote_nome || `Recarga de ${qtd} moedas via ${metodo}`);

        return res.json({
            mensagem: `Recarga aprovada com sucesso via ${metodo}! Novo saldo: 🪙 ${novoSaldo.toFixed(2)} moedas.`,
            saldo: novoSaldo
        });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao recarregar moedas.' });
    }
});

// Comprar Sistema (Moedas, PIX Instantâneo ou Cartão de Crédito)
app.post('/api/moedas/comprar-sistema', async (req, res) => {
    try {
        const { user_uuid, id_sistema, metodo_pagamento, detalhes_pagamento } = req.body;
        const metodo = (metodo_pagamento || 'moedas').toLowerCase(); // 'moedas', 'pix', 'cartao'

        const user = await db.prepare('SELECT id, moeda_virtual FROM usuarios WHERE uuid = ?').get(user_uuid);
        if (!user) {
            return res.status(401).json({ erro: 'Faça login para realizar a compra.' });
        }

        const sistema = await db.prepare('SELECT id, nome, preco FROM sistemas WHERE id = ?').get(id_sistema);
        if (!sistema) {
            return res.status(404).json({ erro: 'Sistema não encontrado.' });
        }

        // Verificar se já possui
        const jaPossui = await db.prepare('SELECT id FROM biblioteca_sistemas WHERE id_usuario = ? AND id_sistema = ?').get(user.id, sistema.id);
        if (jaPossui) {
            return res.status(400).json({ erro: 'Você já possui este sistema em sua biblioteca!' });
        }

        let novoSaldo = user.moeda_virtual;

        if (metodo === 'moedas') {
            if (user.moeda_virtual < sistema.preco) {
                return res.status(400).json({
                    erro: `Saldo insuficiente em moedas! Você possui 🪙 ${user.moeda_virtual.toFixed(2)} e o sistema custa 🪙 ${sistema.preco.toFixed(2)}. Experimente pagar via PIX ou Cartão!`
                });
            }
            novoSaldo = user.moeda_virtual - sistema.preco;
            await db.prepare('UPDATE usuarios SET moeda_virtual = ? WHERE id = ?').run(novoSaldo, user.id);

            await db.prepare(`
                INSERT INTO transacoes_moedas (id_usuario, quantidade, tipo, descricao)
                VALUES (?, ?, 'COMPRA_SISTEMA_MOEDAS', ?)
            `).run(user.id, -sistema.preco, `Aquisição do sistema ${sistema.nome} com moedas virtuais`);
        } else if (metodo === 'pix') {
            await db.prepare(`
                INSERT INTO transacoes_moedas (id_usuario, quantidade, tipo, descricao)
                VALUES (?, ?, 'PAGAMENTO_PIX', ?)
            `).run(user.id, sistema.preco, `Aquisição do sistema ${sistema.nome} via PIX Instantâneo (R$ ${sistema.preco.toFixed(2)})`);
        } else if (metodo === 'cartao') {
            const ultimosDigitos = detalhes_pagamento?.numero_cartao ? detalhes_pagamento.numero_cartao.slice(-4) : '••••';
            await db.prepare(`
                INSERT INTO transacoes_moedas (id_usuario, quantidade, tipo, descricao)
                VALUES (?, ?, 'PAGAMENTO_CARTAO', ?)
            `).run(user.id, sistema.preco, `Aquisição do sistema ${sistema.nome} via Cartão de Crédito final ${ultimosDigitos} (R$ ${sistema.preco.toFixed(2)})`);
        }

        // Adicionar sistema à biblioteca do usuário
        await db.prepare('INSERT INTO biblioteca_sistemas (id_usuario, id_sistema) VALUES (?, ?)').run(user.id, sistema.id);

        const textoMetodo = metodo === 'pix' ? 'via PIX Instantâneo' : (metodo === 'cartao' ? 'via Cartão de Crédito' : 'com Moedas Virtuais');

        return res.json({
            mensagem: `Parabéns! Sistema "${sistema.nome}" adquirido com sucesso ${textoMetodo}!`,
            saldo: novoSaldo,
            metodo
        });
    } catch (err) {
        return res.status(500).json({ erro: 'Erro ao processar compra do sistema.' });
    }
});

// ==========================================
// 7. DASHBOARD ADMIN E ESTATÍSTICAS
// Requisito 9: Gráficos de Visão Geral
// ==========================================
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const totalClientes = await db.prepare('SELECT count(*) as count FROM usuarios').get().count;
        const totalSistemas = await db.prepare('SELECT count(*) as count FROM sistemas').get().count;
        const totalPropostas = await db.prepare('SELECT count(*) as count FROM propostas').get().count;
        const totalCampanhas = await db.prepare('SELECT count(*) as count FROM campanhas').get().count;

        // Gráfico 1: Sistemas por Gênero
        const sistemasPorGenero = await db.prepare(`
            SELECT genero, count(*) as total
            FROM sistemas
            GROUP BY genero
        `).all();

        // Gráfico 2: Clientes por Cidade (Pelotas, Rio Grande, Bagé, etc.)
        const clientesPorCidade = await db.prepare(`
            SELECT cidade, count(*) as total
            FROM usuarios
            GROUP BY cidade
        `).all();

        // Propostas por Status
        const propostasPorStatus = await db.prepare(`
            SELECT status, count(*) as total
            FROM propostas
            GROUP BY status
        `).all();

        // Lista de clientes recentes
        const clientes = await db.prepare(`
            SELECT id, uuid, nome_usuario, email, cidade, nivel_jogador, moeda_virtual, data_criacao
            FROM usuarios ORDER BY id DESC LIMIT 10
        `).all();

        return res.json({
            totais: {
                totalClientes,
                totalSistemas,
                totalPropostas,
                totalCampanhas
            },
            graficos: {
                sistemasPorGenero,
                clientesPorCidade,
                propostasPorStatus
            },
            clientes
        });
    } catch (err) {
        console.error('Erro no dashboard admin:', err);
        return res.status(500).json({ erro: 'Erro ao carregar dados do dashboard.' });
    }
});

// Iniciar Servidor HTTP apenas em ambiente local / não-serverless
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 RPG Central Server rodando na porta ${PORT}`);
        console.log(`🌐 Acesse no navegador: http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}

// Exportar app para execução Serverless na Vercel
module.exports = app;

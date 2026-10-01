// limpar_banco.js - Script de Limpeza do Banco de Dados do RPG Central
// Remove: Sistemas, Campanhas, Personagens, Resumos/Sessões e Contas de Usuários normais.
// PRESERVA: Todas as contas de Administradores (admins).

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'rpg_central.db');

try {
    const db = new Database(dbPath);

    console.log('========================================================');
    console.log('       RPG CENTRAL - LIMPEZA DE DADOS DO BANCO          ');
    console.log('========================================================\n');

    // Desabilitar chaves estrangeiras temporariamente para exclusão limpa em lote
    db.pragma('foreign_keys = OFF');

    // 1. Contar registros antes da exclusão
    const countSistemas = db.prepare('SELECT count(*) as count FROM sistemas').get().count;
    const countCampanhas = db.prepare('SELECT count(*) as count FROM campanhas').get().count;
    const countPersonagens = db.prepare('SELECT count(*) as count FROM personagens').get().count;
    const countSessoes = db.prepare('SELECT count(*) as count FROM sessoes_episodios').get().count;
    const countUsuarios = db.prepare('SELECT count(*) as count FROM usuarios').get().count;
    const countAdmins = db.prepare('SELECT count(*) as count FROM admins').get().count;

    console.log('[INFO] Registros encontrados antes da limpeza:');
    console.log(` - Sistemas: ${countSistemas}`);
    console.log(` - Campanhas: ${countCampanhas}`);
    console.log(` - Personagens: ${countPersonagens}`);
    console.log(` - Resumos / Episodios: ${countSessoes}`);
    console.log(` - Contas de Usuarios: ${countUsuarios}`);
    console.log(` - Contas de Administradores (PRESERVADAS): ${countAdmins}\n`);

    // 2. Executar exclusões em transação segura
    const limparTransacao = db.transaction(() => {
        // Excluir Resumos / Episódios
        db.prepare('DELETE FROM sessoes_episodios').run();
        
        // Excluir Personagens
        db.prepare('DELETE FROM personagens').run();
        
        // Excluir Campanhas
        db.prepare('DELETE FROM campanhas').run();
        
        // Excluir Vínculos de Biblioteca e Propostas
        db.prepare('DELETE FROM biblioteca_sistemas').run();
        db.prepare('DELETE FROM propostas').run();
        db.prepare('DELETE FROM transacoes_moedas').run();
        
        // Excluir Sistemas
        db.prepare('DELETE FROM sistemas').run();
        
        // Excluir Usuários comuns
        db.prepare('DELETE FROM usuarios').run();

        // Resetar sequências de IDs autoincremento (mantendo admins)
        db.prepare(`
            DELETE FROM sqlite_sequence 
            WHERE name IN (
                'sessoes_episodios', 
                'personagens', 
                'campanhas', 
                'biblioteca_sistemas', 
                'propostas', 
                'transacoes_moedas', 
                'sistemas', 
                'usuarios'
            )
        `).run();
    });

    limparTransacao();

    // Reabilitar chaves estrangeiras
    db.pragma('foreign_keys = ON');

    // Desfragmentar o banco de dados
    db.exec('VACUUM');

    console.log('--------------------------------------------------------');
    console.log('[SUCESSO] Todos os registros solicitados foram apagados!');
    console.log(' - Sistemas excluidos: OK');
    console.log(' - Campanhas excluidas: OK');
    console.log(' - Personagens excluidos: OK');
    console.log(' - Resumos / Episodios excluidos: OK');
    console.log(' - Contas de usuarios normais excluidas: OK');
    console.log('--------------------------------------------------------\n');

    // 3. Exibir Administradores Preservados
    const admins = db.prepare('SELECT id, nome_admin, email_admin, cargo_nivel FROM admins').all();
    console.log('=== CONTAS DE ADMINISTRADOR PRESERVADAS (ATIVAS) ===');
    admins.forEach((admin, index) => {
        console.log(`[Admin #${admin.id}] ${admin.nome_admin}`);
        console.log(`   E-mail: ${admin.email_admin}`);
        console.log(`   Cargo : ${admin.cargo_nivel}`);
        console.log(`   Senha : admin123\n`);
    });

    console.log('O banco de dados do RPG Central esta agora limpo e pronto');
    console.log('para novas contas e cadastros do zero pelo usuario!');
    console.log('========================================================');

    db.close();
    process.exit(0);
} catch (error) {
    console.error('[ERRO] Falha ao limpar o banco de dados:', error.message);
    process.exit(1);
}

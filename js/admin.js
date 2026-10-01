// js/admin.js - Lógica do Painel de Administração e Dashboard (Requisitos 8, 9, 10, 11)
let currentAdmin = null;
let adminSistemas = [];
let adminPropostas = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar Admin
    const admin = await AuthService.initAdmin();
    if (!admin) {
        window.location.href = 'Admin_Login.html';
        return;
    }
    currentAdmin = admin;
    window.currentAdmin = admin;

    const isCargo2 = admin.cargo_nivel && admin.cargo_nivel.toLowerCase().includes('cargo 2');

    // Preencher cabeçalho
    const adminNomeEl = document.getElementById('admin-nome-display');
    if (adminNomeEl) adminNomeEl.textContent = `${admin.nome_admin}`;

    const badgeCargoEl = document.getElementById('admin-badge-cargo');
    if (badgeCargoEl) {
        if (isCargo2) {
            badgeCargoEl.innerHTML = '👑 Cargo 2 (Supervisor)';
            badgeCargoEl.style.cssText = 'background: rgba(234, 179, 8, 0.15); color: #fbbf24; border: 1px solid rgba(234, 179, 8, 0.4); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;';
        } else {
            badgeCargoEl.innerHTML = '🛡️ Cargo 1 (Moderador)';
            badgeCargoEl.style.cssText = 'background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;';
        }
    }

    // Banner Informativo de Permissões
    const bannerCargoEl = document.getElementById('banner-cargo-info');
    if (bannerCargoEl) {
        if (isCargo2) {
            bannerCargoEl.innerHTML = `
                <div style="background: linear-gradient(90deg, rgba(234, 179, 8, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid rgba(234, 179, 8, 0.35); border-radius: 10px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 26px;">👑</span>
                        <div>
                            <strong style="color: #fbbf24; font-size: 14.5px;">Acesso Total — Cargo 2 (Supervisor / Administrador Geral)</strong>
                            <p style="color: #cbd5e1; font-size: 13px; margin-top: 3px;">Permissões ativas: Gerenciar e cadastrar sistemas com IA (Gemini), controlar produtos em destaque, excluir itens do catálogo e responder propostas.</p>
                        </div>
                    </div>
                    <span style="font-size: 11.5px; background: rgba(234, 179, 8, 0.2); color: #fbbf24; padding: 5px 10px; border-radius: 6px; font-weight: 700; white-space: nowrap;">PERMISSÃO TOTAL</span>
                </div>
            `;
        } else {
            bannerCargoEl.innerHTML = `
                <div style="background: linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 10px; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 25px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 26px;">🛡️</span>
                        <div>
                            <strong style="color: #38bdf8; font-size: 14.5px;">Acesso Operacional — Cargo 1 (Moderador de Atendimento)</strong>
                            <p style="color: #cbd5e1; font-size: 13px; margin-top: 3px;">Permissões ativas: <strong>Controle de Propostas</strong> e consulta de métricas. O cadastro de novos sistemas e alterações no catálogo são restritos ao Cargo 2.</p>
                        </div>
                    </div>
                    <span style="font-size: 11.5px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 5px 10px; border-radius: 6px; font-weight: 700; white-space: nowrap;">MODERAÇÃO E SUPORTE</span>
                </div>
            `;
        }
    }

    // Configurar botão de Novo Sistema para Cargo 1
    const btnNovoSistema = document.getElementById('btn-abrir-novo-sistema-admin');
    if (btnNovoSistema && !isCargo2) {
        btnNovoSistema.innerHTML = '🔒 + Novo Sistema (Restrito Cargo 2)';
        btnNovoSistema.style.background = '#1e293b';
        btnNovoSistema.style.color = '#94a3b8';
        btnNovoSistema.style.cursor = 'not-allowed';
        btnNovoSistema.style.border = '1px dashed #475569';
        btnNovoSistema.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showNotification('Acesso Negado: Apenas administradores Cargo 2 podem cadastrar novos sistemas.', 'erro');
        };
    }

    // Navegação Sidebar
    inicializarNavegacaoSidebar();

    // Carregar Dashboard
    await carregarDadosDashboard();

    // Carregar Sistemas
    await carregarTabelaSistemas();

    // Carregar Propostas
    await carregarTabelaPropostas();

    // Botão Sair
    const btnSair = document.getElementById('btn-admin-logout');
    if (btnSair) {
        btnSair.addEventListener('click', (e) => {
            e.preventDefault();
            AuthService.clearAdmin();
            window.location.href = 'Admin_Login.html';
        });
    }
});

function inicializarNavegacaoSidebar() {
    const links = document.querySelectorAll('.admin-menu li a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const alvo = link.getAttribute('data-tab');
            if (!alvo) return; // botão de sair não tem data-tab
            e.preventDefault();

            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.secao-admin').forEach(sec => sec.classList.remove('ativa'));
            const secAlvo = document.getElementById(`secao-${alvo}`);
            if (secAlvo) secAlvo.classList.add('ativa');
        });
    });
}

// ==========================================
// 1. DASHBOARD E GRÁFICOS (REQUISITO 9)
// ==========================================
async function carregarDadosDashboard() {
    try {
        const data = await Api.get('/api/admin/dashboard');

        // Contadores Superiores
        document.getElementById('count-clientes').textContent = data.totais.totalClientes;
        document.getElementById('count-sistemas').textContent = data.totais.totalSistemas;
        document.getElementById('count-propostas').textContent = data.totais.totalPropostas;
        document.getElementById('count-campanhas').textContent = data.totais.totalCampanhas;

        // Renderizar Gráficos em Canvas
        renderizarGraficoDonut(
            'canvas-grafico-sistemas',
            data.graficos.sistemasPorGenero.map(g => ({ rotulo: g.genero, valor: g.total })),
            ['#38bdf8', '#0284c7', '#0369a1', '#2563eb', '#7c3aed', '#db2777'],
            'legenda-sistemas'
        );

        renderizarGraficoDonut(
            'canvas-grafico-cidades',
            data.graficos.clientesPorCidade.map(c => ({ rotulo: c.cidade, valor: c.total })),
            ['#10b981', '#059669', '#38bdf8', '#eab308', '#f97316'],
            'legenda-cidades'
        );

        // Preencher Tabela de Clientes no Dashboard / Controle de Clientes
        const tbodyClientes = document.getElementById('tbody-admin-clientes');
        if (tbodyClientes && data.clientes) {
            tbodyClientes.innerHTML = data.clientes.map(c => `
                <tr>
                    <td><strong>${c.nome_usuario}</strong></td>
                    <td>${c.email}</td>
                    <td>${c.cidade}</td>
                    <td><span style="color: #ffd700; font-weight: bold;">🪙 ${parseFloat(c.moeda_virtual || 0).toFixed(2)}</span></td>
                    <td>${c.nivel_jogador || 'Jogador'}</td>
                    <td>${new Date(c.data_criacao).toLocaleDateString('pt-BR')}</td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Erro ao carregar métricas:', err);
    }
}

// Desenhador de Gráfico Circular / Donut Moderno em HTML5 Canvas
function renderizarGraficoDonut(canvasId, dados, cores, legendaId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const total = dados.reduce((acc, d) => acc + d.valor, 0);
    if (total === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('Sem dados suficientes', width / 2, height / 2);
        return;
    }

    let anguloAtual = -0.5 * Math.PI;
    const centerX = width / 2;
    const centerY = height / 2;
    const raioExterno = Math.min(centerX, centerY) - 10;
    const raioInterno = raioExterno * 0.55;

    dados.forEach((item, i) => {
        const fatia = (item.valor / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, raioExterno, anguloAtual, anguloAtual + fatia);
        ctx.arc(centerX, centerY, raioInterno, anguloAtual + fatia, anguloAtual, true);
        ctx.closePath();
        ctx.fillStyle = cores[i % cores.length];
        ctx.fill();
        ctx.strokeStyle = '#0b1e30';
        ctx.lineWidth = 3;
        ctx.stroke();

        anguloAtual += fatia;
    });

    // Legenda
    const legendaEl = document.getElementById(legendaId);
    if (legendaEl) {
        legendaEl.innerHTML = dados.map((d, i) => `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #cbd5e1; margin-bottom: 6px;">
                <span style="width: 12px; height: 12px; border-radius: 3px; background: ${cores[i % cores.length]}; display: inline-block;"></span>
                <span>${d.rotulo}: <strong>${d.valor} (${Math.round((d.valor / total) * 100)}%)</strong></span>
            </div>
        `).join('');
    }
}

// ==========================================
// 2. CONTROLE DE SISTEMAS (REQUISITO 10)
// ==========================================
async function carregarTabelaSistemas() {
    const tbody = document.getElementById('tbody-admin-sistemas');
    if (!tbody) return;

    try {
        const data = await Api.get('/api/sistemas');
        adminSistemas = data.sistemas || [];
        const cargo = (currentAdmin?.cargo_nivel || '').toLowerCase();
        const isCargo2 = cargo.includes('cargo 2') || cargo.includes('geral') || cargo.includes('supervisor') || !cargo.includes('cargo 1');

        tbody.innerHTML = adminSistemas.map(s => {
            const acoesHtml = isCargo2 ? `
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn-estrela-destaque" title="Alternar Destaque na Loja" onclick="alternarDestaqueSistema(${s.id})">
                        ${s.destaque ? '⭐' : '☆'}
                    </button>
                    <button class="btn-acao-admin" title="Editar Sistema" onclick="abrirModalEditarSistema(${s.id})" style="color: #38bdf8;">✏️</button>
                    <button class="btn-acao-admin recusar" title="Excluir Sistema do Catálogo" onclick="deletarSistemaAdmin(${s.id})">🗑️</button>
                </div>
            ` : `
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span title="Destaque gerenciado pelo Cargo 2" style="font-size: 18px; cursor: default; opacity: 0.85;">
                        ${s.destaque ? '⭐' : '☆'}
                    </span>
                    <span style="font-size: 11.5px; color: #94a3b8; background: #081726; padding: 4px 8px; border-radius: 4px; border: 1px solid #1e293b;" title="Apenas Cargo 2 pode gerenciar produtos">
                        🔒 Leitura (Cargo 1)
                    </span>
                </div>
            `;

            return `
            <tr>
                <td>
                    <img src="${s.imagemcapa_link || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" class="foto-item-admin" alt="${s.nome}">
                </td>
                <td>
                    <strong style="color: white; font-size: 15px;">${s.nome}</strong>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">ID: #${s.id}</div>
                    ${s.pdf_link ? `
                        <a href="${s.pdf_link}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11.5px; color: #38bdf8; text-decoration: underline;" title="Testar link do PDF do Livro">
                            📄 Ver PDF Cadastrado
                        </a>
                    ` : `
                        <span style="font-size: 11px; color: #64748b; display: block; margin-top: 4px;">(Sem PDF cadastrado)</span>
                    `}
                </td>
                <td><span style="color: #80D0FF;">${s.genero}</span></td>
                <td><span style="color: #ffd700; font-weight: bold;">🪙 ${parseFloat(s.preco).toFixed(2)}</span></td>
                <td>${acoesHtml}</td>
            </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ff6b6b; padding: 20px;">Erro ao listar sistemas.</td></tr>`;
    }
}

async function alternarDestaqueSistema(id) {
    const cargo = (currentAdmin?.cargo_nivel || '').toLowerCase();
    const isCargo2 = cargo.includes('cargo 2') || cargo.includes('geral') || cargo.includes('supervisor') || !cargo.includes('cargo 1');
    if (!isCargo2) {
        showNotification('Acesso Negado: Apenas administradores Cargo 2 podem alterar destaques.', 'erro');
        return;
    }
    try {
        const res = await Api.patch(`/api/sistemas/${id}/destaque`);
        showNotification(res.mensagem, 'sucesso');
        await carregarTabelaSistemas();
        await carregarDadosDashboard();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

async function deletarSistemaAdmin(id) {
    const cargo = (currentAdmin?.cargo_nivel || '').toLowerCase();
    const isCargo2 = cargo.includes('cargo 2') || cargo.includes('geral') || cargo.includes('supervisor') || !cargo.includes('cargo 1');
    if (!isCargo2) {
        showNotification('Acesso Negado: Apenas administradores Cargo 2 / Geral podem excluir sistemas.', 'erro');
        return;
    }
    if (!confirm('Deseja realmente remover este sistema do catálogo? Esta ação não pode ser desfeita.')) return;
    try {
        const res = await Api.delete(`/api/sistemas/${id}`);
        showNotification(res.mensagem || 'Sistema excluído com sucesso!', 'sucesso');
        await carregarTabelaSistemas();
        await carregarDadosDashboard();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// ==========================================
// 3. CONTROLE DE PROPOSTAS (REQUISITO 11)
// ==========================================
async function carregarTabelaPropostas() {
    const tbody = document.getElementById('tbody-admin-propostas');
    if (!tbody) return;

    try {
        const data = await Api.get('/api/propostas');
        adminPropostas = data.propostas || [];

        if (adminPropostas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #80D0FF; padding: 30px;">Nenhuma proposta recebida até o momento.</td></tr>`;
            return;
        }

        tbody.innerHTML = adminPropostas.map(p => {
            let statusCor = '#ffd700';
            if (p.status.toLowerCase().includes('aceit')) statusCor = '#4ade80';
            if (p.status.toLowerCase().includes('recus') || p.status.toLowerCase().includes('rejeit')) statusCor = '#f87171';

            const fp = (p.forma_pagamento || 'Moedas').toLowerCase();
            let badgeFp = '<span style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid #fbbf24; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-left: 6px;">🪙 Moedas</span>';
            let prefixo = '🪙';

            if (fp.includes('pix')) {
                badgeFp = '<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-left: 6px;">⚡ PIX</span>';
                prefixo = 'R$';
            } else if (fp.includes('cart')) {
                badgeFp = '<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #c084fc; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-left: 6px;">💳 Cartão</span>';
                prefixo = 'R$';
            } else if (fp.includes('outro') || fp.includes('negoc')) {
                badgeFp = '<span style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid #94a3b8; padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-left: 6px;">🤝 Negociação</span>';
                prefixo = 'Equiv.';
            }

            return `
                <tr>
                    <td>
                        <img src="${p.foto_sistema || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" class="foto-item-admin" alt="${p.sistema_nome}">
                    </td>
                    <td>
                        <strong style="color: white;">${p.sistema_nome}</strong>
                    </td>
                    <td>
                        <span style="color: #ffd700; font-weight: bold;">🪙 ${parseFloat(p.sistema_preco).toFixed(2)}</span>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: white;">${p.cliente_nome}</div>
                        <div style="font-size: 12px; color: #94a3b8;">${p.cliente_email} (${p.cliente_cidade})</div>
                    </td>
                    <td>
                        <p style="font-size: 13.5px; color: #e2e8f0; line-height: 1.4; max-width: 250px;">${p.proposta_texto}</p>
                        <div style="font-size: 12px; color: #ffd700; margin-top: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                            <span>Ofereceu: <strong>${prefixo} ${parseFloat(p.valor_oferecido).toFixed(2)}</strong></span>
                            ${badgeFp}
                        </div>
                    </td>
                    <td>
                        <span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; background: rgba(0,0,0,0.3); color: ${statusCor}; border: 1px solid ${statusCor}; margin-bottom: 6px;">
                            ${p.status}
                        </span>
                        <div style="font-size: 12.5px; color: #cbd5e1; max-width: 220px; line-height: 1.3;">${p.resposta_admin || 'Sem resposta.'}</div>
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-acao-admin responder" title="Responder Proposta" onclick="abrirModalRespostaProposta(${p.id})">💬</button>
                            <button class="btn-acao-admin aceitar" title="Aceitar Diretamente" onclick="responderPropostaRapido(${p.id}, 'Aceita', 'Proposta aceita com sucesso pela administração!')">✔️</button>
                            <button class="btn-acao-admin recusar" title="Recusar Proposta" onclick="recusarPropostaRapido(${p.id})">❌</button>
                            <button class="btn-acao-admin excluir" title="Excluir Definitivamente" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5;" onclick="excluirPropostaAdmin(${p.id})">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ff6b6b; padding: 20px;">Erro ao listar propostas.</td></tr>`;
    }
}

function abrirModalRespostaProposta(id) {
    const p = adminPropostas.find(item => item.id === id);
    if (!p) return;

    document.getElementById('modal-resp-proposta-id').value = p.id;
    document.getElementById('modal-resp-cliente-info').textContent = `${p.cliente_nome} propôs: "${p.proposta_texto}" (${p.valor_oferecido} via ${p.forma_pagamento || 'Moedas'})`;
    document.getElementById('modal-resp-status').value = p.status.includes('Aceit') ? 'Aceita' : (p.status.includes('Recus') ? 'Recusada' : 'Aceita');
    document.getElementById('modal-resp-texto').value = p.resposta_admin.includes('Aguardando') ? '' : p.resposta_admin;

    document.getElementById('modal-responder-proposta').style.display = 'flex';
}

function fecharModalRespostaProposta() {
    document.getElementById('modal-responder-proposta').style.display = 'none';
}

async function enviarRespostaProposta(e) {
    e.preventDefault();
    const id = document.getElementById('modal-resp-proposta-id').value;
    const status = document.getElementById('modal-resp-status').value;
    const resposta_admin = document.getElementById('modal-resp-texto').value.trim();

    try {
        await Api.patch(`/api/propostas/${id}/responder`, { status, resposta_admin });
        showNotification('Proposta respondida e atualizada com sucesso!', 'sucesso');
        fecharModalRespostaProposta();
        await carregarTabelaPropostas();
        await carregarDadosDashboard();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

async function responderPropostaRapido(id, status, resposta) {
    try {
        await Api.patch(`/api/propostas/${id}/responder`, { status, resposta_admin: resposta });
        showNotification(`Proposta marcada como ${status}!`, 'sucesso');
        await carregarTabelaPropostas();
        await carregarDadosDashboard();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

async function recusarPropostaRapido(id) {
    if (!confirm('Deseja recusar esta proposta?')) return;
    try {
        await Api.patch(`/api/propostas/${id}/responder`, {
            status: 'Recusada',
            resposta_admin: 'Infelizmente a administração não pôde aceitar os termos propostos para este item.'
        });
        showNotification('Proposta recusada!', 'sucesso');
        await carregarTabelaPropostas();
        await carregarDadosDashboard();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

async function excluirPropostaAdmin(id) {
    if (!confirm('Deseja realmente excluir esta proposta definitivamente?')) return;
    try {
        await Api.delete(`/api/propostas/${id}`);
        showNotification('Proposta excluída com sucesso!', 'sucesso');
        await carregarTabelaPropostas();
        await carregarDadosDashboard();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

window.alternarDestaqueSistema = alternarDestaqueSistema;
window.deletarSistemaAdmin = deletarSistemaAdmin;
window.abrirModalRespostaProposta = abrirModalRespostaProposta;
window.fecharModalRespostaProposta = fecharModalRespostaProposta;
window.enviarRespostaProposta = enviarRespostaProposta;
window.responderPropostaRapido = responderPropostaRapido;
window.recusarPropostaRapido = recusarPropostaRapido;
window.excluirPropostaAdmin = excluirPropostaAdmin;

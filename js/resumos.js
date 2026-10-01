// js/resumos.js - Crônicas e Diários de Sessões (Separados por Campanha)
let listaSessoesCache = [];
let listaCampanhasDisponiveis = [];
let filtroCampanhaAtual = 'todas';

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    // Verificar se há campanha passada na URL (ex: Resumos.html?campanha=2)
    const urlParams = new URLSearchParams(window.location.search);
    const paramCampanha = urlParams.get('campanha');
    if (paramCampanha) {
        filtroCampanhaAtual = paramCampanha;
    }

    await carregarCampanhasSelect();
    await carregarResumos();

    const btnNovo = document.getElementById('btn-novo-resumo');
    if (btnNovo) {
        btnNovo.addEventListener('click', () => {
            if (!AuthService.getUsuarioAtual()) {
                showNotification('Faça login para registrar resumos de sessões.', 'erro');
                setTimeout(() => window.location.href = 'Entrar.html', 1000);
                return;
            }
            abrirModalNovoResumo();
        });
    }

    // Listener para o filtro dropdown
    const selectFiltro = document.getElementById('filtro-campanha-select');
    if (selectFiltro) {
        selectFiltro.addEventListener('change', async (e) => {
            filtroCampanhaAtual = e.target.value;
            atualizarBadgeFiltroAtivo();
            await carregarResumos();
        });
    }
});

function atualizarBadgeFiltroAtivo() {
    const containerBadge = document.getElementById('tag-filtro-ativo');
    const textoBadge = document.getElementById('texto-filtro-ativo');
    const selectFiltro = document.getElementById('filtro-campanha-select');

    if (!containerBadge) return;

    if (filtroCampanhaAtual && filtroCampanhaAtual !== 'todas') {
        const campEncontrada = listaCampanhasDisponiveis.find(c => String(c.id) === String(filtroCampanhaAtual));
        const nomeCamp = campEncontrada ? campEncontrada.titulo : `Campanha #${filtroCampanhaAtual}`;
        textoBadge.innerHTML = `Mostrando apenas: <strong style="color: #80D0FF;">${nomeCamp}</strong>`;
        containerBadge.style.display = 'flex';
        if (selectFiltro) selectFiltro.value = filtroCampanhaAtual;
    } else {
        containerBadge.style.display = 'none';
        if (selectFiltro) selectFiltro.value = 'todas';
    }
}

function limparFiltroCampanha() {
    filtroCampanhaAtual = 'todas';
    // Atualizar URL sem recarregar a página
    window.history.replaceState({}, '', window.location.pathname);
    atualizarBadgeFiltroAtivo();
    carregarResumos();
}

async function carregarCampanhasSelect() {
    const selNovo = document.getElementById('resumo-camp-id');
    const selEdit = document.getElementById('edit-resumo-camp-id');
    const selFiltro = document.getElementById('filtro-campanha-select');

    try {
        const data = await Api.get('/api/campanhas');
        listaCampanhasDisponiveis = data.campanhas || [];

        const optionsHtml = listaCampanhasDisponiveis.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');

        if (selNovo) selNovo.innerHTML = optionsHtml;
        if (selEdit) selEdit.innerHTML = optionsHtml;

        if (selFiltro) {
            selFiltro.innerHTML = `
                <option value="todas">🌐 Todas as Campanhas</option>
                ${optionsHtml}
            `;
            if (filtroCampanhaAtual) selFiltro.value = filtroCampanhaAtual;
        }

        atualizarBadgeFiltroAtivo();
    } catch (err) {
        console.warn('Erro ao carregar campanhas para resumos:', err);
    }
}

async function carregarResumos() {
    const lista = document.getElementById('lista-resumos');
    if (!lista) return;

    try {
        let endpoint = '/api/sessoes';
        if (filtroCampanhaAtual && filtroCampanhaAtual !== 'todas') {
            endpoint += `?campanha=${filtroCampanhaAtual}`;
        }

        const data = await Api.get(endpoint);
        const sessoes = data.sessoes || [];
        listaSessoesCache = sessoes;

        if (sessoes.length === 0) {
            lista.innerHTML = `
                <div style="text-align: center; color: #80D0FF; padding: 50px; background: rgba(11, 26, 39, 0.7); border-radius: 12px; border: 1px dashed rgba(128, 208, 255, 0.3);">
                    <div style="font-size: 32px; margin-bottom: 10px;">📜</div>
                    <h3 style="font-size: 20px; color: white; margin-bottom: 6px;">Nenhum resumo encontrado</h3>
                    <p style="color: #cbd5e1; font-size: 14px;">Nenhuma crônica registrada para esta seleção. Use o botão acima para registrar o primeiro episódio!</p>
                </div>
            `;
            return;
        }

        const usuarioAtual = AuthService.getUsuarioAtual();
        const adminAtual = AuthService.getAdminAtual();

        // 1. Agrupar resumos por Campanha (Requisito: resumos separados de acordo com a Campanha)
        const gruposPorCampanha = {};
        sessoes.forEach(s => {
            const campKey = s.campanha_id || s.id_campanha;
            if (!gruposPorCampanha[campKey]) {
                gruposPorCampanha[campKey] = {
                    id: campKey,
                    titulo: s.campanha_titulo || `Campanha #${campKey}`,
                    mestre: s.mestre_nome || 'Mestre da Mesa',
                    mestre_id: s.mestre_id,
                    sessoes: []
                };
            }
            gruposPorCampanha[campKey].sessoes.push(s);
        });

        // 2. Renderizar cada campanha com seus respectivos episódios separados
        lista.innerHTML = Object.values(gruposPorCampanha).map(grupo => {
            return `
                <section class="secao-campanha-resumos" style="margin-bottom: 40px; background: rgba(6, 21, 35, 0.6); border: 1px solid rgba(0, 72, 135, 0.5); border-radius: 14px; padding: 22px;">
                    <!-- Cabeçalho da Campanha -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(128, 208, 255, 0.2); padding-bottom: 14px; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 28px;">🏰</span>
                            <div>
                                <h3 style="font-size: 22px; color: white; margin: 0; font-weight: 700;">
                                    ${grupo.titulo}
                                </h3>
                                <div style="font-size: 13.5px; color: #94a3b8; margin-top: 3px;">
                                    Mestre Narrador: <strong style="color: #80D0FF;">${grupo.mestre}</strong>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 12.5px; font-weight: 600; padding: 5px 12px; border-radius: 20px;">
                                📖 ${grupo.sessoes.length} Episódio${grupo.sessoes.length > 1 ? 's' : ''}
                            </span>
                            <a href="Campanhas.html" style="font-size: 12px; color: #80D0FF; text-decoration: none; border: 1px solid #004887; padding: 5px 10px; border-radius: 6px;">Ver Mesa</a>
                        </div>
                    </div>

                    <!-- Lista de Episódios Desta Campanha -->
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${grupo.sessoes.map(s => {
                            const podeGerenciar = (usuarioAtual && usuarioAtual.id === s.mestre_id) || !!adminAtual;

                            const acoesBotoes = podeGerenciar ? `
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="abrirModalEditarResumo(${s.id})" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #80D0FF; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">✏️ Editar</button>
                                    <button onclick="deletarResumo(${s.id})" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #f87171; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">🗑️ Excluir</button>
                                </div>
                            ` : '';

                            return `
                            <div class="card-resumo" style="background: #091a2b; border: 1px solid #1a3c5e; border-radius: 10px; padding: 20px;">
                                <div class="card-resumo-cabecalho" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <span style="background: #0284c7; color: white; font-weight: bold; font-size: 12px; padding: 3px 8px; border-radius: 4px;">
                                                Episódio #${s.numero_episodio}
                                            </span>
                                            <span style="color: #94a3b8; font-size: 13px;">📅 ${s.data_jogo}</span>
                                        </div>
                                        <h4 style="font-size: 19px; color: white; margin-top: 8px; font-weight: 700;">${s.titulo_episodio}</h4>
                                    </div>
                                    ${acoesBotoes}
                                </div>

                                <p style="font-size: 14.5px; line-height: 1.6; color: #cbd5e1; white-space: pre-line; background: rgba(0, 15, 30, 0.4); padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin: 0;">
                                    ${s.resumo}
                                </p>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }).join('');
    } catch (err) {
        lista.innerHTML = `<div style="text-align: center; color: #ff6b6b; padding: 30px;">Erro ao carregar resumos.</div>`;
    }
}

function abrirModalNovoResumo() {
    // Se estiver filtrando por uma campanha específica, já seleciona ela no modal
    const sel = document.getElementById('resumo-camp-id');
    if (sel && filtroCampanhaAtual && filtroCampanhaAtual !== 'todas') {
        sel.value = filtroCampanhaAtual;
    }
    document.getElementById('modal-novo-resumo').style.display = 'flex';
}

function fecharModalNovoResumo() {
    document.getElementById('modal-novo-resumo').style.display = 'none';
}

async function salvarNovoResumo(e) {
    e.preventDefault();
    const usuario = AuthService.getUsuarioAtual();
    const id_campanha = document.getElementById('resumo-camp-id').value;
    const numero_episodio = document.getElementById('resumo-episodio').value;
    const data_jogo = document.getElementById('resumo-data').value || new Date().toLocaleDateString('pt-BR');
    const titulo_episodio = document.getElementById('resumo-titulo').value.trim();
    const resumo = document.getElementById('resumo-texto').value.trim();

    try {
        await Api.post('/api/sessoes', {
            id_campanha,
            numero_episodio,
            data_jogo,
            titulo_episodio,
            resumo,
            user_uuid: usuario ? usuario.uuid : undefined
        });

        showNotification('Resumo de sessão salvo com sucesso!', 'sucesso');
        fecharModalNovoResumo();
        await carregarResumos();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Edição de Resumos
function abrirModalEditarResumo(id) {
    const s = listaSessoesCache.find(item => item.id === id);
    if (!s) return;

    document.getElementById('edit-resumo-id').value = s.id;
    document.getElementById('edit-resumo-camp-id').value = s.id_campanha || s.campanha_id;
    document.getElementById('edit-resumo-episodio').value = s.numero_episodio;
    document.getElementById('edit-resumo-data').value = s.data_jogo;
    document.getElementById('edit-resumo-titulo').value = s.titulo_episodio;
    document.getElementById('edit-resumo-texto').value = s.resumo;

    document.getElementById('modal-editar-resumo').style.display = 'flex';
}

function fecharModalEditarResumo() {
    document.getElementById('modal-editar-resumo').style.display = 'none';
}

async function salvarEdicaoResumo(e) {
    e.preventDefault();
    const id = document.getElementById('edit-resumo-id').value;
    const id_campanha = document.getElementById('edit-resumo-camp-id').value;
    const numero_episodio = document.getElementById('edit-resumo-episodio').value;
    const data_jogo = document.getElementById('edit-resumo-data').value.trim();
    const titulo_episodio = document.getElementById('edit-resumo-titulo').value.trim();
    const resumo = document.getElementById('edit-resumo-texto').value.trim();

    try {
        await Api.put(`/api/sessoes/${id}`, {
            id_campanha,
            numero_episodio,
            data_jogo,
            titulo_episodio,
            resumo
        });

        showNotification('Resumo de sessão atualizado com sucesso!', 'sucesso');
        fecharModalEditarResumo();
        await carregarResumos();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Exclusão de Resumo
async function deletarResumo(id) {
    if (!confirm('Deseja realmente excluir este resumo de sessão?')) {
        return;
    }

    try {
        await Api.delete(`/api/sessoes/${id}`);
        showNotification('Resumo excluído com sucesso!', 'sucesso');
        await carregarResumos();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

window.fecharModalNovoResumo = fecharModalNovoResumo;
window.salvarNovoResumo = salvarNovoResumo;
window.abrirModalNovoResumo = abrirModalNovoResumo;
window.abrirModalEditarResumo = abrirModalEditarResumo;
window.fecharModalEditarResumo = fecharModalEditarResumo;
window.salvarEdicaoResumo = salvarEdicaoResumo;
window.deletarResumo = deletarResumo;
window.limparFiltroCampanha = limparFiltroCampanha;

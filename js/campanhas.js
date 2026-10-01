// js/campanhas.js - Gestão de Campanhas (Apenas com Sistemas Adquiridos)
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    await carregarCampanhas();
    await carregarSistemasParaSelect(usuario);

    const btnNova = document.getElementById('btn-nova-campanha');
    if (btnNova) {
        btnNova.addEventListener('click', async () => {
            const u = AuthService.getUsuarioAtual();
            if (!u) {
                showNotification('Faça login para criar uma campanha.', 'erro');
                setTimeout(() => window.location.href = 'Entrar.html', 1000);
                return;
            }
            await abrirModalNovaCampanha(u);
        });
    }
});

let listaCampanhasCache = [];

async function carregarCampanhas() {
    const grid = document.getElementById('grid-campanhas');
    if (!grid) return;

    try {
        const data = await Api.get('/api/campanhas');
        const campanhas = data.campanhas || [];
        listaCampanhasCache = campanhas;

        if (campanhas.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #80D0FF; padding: 40px;">Nenhuma campanha ativa no momento.</div>`;
            return;
        }

        const usuarioAtual = AuthService.getUsuarioAtual();
        const adminAtual = AuthService.getAdminAtual();

        grid.innerHTML = campanhas.map(c => {
            const podeGerenciar = (usuarioAtual && usuarioAtual.id === c.mestre_id) || !!adminAtual;

            const acoesMestre = podeGerenciar ? `
                <div style="display: flex; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(128, 208, 255, 0.2);">
                    <button onclick="abrirModalEditarCampanha(${c.id})" style="flex: 1; background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #80D0FF; padding: 6px 10px; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">✏️ Editar</button>
                    <button onclick="deletarCampanha(${c.id})" style="flex: 1; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #f87171; padding: 6px 10px; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">🗑️ Excluir</button>
                </div>
            ` : '';

            return `
            <div class="card-campanha">
                <img class="campanha-capa" src="${c.imagemcapa_link || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600'}" alt="${c.titulo}">
                <div class="campanha-corpo">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="background: rgba(0, 48, 92, 0.8); color: #80D0FF; font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid #004887;">
                                📜 ${c.sistema_nome || 'Sem Sistema Registrado'}
                            </span>
                            <span style="color: #94a3b8; font-size: 13px;">${c.visibilidade === 'publica' ? '🌐 Pública' : '🔒 Privada'}</span>
                        </div>
                        <h3 style="font-size: 22px; font-weight: 700; color: white; margin-bottom: 8px;">${c.titulo}</h3>
                        <p style="color: #c3eeff; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">${c.sinopse}</p>
                    </div>

                    <div style="border-top: 1px solid rgba(128, 208, 255, 0.2); padding-top: 14px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; color: #94a3b8;">Mestre: <strong style="color: white;">${c.mestre_nome}</strong></span>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <a href="Resumos.html?campanha=${c.id}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; background: rgba(2, 132, 199, 0.25); color: #80D0FF; border: 1px solid #0284c7; padding: 5px 12px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: all 0.2s ease;">
                                    📖 Ver Resumos (${c.total_episodios || 0})
                                </a>
                            </div>
                        </div>
                        ${acoesMestre}
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff6b6b; padding: 30px;">Erro ao carregar campanhas.</div>`;
    }
}

// Carregar sistemas que o usuário comprou na loja + Opção Sistema Personalizado
async function carregarSistemasParaSelect(usuario) {
    const sel = document.getElementById('camp-sistema-id');
    const containerAviso = document.getElementById('aviso-sistemas-campanha');
    if (!sel) return;

    if (!usuario) {
        sel.innerHTML = '<option value="customizado">✨ Sistema Personalizado (Regras Próprias)</option>';
        return;
    }

    try {
        const data = await Api.get(`/api/biblioteca/${usuario.uuid}`);
        const sistemas = data.sistemas || [];

        let optionsHtml = `<option value="customizado" selected>✨ Sistema Personalizado (Regras Próprias / Homebrew)</option>`;

        if (sistemas.length > 0) {
            optionsHtml += `<optgroup label="Sistemas Adquiridos na Loja">`;
            optionsHtml += sistemas.map(s => `<option value="${s.id}">✔ ${s.nome} (${s.genero})</option>`).join('');
            optionsHtml += `</optgroup>`;

            if (containerAviso) {
                containerAviso.innerHTML = `
                    <small style="color: #10b981; display: block; margin-top: 6px;">
                        ✔ Disponível: Sistema Personalizado e ${sistemas.length} sistema${sistemas.length > 1 ? 's' : ''} adquirido${sistemas.length > 1 ? 's' : ''} na Loja.
                    </small>
                `;
            }
        } else {
            if (containerAviso) {
                containerAviso.innerHTML = `
                    <small style="color: #80D0FF; display: block; margin-top: 6px;">
                        💡 Você pode criar com <strong>Sistema Personalizado</strong> ou adquirir sistemas oficiais com suas moedas na <a href="Sistemas.html" style="color: #ffd700; text-decoration: underline;">Loja de Sistemas</a>.
                    </small>
                `;
            }
        }

        sel.innerHTML = optionsHtml;
    } catch (err) {
        console.warn('Erro ao carregar sistemas adquiridos:', err);
        sel.innerHTML = '<option value="customizado">✨ Sistema Personalizado (Regras Próprias)</option>';
    }
}

async function abrirModalNovaCampanha(usuario) {
    await carregarSistemasParaSelect(usuario);
    document.getElementById('modal-nova-campanha').style.display = 'flex';
}

function fecharModalNovaCampanha() {
    document.getElementById('modal-nova-campanha').style.display = 'none';
}

async function salvarNovaCampanha(e) {
    e.preventDefault();
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) return;

    const titulo = document.getElementById('camp-titulo').value.trim();
    const sinopse = document.getElementById('camp-sinopse').value.trim();
    const id_sistema = document.getElementById('camp-sistema-id').value;
    const visibilidade = document.getElementById('camp-visibilidade').value;
    const imagemcapa_link = document.getElementById('camp-capa').value.trim();

    if (!id_sistema) {
        showNotification('Selecione um sistema ou escolha Sistema Personalizado.', 'erro');
        return;
    }

    try {
        await Api.post('/api/campanhas', {
            user_uuid: usuario.uuid,
            titulo,
            sinopse,
            id_sistema,
            visibilidade,
            imagemcapa_link
        });

        showNotification('Campanha criada com sucesso!', 'sucesso');
        fecharModalNovaCampanha();
        await carregarCampanhas();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

async function abrirModalEditarCampanha(id) {
    const campanha = listaCampanhasCache.find(c => c.id === id);
    if (!campanha) return;

    const usuario = AuthService.getUsuarioAtual();
    const sel = document.getElementById('edit-camp-sistema-id');
    if (sel) {
        let optionsHtml = '<option value="customizado">✨ Sistema Personalizado</option>';
        if (usuario) {
            try {
                const data = await Api.get(`/api/biblioteca/${usuario.uuid}`);
                const sistemas = data.sistemas || [];
                if (sistemas.length > 0) {
                    optionsHtml += '<optgroup label="Sistemas Adquiridos">';
                    optionsHtml += sistemas.map(s => `<option value="${s.id}">✔ ${s.nome}</option>`).join('');
                    optionsHtml += '</optgroup>';
                }
            } catch (e) {}
        }
        sel.innerHTML = optionsHtml;
        if (campanha.id_sistema) {
            sel.value = campanha.id_sistema;
        } else {
            sel.value = 'customizado';
        }
    }

    document.getElementById('edit-camp-id').value = campanha.id;
    document.getElementById('edit-camp-titulo').value = campanha.titulo;
    document.getElementById('edit-camp-sinopse').value = campanha.sinopse;
    document.getElementById('edit-camp-visibilidade').value = campanha.visibilidade || 'publica';
    document.getElementById('edit-camp-capa').value = campanha.imagemcapa_link || '';

    document.getElementById('modal-editar-campanha').style.display = 'flex';
}

function fecharModalEditarCampanha() {
    document.getElementById('modal-editar-campanha').style.display = 'none';
}

async function salvarEdicaoCampanha(e) {
    e.preventDefault();
    const id = document.getElementById('edit-camp-id').value;
    const titulo = document.getElementById('edit-camp-titulo').value.trim();
    const sinopse = document.getElementById('edit-camp-sinopse').value.trim();
    const id_sistema = document.getElementById('edit-camp-sistema-id').value;
    const visibilidade = document.getElementById('edit-camp-visibilidade').value;
    const imagemcapa_link = document.getElementById('edit-camp-capa').value.trim();

    try {
        await Api.put(`/api/campanhas/${id}`, {
            titulo,
            sinopse,
            id_sistema,
            visibilidade,
            imagemcapa_link
        });

        showNotification('Campanha atualizada com sucesso!', 'sucesso');
        fecharModalEditarCampanha();
        await carregarCampanhas();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

async function deletarCampanha(id) {
    if (!confirm('Deseja realmente excluir esta campanha? Todos os resumos associados a ela também serão excluídos.')) {
        return;
    }

    try {
        await Api.delete(`/api/campanhas/${id}`);
        showNotification('Campanha excluída com sucesso!', 'sucesso');
        await carregarCampanhas();
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

window.fecharModalNovaCampanha = fecharModalNovaCampanha;
window.salvarNovaCampanha = salvarNovaCampanha;
window.abrirModalNovaCampanha = abrirModalNovaCampanha;
window.abrirModalEditarCampanha = abrirModalEditarCampanha;
window.salvarEdicaoCampanha = salvarEdicaoCampanha;
window.deletarCampanha = deletarCampanha;

// Gerar Campanha com Inteligência Artificial Generativa (Google Gemini)
async function gerarCampanhaComIA() {
    const statusEl = document.getElementById('camp-ia-status');
    const btn = document.getElementById('btn-ia-gerar-campanha');
    const tema = document.getElementById('camp-ia-tema-opcional') ? document.getElementById('camp-ia-tema-opcional').value.trim() : '';

    if (statusEl) statusEl.style.display = 'block';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
    }

    try {
        const res = await Api.post('/api/ia/gerar-campanha', { tema });
        if (res.sucesso && res.campanha) {
            const c = res.campanha;
            document.getElementById('camp-titulo').value = c.titulo || '';
            document.getElementById('camp-sinopse').value = c.sinopse || '';
            if (c.visibilidade) document.getElementById('camp-visibilidade').value = c.visibilidade;
            if (c.imagemcapa_link) document.getElementById('camp-capa').value = c.imagemcapa_link;

            showNotification(`✨ Campanha "${c.titulo}" gerada com sucesso pela IA!`, 'sucesso');
        }
    } catch (err) {
        showNotification('Erro ao gerar campanha com IA: ' + err.message, 'erro');
    } finally {
        if (statusEl) statusEl.style.display = 'none';
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}
window.gerarCampanhaComIA = gerarCampanhaComIA;


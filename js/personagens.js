// js/personagens.js - Lógica Dinâmica e Moderna de Personagens (Slots Infinitos e Acesso à Ficha Externa)
let listaPersonagens = [];
let filtroTexto = '';

const ICON_EYE = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
const ICON_PENCIL = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    await carregarPersonagens(usuario);

    // Botão Criar Novo Personagem
    const btnNovo = document.getElementById('btn-novo-personagem');
    if (btnNovo) {
        btnNovo.addEventListener('click', () => {
            if (!AuthService.getUsuarioAtual()) {
                showNotification('Faça login para cadastrar seus personagens.', 'erro');
                setTimeout(() => window.location.href = 'Entrar.html', 1000);
                return;
            }
            abrirModalNovoPersonagem();
        });
    }

    // Campo de busca instantânea
    const inputBusca = document.getElementById('input-busca-personagem');
    if (inputBusca) {
        inputBusca.addEventListener('input', (e) => {
            filtroTexto = e.target.value.toLowerCase().trim();
            renderizarCards();
        });
    }
});

async function carregarPersonagens(usuario) {
    try {
        const url = usuario ? `/api/personagens?user_uuid=${usuario.uuid}` : '/api/personagens';
        const data = await Api.get(url);
        listaPersonagens = data.personagens || [];
        renderizarCards();
    } catch (err) {
        console.error('Erro ao consultar personagens:', err);
        renderizarCards();
    }
}

function renderizarCards() {
    const grid = document.getElementById('grid-personagens');
    if (!grid) return;

    // Filtrar personagens caso haja pesquisa
    const filtrados = listaPersonagens.filter(p => {
        if (!filtroTexto) return true;
        const nomeMatch = (p.nome || '').toLowerCase().includes(filtroTexto);
        const classeMatch = (p.classe_raca || '').toLowerCase().includes(filtroTexto);
        return nomeMatch || classeMatch;
    });

    let html = '';

    // 1. Renderizar os personagens cadastrados
    filtrados.forEach(p => {
        const dataFmt = p.data_criacao ? new Date(p.data_criacao).toLocaleDateString('pt-BR') : '';
        const avatarSrc = (p.imagemperfil_link && !p.imagemperfil_link.includes('avatar_padrao.svg') && !p.imagemperfil_link.includes('unsplash'))
            ? p.imagemperfil_link
            : '../avatar_padrao.svg';

        html += `
            <div class="card-heroi" id="card-p-${p.id}">
                <div class="card-heroi-capa">
                    <span class="badge-nivel">Nível ${p.nivel || 1}</span>
                    ${dataFmt ? `<span class="badge-data">${dataFmt}</span>` : ''}
                </div>

                <div class="card-heroi-avatar">
                    <img src="${avatarSrc}" alt="${p.nome}">
                </div>

                <div class="card-heroi-corpo">
                    <div>
                        <h3 class="card-heroi-nome" title="${p.nome}">${p.nome}</h3>
                        <p class="card-heroi-classe">${p.classe_raca}</p>
                        <p class="card-heroi-desc">${p.descricao || 'Sem histórico ou descrição cadastrada ainda.'}</p>
                    </div>

                    <div class="card-heroi-acoes">
                        <button class="btn-ficha-principal" onclick="acessarFichaPersonagem(${p.id})">
                            Acessar Ficha
                        </button>
                        <div class="card-heroi-botoes-icones">
                            <button class="btn-icone-acao" title="Ver Detalhes e Biografia" onclick="abrirFichaCompleta(${p.id})">
                                ${ICON_EYE}
                            </button>
                            <button class="btn-icone-acao" title="Editar Herói" onclick="clicarEditarCard(${p.id})">
                                ${ICON_PENCIL}
                            </button>
                            <button class="btn-icone-acao deletar" title="Excluir Herói" onclick="clicarDeletarCard(${p.id})">
                                ${ICON_TRASH}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    // 2. Card de Slot Infinito "+ Adicionar Novo Herói"
    html += `
        <div class="card-adicionar-heroi" onclick="abrirModalNovoPersonagem()">
            <div class="card-adicionar-icone">+</div>
            <div class="card-adicionar-titulo">Novo Personagem</div>
            <div class="card-adicionar-sub">Clique aqui para criar um novo slot</div>
        </div>
    `;

    grid.innerHTML = html;
}

// Acesso direto à ficha (Google Drive / PDF)
function acessarFichaPersonagem(id) {
    const p = listaPersonagens.find(item => item.id == id);
    if (!p) return;

    if (p.pdf_link && p.pdf_link.trim() !== '') {
        window.open(p.pdf_link, '_blank');
    } else {
        showNotification('Nenhum link de ficha (Google Drive / PDF) foi adicionado ainda. Abrindo detalhes para edição.', 'info');
        abrirFichaCompleta(id);
    }
}

function clicarEditarCard(id) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para editar personagens.', 'erro');
        return;
    }
    const p = listaPersonagens.find(item => item.id == id);
    if (!p) return;
    abrirModalEditarPersonagem(p);
}

async function clicarDeletarCard(id) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para gerenciar personagens.', 'erro');
        return;
    }
    const p = listaPersonagens.find(item => item.id == id);
    if (!p) return;

    if (!confirm(`Deseja realmente excluir o personagem "${p.nome}"?`)) return;

    try {
        await Api.delete(`/api/personagens/${p.id}`);
        showNotification('Personagem excluído com sucesso!', 'sucesso');
        await carregarPersonagens(usuario);
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Modal Novo Personagem
function abrirModalNovoPersonagem() {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para cadastrar novos personagens.', 'erro');
        setTimeout(() => window.location.href = 'Entrar.html', 1000);
        return;
    }
    document.getElementById('modal-novo-personagem').style.display = 'flex';
}

function fecharModalNovoPersonagem() {
    document.getElementById('modal-novo-personagem').style.display = 'none';
}

async function salvarNovoPersonagem(e) {
    e.preventDefault();
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) return;

    const nome = document.getElementById('form-p-nome').value.trim();
    const classe_raca = document.getElementById('form-p-classe').value.trim();
    const nivel = parseInt(document.getElementById('form-p-nivel').value, 10) || 1;
    const descricao = document.getElementById('form-p-descricao').value.trim();
    const imagemperfil_link = document.getElementById('form-p-avatar').value.trim();
    const imagem_link = document.getElementById('form-p-arte').value.trim();
    const pdf_link = document.getElementById('form-p-pdf').value.trim();

    try {
        await Api.post('/api/personagens', {
            user_uuid: usuario.uuid,
            nome,
            classe_raca,
            nivel,
            descricao,
            imagem_link: imagem_link || '',
            imagemperfil_link: imagemperfil_link || 'avatar_padrao.svg',
            pdf_link: pdf_link || ''
        });

        showNotification('Personagem criado com sucesso!', 'sucesso');
        fecharModalNovoPersonagem();
        document.getElementById('form-p-nome').value = '';
        document.getElementById('form-p-classe').value = '';
        document.getElementById('form-p-nivel').value = '1';
        document.getElementById('form-p-descricao').value = '';
        document.getElementById('form-p-avatar').value = '';
        document.getElementById('form-p-arte').value = '';
        document.getElementById('form-p-pdf').value = '';
        await carregarPersonagens(usuario);
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Modal Editar Personagem
function abrirModalEditarPersonagem(p) {
    document.getElementById('edit-p-id').value = p.id;
    document.getElementById('edit-p-nome').value = p.nome || '';
    document.getElementById('edit-p-classe').value = p.classe_raca || '';
    document.getElementById('edit-p-nivel').value = p.nivel || 1;
    document.getElementById('edit-p-descricao').value = p.descricao || '';
    document.getElementById('edit-p-avatar').value = (p.imagemperfil_link && !p.imagemperfil_link.includes('avatar_padrao.svg')) ? p.imagemperfil_link : '';
    document.getElementById('edit-p-arte').value = (p.imagem_link && !p.imagem_link.includes('avatar_padrao.svg')) ? p.imagem_link : '';
    document.getElementById('edit-p-pdf').value = p.pdf_link || '';

    document.getElementById('modal-editar-personagem').style.display = 'flex';
}

function fecharModalEditarPersonagem() {
    document.getElementById('modal-editar-personagem').style.display = 'none';
}

async function salvarEdicaoPersonagem(e) {
    e.preventDefault();
    const id = document.getElementById('edit-p-id').value;
    const nome = document.getElementById('edit-p-nome').value.trim();
    const classe_raca = document.getElementById('edit-p-classe').value.trim();
    const nivel = parseInt(document.getElementById('edit-p-nivel').value, 10) || 1;
    const descricao = document.getElementById('edit-p-descricao').value.trim();
    const imagemperfil_link = document.getElementById('edit-p-avatar').value.trim();
    const imagem_link = document.getElementById('edit-p-arte').value.trim();
    const pdf_link = document.getElementById('edit-p-pdf').value.trim();

    try {
        await Api.put(`/api/personagens/${id}`, {
            nome,
            classe_raca,
            nivel,
            descricao,
            imagem_link: imagem_link || '',
            imagemperfil_link: imagemperfil_link || 'avatar_padrao.svg',
            pdf_link: pdf_link || ''
        });

        showNotification('Personagem atualizado com sucesso!', 'sucesso');
        fecharModalEditarPersonagem();
        const usuario = AuthService.getUsuarioAtual();
        await carregarPersonagens(usuario);
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Modal Ficha Completa
function abrirFichaCompleta(id) {
    const p = listaPersonagens.find(item => item.id == id);
    if (!p) return;

    document.getElementById('ficha-nome').textContent = p.nome;
    document.getElementById('ficha-classe').textContent = p.classe_raca;
    document.getElementById('ficha-nivel').textContent = `Nível ${p.nivel || 1}`;
    document.getElementById('ficha-desc').textContent = p.descricao || 'Nenhuma história ou descrição cadastrada.';
    
    // Arte da Ficha Completa
    const arteSrc = (p.imagem_link && !p.imagem_link.includes('avatar_padrao.svg'))
        ? p.imagem_link
        : (p.imagemperfil_link && !p.imagemperfil_link.includes('avatar_padrao.svg') ? p.imagemperfil_link : '../avatar_padrao.svg');
    document.getElementById('ficha-arte').src = arteSrc;

    // Seção do Link da Ficha no Google Drive / PDF
    const linkBox = document.getElementById('ficha-link-box');
    if (linkBox) {
        if (p.pdf_link && p.pdf_link.trim() !== '') {
            linkBox.innerHTML = `
                <a href="${p.pdf_link}" target="_blank" class="btn-abrir-ficha-drive">
                    📄 Abrir Ficha Completa no Google Drive / PDF
                </a>
            `;
        } else {
            linkBox.innerHTML = `
                <div style="background: rgba(0, 30, 60, 0.6); padding: 14px; border-radius: 8px; border: 1px dashed rgba(128, 208, 255, 0.4); text-align: center; color: #94a3b8; font-size: 13.5px;">
                    ⚠️ Nenhum link de ficha (Google Drive / PDF) foi adicionado ainda.<br>
                    <button onclick="fecharModalFicha(); clicarEditarCard(${p.id})" style="background: transparent; border: none; color: #80D0FF; text-decoration: underline; font-weight: bold; cursor: pointer; margin-top: 6px; font-size: 13px;">
                        Clique aqui para editar e inserir o link da sua ficha
                    </button>
                </div>
            `;
        }
    }

    document.getElementById('modal-ficha-completa').style.display = 'flex';
}

function fecharModalFicha() {
    document.getElementById('modal-ficha-completa').style.display = 'none';
}

window.acessarFichaPersonagem = acessarFichaPersonagem;
window.clicarEditarCard = clicarEditarCard;
window.clicarDeletarCard = clicarDeletarCard;
window.abrirModalNovoPersonagem = abrirModalNovoPersonagem;
window.fecharModalNovoPersonagem = fecharModalNovoPersonagem;
window.salvarNovoPersonagem = salvarNovoPersonagem;
window.abrirFichaCompleta = abrirFichaCompleta;
window.fecharModalFicha = fecharModalFicha;

// Gerar Personagem com Inteligência Artificial Generativa (Google Gemini)
async function gerarPersonagemComIA() {
    const statusEl = document.getElementById('p-ia-status');
    const btn = document.getElementById('btn-ia-gerar-personagem');
    const ideia = document.getElementById('p-ia-ideia-opcional') ? document.getElementById('p-ia-ideia-opcional').value.trim() : '';

    if (statusEl) statusEl.style.display = 'block';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
    }

    try {
        const res = await Api.post('/api/ia/gerar-personagem', { ideia });
        if (res.sucesso && res.personagem) {
            const p = res.personagem;
            document.getElementById('form-p-nome').value = p.nome || '';
            document.getElementById('form-p-classe').value = p.classe_raca || '';
            document.getElementById('form-p-nivel').value = p.nivel || 1;
            document.getElementById('form-p-descricao').value = p.biografia || '';
            if (p.fotoperfil_link) document.getElementById('form-p-avatar').value = p.fotoperfil_link;
            if (p.fotoarte_link) document.getElementById('form-p-arte').value = p.fotoarte_link;
            if (p.pdf_link) document.getElementById('form-p-pdf').value = p.pdf_link;

            showNotification(`✨ Personagem "${p.nome}" gerado com sucesso pela IA!`, 'sucesso');
        }
    } catch (err) {
        showNotification('Erro ao gerar personagem com IA: ' + err.message, 'erro');
    } finally {
        if (statusEl) statusEl.style.display = 'none';
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}
window.gerarPersonagemComIA = gerarPersonagemComIA;


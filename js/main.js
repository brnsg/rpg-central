// js/main.js - Lógica Principal da Página Inicial (index.html)
// Função auxiliar para resolver caminhos relativos entre index.html (raiz) e arquivos em abas/
function getPathAba(pagina) {
    const isAbas = window.location.pathname.includes('/abas/') || window.location.pathname.includes('\\abas\\') || window.location.href.includes('/abas/');
    return isAbas ? pagina : `abas/${pagina}`;
}
window.getPathAba = getPathAba;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar Sessão
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    // 2. Inicializar Rolagem de Dados
    inicializarRolagemDeDados();

    // 3. Inicializar Vitrine de Sistemas (Requisitos 1, 2, 3 e 6 do Edital)
    inicializarVitrineSistemas(usuario);
});

// ==========================================
// ROLAGEM DE DADOS (D20, D12, D10, D8, D6, D4)
// ==========================================
function inicializarRolagemDeDados() {
    const botoes = document.querySelectorAll('.rolagemdedados__botoes button');
    const resultadoDisplay = document.getElementById('resultado_numero');

    if (!resultadoDisplay) return;

    botoes.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const diceClass = btn.className.trim(); // ex: 'd20', 'd12', etc.
            const diceFaces = parseInt(diceClass.replace('d', '')) || 20;

            // Efeito visual de rolagem
            resultadoDisplay.style.opacity = '0.3';
            resultadoDisplay.style.transform = 'scale(0.8)';
            resultadoDisplay.textContent = '...';

            setTimeout(() => {
                const roll = Math.floor(Math.random() * diceFaces) + 1;
                resultadoDisplay.textContent = `${roll} (no ${diceClass.toUpperCase()})`;
                resultadoDisplay.style.opacity = '1';
                resultadoDisplay.style.transform = 'scale(1.1)';
                resultadoDisplay.style.transition = 'all 0.2s ease';

                if (roll === diceFaces && diceFaces === 20) {
                    resultadoDisplay.innerHTML = `<span style="color: #ffd700; text-shadow: 0 0 12px gold;">💥 CRÍTICO! ${roll} 💥</span>`;
                } else if (roll === 1 && diceFaces === 20) {
                    resultadoDisplay.innerHTML = `<span style="color: #ff6b6b;">💀 FALHA CRÍTICA! 1 💀</span>`;
                }
            }, 250);
        });
    });
}

// ==========================================
// VITRINE DE SISTEMAS (Requisitos 1, 2, 3 e 6)
// ==========================================
let sistemasCache = [];
let filtroDestaqueAtivo = false;

async function inicializarVitrineSistemas(usuario) {
    const container = document.getElementById('vitrine-sistemas-container');
    if (!container) return;

    const inputBusca = document.getElementById('input-busca-sistema');
    const btnPesquisar = document.getElementById('btn-pesquisar-sistema');
    const btnDestaques = document.getElementById('btn-exibir-destaques');

    // Carregar dados iniciais (Requisito 1: Destaques e Sistemas)
    await carregarSistemas({ destaque: true });

    // Evento de Pesquisa (Requisito 2)
    if (btnPesquisar && inputBusca) {
        btnPesquisar.addEventListener('click', (e) => {
            e.preventDefault();
            carregarSistemas({ search: inputBusca.value.trim() });
        });

        inputBusca.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                carregarSistemas({ search: inputBusca.value.trim() });
            }
        });
    }

    // Botão Reexibir Destaques (Requisito 2)
    if (btnDestaques) {
        btnDestaques.addEventListener('click', (e) => {
            e.preventDefault();
            filtroDestaqueAtivo = !filtroDestaqueAtivo;
            if (inputBusca) inputBusca.value = '';

            btnDestaques.style.background = filtroDestaqueAtivo ? '#80D0FF' : 'rgb(146, 228, 255)';
            btnDestaques.style.color = '#001e3c';

            carregarSistemas(filtroDestaqueAtivo ? { destaque: true } : {});
        });
    }
}

async function carregarSistemas(filtros = {}) {
    const grid = document.getElementById('grid-sistemas');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #80D0FF; padding: 40px; font-size: 18px;">Carregando acervo de sistemas...</div>`;

    try {
        const queryParams = new URLSearchParams();
        if (filtros.search) queryParams.append('search', filtros.search);
        if (filtros.destaque) queryParams.append('destaque', '1');

        const data = await Api.get(`/api/sistemas?${queryParams.toString()}`);
        sistemasCache = data.sistemas || [];
        renderizarCardsSistemas(sistemasCache);
    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff6b6b; padding: 30px;">Erro ao carregar sistemas do servidor.</div>`;
    }
}

function renderizarCardsSistemas(sistemas) {
    const grid = document.getElementById('grid-sistemas');
    if (!grid) return;

    if (sistemas.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #c3eeff; padding: 50px; font-size: 18px;">Nenhum sistema encontrado com os critérios de busca.</div>`;
        return;
    }

    grid.innerHTML = sistemas.map(sis => `
        <div class="card-sistema" style="
            background: linear-gradient(135deg, rgba(25, 28, 29, 0.95) 0%, rgba(0, 49, 87, 0.9) 100%);
            border: 1px solid ${sis.destaque ? '#80D0FF' : 'rgb(0, 48, 92)'};
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            display: flex;
            flex-direction: column;
            transition: transform 0.3s ease, border-color 0.3s ease;
            position: relative;
        ">
            ${sis.destaque ? `
                <div style="position: absolute; top: 12px; right: 12px; background: rgba(0, 48, 92, 0.9); color: #ffd700; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: bold; border: 1px solid #ffd700; z-index: 2;">
                    ★ Destaque
                </div>
            ` : ''}

            <div style="height: 180px; overflow: hidden; background: #001224;">
                <img src="${sis.imagemcapa_link || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}"
                     alt="${sis.nome}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;"
                     onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1.0)'">
            </div>

            <div style="padding: 20px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
                <div>
                    <h3 style="color: white; font-size: 20px; font-weight: 700; margin-bottom: 6px;">${sis.nome}</h3>
                    <p style="color: #80D0FF; font-size: 14px; margin-bottom: 12px; font-weight: 500;">🎭 ${sis.genero}</p>
                    <p style="color: #ffd700; font-size: 18px; font-weight: 700; margin-bottom: 15px;">
                        🪙 ${parseFloat(sis.preco) > 0 ? `${parseFloat(sis.preco).toFixed(2)} Moedas` : 'Gratuito'}
                    </p>
                </div>

                <button onclick="abrirModalDetalhes(${sis.id})" style="
                    background: rgb(146, 228, 255);
                    color: rgb(0, 30, 60);
                    border: none;
                    border-radius: 10px;
                    padding: 10px 16px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: 0.3s ease;
                " onmouseover="this.style.background='rgb(195, 238, 255)'; this.style.transform='scale(1.03)'"
                   onmouseout="this.style.background='rgb(146, 228, 255)'; this.style.transform='scale(1.0)'">
                    Ver Detalhes ➔
                </button>
            </div>
        </div>
    `).join('');
}

// ==========================================
// MODAL DE DETALHES COM IA E COMPRA DIRETA
// ==========================================
async function abrirModalDetalhes(sistemaId) {
    try {
        const usuario = AuthService.getUsuarioAtual();
        const url = usuario ? `/api/sistemas/${sistemaId}?user_uuid=${usuario.uuid}` : `/api/sistemas/${sistemaId}`;
        const data = await Api.get(url);
        const sis = data.sistema;

        let modal = document.getElementById('modal-detalhes-sistema');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-detalhes-sistema';
            modal.style.cssText = `
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 15, 30, 0.85);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgb(25, 28, 29) 0%, rgba(0, 49, 87, 0.98) 100%);
                border: 1px solid #80D0FF;
                border-radius: 18px;
                max-width: 850px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 15px 40px rgba(0,0,0,0.7);
                position: relative;
                padding: 30px;
                color: white;
            ">
                <button onclick="document.getElementById('modal-detalhes-sistema').style.display='none'" style="
                    position: absolute;
                    top: 18px; right: 20px;
                    background: transparent;
                    border: none;
                    color: #80D0FF;
                    font-size: 26px;
                    cursor: pointer;
                ">&times;</button>

                <!-- Cabeçalho do Item -->
                <div style="display: flex; gap: 25px; flex-wrap: wrap; margin-bottom: 25px;">
                    <img src="${sis.imagemcapa_link || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}"
                         style="width: 200px; height: 260px; object-fit: cover; border-radius: 12px; border: 1px solid rgba(128, 208, 255, 0.4);">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                            <h2 style="font-size: 28px; color: white; margin-bottom: 8px;">${sis.nome}</h2>
                            ${sis.adquirido ? `
                                <span style="background: rgba(16, 185, 129, 0.9); color: white; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: bold; border: 1px solid #34d399;">
                                    ✔ Adquirido
                                </span>
                            ` : ''}
                        </div>
                        <p style="color: #80D0FF; font-size: 16px; margin-bottom: 8px;">Gênero: <strong>${sis.genero}</strong></p>
                        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #bae6fd; padding: 4px 10px; border-radius: 6px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px;">
                                📄 Livro de Regras em PDF ${sis.pdf_link ? 'Disponível' : 'Digital'}
                            </span>
                            ${sis.pdf_link && !sis.adquirido ? `
                                <a href="${sis.pdf_link}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-size: 12.5px; text-decoration: underline;" title="Abrir amostra do livro de regras">
                                    Visualizar Amostra (PDF) ↗
                                </a>
                            ` : ''}
                        </div>
                        <p style="color: #FFD700; font-size: 22px; font-weight: bold; margin-bottom: 14px;">
                            🪙 ${parseFloat(sis.preco) > 0 ? `${parseFloat(sis.preco).toFixed(2)} Moedas` : 'Gratuito'}
                        </p>
                        <p style="font-size: 15px; line-height: 1.6; color: #d0e7ff; margin-bottom: 15px;">${sis.descricao}</p>
                        <p style="font-size: 14px; color: #a2c4e2;">Mestre / Criador: <strong>${sis.criador_nome || 'Equipe RPG Central'}</strong></p>
                    </div>
                </div>

                <!-- SEÇÃO REQUISITO 3: CONSULTA A PLATAFORMA DE IA -->
                <div style="
                    background: rgba(0, 30, 60, 0.7);
                    border: 1px solid #4dabf7;
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 25px;
                ">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <h3 style="color: #80D0FF; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                            ✨ Análise Assistida por Inteligência Artificial
                        </h3>
                        <span style="font-size: 12px; background: rgba(77, 171, 247, 0.2); color: #80D0FF; padding: 4px 10px; border-radius: 12px; border: 1px solid #4dabf7;">
                            Complexidade: ${sis.ia_complexidade || 'Média'}
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 12px;">
                        <div style="background: rgba(16, 42, 67, 0.5); padding: 12px; border-radius: 8px; border-left: 4px solid #51cf66;">
                            <strong style="color: #51cf66; display: block; margin-bottom: 6px;">Pontos Fortes: *</strong>
                            <p style="font-size: 13.5px; line-height: 1.5; color: #e2f0d9; white-space: pre-line;">${sis.ia_pontos_fortes || 'Narrativa dinâmica e fácil adaptação.'}</p>
                        </div>
                        <div style="background: rgba(16, 42, 67, 0.5); padding: 12px; border-radius: 8px; border-left: 4px solid #ff6b6b;">
                            <strong style="color: #ff6b6b; display: block; margin-bottom: 6px;">Pontos Fracos: *</strong>
                            <p style="font-size: 13.5px; line-height: 1.5; color: #ffd8d8; white-space: pre-line;">${sis.ia_pontos_fracos || 'Pode exigir leitura atenta das regras básicas.'}</p>
                        </div>
                    </div>

                    <div style="background: rgba(16, 42, 67, 0.5); padding: 12px; border-radius: 8px; border-left: 4px solid #ffd700; margin-bottom: 10px;">
                        <strong style="color: #ffd700; display: block; margin-bottom: 4px;">Dicas da IA para o Mestre: *</strong>
                        <p style="font-size: 13.5px; line-height: 1.5; color: #fff8db;">${sis.ia_dicas_mestre || 'Estimule a criatividade na elaboração de pistas e mapas dinâmicos.'}</p>
                    </div>

                    <small style="color: #8da4be; font-style: italic; display: block; font-size: 12px;">
                        * Informações geradas por IA. Sujeito a divergências dependendo do estilo de narrativa do Mestre.
                    </small>
                </div>

                <!-- SEÇÃO DE AQUISIÇÃO COM MOEDAS OU GRATUITO -->
                <div>
                    ${(() => {
                        const isGratuito = parseFloat(sis.preco) <= 0;
                        const linkEntrar = getPathAba('Entrar.html');
                        const linkCampanhas = getPathAba('Campanhas.html');

                        if (sis.adquirido) {
                            return `
                                <div style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid #10b981; border-radius: 12px; padding: 22px; text-align: center;">
                                    <h4 style="color: #10b981; font-size: 19px; margin-bottom: 8px;">✔ Sistema Adquirido em sua Biblioteca</h4>
                                    <p style="color: #e2e8f0; font-size: 14.5px; line-height: 1.5; margin-bottom: 16px;">
                                        Você já possui este livro de regras! Você pode acessar o documento oficial em PDF para leitura ou utilizá-lo para criar novas campanhas.
                                    </p>
                                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                                        ${sis.pdf_link ? `
                                            <a href="${sis.pdf_link}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); transition: transform 0.2s;">
                                                📖 Acessar / Ler Livro de Regras (PDF)
                                            </a>
                                        ` : ''}
                                        <a href="${linkCampanhas}" style="display: inline-flex; align-items: center; gap: 8px; background: #0284c7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4); transition: transform 0.2s;">
                                            ⚔️ Criar Campanha com este Sistema
                                        </a>
                                    </div>
                                </div>
                            `;
                        } else {
                            return `
                                <div style="background: rgba(0, 20, 45, 0.85); border: 1px solid rgba(128, 208, 255, 0.3); border-radius: 12px; padding: 22px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                                    <div>
                                        <span style="color: #94a3b8; font-size: 13.5px; display: block; margin-bottom: 4px;">Preço de Aquisição:</span>
                                        <strong style="color: #ffd700; font-size: 24px; font-weight: 800;">🪙 ${!isGratuito ? `${parseFloat(sis.preco).toFixed(2)} Moedas` : 'Gratuito'}</strong>
                                    </div>

                                    ${!usuario ? `
                                        <a href="${linkEntrar}" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: rgb(146, 228, 255); color: rgb(0, 30, 60); text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(146, 228, 255, 0.3); transition: transform 0.2s;">
                                            ${isGratuito ? '🎁 Entrar para Resgatar Grátis' : 'Entrar para Comprar'}
                                        </a>
                                    ` : `
                                        ${isGratuito ? `
                                            <button onclick="comprarDireto(${sis.id})" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; padding: 12px 28px; font-weight: bold; font-size: 16px; cursor: pointer; transition: transform 0.2s, background 0.2s; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); display: inline-flex; align-items: center; gap: 8px;">
                                                🎁 Resgatar Gratuitamente
                                            </button>
                                        ` : `
                                            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                                                <button onclick="abrirModalEnviarProposta(${sis.id}, '${sis.nome.replace(/'/g, "\\'")}', ${sis.preco})" style="background: rgba(2, 132, 199, 0.2); color: #80D0FF; border: 1px solid #0284c7; border-radius: 8px; padding: 12px 20px; font-weight: bold; font-size: 15px; cursor: pointer; transition: all 0.2s;">
                                                    💬 Fazer Proposta
                                                </button>
                                                <button onclick="comprarDireto(${sis.id})" style="background: #10b981; color: white; border: none; border-radius: 8px; padding: 12px 26px; font-weight: bold; font-size: 16px; cursor: pointer; transition: transform 0.2s, background 0.2s; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                                                    Comprar com Moedas
                                                </button>
                                            </div>
                                        `}
                                    `}
                                </div>
                            `;
                        }
                    })()}
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Comprar Direto usando Saldo ou Resgate Grátis
async function comprarDireto(sistemaId) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para adquirir sistemas.', 'erro');
        setTimeout(() => window.location.href = getPathAba('Entrar.html'), 1000);
        return;
    }

    try {
        const res = await Api.post('/api/moedas/comprar-sistema', {
            user_uuid: usuario.uuid,
            id_sistema: sistemaId,
            metodo_pagamento: 'moedas'
        });

        showNotification(res.mensagem, 'sucesso');
        usuario.moeda_virtual = res.saldo;
        AuthService.setUsuarioAtual(usuario);
        renderizarCabecalho(usuario);

        // Atualizar imediatamente o modal para exibir o status de Adquirido com o botão de PDF
        await abrirModalDetalhes(sistemaId);

        if (typeof filtrar === 'function') {
            filtrar();
        } else if (typeof carregarCatalogo === 'function') {
            carregarCatalogo();
        } else if (typeof carregarDestaques === 'function') {
            carregarDestaques();
        }
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Modal para Enviar Proposta (Requisitos 6 e 7)
function abrirModalEnviarProposta(sistemaId, sistemaNome, precoAtual) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para enviar uma proposta.', 'erro');
        setTimeout(() => window.location.href = getPathAba('Entrar.html'), 1000);
        return;
    }

    let modal = document.getElementById('modal-enviar-proposta');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-enviar-proposta';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 15, 30, 0.85); backdrop-filter: blur(8px);
            z-index: 10002; display: flex; align-items: center; justify-content: center; padding: 20px;
        `;
        document.body.appendChild(modal);
    }

    const valorSugerido = parseFloat(precoAtual) > 0 ? (parseFloat(precoAtual) * 0.8).toFixed(2) : '10.00';

    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, rgb(25, 28, 29) 0%, rgba(0, 49, 87, 0.98) 100%); border: 1px solid #80D0FF; border-radius: 16px; max-width: 540px; width: 100%; padding: 28px; color: white; position: relative;">
            <button onclick="document.getElementById('modal-enviar-proposta').style.display='none'" style="position: absolute; top: 15px; right: 18px; background: transparent; border: none; color: #80D0FF; font-size: 26px; cursor: pointer;">&times;</button>
            <h3 style="color: #80D0FF; font-size: 22px; margin-bottom: 8px;">💬 Enviar Proposta de Negociação</h3>
            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">
                Proponha condições personalizadas para: <strong style="color: white;">${sistemaNome}</strong> (Preço de tabela: 🪙 ${parseFloat(precoAtual).toFixed(2)})
            </p>

            <form onsubmit="submeterProposta(event, ${sistemaId})">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 14px; color: #80D0FF; margin-bottom: 6px;">Forma de Pagamento Proposta *</label>
                    <select id="prop-forma-pagamento" onchange="atualizarLabelValorProposta(this.value)" style="width: 100%; padding: 11px; background: rgba(0,20,40,0.9); border: 1px solid #004887; border-radius: 8px; color: white; font-size: 14px;">
                        <option value="PIX">⚡ PIX Instantâneo</option>
                        <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                        <option value="Moedas" selected>🪙 Moedas Virtuais (Saldo RPG Central)</option>
                        <option value="Outro / Negociação">🤝 Outro / Troca / Negociação Especial</option>
                    </select>
                </div>

                <div style="margin-bottom: 16px;">
                    <label id="prop-valor-label" style="display: block; font-size: 14px; color: #80D0FF; margin-bottom: 6px;">Valor Ofertado (Moedas 🪙) *</label>
                    <input type="number" id="prop-valor-input" step="0.5" min="0" value="${valorSugerido}" required style="width: 100%; padding: 11px; background: rgba(0,20,40,0.9); border: 1px solid #004887; border-radius: 8px; color: #ffd700; font-size: 16px; font-weight: bold;">
                </div>

                <div style="margin-bottom: 22px;">
                    <label style="display: block; font-size: 14px; color: #80D0FF; margin-bottom: 6px;">Mensagem / Justificativa da Oferta *</label>
                    <textarea id="prop-texto-input" rows="4" placeholder="Ex: Olá! Gostaria de oferecer este valor via PIX ou negociar um pacote especial para mestrar aos finais de semana..." required style="width: 100%; padding: 11px; background: rgba(0,20,40,0.9); border: 1px solid #004887; border-radius: 8px; color: white; font-size: 14px;"></textarea>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button type="submit" style="flex: 1; padding: 12px; background: #0284c7; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer;">Enviar Proposta</button>
                    <button type="button" onclick="document.getElementById('modal-enviar-proposta').style.display='none'" style="padding: 12px 20px; background: #334155; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer;">Cancelar</button>
                </div>
            </form>
        </div>
    `;
    modal.style.display = 'flex';
}

function atualizarLabelValorProposta(forma) {
    const label = document.getElementById('prop-valor-label');
    if (!label) return;
    if (forma.includes('PIX') || forma.includes('Cartão')) {
        label.innerHTML = `Valor Ofertado em Reais (R$) *`;
    } else if (forma.includes('Moedas')) {
        label.innerHTML = `Valor Ofertado (Moedas 🪙) *`;
    } else {
        label.innerHTML = `Valor Estimado / Equivalente *`;
    }
}

async function submeterProposta(e, sistemaId) {
    e.preventDefault();
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) return;

    const valor_oferecido = parseFloat(document.getElementById('prop-valor-input').value) || 0;
    const proposta_texto = document.getElementById('prop-texto-input').value.trim();
    const forma_pagamento = document.getElementById('prop-forma-pagamento')?.value || 'Moedas';

    try {
        const res = await Api.post('/api/propostas', {
            user_uuid: usuario.uuid,
            id_sistema: sistemaId,
            valor_oferecido,
            proposta_texto,
            forma_pagamento
        });

        showNotification(res.mensagem, 'sucesso');
        document.getElementById('modal-enviar-proposta').style.display = 'none';
        const modalDetalhes = document.getElementById('modal-detalhes-sistema');
        if (modalDetalhes) modalDetalhes.style.display = 'none';
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Modal para Visualizar Minhas Propostas (Requisito 7)
async function abrirModalMinhasPropostas() {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para ver suas propostas.', 'erro');
        setTimeout(() => window.location.href = getPathAba('Entrar.html'), 1000);
        return;
    }

    let modal = document.getElementById('modal-minhas-propostas');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-minhas-propostas';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 15, 30, 0.85); backdrop-filter: blur(8px);
            z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;
        `;
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, rgb(25, 28, 29) 0%, rgba(0, 49, 87, 0.98) 100%); border: 1px solid #80D0FF; border-radius: 18px; max-width: 750px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 28px; color: white; position: relative;">
            <button onclick="document.getElementById('modal-minhas-propostas').style.display='none'" style="position: absolute; top: 15px; right: 18px; background: transparent; border: none; color: #80D0FF; font-size: 26px; cursor: pointer;">&times;</button>
            <h3 style="color: #80D0FF; font-size: 24px; margin-bottom: 6px;">📋 Minhas Propostas Enviadas</h3>
            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">Acompanhe o retorno e as respostas da administração para suas ofertas.</p>

            <div id="conteudo-minhas-propostas">
                <p style="text-align: center; color: #80D0FF; padding: 20px;">Carregando suas propostas...</p>
            </div>
        </div>
    `;
    modal.style.display = 'flex';

    try {
        const data = await Api.get(`/api/propostas/usuario/${usuario.uuid}`);
        const propostas = data.propostas || [];
        const container = document.getElementById('conteudo-minhas-propostas');

        if (propostas.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; background: rgba(0,20,40,0.5); border-radius: 10px; border: 1px dashed rgba(128,208,255,0.3);">
                    <p style="color: #94a3b8; font-size: 15px;">Você ainda não enviou nenhuma proposta.</p>
                    <small style="color: #cbd5e1;">Você pode enviar ofertas personalizadas abrindo os detalhes de qualquer sistema no catálogo!</small>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex-direction: column; gap: 14px;">
                ${propostas.map(p => {
                    let statusCor = '#fbbf24';
                    let statusBg = 'rgba(251, 191, 36, 0.15)';
                    if (p.status.toLowerCase().includes('aceit')) {
                        statusCor = '#34d399';
                        statusBg = 'rgba(52, 211, 153, 0.15)';
                    } else if (p.status.toLowerCase().includes('recus') || p.status.toLowerCase().includes('rejeit')) {
                        statusCor = '#f87171';
                        statusBg = 'rgba(248, 113, 113, 0.15)';
                    }

                    const fp = (p.forma_pagamento || 'Moedas').toLowerCase();
                    let badgeForma = '<span style="background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid #fbbf24; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: bold; margin-left: 8px;">🪙 Moedas</span>';
                    let prefixoValor = '🪙';

                    if (fp.includes('pix')) {
                        badgeForma = '<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: bold; margin-left: 8px;">⚡ PIX</span>';
                        prefixoValor = 'R$';
                    } else if (fp.includes('cart')) {
                        badgeForma = '<span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid #c084fc; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: bold; margin-left: 8px;">💳 Cartão</span>';
                        prefixoValor = 'R$';
                    } else if (fp.includes('outro') || fp.includes('negoc')) {
                        badgeForma = '<span style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid #94a3b8; padding: 2px 8px; border-radius: 6px; font-size: 11.5px; font-weight: bold; margin-left: 8px;">🤝 Negociação</span>';
                        prefixoValor = 'Equiv.';
                    }

                    return `
                    <div style="background: rgba(0, 15, 30, 0.6); border: 1px solid rgba(0, 72, 135, 0.6); border-radius: 10px; padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div>
                                <strong style="color: white; font-size: 17px;">${p.sistema_nome}</strong>
                                <span style="color: #80D0FF; font-size: 13px; margin-left: 8px;">(${p.sistema_genero})</span>
                            </div>
                            <span style="background: ${statusBg}; color: ${statusCor}; border: 1px solid ${statusCor}; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                                ${p.status}
                            </span>
                        </div>

                        <div style="font-size: 13.5px; color: #cbd5e1; margin-bottom: 10px;">
                            Sua Proposta: "<em>${p.proposta_texto}</em>"
                            <span style="color: #ffd700; font-weight: bold; margin-left: 8px;">${prefixoValor} ${parseFloat(p.valor_oferecido).toFixed(2)}</span>
                            ${badgeForma}
                        </div>

                        <div style="background: rgba(0, 30, 60, 0.5); padding: 10px 12px; border-radius: 6px; border-left: 3px solid ${statusCor}; font-size: 13px; color: #e2e8f0; margin-bottom: 10px;">
                            <strong style="color: ${statusCor};">Resposta da Administração:</strong>
                            <p style="margin-top: 4px; margin-bottom: 0;">${p.resposta_admin || 'Aguardando retorno da equipe de moderação...'}</p>
                        </div>

                        <div style="display: flex; justify-content: flex-end; align-items: center; padding-top: 6px; border-top: 1px solid rgba(128, 208, 255, 0.15);">
                            <button onclick="excluirPropostaCliente(${p.id})" style="padding: 6px 14px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; border-radius: 6px; cursor: pointer; font-size: 12.5px; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239, 68, 68, 0.2)'; this.style.color='#fca5a5';">
                                🗑️ Excluir Proposta
                            </button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (err) {
        document.getElementById('conteudo-minhas-propostas').innerHTML = `<p style="color: #ff6b6b; text-align: center;">Erro ao carregar propostas: ${err.message}</p>`;
    }
}

async function excluirPropostaCliente(id) {
    if (!confirm('Deseja realmente excluir esta proposta?')) return;
    try {
        await Api.delete(`/api/propostas/${id}`);
        showNotification('Proposta excluída com sucesso!', 'sucesso');
        await abrirModalMinhasPropostas();
    } catch (err) {
        showNotification('Erro ao excluir proposta: ' + err.message, 'erro');
    }
}
window.excluirPropostaCliente = excluirPropostaCliente;

// ==========================================
// CHECKOUT MULTI-MÉTODO: PIX, CARTÃO E MOEDAS
// ==========================================
let checkoutSistemaAtual = null;

async function abrirModalCheckout(sistemaId) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login para prosseguir com a compra.', 'erro');
        setTimeout(() => window.location.href = getPathAba('Entrar.html'), 1000);
        return;
    }

    try {
        const data = await Api.get(`/api/sistemas/${sistemaId}?user_uuid=${usuario.uuid}`);
        const sis = data.sistema;
        checkoutSistemaAtual = sis;

        if (sis.adquirido) {
            showNotification('Você já possui este sistema em sua biblioteca!', 'aviso');
            return;
        }

        // Se o sistema for gratuito, resgatar diretamente sem exibir tela de cobrança
        if (parseFloat(sis.preco) <= 0) {
            await comprarDireto(sistemaId);
            return;
        }

        let modal = document.getElementById('modal-checkout-pagamento');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-checkout-pagamento';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 15, 30, 0.88); backdrop-filter: blur(8px);
                z-index: 10005; display: flex; align-items: center; justify-content: center; padding: 20px;
            `;
            document.body.appendChild(modal);
        }

        const precoNum = parseFloat(sis.preco);
        const precoFormatado = precoNum.toFixed(2);
        const saldoUsuario = parseFloat(usuario.moeda_virtual || 0);
        const temSaldoMoedas = saldoUsuario >= precoNum;

        // Código PIX aleatório simulado
        const chavePixFicticia = `00020126580014br.gov.bcb.pix0136rpgcentral-${sis.id}-${Date.now()}520400005303986540${precoFormatado}5802BR5915RPG_CENTRAL_SISTEMAS6007PELOTAS62070503***6304`;

        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, rgb(25, 28, 29) 0%, rgba(0, 49, 87, 0.98) 100%); border: 1.5px solid #80D0FF; border-radius: 18px; max-width: 650px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 30px; color: white; position: relative;">
                <button onclick="document.getElementById('modal-checkout-pagamento').style.display='none'" style="position: absolute; top: 16px; right: 20px; background: transparent; border: none; color: #80D0FF; font-size: 28px; cursor: pointer;">&times;</button>

                <!-- Resumo do Item -->
                <div style="display: flex; gap: 18px; align-items: center; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 1px solid rgba(128, 208, 255, 0.25);">
                    <img src="${sis.imagemcapa_link || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" style="width: 75px; height: 95px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(128,208,255,0.4);">
                    <div style="flex: 1;">
                        <span style="font-size: 12px; color: #80D0FF; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Checkout Seguro RPG Central</span>
                        <h3 style="font-size: 22px; color: white; margin: 4px 0;">${sis.nome}</h3>
                        <div style="display: flex; gap: 15px; align-items: center; margin-top: 4px;">
                            <span style="color: #ffd700; font-size: 19px; font-weight: 800;">🪙 ${precoFormatado}</span>
                            <span style="color: #94a3b8; font-size: 14px;">(ou R$ ${precoFormatado} à vista)</span>
                        </div>
                    </div>
                </div>

                <!-- Seletor de Abas de Pagamento -->
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 14px; color: #80D0FF; font-weight: 700; margin-bottom: 10px;">Selecione a Forma de Pagamento:</label>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                        <button id="tab-btn-moedas" onclick="trocarAbaPagamento('moedas')" style="padding: 12px 8px; background: rgba(234, 179, 8, 0.2); border: 2px solid #eab308; border-radius: 10px; color: white; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <span style="font-size: 20px;">🪙</span>
                            <span>Moedas da Conta</span>
                        </button>
                        <button id="tab-btn-pix" onclick="trocarAbaPagamento('pix')" style="padding: 12px 8px; background: rgba(0, 30, 60, 0.6); border: 1px solid rgba(128, 208, 255, 0.3); border-radius: 10px; color: #94a3b8; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <span style="font-size: 20px;">⚡</span>
                            <span>PIX Instantâneo</span>
                        </button>
                        <button id="tab-btn-cartao" onclick="trocarAbaPagamento('cartao')" style="padding: 12px 8px; background: rgba(0, 30, 60, 0.6); border: 1px solid rgba(128, 208, 255, 0.3); border-radius: 10px; color: #94a3b8; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <span style="font-size: 20px;">💳</span>
                            <span>Cartão de Crédito</span>
                        </button>
                    </div>
                </div>

                <!-- CONTEÚDO 1: MOEDAS DA CONTA (PADRÃO) -->
                <div id="conteudo-pag-moedas" style="display: block; background: rgba(0, 20, 45, 0.7); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 22px; text-align: center;">
                    <div style="font-size: 14px; color: #ffd700; font-weight: bold; margin-bottom: 12px;">🪙 Pagamento com Saldo de Moedas (Padrão RPG Central)</div>
                    <div style="background: rgba(0,0,0,0.4); border-radius: 10px; padding: 16px; margin-bottom: 16px;">
                        <span style="font-size: 13px; color: #94a3b8; display: block; margin-bottom: 4px;">Seu Saldo Atual:</span>
                        <strong style="color: #ffd700; font-size: 26px;">🪙 ${saldoUsuario.toFixed(2)}</strong>
                    </div>
                    <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 18px;">
                        Custo do Sistema: <strong style="color: white;">🪙 ${precoFormatado}</strong><br>
                        Saldo restante após a compra: <strong style="color: ${temSaldoMoedas ? '#34d399' : '#f87171'};">🪙 ${temSaldoMoedas ? (saldoUsuario - precoNum).toFixed(2) : 'Saldo Insuficiente'}</strong>
                    </p>
                    ${temSaldoMoedas ? `
                        <button onclick="confirmarPagamentoCheckout('moedas')" style="width: 100%; padding: 14px; background: #eab308; color: #001224; border: none; border-radius: 10px; font-weight: 800; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(234,179,8,0.4);">
                            🪙 Confirmar Compra com Moedas
                        </button>
                    ` : `
                        <div style="background: rgba(239,68,68,0.15); border: 1px solid #ef4444; border-radius: 8px; padding: 12px; color: #f87171; font-size: 13.5px; margin-bottom: 12px;">
                            Você não possui moedas suficientes para esta compra. Você pode pagar via <strong>PIX</strong>, <strong>Cartão</strong> ou <strong>Enviar uma Proposta</strong>!
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <button onclick="trocarAbaPagamento('pix')" style="padding: 10px 18px; background: #0284c7; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
                                Pagar via PIX ➔
                            </button>
                            <button onclick="document.getElementById('modal-checkout-pagamento').style.display='none'; abrirModalEnviarProposta(${sis.id}, '${sis.nome.replace(/'/g, "\\'")}', ${sis.preco});" style="padding: 10px 18px; background: rgba(56, 189, 248, 0.2); color: #80D0FF; border: 1px solid #38bdf8; border-radius: 8px; font-weight: bold; cursor: pointer;">
                                💬 Enviar Proposta
                            </button>
                        </div>
                    `}
                </div>

                <!-- CONTEÚDO 2: PIX -->
                <div id="conteudo-pag-pix" style="display: none; background: rgba(0, 20, 45, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 22px; text-align: center;">
                    <div style="font-size: 14px; color: #38bdf8; font-weight: bold; margin-bottom: 12px;">⚡ Pagamento via PIX Instantâneo</div>
                    <div style="background: white; width: 170px; height: 170px; margin: 0 auto 15px auto; padding: 10px; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                        <!-- QR Code Ilustrativo SVG -->
                        <svg viewBox="0 0 100 100" width="150" height="150">
                            <rect x="0" y="0" width="30" height="30" fill="#000"/>
                            <rect x="5" y="5" width="20" height="20" fill="#fff"/>
                            <rect x="10" y="10" width="10" height="10" fill="#000"/>
                            <rect x="70" y="0" width="30" height="30" fill="#000"/>
                            <rect x="75" y="5" width="20" height="20" fill="#fff"/>
                            <rect x="80" y="10" width="10" height="10" fill="#000"/>
                            <rect x="0" y="70" width="30" height="30" fill="#000"/>
                            <rect x="5" y="75" width="20" height="20" fill="#fff"/>
                            <rect x="10" y="80" width="10" height="10" fill="#000"/>
                            <rect x="40" y="15" width="20" height="10" fill="#000"/>
                            <rect x="40" y="40" width="20" height="20" fill="#000"/>
                            <rect x="15" y="45" width="15" height="15" fill="#000"/>
                            <rect x="70" y="45" width="15" height="25" fill="#000"/>
                            <rect x="40" y="70" width="25" height="20" fill="#000"/>
                            <rect x="75" y="80" width="15" height="10" fill="#000"/>
                        </svg>
                    </div>
                    <p style="font-size: 13.5px; color: #cbd5e1; margin-bottom: 12px;">Escaneie o código QR com o app do seu banco ou use a chave Copia e Cola:</p>
                    <div style="display: flex; gap: 8px; margin-bottom: 18px;">
                        <input type="text" id="input-chave-pix" value="${chavePixFicticia}" readonly style="flex: 1; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #004887; border-radius: 6px; color: #94a3b8; font-size: 12px; font-family: monospace;">
                        <button onclick="copiarChavePix()" style="padding: 10px 14px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 13px;">Copiar</button>
                    </div>
                    <button onclick="confirmarPagamentoCheckout('pix')" style="width: 100%; padding: 14px; background: #10b981; color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(16,185,129,0.4);">
                        ⚡ Confirmar Pagamento PIX (R$ ${precoFormatado})
                    </button>
                </div>

                <!-- CONTEÚDO 3: CARTÃO DE CRÉDITO -->
                <div id="conteudo-pag-cartao" style="display: none; background: rgba(0, 20, 45, 0.7); border: 1px solid rgba(128, 208, 255, 0.3); border-radius: 12px; padding: 22px;">
                    <div style="font-size: 14px; color: #80D0FF; font-weight: bold; margin-bottom: 14px;">💳 Pagamento com Cartão de Crédito ou Débito</div>
                    <form onsubmit="event.preventDefault(); confirmarPagamentoCheckout('cartao');">
                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-size: 13px; color: #80D0FF; margin-bottom: 5px;">Número do Cartão *</label>
                            <input type="text" id="checkout-cartao-num" placeholder="4532 •••• •••• 8910" required maxlength="19" value="4532 8901 2345 6789" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #004887; border-radius: 6px; color: white; font-family: monospace; font-size: 15px;">
                        </div>
                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-size: 13px; color: #80D0FF; margin-bottom: 5px;">Nome Impresso no Cartão *</label>
                            <input type="text" id="checkout-cartao-nome" placeholder="NOME COMO NO CARTÃO" required value="${usuario.nome_usuario.toUpperCase()}" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #004887; border-radius: 6px; color: white; font-size: 14px; text-transform: uppercase;">
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                            <div>
                                <label style="display: block; font-size: 13px; color: #80D0FF; margin-bottom: 5px;">Validade (MM/AA) *</label>
                                <input type="text" id="checkout-cartao-val" placeholder="12/28" required maxlength="5" value="12/28" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #004887; border-radius: 6px; color: white; text-align: center;">
                            </div>
                            <div>
                                <label style="display: block; font-size: 13px; color: #80D0FF; margin-bottom: 5px;">CVV *</label>
                                <input type="password" id="checkout-cartao-cvv" placeholder="•••" required maxlength="4" value="789" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #004887; border-radius: 6px; color: white; text-align: center;">
                            </div>
                        </div>
                        <div style="margin-bottom: 18px;">
                            <label style="display: block; font-size: 13px; color: #80D0FF; margin-bottom: 5px;">Parcelamento</label>
                            <select style="width: 100%; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #004887; border-radius: 6px; color: white; font-size: 14px;">
                                <option value="1">1x de R$ ${precoFormatado} (Sem juros)</option>
                                <option value="2">2x de R$ ${(precoNum / 2).toFixed(2)} (Sem juros)</option>
                                <option value="3">3x de R$ ${(precoNum / 3).toFixed(2)} (Sem juros)</option>
                            </select>
                        </div>
                        <button type="submit" style="width: 100%; padding: 14px; background: #0284c7; color: white; border: none; border-radius: 10px; font-weight: 800; font-size: 16px; cursor: pointer; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                            💳 Pagar com Cartão (R$ ${precoFormatado})
                        </button>
                    </form>
                </div>
            </div>
        `;
        modal.style.display = 'flex';
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

function trocarAbaPagamento(aba) {
    const btnPix = document.getElementById('tab-btn-pix');
    const btnCartao = document.getElementById('tab-btn-cartao');
    const btnMoedas = document.getElementById('tab-btn-moedas');

    const boxPix = document.getElementById('conteudo-pag-pix');
    const boxCartao = document.getElementById('conteudo-pag-cartao');
    const boxMoedas = document.getElementById('conteudo-pag-moedas');

    if (!btnPix || !btnCartao || !btnMoedas) return;

    // Reset styles
    [btnPix, btnCartao, btnMoedas].forEach(btn => {
        btn.style.background = 'rgba(0, 30, 60, 0.6)';
        btn.style.borderColor = 'rgba(128, 208, 255, 0.3)';
        btn.style.color = '#94a3b8';
    });

    [boxPix, boxCartao, boxMoedas].forEach(box => box.style.display = 'none');

    if (aba === 'pix') {
        btnPix.style.background = 'rgba(56, 189, 248, 0.2)';
        btnPix.style.borderColor = '#38bdf8';
        btnPix.style.color = 'white';
        boxPix.style.display = 'block';
    } else if (aba === 'cartao') {
        btnCartao.style.background = 'rgba(2, 132, 199, 0.25)';
        btnCartao.style.borderColor = '#0284c7';
        btnCartao.style.color = 'white';
        boxCartao.style.display = 'block';
    } else if (aba === 'moedas') {
        btnMoedas.style.background = 'rgba(234, 179, 8, 0.2)';
        btnMoedas.style.borderColor = '#eab308';
        btnMoedas.style.color = 'white';
        boxMoedas.style.display = 'block';
    }
}

function copiarChavePix() {
    const input = document.getElementById('input-chave-pix');
    if (input) {
        input.select();
        navigator.clipboard.writeText(input.value);
        showNotification('Código PIX Copia e Cola copiado!', 'sucesso');
    }
}

async function confirmarPagamentoCheckout(metodo) {
    if (!checkoutSistemaAtual) return;
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) return;

    try {
        const body = {
            user_uuid: usuario.uuid,
            id_sistema: checkoutSistemaAtual.id,
            metodo_pagamento: metodo
        };

        if (metodo === 'cartao') {
            const numCartao = document.getElementById('checkout-cartao-num') ? document.getElementById('checkout-cartao-num').value : '';
            body.detalhes_pagamento = { numero_cartao: numCartao };
        }

        const res = await Api.post('/api/moedas/comprar-sistema', body);

        showNotification(res.mensagem, 'sucesso');

        if (metodo === 'moedas') {
            usuario.moeda_virtual = res.saldo;
            AuthService.setUsuarioAtual(usuario);
            renderizarCabecalho(usuario);
        }

        // Fechar modais
        const modalCheckout = document.getElementById('modal-checkout-pagamento');
        if (modalCheckout) modalCheckout.style.display = 'none';

        const modalDetalhes = document.getElementById('modal-detalhes-sistema');
        if (modalDetalhes) modalDetalhes.style.display = 'none';

        // Atualizar listagens
        if (typeof filtrar === 'function') {
            filtrar();
        } else if (typeof carregarCatalogo === 'function') {
            carregarCatalogo();
        } else if (typeof carregarSistemas === 'function') {
            carregarSistemas();
        }
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Redirecionamento Direto para a Loja Oficial de Moedas (sem modal flutuante)
function abrirModalRecargaMoedas() {
    window.location.href = getPathAba('Loja_de_moedas.html');
}

async function processarRecarga(qtd, valorReais, pacoteNome) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) return;

    try {
        const res = await Api.post('/api/moedas/recarregar', {
            user_uuid: usuario.uuid,
            quantidade: qtd,
            pacote_nome: `${pacoteNome} (R$ ${valorReais.toFixed(2)})`,
            metodo_pagamento: 'PIX/Cartao'
        });

        showNotification(res.mensagem, 'sucesso');
        usuario.moeda_virtual = res.saldo;
        AuthService.setUsuarioAtual(usuario);
        renderizarCabecalho(usuario);

        const modal = document.getElementById('modal-recarga-moedas');
        if (modal) modal.style.display = 'none';
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

// Tornar funções globais para chamadas nos botões inline
window.abrirModalDetalhes = abrirModalDetalhes;
window.comprarDireto = comprarDireto;
window.abrirModalEnviarProposta = abrirModalEnviarProposta;
window.submeterProposta = submeterProposta;
window.abrirModalMinhasPropostas = abrirModalMinhasPropostas;
window.abrirModalCheckout = abrirModalCheckout;
window.trocarAbaPagamento = trocarAbaPagamento;
window.copiarChavePix = copiarChavePix;
window.confirmarPagamentoCheckout = confirmarPagamentoCheckout;
window.abrirModalRecargaMoedas = abrirModalRecargaMoedas;
window.processarRecarga = processarRecarga;


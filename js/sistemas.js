// js/sistemas.js - Lógica do Catálogo de Sistemas e Loja de Livros de Regras
let filtroDestaque = false;
let filtroMeusSistemas = false;

document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    await carregarCatalogo();

    // Eventos de Busca e Filtros
    const btnPesquisar = document.getElementById('btn-busca');
    const inputBusca = document.getElementById('input-busca');
    const selectGenero = document.getElementById('select-genero');
    const btnDestaques = document.getElementById('btn-destaques');
    const btnMeusSistemas = document.getElementById('btn-meus-sistemas');

    if (btnPesquisar) {
        btnPesquisar.addEventListener('click', () => filtrar());
    }
    if (inputBusca) {
        inputBusca.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') filtrar();
        });
    }
    if (selectGenero) {
        selectGenero.addEventListener('change', () => filtrar());
    }
    if (btnDestaques) {
        btnDestaques.addEventListener('click', () => {
            filtroDestaque = !filtroDestaque;
            btnDestaques.style.background = filtroDestaque ? '#80D0FF' : 'rgb(146, 228, 255)';
            filtrar();
        });
    }
    if (btnMeusSistemas) {
        btnMeusSistemas.addEventListener('click', () => {
            const u = AuthService.getUsuarioAtual();
            if (!u) {
                showNotification('Faça login para ver os sistemas da sua biblioteca.', 'erro');
                setTimeout(() => window.location.href = 'Entrar.html', 1000);
                return;
            }
            filtroMeusSistemas = !filtroMeusSistemas;
            btnMeusSistemas.classList.toggle('ativo', filtroMeusSistemas);
            btnMeusSistemas.textContent = filtroMeusSistemas ? '✔ Exibindo Meus Sistemas' : 'Meus Sistemas';
            filtrar();
        });
    }
});

function filtrar() {
    const search = document.getElementById('input-busca') ? document.getElementById('input-busca').value.trim() : '';
    const genero = document.getElementById('select-genero') ? document.getElementById('select-genero').value : 'Todos';
    carregarCatalogo({ search, genero, destaque: filtroDestaque, apenas_adquiridos: filtroMeusSistemas });
}

async function carregarCatalogo(filtros = {}) {
    const grid = document.getElementById('grid-sistemas-catalogo');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #80D0FF; padding: 40px;">Carregando sistemas...</div>`;

    try {
        const usuario = AuthService.getUsuarioAtual();
        const queryParams = new URLSearchParams();
        if (usuario) queryParams.append('user_uuid', usuario.uuid);
        if (filtros.search) queryParams.append('search', filtros.search);
        if (filtros.genero && filtros.genero !== 'Todos') queryParams.append('genero', filtros.genero);
        if (filtros.destaque) queryParams.append('destaque', '1');
        if (filtros.apenas_adquiridos) queryParams.append('apenas_adquiridos', '1');

        const data = await Api.get(`/api/sistemas?${queryParams.toString()}`);
        const sistemas = data.sistemas || [];

        if (sistemas.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: #c3eeff; padding: 40px; background: rgba(0, 30, 60, 0.4); border-radius: 12px; border: 1px dashed rgba(128,208,255,0.3);">
                    <p style="font-size: 16px; margin-bottom: 8px;">Nenhum sistema encontrado com os filtros aplicados.</p>
                    ${filtros.apenas_adquiridos ? '<small style="color: #94a3b8;">Você ainda não adquiriu nenhum sistema. Desative o filtro "Meus Sistemas" para explorar os livros à venda!</small>' : ''}
                </div>
            `;
            return;
        }

        grid.innerHTML = sistemas.map(s => {
            const jaPossui = s.adquirido === 1;

            return `
                <div class="card-sistema">
                    ${jaPossui ? `
                        <div class="badge-adquirido">
                            ✔ Adquirido
                        </div>
                    ` : ''}

                    ${s.destaque ? `
                        <div style="position: absolute; top: 12px; right: 12px; background: rgba(0, 48, 92, 0.9); color: #ffd700; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: bold; border: 1px solid #ffd700; z-index: 2;">
                            ★ Destaque
                        </div>
                    ` : ''}

                    <div class="card-sistema-capa">
                        <img src="${s.imagemcapa_link || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" alt="${s.nome}">
                    </div>

                    <div class="card-sistema-corpo">
                        <div>
                            <h3>${s.nome}</h3>
                            <p class="genero">🎭 ${s.genero}</p>
                            <p style="font-size: 11.5px; color: #7dd3fc; margin: 3px 0 6px 0; display: flex; align-items: center; gap: 4px;">
                                <span>📄</span> Livro de Regras em PDF
                            </p>
                            <p class="preco">🪙 ${parseFloat(s.preco) > 0 ? `${parseFloat(s.preco).toFixed(2)} Moedas` : 'Gratuito'}</p>
                        </div>
                        <div class="card-botoes">
                            <button class="btn-detalhes-sis" onclick="abrirModalDetalhes(${s.id})">Detalhes</button>
                            ${jaPossui ? `
                                <button class="btn-adquirido-sis" onclick="abrirModalDetalhes(${s.id})">✔ Na Biblioteca</button>
                            ` : `
                                <button class="btn-comprar-sis" style="${parseFloat(s.preco) <= 0 ? 'background: #10b981; border-color: #10b981;' : ''}" onclick="${parseFloat(s.preco) <= 0 ? `comprarDireto(${s.id})` : `abrirModalCheckout(${s.id})`}">
                                    ${parseFloat(s.preco) <= 0 ? '🎁 Obter Grátis' : 'Comprar'}
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff6b6b; padding: 30px;">Erro ao carregar acervo.</div>`;
    }
}

window.filtrar = filtrar;
window.carregarCatalogo = carregarCatalogo;

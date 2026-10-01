// js/propostas.js - Listagem de Propostas do Usuário Logado (Requisito 7)
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    if (!usuario) {
        document.getElementById('container-conteudo-propostas').innerHTML = `
            <div style="text-align: center; padding: 60px 20px; background: #0e1e2d; border-radius: 16px; border: 1px solid #1a3349;">
                <h3 style="color: #ffd700; font-size: 22px; margin-bottom: 12px;">Faça login para ver suas propostas</h3>
                <p style="color: #c3eeff; margin-bottom: 20px;">Você precisa estar conectado para acessar o histórico de propostas enviadas e respostas.</p>
                <a href="Entrar.html" style="background: rgb(146, 228, 255); color: rgb(0, 30, 60); text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: bold;">Fazer Login</a>
            </div>
        `;
        return;
    }

    await carregarMinhasPropostas(usuario.uuid);
});

async function carregarMinhasPropostas(uuid) {
    const tbody = document.getElementById('tbody-propostas');
    if (!tbody) return;

    try {
        const data = await Api.get(`/api/propostas/usuario/${uuid}`);
        const propostas = data.propostas || [];

        if (propostas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: #80D0FF; padding: 40px;">
                        Você ainda não enviou propostas para nenhum sistema. <a href="Sistemas.html" style="color: #ffd700;">Explore nosso acervo!</a>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = propostas.map(p => {
            let statusClass = 'aguardando';
            if (p.status.toLowerCase().includes('aceit')) statusClass = 'aceita';
            if (p.status.toLowerCase().includes('recus') || p.status.toLowerCase().includes('rejeit')) statusClass = 'recusada';

            const dataEnvioFmt = p.data_envio ? new Date(p.data_envio).toLocaleDateString('pt-BR') : '';

            return `
                <tr>
                    <td style="width: 250px;">
                        <strong style="color: white; font-size: 16px; display: block; margin-bottom: 4px;">${p.sistema_nome}</strong>
                        <span style="color: #80D0FF; font-size: 13px;">Gênero: ${p.sistema_genero}</span><br>
                        <span style="color: #ffd700; font-size: 13.5px; font-weight: bold;">Catálogo: 🪙 ${parseFloat(p.sistema_preco || 0).toFixed(2)} Moedas</span>
                    </td>
                    <td style="width: 110px; text-align: center;">
                        <img src="${p.imagemcapa_link || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" class="proposta-sistema-foto" alt="${p.sistema_nome}">
                    </td>
                    <td>
                        <p style="color: white; font-size: 15px; margin-bottom: 8px; line-height: 1.5;">${p.proposta_texto}</p>
                        <div style="font-size: 13px; color: #94a3b8;">
                            Oferecido: <strong style="color: #ffd700;">🪙 ${parseFloat(p.valor_oferecido || 0).toFixed(2)}</strong> | Enviado em: ${dataEnvioFmt}
                        </div>
                    </td>
                    <td style="width: 280px;">
                        <div style="margin-bottom: 8px;">
                            <span class="tag-status ${statusClass}">${p.status}</span>
                        </div>
                        <p style="color: #cbd5e1; font-size: 13.5px; line-height: 1.4; background: rgba(0, 15, 30, 0.4); padding: 10px; border-radius: 8px; border: 1px solid rgba(128,208,255,0.15); margin-bottom: 8px;">
                            ${p.resposta_admin || 'Aguardando avaliação dos moderadores...'}
                        </p>
                        <div style="text-align: right;">
                            <button onclick="excluirPropostaCliente(${p.id})" style="padding: 5px 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='rgba(239, 68, 68, 0.2)'; this.style.color='#fca5a5';">
                                🗑️ Excluir Proposta
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ff6b6b; padding: 30px;">Erro ao carregar propostas.</td></tr>`;
    }
}

async function excluirPropostaCliente(id) {
    if (!confirm('Deseja realmente excluir esta proposta?')) return;
    try {
        await Api.delete(`/api/propostas/${id}`);
        showNotification('Proposta excluída com sucesso!', 'sucesso');
        const usuario = AuthService.getUsuarioAtual();
        if (usuario) carregarMinhasPropostas(usuario.uuid);
    } catch (err) {
        showNotification('Erro ao excluir proposta: ' + err.message, 'erro');
    }
}
window.excluirPropostaCliente = excluirPropostaCliente;

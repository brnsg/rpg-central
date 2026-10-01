// js/moedas.js - Lógica da Loja de Moedas Virtuais
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);
    atualizarSaldoInterface(usuario);
});

function atualizarSaldoInterface(usuario) {
    const saldoTxt = document.getElementById('saldo-atual-loja');
    if (!saldoTxt) return;

    if (usuario) {
        saldoTxt.textContent = parseFloat(usuario.moeda_virtual || 0).toFixed(2);
    } else {
        saldoTxt.textContent = '0.00 (Faça Login)';
    }
}

async function comprarPacote(quantidade, precoReal, nomePacote) {
    const usuario = AuthService.getUsuarioAtual();
    if (!usuario) {
        showNotification('Faça login na sua conta para recarregar moedas.', 'erro');
        setTimeout(() => window.location.href = 'Entrar.html', 1200);
        return;
    }

    try {
        const res = await Api.post('/api/moedas/recarregar', {
            user_uuid: usuario.uuid,
            quantidade,
            pacote_nome: `${nomePacote} (R$ ${precoReal})`
        });

        showNotification(res.mensagem, 'sucesso');
        usuario.moeda_virtual = res.saldo;
        AuthService.setUsuarioAtual(usuario);
        atualizarSaldoInterface(usuario);
        renderizarCabecalho(usuario);
    } catch (err) {
        showNotification(err.message, 'erro');
    }
}

window.comprarPacote = comprarPacote;

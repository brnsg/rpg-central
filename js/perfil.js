// js/perfil.js - Gerenciamento e Edição de Perfil do Usuário
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    if (!usuario) {
        showNotification('Faça login para acessar suas configurações de perfil.', 'erro');
        setTimeout(() => window.location.href = 'Entrar.html', 1000);
        return;
    }

    preencherCamposPerfil(usuario);

    // Evento de preview do avatar
    const inputFoto = document.getElementById('perfil-foto');
    if (inputFoto) {
        inputFoto.addEventListener('input', () => {
            atualizarPreviewAvatar(inputFoto.value.trim());
        });
    }

    // Formulário de Salvar
    const formPerfil = document.getElementById('form-editar-perfil');
    if (formPerfil) {
        formPerfil.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome_usuario = document.getElementById('perfil-nome').value.trim();
            const cidade = document.getElementById('perfil-cidade').value.trim();
            const fotoperfil_link = document.getElementById('perfil-foto').value.trim();
            const nova_senha = document.getElementById('perfil-nova-senha').value;

            try {
                const res = await Api.put(`/api/auth/me/${usuario.uuid}`, {
                    nome_usuario,
                    cidade,
                    fotoperfil_link: fotoperfil_link || 'avatar_padrao.svg',
                    nova_senha
                });

                showNotification(res.mensagem, 'sucesso');
                AuthService.setUsuarioAtual(res.usuario);
                renderizarCabecalho(res.usuario);
                preencherCamposPerfil(res.usuario);
            } catch (err) {
                showNotification(err.message, 'erro');
            }
        });
    }

    // Botão de Deletar Conta
    const btnDeletar = document.getElementById('btn-deletar-conta');
    if (btnDeletar) {
        btnDeletar.addEventListener('click', async () => {
            const confirmacao = confirm('ATENÇÃO: Deseja realmente excluir sua conta definitivamente?\nEsta ação é irreversível e removerá todas as suas propostas, personagens e dados.');
            if (!confirmacao) return;

            try {
                const res = await Api.delete(`/api/auth/me/${usuario.uuid}`);
                showNotification(res.mensagem, 'sucesso');
                AuthService.clearCliente();
                setTimeout(() => window.location.href = '../index.html', 1200);
            } catch (err) {
                showNotification(err.message, 'erro');
            }
        });
    }
});

function preencherCamposPerfil(usuario) {
    document.getElementById('perfil-nome').value = usuario.nome_usuario || '';
    document.getElementById('perfil-email').value = usuario.email || '';
    document.getElementById('perfil-cidade').value = usuario.cidade || '';
    document.getElementById('perfil-foto').value = (usuario.fotoperfil_link && usuario.fotoperfil_link !== 'avatar_padrao.svg' && !usuario.fotoperfil_link.includes('unsplash')) ? usuario.fotoperfil_link : '';
    document.getElementById('perfil-saldo-txt').textContent = parseFloat(usuario.moeda_virtual || 0).toFixed(2);
    document.getElementById('perfil-uuid-txt').textContent = usuario.uuid || '';

    atualizarPreviewAvatar(usuario.fotoperfil_link);
}

function atualizarPreviewAvatar(url) {
    const preview = document.getElementById('perfil-avatar-img');
    if (!preview) return;

    if (!url || url === 'avatar_padrao.svg' || url.includes('unsplash')) {
        preview.src = '../avatar_padrao.svg';
    } else {
        preview.src = url;
    }
}

function redefinirFotoPadrao() {
    document.getElementById('perfil-foto').value = '';
    atualizarPreviewAvatar('');
    showNotification('Foto redefinida para o avatar padrão do sistema!');
}

window.redefinirFotoPadrao = redefinirFotoPadrao;

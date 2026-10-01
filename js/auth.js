// js/auth.js - Autenticação, Registro e Gestão de LocalStorage (Requisito 5)
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = await AuthService.initCliente();
    renderizarCabecalho(usuario);

    // Formulário de Login
    const formLogin = document.getElementById('form-login-cliente');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const senha = document.getElementById('login-senha').value;
            const manterConectado = document.getElementById('manter-conectado').checked;

            try {
                const res = await Api.post('/api/auth/login', { email, senha });

                // Caso seja uma conta de Administrador
                if (res.isAdmin && res.admin) {
                    if (manterConectado) {
                        AuthService.setAdminUUID(res.admin.uuid);
                        AuthService.setClienteUUID(res.admin.uuid);
                    }
                    AuthService.setAdminAtual(res.admin);
                    AuthService.setUsuarioAtual(res.usuario);

                    showNotification(`Acesso administrativo autorizado! Bem-vindo(a), ${res.admin.nome_admin}.`, 'sucesso');
                    setTimeout(() => window.location.href = 'Admin_Dashboard.html', 800);
                    return;
                }

                const user = res.usuario;

                // REQUISITO 5: Salvar string UUID em LocalStorage se manter conectado
                if (manterConectado) {
                    AuthService.setClienteUUID(user.uuid);
                }
                AuthService.setUsuarioAtual(user);

                showNotification(`Bem-vindo de volta, ${user.nome_usuario}!`, 'sucesso');
                setTimeout(() => window.location.href = '../index.html', 800);
            } catch (err) {
                showNotification(err.message, 'erro');
            }
        });
    }

    // Formulário de Cadastro
    const formRegistro = document.getElementById('form-registro-cliente');
    if (formRegistro) {
        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome_usuario = document.getElementById('reg-nome').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const senha = document.getElementById('reg-senha').value;
            const cidade = document.getElementById('reg-cidade').value.trim();
            const fotoperfil_link = document.getElementById('reg-foto').value.trim();

            try {
                const res = await Api.post('/api/auth/register', {
                    nome_usuario,
                    email,
                    senha,
                    cidade,
                    fotoperfil_link
                });

                const user = res.usuario;
                AuthService.setClienteUUID(user.uuid);
                AuthService.setUsuarioAtual(user);

                showNotification('Conta criada com sucesso! Você recebeu 250 moedas de bônus.', 'sucesso');
                setTimeout(() => window.location.href = '../index.html', 1000);
            } catch (err) {
                showNotification(err.message, 'erro');
            }
        });
    }
});

function preencherDemo(email, senha) {
    const inputEmail = document.getElementById('login-email');
    const inputSenha = document.getElementById('login-senha');
    if (inputEmail && inputSenha) {
        inputEmail.value = email;
        inputSenha.value = senha;
    }
}

window.preencherDemo = preencherDemo;

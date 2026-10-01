// js/api.js - Camada de Serviços, Sessão e Comunicação REST do RPG Central
// Suporte transparente para backend no Render, Vercel ou Localhost
const API_BASE = (typeof window !== 'undefined' && (window.RENDER_API_URL || localStorage.getItem('RENDER_API_URL') || localStorage.getItem('RENDER_BACKEND_URL')))
    ? (window.RENDER_API_URL || localStorage.getItem('RENDER_API_URL') || localStorage.getItem('RENDER_BACKEND_URL')).replace(/\/$/, '')
    : '';

// Gerenciamento de Sessão do Cliente (Requisito 5: UUID salvo em localStorage)
const AuthService = {
    CLIENTE_KEY: 'clienteKey',
    ADMIN_KEY: 'adminKey',

    // Obter UUID salvo
    getClienteUUID() {
        return localStorage.getItem(this.CLIENTE_KEY);
    },

    // Salvar UUID ao marcar "Manter Conectado"
    setClienteUUID(uuid) {
        localStorage.setItem(this.CLIENTE_KEY, uuid);
    },

    // Limpar sessão
    clearCliente() {
        localStorage.removeItem(this.CLIENTE_KEY);
        sessionStorage.removeItem('usuarioAtual');
    },

    // Obter usuário da memória da sessão
    getUsuarioAtual() {
        const u = sessionStorage.getItem('usuarioAtual');
        return u ? JSON.parse(u) : null;
    },

    setUsuarioAtual(usuario) {
        sessionStorage.setItem('usuarioAtual', JSON.stringify(usuario));
    },

    // Inicializar e validar sessão do cliente (busca por UUID se existir)
    async initCliente() {
        const uuid = this.getClienteUUID();
        if (uuid) {
            try {
                const res = await fetch(`${API_BASE}/api/auth/me/${uuid}`);
                if (res.ok) {
                    const data = await res.json();
                    this.setUsuarioAtual(data.usuario);
                    return data.usuario;
                } else {
                    this.clearCliente();
                }
            } catch (err) {
                console.warn('Não foi possível restaurar sessão:', err);
            }
        }
        return this.getUsuarioAtual();
    },

    // Admin Session
    getAdminUUID() {
        return localStorage.getItem(this.ADMIN_KEY);
    },

    setAdminUUID(uuid) {
        localStorage.setItem(this.ADMIN_KEY, uuid);
    },

    clearAdmin() {
        localStorage.removeItem(this.ADMIN_KEY);
        sessionStorage.removeItem('adminAtual');
    },

    getAdminAtual() {
        const a = sessionStorage.getItem('adminAtual');
        return a ? JSON.parse(a) : null;
    },

    setAdminAtual(admin) {
        sessionStorage.setItem('adminAtual', JSON.stringify(admin));
    },

    async initAdmin() {
        const uuid = this.getAdminUUID();
        if (uuid) {
            try {
                const res = await fetch(`${API_BASE}/api/auth/admin/me/${uuid}`);
                if (res.ok) {
                    const data = await res.json();
                    this.setAdminAtual(data.admin);
                    return data.admin;
                } else {
                    this.clearAdmin();
                }
            } catch (err) {
                console.warn('Erro ao validar admin:', err);
            }
        }
        return this.getAdminAtual();
    }
};

// Requisições HTTP utilitárias com cabeçalho de autorização admin
const Api = {
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const adminUuid = AuthService.getAdminUUID();
        if (adminUuid) headers['x-admin-uuid'] = adminUuid;
        const clienteUuid = AuthService.getClienteUUID();
        if (clienteUuid) {
            headers['x-cliente-uuid'] = clienteUuid;
            headers['x-user-uuid'] = clienteUuid;
        }
        return headers;
    },

    async get(endpoint) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            headers: this.getHeaders()
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.erro || `Erro na requisição GET: ${res.status}`);
        }
        return res.json();
    },

    async post(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.erro || `Erro na requisição POST: ${res.status}`);
        }
        return json;
    },

    async put(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.erro || 'Erro no PUT');
        return json;
    },

    async patch(endpoint, data = {}) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.erro || 'Erro no PATCH');
        return json;
    },

    async delete(endpoint) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.erro || 'Erro no DELETE');
        return json;
    }
};

// Utilitário para exibir Toast / Notificações elegantes
function showNotification(mensagem, tipo = 'sucesso') {
    let container = document.getElementById('rpg-notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'rpg-notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const isError = tipo === 'erro';
    toast.style.cssText = `
        background: ${isError ? 'linear-gradient(135deg, #4a0c0c 0%, #8b1e1e 100%)' : 'linear-gradient(135deg, #0b3d2c 0%, #157347 100%)'};
        color: #fff;
        padding: 14px 22px;
        border-radius: 10px;
        border: 1px solid ${isError ? '#ff6b6b' : '#51cf66'};
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-size: 15px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    toast.innerHTML = `<span>${isError ? '⚠️' : '✨'}</span> <div>${mensagem}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Atualizar cabeçalho da página com base na sessão
function renderizarCabecalho(usuario) {
    const loginRegistroDiv = document.querySelector('.login__registro');
    const moedasDiv = document.querySelector('.moedas');
    const moedasSpan = document.getElementById('moedas_usuario');
    const menuList = document.querySelector('.botoes__menu ul li');

    // Verificar se estamos na raiz ou dentro da pasta abas/
    const isAbas = window.location.pathname.includes('/abas/');
    const basePath = isAbas ? '' : 'abas/';
    const rootPath = isAbas ? '../' : '';

    if (usuario) {
        // Obter URL correta da foto de perfil
        let fotoSrc = usuario.fotoperfil_link;
        if (!fotoSrc || fotoSrc === 'avatar_padrao.svg' || fotoSrc.includes('unsplash')) {
            fotoSrc = `${rootPath}avatar_padrao.svg`;
        }

        // Adicionar link para Perfil no menu de navegação apenas se ainda não existir nenhum link para Perfil
        if (menuList && !document.getElementById('menu-item-perfil') && !Array.from(menuList.querySelectorAll('a')).some(a => a.textContent.trim().toLowerCase() === 'perfil')) {
            const perfilLink = document.createElement('a');
            perfilLink.id = 'menu-item-perfil';
            perfilLink.href = `${basePath}Perfil.html`;
            perfilLink.textContent = 'Perfil';
            if (window.location.pathname.includes('Perfil.html')) {
                perfilLink.classList.add('active');
            }
            menuList.appendChild(perfilLink);
        }

        // Usuário logado: exibir avatar ampliado, nome clicável para perfil, Minhas Propostas (Slide 3 e 5), e botão Sair
        if (loginRegistroDiv) {
            loginRegistroDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <a href="${basePath}Perfil.html" title="Editar meu perfil" style="display: flex; align-items: center; gap: 10px; text-decoration: none;">
                        <img src="${fotoSrc}"
                             alt="Avatar" style="width: 44px; height: 44px; border-radius: 50%; border: 2.5px solid #80D0FF; object-fit: cover; background: #ffffff; box-shadow: 0 0 10px rgba(128, 208, 255, 0.4); transition: transform 0.2s;"
                             onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1.0)'">
                        <span style="color: #ffffff; font-weight: 700; font-size: 15px;">${usuario.nome_usuario}</span>
                    </a>
                    <a href="${basePath}Minhas_Propostas.html" style="padding: 7px 14px; background: rgba(2, 132, 199, 0.35); border: 1px solid #38bdf8; border-radius: 8px; color: #80D0FF; text-decoration: none; font-weight: 700; font-size: 13.5px; transition: 0.2s ease;">Minhas Propostas</a>
                    <button id="btn-logout" style="padding: 7px 15px; border: none; border-radius: 8px; background: #e03131; color: white; cursor: pointer; font-weight: 700; font-size: 14px; transition: 0.3s ease;">Sair</button>
                </div>
            `;

            document.getElementById('btn-logout').addEventListener('click', () => {
                AuthService.clearCliente();
                showNotification('Sessão encerrada com sucesso!');
                setTimeout(() => window.location.reload(), 800);
            });
        }

        // Exibir moedas com atalho direto para a Loja de Moedas Oficial
        if (moedasDiv) {
            moedasDiv.style.display = 'flex';
            moedasDiv.style.cursor = 'pointer';
            moedasDiv.title = 'Clique para acessar a Loja de Moedas';
            moedasDiv.onclick = (e) => {
                // Se o clique veio diretamente do botão ou do link de comprar, deixa navegar normalmente
                if (e.target.closest('.comprar') || e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                    return;
                }
                const destino = (typeof getPathAba === 'function') ? getPathAba('Loja_de_moedas.html') : 'abas/Loja_de_moedas.html';
                window.location.href = destino;
            };
        }
        if (moedasSpan) {
            moedasSpan.textContent = parseFloat(usuario.moeda_virtual || 0).toFixed(2);
        }

        // Atualizar links das boas vindas se existirem
        const boasVindasBotoes = document.querySelector('.boasvindas__botoes');
        if (boasVindasBotoes) {
            boasVindasBotoes.innerHTML = `
                <button class="entrar" onclick="window.location.href='${basePath}Sistemas.html'"><a href="${basePath}Sistemas.html">Ver Sistemas</a></button>
                <button class="registrar" onclick="window.location.href='${basePath}Personagens.html'"><a href="${basePath}Personagens.html">Meus Personagens</a></button>
            `;
        }
    } else {
        // Usuário deslogado
        if (loginRegistroDiv) {
            loginRegistroDiv.innerHTML = `
                <button class="entrar" onclick="window.location.href='${basePath}Entrar.html'"><a href="${basePath}Entrar.html">Entrar</a></button>
                <button class="registrar" onclick="window.location.href='${basePath}Registrar.html'"><a href="${basePath}Registrar.html">Registrar</a></button>
            `;
        }
        if (moedasDiv) {
            moedasDiv.style.display = 'none';
        }
    }
}

// Navegação global segura para botões de entrar e registrar em qualquer parte da interface
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.entrar, .registrar');
    if (btn) {
        const link = btn.querySelector('a') || (btn.tagName === 'A' ? btn : null);
        if (link && link.getAttribute('href') && !link.getAttribute('href').startsWith('#')) {
            window.location.href = link.href;
        }
    }
});

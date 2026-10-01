// ia_service.js - Módulo de Inteligência Artificial Oficial Google Gemini (Requisito 3)
// Integração direta com a API do Google Gemini (gemini-1.5-flash / gemini-2.0-flash)

const IMAGENS_TEMATICAS = {
    fantasia: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    scifi: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
    terror: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800'
};

function selecionarImagem(genero = '') {
    const g = genero.toLowerCase();
    if (g.includes('cyber') || g.includes('ficção') || g.includes('espaço') || g.includes('futur')) {
        return IMAGENS_TEMATICAS.scifi;
    }
    if (g.includes('terror') || g.includes('horror') || g.includes('sombri') || g.includes('vampir') || g.includes('paranormal')) {
        return IMAGENS_TEMATICAS.terror;
    }
    return IMAGENS_TEMATICAS.fantasia;
}

function getGeminiApiKey() {
    return process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
}

// Extrator robusto de JSON tolerante a markdown, truncamento ou texto envolvente
function extrairJsonSeguro(texto) {
    if (!texto) throw new Error('Resposta vazia da IA.');

    let limpo = texto.trim();
    // Remover blocos de código ```json ... ``` ou ``` ... ```
    limpo = limpo.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    // Tentar parse direto
    try {
        return JSON.parse(limpo);
    } catch (e1) {}

    // Buscar delimitadores { ... } mais externos
    const start = limpo.indexOf('{');
    const end = limpo.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        try {
            return JSON.parse(limpo.substring(start, end + 1));
        } catch (e2) {}
    }

    // Se o JSON foi cortado antes de fechar a última chave, tentar reparar fechando strings e chaves
    if (start !== -1) {
        let pedaco = limpo.substring(start);
        // Se termina com aspas abertas ou campo incompleto, tentar consertar
        const quotes = (pedaco.match(/"/g) || []).length;
        if (quotes % 2 !== 0) {
            pedaco += '"';
        }
        if (!pedaco.endsWith('}')) {
            pedaco += '}';
        }
        try {
            return JSON.parse(pedaco);
        } catch (e3) {}
    }

    throw new Error('Não foi possível interpretar o JSON retornado pela IA.');
}

// Consulta Oficial ao Google Gemini
async function consultarGemini(prompt) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('Chave GEMINI_API_KEY não encontrada no arquivo .env. Obtenha uma chave gratuita em: https://aistudio.google.com/app/apikey');
    }

    // Modelos ativos do Google Gemini (incluindo modelos padrão e os mais recentes)
    const modelos = [
        'gemini-flash-latest',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
    ];
    let ultimoErro = null;

    for (const modelo of modelos) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
            const payload = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json'
                }
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) {
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            } else {
                const msg = data.error?.message || `HTTP ${res.status}`;
                ultimoErro = new Error(`Google Gemini [${modelo}]: ${msg}`);
            }
        } catch (err) {
            ultimoErro = err;
        }
    }

    throw ultimoErro || new Error('Falha ao comunicar com a API do Google Gemini.');
}

// 1. Gerar Sistema Completo do Zero com a API do Google Gemini
async function gerarSistemaCompletoDoZero(temaOpcional = '') {
    const prompt = `Você é um game designer mestre de RPG de mesa e Inteligência Artificial.
Crie um sistema de RPG totalmente inédito, original e completo do zero ${temaOpcional ? `inspirado no tema: "${temaOpcional}"` : 'com tema e mecânicas surpreendentes'}.
Responda OBRIGATORIAMENTE em JSON puro no seguinte formato exato (sem blocos de código markdown adicionais ou texto fora do JSON):
{
  "nome": "Nome Épico do Sistema",
  "genero": "Gênero do RPG",
  "preco": 60,
  "descricao": "Sinopse épica e premissa do sistema em 2 a 3 frases envolventes.",
  "pontos_fortes": "• Ponto forte 1\\n• Ponto forte 2",
  "pontos_fracos": "• Ponto fraco 1\\n• Ponto fraco 2",
  "dicas_mestre": "Dica prática para narrar aventuras inesquecíveis.",
  "complexidade": "Média (3/5)"
}`;

    const textoResposta = await consultarGemini(prompt);

    try {
        const json = extrairJsonSeguro(textoResposta);
        return {
            nome: json.nome || 'Sistema Inédito Gemini',
            genero: json.genero || 'Fantasia & Aventura',
            preco: parseFloat(json.preco) || 50.00,
            descricao: json.descricao || 'Um novo RPG gerado pela IA do Google Gemini.',
            imagemcapa_link: selecionarImagem(json.genero),
            pdf_link: 'https://media.wizards.com/2018/dnd/downloads/DnD_BasicRules_2018.pdf',
            ia_pontos_fortes: json.pontos_fortes || '• Sistema dinâmico gerado pelo Gemini',
            ia_pontos_fracos: json.pontos_fracos || '• Requer leitura atenta das regras básicas',
            ia_dicas_mestre: json.dicas_mestre || 'Comece com uma aventura curta introdutória.',
            ia_complexidade: json.complexidade || 'Média (3/5)',
            origem: 'Google Gemini AI (API Oficial)'
        };
    } catch (parseErr) {
        throw new Error('Falha ao processar resposta do Gemini: ' + parseErr.message);
    }
}

// 2. Analisar Sistema com a API do Google Gemini (Requisito 3)
async function gerarAnaliseIASistema({ nome, genero, descricao }) {
    const prompt = `Você é um crítico mestre de RPG de mesa e Inteligência Artificial. Analise o seguinte sistema de RPG de mesa:
Nome: ${nome || 'Sistema sem nome'}
Gênero: ${genero || 'Geral'}
Sinopse / Descrição: ${descricao || 'Aventura de RPG de mesa.'}

Responda OBRIGATORIAMENTE em JSON puro no seguinte formato exato (sem blocos de código markdown adicionais):
{
  "pontos_fortes": "• Ponto forte 1\\n• Ponto forte 2",
  "pontos_fracos": "• Ponto fraco 1\\n• Ponto fraco 2",
  "dicas_mestre": "Dica prática para o mestre",
  "complexidade": "Média (3/5)"
}`;

    const textoResposta = await consultarGemini(prompt);

    try {
        const json = extrairJsonSeguro(textoResposta);
        return {
            pontos_fortes: json.pontos_fortes || '• Sistema dinâmico e flexível',
            pontos_fracos: json.pontos_fracos || '• Requer leitura das regras básicas',
            dicas_mestre: json.dicas_mestre || 'Inicie com aventuras introdutórias.',
            complexidade: json.complexidade || 'Média (3/5)',
            origem: 'Google Gemini AI (API Oficial)'
        };
    } catch (parseErr) {
        throw new Error('Falha ao processar análise do Gemini: ' + parseErr.message);
    }
}

// 3. Gerar Personagem Completo com IA Generativa (Google Gemini)
async function gerarPersonagemComIA(ideiaOpcional = '') {
    const prompt = `Você é um criador experiente de heróis e personagens de RPG de mesa.
Crie um personagem único, memorável e pronto para jogar ${ideiaOpcional ? `inspirado em: "${ideiaOpcional}"` : 'com conceito e história instigantes'}.
Responda OBRIGATORIAMENTE em JSON puro no formato exato:
{
  "nome": "Nome do Personagem",
  "classe_raca": "Ex: Ladino Meio-Elfo / Guerreiro Humano / Mago Draconato",
  "nivel": 1,
  "biografia": "História cativante, motivação e segredo do personagem em 2 a 3 frases envolventes."
}`;

    const textoResposta = await consultarGemini(prompt);

    try {
        const json = extrairJsonSeguro(textoResposta);
        const avatarPadrao = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300';
        const artePadrao = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';

        return {
            nome: json.nome || 'Herói Gerado por IA',
            classe_raca: json.classe_raca || 'Aventureiro Experiente',
            nivel: parseInt(json.nivel) || 1,
            biografia: json.biografia || 'Um personagem envolvente com passado enigmático.',
            fotoperfil_link: avatarPadrao,
            fotoarte_link: artePadrao,
            pdf_link: 'https://media.wizards.com/2018/dnd/downloads/DnD_BasicRules_2018.pdf'
        };
    } catch (err) {
        throw new Error('Falha ao processar personagem gerado pelo Gemini: ' + err.message);
    }
}

// 4. Gerar Campanha Completa com IA Generativa (Google Gemini)
async function gerarCampanhaComIA(temaOpcional = '') {
    const prompt = `Você é um mestre experiente de campanhas épicas de RPG de mesa.
Crie uma campanha rica, imersiva e misteriosa ${temaOpcional ? `inspirada no tema: "${temaOpcional}"` : 'com enredo envolvente, perigos e reviravoltas'}.
Responda OBRIGATORIAMENTE em JSON puro no formato exato:
{
  "titulo": "Título Épico da Campanha",
  "sinopse": "Premissa emocionante com gancho inicial, conflito principal e ameaça iminente em 2 a 3 frases fortes.",
  "visibilidade": "publica"
}`;

    const textoResposta = await consultarGemini(prompt);

    try {
        const json = extrairJsonSeguro(textoResposta);
        return {
            titulo: json.titulo || 'Crônicas do Desconhecido',
            sinopse: json.sinopse || 'Uma jornada épica repleta de perigos, escolhas morais e segredos ancestrais.',
            visibilidade: json.visibilidade || 'publica',
            imagemcapa_link: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800'
        };
    } catch (err) {
        throw new Error('Falha ao processar campanha gerada pelo Gemini: ' + err.message);
    }
}

module.exports = {
    gerarSistemaCompletoDoZero,
    gerarAnaliseIASistema,
    gerarPersonagemComIA,
    gerarCampanhaComIA,
    consultarGemini
};


// Coordenadas padrão (Camocim - CE)
let LAT = -2.90;
let LON = -40.84;
let nomeLocal = "Camocim";

// Configurações de Corrida
const TEMP_BOM_CORRIDA = 30; // Temperatura ideal máxima (°C)
const TEMP_ALERTA_HIDRATACAO = 28; // Acima disto, recomenda reforçar a água

// Estado
let tempAtual = null;
let nascerSolMinutos = null;
let porSolMinutos = null;
let modo = 'mare'; // 'mare' | 'corrida'
try { modo = localStorage.getItem('modo') || 'mare'; } catch (e) {}

// Converte graus em ponto cardeal
function direcaoVento(graus) {
    const pontos = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
    return pontos[Math.round(graus / 45) % 8];
}

// Converte string de hora para minutos totais
function horaParaMinutos(strHora) {
    if (!strHora) return 0;
    const partes = strHora.split('T');
    const horaTime = partes.length > 1 ? partes[1] : partes[0];
    const [h, m] = horaTime.split(':').map(Number);
    return h * 60 + m;
}

// Função para obter a localização atual do dispositivo
function obterLocalizacaoUsuario() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(); // Geolocalização não suportada, mantém Camocim
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                LAT = position.coords.latitude;
                LON = position.coords.longitude;
                
                try {
                    const resNom = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${LAT}&lon=${LON}`);
                    const dataNom = await resNom.json();
                    if (dataNom && dataNom.address) {
                        nomeLocal = dataNom.address.city || dataNom.address.town || dataNom.address.municipality || "sua região";
                    }
                } catch (e) {
                    nomeLocal = "sua localização";
                }
                resolve();
            },
            (error) => {
                // Se a permissão for negada, mantém Camocim
                resolve();
            },
            { timeout: 10000 }
        );
    });
}

async function buscarAPIs() {
    const climaDisplay = document.getElementById('clima-display');
    const ventoDisplay = document.getElementById('vento-display');
    const luaDisplay = document.getElementById('lua-display');

    // 1. Clima, Vento (em nós) e Horas de Sol (Open-Meteo)
    try {
        const resClima = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&daily=sunrise,sunset&timezone=auto&wind_speed_unit=knots`);
        const dataClima = await resClima.json();
        
        const atual = dataClima.current_weather;
        tempAtual = atual.temperature;
        climaDisplay.innerHTML = `🌡️ ${Math.round(tempAtual)}°C`;
        ventoDisplay.innerHTML = `💨 ${Math.round(atual.windspeed)} nós ${direcaoVento(atual.winddirection)}`;

        if (dataClima.daily && dataClima.daily.sunrise && dataClima.daily.sunset) {
            nascerSolMinutos = horaParaMinutos(dataClima.daily.sunrise[0]);
            porSolMinutos = horaParaMinutos(dataClima.daily.sunset[0]);
        }
    } catch (e) {
        tempAtual = null;
        climaDisplay.innerHTML = "🌡️ --";
        ventoDisplay.innerHTML = "💨 --";
    }
    atualizarApp();

    // 2. Lua (Farmsense)
    try {
        const unixTime = Math.floor(Date.now() / 1000);
        const resLua = await fetch(`https://api.farmsense.net/v1/moonphases/?d=${unixTime}`);
        const dataLua = await resLua.json();

        if (dataLua && dataLua[0]) {
            const fases = {
                "New Moon": "🌑", "Waxing Crescent": "🌒", "First Quarter": "🌓",
                "Waxing Gibbous": "🌔", "Full Moon": "🌕", "Waning Gibbous": "🌖",
                "Third Quarter": "🌗", "Waning Crescent": "🌘"
            };
            luaDisplay.innerHTML = `${fases[dataLua[0].Phase] || '🌙'} Lua`;
        }
    } catch (e) {
        luaDisplay.innerHTML = "🌙 Lua";
    }
}

function mostrarImagem(src) {
    const img = document.getElementById('mare-imagem');
    img.onerror = () => { img.style.display = 'none'; };
    img.src = src;
    img.style.display = 'inline-block';
}

// ---------- MODO MARÉ ----------
function renderMare(agora, hora) {
    const hojeStr = agora.toLocaleDateString('en-CA');
    const amanhaData = new Date(agora);
    amanhaData.setDate(agora.getDate() + 1);
    const amanhaStr = amanhaData.toLocaleDateString('en-CA');

    if (typeof tabelasDeMare === 'undefined') return;

    const dadosHoje = tabelasDeMare["LUIS_CORREIA"][hojeStr];
    const dadosAmanha = tabelasDeMare["LUIS_CORREIA"][amanhaStr];
    const statusTxt = document.getElementById('status-text');

    if (dadosHoje) {
        const minAtual = hora * 60 + agora.getMinutes();
        let maisProximo = dadosHoje[0];
        let menorDiff = Infinity;

        dadosHoje.forEach(ev => {
            const [h, m] = ev.hora.split(':').map(Number);
            const diff = Math.abs(minAtual - (h * 60 + m));
            if (diff < menorDiff) { menorDiff = diff; maisProximo = ev; }
        });

        if (maisProximo.altura >= 2.0) {
            mostrarImagem("foto1.png");
            statusTxt.innerText = "MARÉ CHEIA";
        } else {
            mostrarImagem("foto2.png");
            statusTxt.innerText = "MARÉ VAZIA";
        }
        document.getElementById('proxima-info').innerText = `Perto de agora: ${maisProximo.altura}m às ${maisProximo.hora}`;

        document.getElementById('lista-hoje').innerHTML = dadosHoje.map(ev => `
            <div class="event-item"><span>🕒 ${ev.hora}</span><span><b>${ev.altura}m</b></span></div>
        `).join('');
    } else {
        statusTxt.innerText = "Sem dados para hoje";
        document.getElementById('proxima-info').innerText = "Atualize o dados.js";
    }

    document.getElementById('lista-amanha').innerHTML = dadosAmanha
        ? dadosAmanha.map(ev => `
            <div class="event-item"><span>🕒 ${ev.hora}</span><span>${ev.altura}m</span></div>
        `).join('')
        : '';
}

// ---------- MODO CORRIDA ----------
function renderCorrida(agora, hora) {
    const statusTxt = document.getElementById('status-text');
    const info = document.getElementById('proxima-info');

    if (tempAtual === null || nascerSolMinutos === null || porSolMinutos === null) {
        statusTxt.innerText = "Carregando dados...";
        info.innerText = "Aguarde um momento";
        document.getElementById('mare-imagem').style.display = 'none';
        return;
    }

    const minAtual = hora * 60 + agora.getMinutes();
    
    // Janela de 1h antes do nascer ou pôr do sol
    const diffNascer = nascerSolMinutos - minAtual;
    const diffPor = porSolMinutos - minAtual;

    const aptoNascer = diffNascer >= 0 && diffNascer <= 60;
    const aptoPor = diffPor >= 0 && diffPor <= 60;
    const horarioBom = aptoNascer || aptoPor;

    const temperaturaBoa = tempAtual <= TEMP_BOM_CORRIDA;

    if (horarioBom && temperaturaBoa) {
        statusTxt.innerText = "✅ APTO PARA CORRER!";
        let mensagem = `Horário ideal em ${nomeLocal} (perto do nascer/pôr do sol) e temperatura agradável (${Math.round(tempAtual)}°C).`;
        if (tempAtual >= TEMP_ALERTA_HIDRATACAO) {
            mensagem += " 💧 Atenção: dia quente, leve a sua garrafa de água!";
        }
        info.innerText = mensagem;
        mostrarImagem("foto1.png"); // Exibe a mesma foto da maré cheia
    } else {
        statusTxt.innerText = "❌ NÃO RECOMENDADO";
        let motivo = [];
        if (!horarioBom) motivo.push("Fora da janela de 1h antes do nascer/pôr do sol");
        if (!temperaturaBoa) motivo.push(`Temperatura alta (${Math.round(tempAtual)}°C)`);
        
        info.innerText = `Condições desfavoráveis em ${nomeLocal}: ${motivo.join('. ')}.`;
        mostrarImagem("corrida_quente.png");
    }
}

function atualizarApp() {
    const agora = new Date();
    const hora = agora.getHours();

    // Saudação
    const saudacao = document.getElementById('saudacao');
    if (hora >= 5 && hora < 12) saudacao.innerText = "Bom dia, Tais!";
    else if (hora >= 12 && hora < 18) saudacao.innerText = "Boa tarde, Tais!";
    else saudacao.innerText = "Boa noite, Tais!";

    // Mostra/oculta blocos conforme o modo
    const mostrarMare = modo === 'mare';
    document.getElementById('bloco-mare').style.display = mostrarMare ? 'block' : 'none';
    document.getElementById('titulo-app').innerText = mostrarMare ? `Maré em ${nomeLocal}` : `Corrida em ${nomeLocal}`;
    document.getElementById('btn-mare').classList.toggle('ativo', mostrarMare);
    document.getElementById('btn-corrida').classList.toggle('ativo', !mostrarMare);

    if (mostrarMare) {
        renderMare(agora, hora);
    } else {
        renderCorrida(agora, hora);
    }
}

function trocarModo(novo) {
    modo = novo;
    try { localStorage.setItem('modo', modo); } catch (e) {}
    atualizarApp();
}

document.getElementById('btn-mare').addEventListener('click', () => trocarModo('mare'));
document.getElementById('btn-corrida').addEventListener('click', () => trocarModo('corrida'));

// Alternar Temas
const toggle = document.getElementById('mode-toggle');
toggle.addEventListener('change', () => {
    if (toggle.checked) {
        document.body.classList.replace('light-mode', 'dark-mode');
        document.getElementById('label-modo').innerText = "Modo Noturno";
    } else {
        document.body.classList.replace('dark-mode', 'light-mode');
        document.getElementById('label-modo').innerText = "Modo Claro";
    }
});

// Inicialização
async function iniciarApp() {
    await obterLocalizacaoUsuario();
    await buscarAPIs();
    setInterval(atualizarApp, 60000);
    setInterval(buscarAPIs, 15 * 60000);
}

iniciarApp();

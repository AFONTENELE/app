// Coordenadas padrão fixas (Camocim - CE) para carregamento instantâneo
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
    if (graus === undefined || graus === null) return '';
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

// Função para buscar dados do Open-Meteo e Farmsense de forma rápida
async function buscarAPIs() {
    const climaDisplay = document.getElementById('clima-display');
    const ventoDisplay = document.getElementById('vento-display');
    const luaDisplay = document.getElementById('lua-display');

    // 1. Clima, Vento (em nós) e Horas de Sol
    try {
        const resClima = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&daily=sunrise,sunset&timezone=auto&wind_speed_unit=knots`);
        const dataClima = await resClima.json();
        
        if (dataClima && dataClima.current_weather) {
            const atual = dataClima.current_weather;
            tempAtual = atual.temperature;
            climaDisplay.innerHTML = `🌡️ ${Math.round(tempAtual)}°C`;
            ventoDisplay.innerHTML = `💨 ${Math.round(atual.windspeed)} nós ${direcaoVento(atual.winddirection)}`;
        } else {
            climaDisplay.innerHTML = "🌡️ --";
            ventoDisplay.innerHTML = "💨 --";
        }

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
    if (!img) return;
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
        const img = document.getElementById('mare-imagem');
        if (img) img.style.display = 'none';
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
    if (saudacao) {
        if (hora >= 5 && hora < 12) saudacao.innerText = "Bom dia, Tais!";
        else if (hora >= 12 && hora < 18) saudacao.innerText = "Boa tarde, Tais!";
        else saudacao.innerText = "Boa noite, Tais!";
    }

    const mostrarMare = modo === 'mare';
    const blocoMare = document.getElementById('bloco-mare');
    if (blocoMare) blocoMare.style.display = mostrarMare ? 'block' : 'none';
    
    const tituloApp = document.getElementById('titulo-app');
    if (tituloApp) tituloApp.innerText = mostrarMare ? `Maré em ${nomeLocal}` : `Corrida em ${nomeLocal}`;
    
    const btnMare = document.getElementById('btn-mare');
    const btnCorrida = document.getElementById('btn-corrida');
    if (btnMare) btnMare.classList.toggle('ativo', mostrarMare);
    if (btnCorrida) btnCorrida.classList.toggle('ativo', !mostrarMare);

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

const btnMareEl = document.getElementById('btn-mare');
const btnCorridaEl = document.getElementById('btn-corrida');
if (btnMareEl) btnMareEl.addEventListener('click', () => trocarModo('mare'));
if (btnCorridaEl) btnCorridaEl.addEventListener('click', () => trocarModo('corrida'));

// Alternar Temas
const toggle = document.getElementById('mode-toggle');
if (toggle) {
    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            document.body.classList.replace('light-mode', 'dark-mode');
            document.getElementById('label-modo').innerText = "Modo Noturno";
        } else {
            document.body.classList.replace('dark-mode', 'light-mode');
            document.getElementById('label-modo').innerText = "Modo Claro";
        }
    });
}

// Tenta atualizar a localização em segundo plano (sem travar o carregamento inicial)
function tentarObterLocalizacaoSilenciosa() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const novaLat = position.coords.latitude;
            const novaLon = position.coords.longitude;
            try {
                const resNom = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${novaLat}&lon=${novaLon}`);
                const dataNom = await resNom.json();
                if (dataNom && dataNom.address) {
                    LAT = novaLat;
                    LON = novaLon;
                    nomeLocal = dataNom.address.city || dataNom.address.town || dataNom.address.municipality || "sua região";
                    buscarAPIs(); // Atualiza os dados com a nova localização encontrada
                }
            } catch (e) {}
        },
        (error) => {},
        { timeout: 5000 }
    );
}

// Inicialização imediata com Camocim para carregar rápido
buscarAPIs();
setInterval(atualizarApp, 60000);
setInterval(buscarAPIs, 15 * 60000);

// Executa a verificação de GPS de forma assíncrona/não-obstrutiva em segundo plano
setTimeout(tentarObterLocalizacaoSilenciosa, 1000);

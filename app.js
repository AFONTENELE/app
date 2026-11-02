// Coordenadas padrão fixas (Camocim - CE) para carregamento instantâneo
let LAT = -2.90;
let LON = -40.84;
let nomeLocal = "Camocim";

// Configurações de Corrida
const TEMP_ALERTA_HIDRATACAO = 28; // Acima disto, recomenda reforçar a água

// Estado
let tempAtual = null;
let ventoAtualStr = "--";
let nascerSolStr = "--:--";
let porSolStr = "--:--";
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

// Extrai apenas o horário "HH:MM" de uma string ISO
function formatarHoraSimples(strIso) {
    if (!strIso) return "--:--";
    const partes = strIso.split('T');
    const horaTime = partes.length > 1 ? partes[1] : partes[0];
    return horaTime.substring(0, 5);
}

// Busca dados de Clima, Vento e Sol com a API atualizada da Open-Meteo
async function buscarAPIs() {
    const luaDisplay = document.getElementById('lua-display');

    try {
        const urlClima = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,wind_speed_10m,wind_direction_10m&daily=sunrise,sunset&timezone=auto`;
        const resClima = await fetch(urlClima);
        
        if (!resClima.ok) {
            throw new Error(`Erro na API de clima: ${resClima.status}`);
        }
        
        const dataClima = await resClima.json();
        
        if (dataClima && dataClima.current) {
            const atual = dataClima.current;
            tempAtual = atual.temperature_2m;
            // Converte km/h da API para nós (1 km/h = 0.539957 nós)
            const ventoKm = atual.wind_speed_10m || 0;
            const ventoNos = Math.round(ventoKm * 0.539957);
            ventoAtualStr = `${ventoNos} nós ${direcaoVento(atual.wind_direction_10m)}`;
        }

        if (dataClima && dataClima.daily && dataClima.daily.sunrise && dataClima.daily.sunset) {
            nascerSolStr = formatarHoraSimples(dataClima.daily.sunrise[0]);
            porSolStr = formatarHoraSimples(dataClima.daily.sunset[0]);
            nascerSolMinutos = horaParaMinutos(dataClima.daily.sunrise[0]);
            porSolMinutos = horaParaMinutos(dataClima.daily.sunset[0]);
        }
    } catch (e) {
        console.error("Erro ao buscar dados climáticos:", e);
    }
    
    atualizarApp();

    // Lua (Farmsense)
    try {
        const unixTime = Math.floor(Date.now() / 1000);
        const resLua = await fetch(`https://api.farmsense.net/v1/moonphases/?d=${unixTime}`);
        if (!resLua.ok) throw new Error('Erro ao buscar lua');
        const dataLua = await resLua.json();

        if (dataLua && dataLua[0]) {
            const fases = {
                "New Moon": "🌑", "Waxing Crescent": "🌒", "First Quarter": "🌓",
                "Waxing Gibbous": "🌔", "Full Moon": "🌕", "Waning Gibbous": "🌖",
                "Third Quarter": "🌗", "Waning Crescent": "🌘"
            };
            luaDisplay.innerHTML = `<span>${fases[dataLua[0].Phase] || '🌙'}</span> <span>Lua</span>`;
        }
    } catch (e) {
        console.error("Erro ao buscar fase da lua:", e);
        luaDisplay.innerHTML = `<span>🌙</span> <span>Lua</span>`;
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

    document.getElementById('clima-display').innerHTML = `<span>🌡️</span> <span>${tempAtual !== null ? Math.round(tempAtual) + '°C' : '--'}</span>`;
    document.getElementById('vento-display').innerHTML = `<span>💨</span> <span>${ventoAtualStr}</span>`;
    document.getElementById('vento-display').style.display = 'flex';

    if (typeof tabelasDeMare === 'undefined') return;

    const dadosHoje = tabelasDeMare["LUIS_CORREIA"] ? tabelasDeMare["LUIS_CORREIA"][hojeStr] : null;
    const dadosAmanha = tabelasDeMare["LUIS_CORREIA"] ? tabelasDeMare["LUIS_CORREIA"][amanhaStr] : null;
    const statusTxt = document.getElementById('status-text');

    if (dadosHoje && dadosHoje.length > 0) {
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
            statusTxt.innerText = "🌊 MARÉ CHEIA";
        } else {
            mostrarImagem("foto2.png");
            statusTxt.innerText = "🏖️ MARÉ VAZIA";
        }
        document.getElementById('proxima-info').innerHTML = `Perto de agora: <b>${maisProximo.altura}m</b> às <b>${maisProximo.hora}</b>`;

        document.getElementById('lista-hoje').innerHTML = dadosHoje.map(ev => `
            <div class="event-item"><span>🕒 ${ev.hora}</span><span><b>${ev.altura}m</b></span></div>
        `).join('');
    } else {
        statusTxt.innerText = "Sem dados de maré";
        document.getElementById('proxima-info').innerText = "Esta região não possui dados costeiros de maré.";
        document.getElementById('lista-hoje').innerHTML = '<div class="event-item" style="justify-content:center; opacity:0.6;">Nenhum registro</div>';
    }

    document.getElementById('lista-amanha').innerHTML = dadosAmanha && dadosAmanha.length > 0
        ? dadosAmanha.map(ev => `
            <div class="event-item"><span>🕒 ${ev.hora}</span><span><b>${ev.altura}m</b></span></div>
        `).join('')
        : '<div class="event-item" style="justify-content:center; opacity:0.6;">Nenhum registro</div>';
}

// ---------- MODO CORRIDA ----------
function renderCorrida(agora, hora) {
    const statusTxt = document.getElementById('status-text');
    const info = document.getElementById('proxima-info');

    document.getElementById('clima-display').innerHTML = `<span>🌡️</span> <span>${tempAtual !== null ? Math.round(tempAtual) + '°C' : '--'}</span>`;
    document.getElementById('vento-display').innerHTML = `<span>🌅 ${nascerSolStr}</span> <span>🌇 ${porSolStr}</span>`;

    const minAtual = hora * 60 + agora.getMinutes();

    const nascerSol = nascerSolMinutos !== null ? nascerSolMinutos : 5 * 60 + 30;
    const porSol = porSolMinutos !== null ? porSolMinutos : 17 * 60 + 30;

    const diffNascer = nascerSol - minAtual;
    const diffPor = porSol - minAtual;

    const aptoNascer = diffNascer >= 0 && diffNascer <= 60;
    const aptoPor = diffPor >= 0 && diffPor <= 60;
    const horarioApto = aptoNascer || aptoPor;

    const infoSol = `🌅 Nascer: ${nascerSolStr} | 🌇 Pôr: ${porSolStr}`;

    if (horarioApto) {
        statusTxt.innerText = "✅ APTO PARA CORRER!";
        
        let mensagem = `Horário ideal em ${nomeLocal} (janela de 1h antes do nascer/pôr do sol).<br><br>${infoSol}`;

        if (tempAtual !== null) {
            mensagem += `<br>Temp: ${Math.round(tempAtual)}°C.`;
            if (tempAtual >= TEMP_ALERTA_HIDRATACAO) {
                mensagem += " 💧 <b>Atenção:</b> dia quente, leve sua garrafinha de água!";
            }
        }
        
        info.innerHTML = mensagem;
        mostrarImagem("foto1.png");
    } else {
        statusTxt.innerText = "❌ NÃO RECOMENDADO";
        let detalheTemp = tempAtual !== null ? ` (Temp: ${Math.round(tempAtual)}°C)` : '';
        info.innerHTML = `Fora do horário ideal em ${nomeLocal}.${detalheTemp}<br><br>${infoSol}<br><small>Prefira 1h antes do nascer ou pôr do sol.</small>`;
        mostrarImagem("foto2.png");
    }
}

function atualizarApp() {
    const agora = new Date();
    const hora = agora.getHours();

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
            document.getElementById('label-modo').innerText = "Noturno";
        } else {
            document.body.classList.replace('dark-mode', 'light-mode');
            document.getElementById('label-modo').innerText = "Claro";
        }
    });
}

// Localização em segundo plano
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
                    buscarAPIs();
                }
            } catch (e) {}
        },
        (error) => {},
        { timeout: 5000 }
    );
}

// Inicialização
atualizarApp();
buscarAPIs();
setInterval(atualizarApp, 60000);
setInterval(buscarAPIs, 15 * 60000);

setTimeout(tentarObterLocalizacaoSilenciosa, 1000);

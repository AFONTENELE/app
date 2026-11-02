// Coordenadas de Camocim - CE
const LAT = -2.90;
const LON = -40.84;

// Converte graus em ponto cardeal (de onde o vento sopra)
function direcaoVento(graus) {
    const pontos = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
    return pontos[Math.round(graus / 45) % 8];
}

async function buscarAPIs() {
    const climaDisplay = document.getElementById('clima-display');
    const ventoDisplay = document.getElementById('vento-display');
    const luaDisplay = document.getElementById('lua-display');

    // 1. Clima + vento (Open-Meteo) para Camocim
    try {
        const resClima = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current_weather=true&wind_speed_unit=kmh`);
        const dataClima = await resClima.json();
        const atual = dataClima.current_weather;
        climaDisplay.innerHTML = `🌡️ ${Math.round(atual.temperature)}°C`;
        ventoDisplay.innerHTML = `💨 ${Math.round(atual.windspeed)} km/h ${direcaoVento(atual.winddirection)}`;
    } catch (e) {
        climaDisplay.innerHTML = "🌡️ --";
        ventoDisplay.innerHTML = "💨 --";
    }

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

function atualizarApp() {
    const agora = new Date();
    const hora = agora.getHours();

    // Saudação
    const saudacao = document.getElementById('saudacao');
    if (hora >= 5 && hora < 12) saudacao.innerText = "Bom dia, Tais!";
    else if (hora >= 12 && hora < 18) saudacao.innerText = "Boa tarde, Tais!";
    else saudacao.innerText = "Boa noite, Tais!";

    // Datas no formato YYYY-MM-DD
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

        const img = document.getElementById('mare-imagem');

        // Foto: >= 2.0m é cheia
        if (maisProximo.altura >= 2.0) {
            img.src = "foto1.png";
            statusTxt.innerText = "MARÉ CHEIA";
        } else {
            img.src = "foto2.png";
            statusTxt.innerText = "MARÉ VAZIA";
        }
        img.style.display = "inline-block";
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

// Start
buscarAPIs();
atualizarApp();
setInterval(atualizarApp, 60000);
setInterval(buscarAPIs, 15 * 60000); // atualiza clima/vento a cada 15 min

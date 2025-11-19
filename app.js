// Elementos
const resultado = document.getElementById("resultado");

// Data do dia
function dataHoje() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

// Mostra maré de hoje
function mostrarMare() {
    const hoje = dataHoje();
    const dados = tabelasDeMare["LUIS_CORREIA"][hoje];

    if (!dados) {
        resultado.innerHTML = `
            <h3>Sem dados disponíveis para ${hoje}</h3>
        `;
        return;
    }

    let html = `<h3>Maré do dia ${hoje}</h3>`;

    dados.forEach(item => {
        html += `<p><b>${item.hora}</b> — ${item.altura} m</p>`;
    });

    resultado.innerHTML = html;
}

// Inicializa
mostrarMare();

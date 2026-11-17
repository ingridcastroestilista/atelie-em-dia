import * as store from './store.js';
import { protegerApp } from './acesso.js';
import { conteudoFicha, imagemFicha, conteudoPeca, imagensPeca, normalizarPlano, AVIAMENTOS_COMUNS, CROQUIS } from './ficha.js';
import { guardarFoto, enderecoFoto, apagarFoto, limparSoltas } from './fotos.js';
import { tipoLembrete, conteudoLembrete, textoLembrete, imagemLembrete, ORIENTACOES_PADRAO } from './lembrete.js';
import { uid, agora, tocar, MEDIDAS, GRUPOS_MEDIDAS, acharCliente, clientePorNome, novaCliente } from './store.js';
import {
  hojeISO, somaDias, diasEntre, dataBR, diaMes, quando, etapasEncomenda, etapasAluguel, infoEtapa, adicionarEtapa, removerEtapa,
  moverEtapa, modeloDe, VERSAO_ETAPAS, etapa, provaAnterior, marcarEtapa, semana, periodo, conflitos, situacaoPeca, arquivoAgenda, linkGoogleAgenda,
  linkWhats, mensagemProva, mensagemPronta, MENSAGENS_PADRAO, apertados, prazos, PRAZOS_PADRAO, configurarPrazos, prazoValido, GRUPOS, resumoMeses, somaMeses, situacaoMes,
  formatarTelefone, fotosUsadas,
} from './regras.js';

const S = () => store.get();
const $main = document.getElementById('main');

// Estado só da tela (não é guardado).
const ui = {
  busca: '', filtroEnc: 'andamento', abaAluguel: 'pecas', mesPeca: hojeISO().slice(0, 7), novo: null, medicao: null, notas: null, novaPeca: '',
  inicioMeses: hojeISO().slice(0, 7), abrirData: null,
  editEtapas: null, novaEtapa: '', novaEtapaProva: false, nomeModelo: '', // personalizar etapas
  editPlano: null, recem: null, novaCliente: { nome: '', whatsapp: '' }, // recem: { id } do que acabou de ser cadastrado // abrirData: 'id:k' da etapa com "+ data" aberto
};

// ---------- Texto ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function dataLonga(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${maiuscula(DIAS[new Date(a, m - 1, d).getDay()])}, ${d} de ${MESES[m - 1]}`;
}
const mesNome = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
const mesCurtoAno = (ym) => `${maiuscula(MESES[Number(ym.slice(5, 7)) - 1].slice(0, 3))}/${ym.slice(2, 4)}`;
const faltam = (iso) => {
  const d = diasEntre(hojeISO(), iso);
  if (d === 0) return 'é hoje';
  if (d === 1) return 'é amanhã';
  if (d < 0) return `foi há ${-d} dia${d === -1 ? '' : 's'}`;
  return `faltam ${d} dias`;
};
const horaTxt = (h) => (h ? ` · ${h.replace(':00', 'h').replace(':', 'h')}` : '');
const nomeCliente = (id) => acharCliente(id)?.nome || 'Cliente apagada';

// ---------- Caminhos de dados (data-bind) ----------
// 'encomendas#ID.etapas#prova1.data' → item com id (ou etapa com k) dentro da lista.

function resolver(caminho) {
  const partes = caminho.split('.');
  let alvo = partes[0] === 'ui' ? ui : S();
  if (partes[0] === 'ui') partes.shift();
  for (let i = 0; i < partes.length - 1; i++) {
    const [k, id] = partes[i].split('#');
    alvo = alvo?.[k];
    if (id) alvo = alvo?.find((x) => x.id === id || x.k === id);
    if (!alvo) return null;
  }
  return { alvo, chave: partes[partes.length - 1] };
}

function setPath(caminho, valor) {
  const r = resolver(caminho);
  if (!r) return;
  r.alvo[r.chave] = valor;
  if (!caminho.startsWith('ui.')) {
    const [raiz, id] = caminho.split('.')[0].split('#');
    if (id) { const obj = S()[raiz]?.find((x) => x.id === id); if (obj) tocar(obj); }
    store.salvar();
  }
}

// ---------- Componentes ----------

const campo = (bind, valor, tipo = 'text', attrs = '') =>
  `<input type="${tipo}" data-bind="${esc(bind)}" value="${esc(valor ?? '')}" ${attrs}>`;
const area = (bind, valor, attrs = '') => `<textarea data-bind="${esc(bind)}" rows="3" ${attrs}>${esc(valor ?? '')}</textarea>`;
const cab = (titulo, sub = '', voltar = '') => `
  <header class="topo">
    ${voltar ? `<a class="voltar" href="${voltar}" aria-label="Voltar">‹</a>` : ''}
    <div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
  </header>`;
const cartao = (conteudo, cls = '', attrs = '') => `<section class="cartao ${cls}" ${attrs}>${conteudo}</section>`;
// Ícones desenhados (no lugar de emoji, que fica pequeno e diferente em cada celular).
const ICONES = {
  agenda: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  conversa: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20.5l1.5-4.6A8.4 8.4 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  sacola: '<path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  ficha: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
};
const ico = (nome) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
// Fotos: miniaturas + botão de pôr foto. alvo = o registro que guarda a lista (ex.: 'pecas#ID').
const AVISO_FOTO_CLIENTE = 'Fotografe só com autorização da cliente e, se der, só a peça, sem o rosto. As fotos ficam só neste celular.';
function galeria(alvo, ids = [], { soVer = false, aviso = '' } = {}) {
  if (soVer && !ids.length) return '';
  return `<div class="galeria">
    ${ids.map((id) => `<button class="foto-mini" data-acao="verFoto" data-alvo="${esc(alvo)}" data-id="${id}" aria-label="Ver foto"><img data-foto="${id}" alt=""></button>`).join('')}
    ${soVer ? '' : `<label class="foto-add">${ico('camera')}<span>${ids.length ? 'Mais' : 'Pôr foto'}</span><input type="file" accept="image/*" multiple hidden data-acao="addFoto" data-alvo="${esc(alvo)}"></label>`}
  </div>${aviso && !soVer ? `<p class="aviso-foto">${aviso}</p>` : ''}`;
}

// Depois de desenhar a tela, carrega as fotos guardadas no celular.
function mostrarFotos(raiz = document) {
  raiz.querySelectorAll('img[data-foto]:not([src])').forEach((img) => {
    enderecoFoto(img.dataset.foto).then((u) => { if (u) img.src = u; else img.closest('.foto-mini, .mini-lista')?.classList.add('sem-foto'); }).catch(() => {});
  });
}

// Lista de compra: o que faltava comprar quando ela abriu (o que ela marca fica riscado até fechar).
function itensCompra(e) {
  const ids = new Set(ui.compras?.ids || []);
  return [['Tecidos', e.plano.tecidos], ['Aviamentos', e.plano.aviamentos]]
    .map(([nome, lista]) => [nome, lista.filter((a) => ids.has(a.id))]).filter(([, l]) => l.length);
}
function textoCompras(e) {
  const pend = itensCompra(e).map(([nome, l]) => [nome, l.filter((a) => !a.ok)]).filter(([, l]) => l.length);
  return [`*Lista de compra · ${e.peca}*`, ...pend.map(([nome, l]) => `\n${nome}:\n${l.map((a) => `- ${a.nome}${a.qtd ? ` (${a.qtd})` : ''}`).join('\n')}`)].join('\n');
}
function folhaCompras() {
  const e = S().encomendas.find((x) => x.id === ui.compras.id);
  if (!e) { ui.compras = null; return ''; }
  const grupos = itensCompra(e);
  const faltam = grupos.flatMap(([, l]) => l).filter((a) => !a.ok).length;
  return `<div class="folha-fundo" data-acao="fecharCompras"></div>
    <div class="folha" role="dialog" aria-label="Lista de compra">
      <p class="ajuda">${esc(e.peca)} · ${esc(nomeCliente(e.clienteId))}</p>
      <h2>${faltam ? `Falta comprar (${faltam})` : 'Tudo comprado ✓'}</h2>
      ${grupos.map(([nome, l]) => `<h3 class="sub-plano">${nome}</h3><div class="lista-plano">${l.map((a) => `<button class="item-compra ${a.ok ? 'feita' : ''}" data-acao="comprado" data-id="${a.id}" aria-pressed="${a.ok}">
          <span class="bola">${a.ok ? '✓' : ''}</span><span class="nome">${esc(a.nome)}</span>${a.qtd ? `<b>${esc(a.qtd)}</b>` : ''}</button>`).join('')}</div>`).join('')}
      <p class="ajuda">Toque no que já comprou.</p>
      <div class="acoes">${faltam ? '<button class="btn" data-acao="mandarCompras">Mandar a lista</button>' : ''}<button class="btn sec" data-acao="fecharCompras">Fechar</button></div>
    </div>`;
}

// Visualizar uma foto em tela cheia, com a opção de apagar.
function folhaFoto() {
  const { id } = ui.foto;
  return `<div class="foto-cheia" role="dialog" aria-label="Foto">
    <img data-foto="${id}" alt="">
    <div class="foto-cheia-acoes"><button class="btn sec" data-acao="apagarFoto">Apagar foto</button><button class="btn" data-acao="fecharFoto">Fechar</button></div>
  </div>`;
}

let limpezaFotos = null;
// Apaga do celular as fotos de vestidos, provas ou encomendas que foram apagados.
function limparFotosDepois() {
  clearTimeout(limpezaFotos);
  limpezaFotos = setTimeout(() => { store.gravar(); limparSoltas(fotosUsadas(S())).catch(() => {}); }, 1500);
}

const rotulo = (texto, controle, ajuda = '') => `<label class="campo"><span>${texto}</span>${controle}${ajuda ? `<small>${ajuda}</small>` : ''}</label>`;

let desfazer = null;
let toastTimer;
function toast(msg, fnDesfazer = null) {
  const el = document.getElementById('toast');
  desfazer = fnDesfazer;
  el.innerHTML = `<span>${esc(msg)}</span>${fnDesfazer ? '<button data-acao="desfazer">Desfazer</button>' : ''}`;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('on'); desfazer = null; }, fnDesfazer ? 6000 : 2600);
}

// ---------- Roteamento ----------

const telas = {};
let telaAtual = null;

function rota() {
  const [nome, id, extra] = (location.hash.replace(/^#\/?/, '') || 'semana').split('/');
  return { nome: telas[nome] ? nome : 'semana', id, extra };
}

let ultimoRender = 0;
let redesenhoPendente = false; // data ou hora mudou e a tela ainda não foi atualizada

// "retirada 2 dias antes" / "devolução no dia do evento"
function txtPrazo(n, quando, nome = 'retirada') {
  if (!n) return `${nome} no dia do evento`;
  return `${nome} ${n} dia${n > 1 ? 's' : ''} ${quando}`;
}

// Selo discreto no fim de todas as telas.
const SELO = '<p class="selo">Desenvolvido por <b>Ingrid Castro Academy</b></p>';

function render() {
  ultimoRender = Date.now();
  redesenhoPendente = false;
  configurarPrazos(S().prazosAluguel); // prazos do aluguel escolhidos em Ajustes
  let { nome, id, extra } = rota();
  // Primeiro acesso (ou o resumo "Tudo pronto!" logo depois dele) no lugar da tela inicial.
  if (nome === 'semana' && (!S().inicioFeito || ui.comecar > PASSOS_ATELIE)) nome = 'comecar';
  if (ui.recem && ui.recem.id !== id) ui.recem = null;
  if (ui.compras && ui.compras.id !== id) ui.compras = null;
  if (ui.planoAberto && ui.planoAberto !== id) ui.planoAberto = null; // saiu da encomenda: o planejamento volta fechado
  if (ui.todasEtapas && ui.todasEtapas !== id) ui.todasEtapas = null; // e as etapas também
  telaAtual = telas[nome];
  if (nome === 'comecar') { $main.innerHTML = telaAtual.render() + SELO; document.body.dataset.tela = nome; telaAtual.depois?.(); return; }
  $main.innerHTML = telaAtual.render(id, extra) + SELO + (ui.notas ? folhaNotas() : '') + (ui.compras ? folhaCompras() : '') + (ui.foto ? folhaFoto() : '');
  mostrarFotos($main);
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.tela === (telaAtual.aba || nome)));
  document.body.dataset.tela = nome;
  telaAtual.depois?.(id, extra);
}

const ir = (h) => { if (location.hash === h) render(); else location.hash = h; };

// ---------- Guia de próximos passos ----------
// Cada passo: { texto, ajuda, feito, botao }. Os passos se marcam sozinhos conforme ela preenche.

const sucesso = (texto) => `<p class="alerta ok sucesso">✓ ${texto}</p>`;

function guia(titulo, passos, ocultar) {
  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return '';
  return cartao(`
    <div class="cartao-cab"><h2>${titulo}</h2><span class="guia-cont">${feitos} de ${passos.length}</span></div>
    <ol class="guia">${passos.filter((p) => !p.feito).map((p) => `<li class="${p.feito ? 'ok' : ''}">
      <span class="guia-bola" aria-hidden="true">${p.feito ? '✓' : ''}</span>
      <div class="guia-txt"><b>${p.texto}</b>${p.ajuda && !p.feito ? `<small>${p.ajuda}</small>` : ''}</div>
      ${!p.feito && p.botao ? `<div class="guia-btn">${p.botao}</div>` : ''}
    </li>`).join('')}</ol>
    <button class="link" data-acao="${ocultar}">Esconder estes passos</button>`, 'guia-cartao');
}

// ---------- Avisos do início ----------

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ehAndroid = () => /android/i.test(navigator.userAgent);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalar = e; if (rota().nome === 'semana') render(); });

function avisoInstalar() {
  if (instalado() || S().avisoInstalarVisto) return '';
  const como = ehIOS()
    ? 'No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.'
    : promptInstalar ? '' : 'No menu do navegador (⋮), toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.';
  return cartao(`
    <h2>Guarde o app na tela do celular</h2>
    <p>Seus dados ficam só neste aparelho. Instalado, o app abre como um aplicativo e o celular não apaga o que você registrou.</p>
    ${como ? `<p>${como}</p>` : ''}
    <div class="acoes">${promptInstalar ? '<button class="btn" data-acao="instalar">Instalar agora</button>' : ''}<button class="btn sec" data-acao="fecharInstalar">Já instalei</button></div>
  `, 'destaque');
}

function avisoBackup() {
  const s = S();
  if (!s.encomendas.length && !s.alugueis.length) return '';
  // Sem backup ainda: só lembra depois de 14 dias de uso.
  const dias = (Date.now() - new Date(s.ultimoBackup || s.criadoEm)) / 864e5;
  if (dias < 14) return '';
  return cartao(`
    <h2>Hora de fazer um backup</h2>
    <p>${s.ultimoBackup ? `O último foi em ${dataBR(hojeISO(new Date(s.ultimoBackup)))}.` : 'Você ainda não fez nenhum.'} Se o celular quebrar ou for trocado, é o backup que traz tudo de volta.</p>
    <div class="acoes"><button class="btn" data-acao="exportar">Fazer backup agora</button></div>
  `, 'aviso');
}

// ---------- Tela: Esta semana ----------

function itemDe(c) {
  return c.tipo === 'aluguel' ? S().alugueis.find((a) => a.id === c.itemId) : S().encomendas.find((e) => e.id === c.itemId);
}
const nomePeca = (item) => (item.tipo === 'aluguel' ? (S().pecas.find((p) => p.id === item.pecaId)?.nome || 'Peça apagada') : item.peca);
const linkItem = (item) => (item.tipo === 'aluguel' ? `#/locacao/${item.id}` : `#/encomenda/${item.id}`);

// Tudo em que a cliente precisa vir (prova, medidas, entrega, retirada, devolução):
// atalho para mandar o lembrete, ou mostra que já foi.
function lembrarNaSemana(c, item) {
  const d = diasEntre(hojeISO(), c.data);
  if (d < 0 || c.semData || !tipoLembrete(item, c.k)) return '';
  const e = etapa(item, c.k);
  return `<a class="comp-lembrar ${e.lembreteEm ? 'ok' : ''}" href="#/lembrete/${item.id}/${c.k}">${e.lembreteEm ? `${ico('ok')}Cliente lembrada` : `${ico('conversa')}Lembrar a cliente`}</a>`;
}

function linhaCompromisso(c, atrasado = false) {
  const item = itemDe(c);
  const notas = c.notasAnteriores ? '<span class="nota-dica">Tem anotações da prova anterior</span>' : '';
  return `<div class="comp g-${c.grupo} ${atrasado ? 'atrasado' : ''}">
    <a class="comp-info" href="${linkItem(item)}">
      <span class="comp-quando">${quando(c.data)}${horaTxt(c.hora)}</span>
      <b>${esc(c.rotulo)}${c.semData ? ' <small>(até o evento)</small>' : ''}</b>
      <span>${esc(nomeCliente(c.clienteId))} · ${esc(nomePeca(item))}</span>
      ${notas}
    </a>
    <button class="btn peq" data-acao="concluir" data-tipo="${c.tipo}" data-id="${c.itemId}" data-k="${c.k}">${c.botao}</button>
    ${lembrarNaSemana(c, item)}
  </div>`;
}

const legenda = () => `<p class="legenda">${Object.entries(GRUPOS).map(([k, t]) => `<span class="g-${k}"><i></i>${t}</span>`).join('')}</p>`;

// Para quem adiou o primeiro acesso, ou já usava o app sem os dados do ateliê.
function cartaoCompletarAtelie() {
  const a = S().atelie;
  const falta = [!a.nome && 'nome', !a.whatsapp && 'WhatsApp', !a.endereco && 'endereço'].filter(Boolean);
  if (!falta.length) return '';
  return cartao(`<h2>Complete os dados do seu ateliê</h2>
    <p>Falta${falta.length > 1 ? 'm' : ''} ${falta.join(', ').replace(/, ([^,]*)$/, ' e $1')}. Eles aparecem nos lembretes que você manda para as clientes.</p>
    <button class="btn" data-acao="comecarDeNovo">Completar agora</button>`, 'destaque');
}

telas.semana = {
  render() {
    const s = S();
    const hoje = hojeISO();
    const sem = semana(s, hoje);
    const vazio = !s.encomendas.length && !s.alugueis.length;
    const hojeLista = sem.semana.filter((c) => c.data === hoje);
    const proximosDias = sem.semana.filter((c) => c.data !== hoje);
    return `
      <header class="marca">
        <img src="icons/icon.svg" alt="" width="40" height="40">
        <div><h1>Esta semana</h1><p>${dataLonga(hoje)}</p></div>
        <a class="engrenagem" href="#/ajustes" aria-label="Ajustes"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></a>
      </header>
      ${vazio ? cartao(`
        <h2>Bem-vinda ao seu ateliê em dia</h2>
        <p>Aqui aparece tudo o que vence nos próximos 7 dias: provas, entregas, retiradas e devoluções. Comece registrando o que está em andamento agora.</p>
        <a class="btn grande" href="#/novo">Registrar a primeira encomenda</a>
        <p class="ajuda">O cadastro é guiado, uma pergunta por vez.</p>
      `, 'destaque') : `
        ${sem.atrasados.length || sem.semana.length ? legenda() : ''}
        ${(sem.atrasados.length || sem.semana.length) && !s.dicaConcluirVista ? '<p class="dica-concluir">Terminou? Toque no botão e a tarefa sai da lista.</p>' : ''}
        ${sem.atrasados.length ? `<h2 class="secao alerta-txt">Atrasados</h2><div class="lista">${sem.atrasados.map((c) => linhaCompromisso(c, true)).join('')}</div>` : ''}
        <h2 class="secao secao-hoje">Hoje</h2>
        ${hojeLista.length ? `<div class="lista">${hojeLista.map((c) => linhaCompromisso(c)).join('')}</div>` : '<p class="vazio-curto">Nada para hoje.</p>'}
        <h2 class="secao">Próximos dias</h2>
        ${proximosDias.length ? `<div class="lista">${proximosDias.map((c) => linhaCompromisso(c)).join('')}</div>`
          : '<p class="vazio-curto">Nada nos próximos 6 dias. Toque em <b>+ Novo</b> para registrar uma encomenda ou um aluguel.</p>'}
        ${sem.depois.length ? `<a class="mais" href="#/proximos">Depois desta semana: ${sem.depois.length} compromisso${sem.depois.length > 1 ? 's' : ''} ›</a>` : ''}
      `}
      ${cartaoCompletarAtelie()}
      ${avisoInstalar()}
      ${avisoBackup()}
    `;
  },
};

telas.proximos = {
  aba: 'semana',
  render() {
    const sem = semana(S());
    return `${cab('Depois desta semana', 'Tudo o que vem a seguir, em ordem de data.', '#/semana')}
      ${sem.depois.length ? legenda() : ''}
      ${sem.depois.length ? `<div class="lista">${sem.depois.map((c) => linhaCompromisso(c)).join('')}</div>` : '<p class="vazio">Nada marcado depois desta semana.</p>'}`;
  },
};

// Folha "O que ficou decidido?" depois de marcar uma prova como feita.
function folhaNotas() {
  const { tipo, id, k } = ui.notas;
  const item = (tipo === 'aluguel' ? S().alugueis : S().encomendas).find((x) => x.id === id);
  if (!item) { ui.notas = null; return ''; }
  const e = etapa(item, k);
  return `<div class="folha-fundo" data-acao="fecharNotas"></div>
    <div class="folha" role="dialog" aria-label="Anotações da prova">
      <p class="ajuda">${esc(infoEtapa(item, k).nome)} feita · ${esc(nomeCliente(item.clienteId))}</p>
      <h2>O que ficou decidido?</h2>
      ${area(`encomendas#${id}.etapas#${k}.notas`, e.notas, 'id="notas-folha" placeholder="Ex.: subir a barra 2 cm, apertar 1 cm na cintura" rows="4"')}
      <p class="ajuda">Dica: toque no microfone do teclado para ditar.</p>
      ${galeria(`encomendas#${id}.etapas#${k}`, e.fotos, { aviso: AVISO_FOTO_CLIENTE })}
      <div class="acoes"><button class="btn" data-acao="fecharNotas">Salvar</button><button class="btn sec" data-acao="fecharNotas">Pular</button></div>
      <button class="link" data-acao="desfazerProva">Marquei sem querer: desfazer</button>
    </div>`;
}

// ---------- Tela: Novo ----------

const novoVazio = (tipo, extra = {}) => ({
  tipo, passo: 1, cliente: '', whatsapp: '', peca: '', evento: '', pecaId: '', retirada: '', devolucao: '',
  modeloId: S().ultimoModelo || '', prova: '', provaHora: '', entrega: '', obs: '', ...extra,
});

function novoForm(tipo) {
  if (!ui.novo || ui.novo.tipo !== tipo) ui.novo = novoVazio(tipo);
  return ui.novo;
}

// Cabeçalho do passo a passo: "Passo 2 de 4" e o voltar para o passo anterior.
const cabPasso = (titulo, n, ajuda = '') => `
  <header class="topo">
    ${n.passo > 1 ? '<button class="voltar" data-acao="passoAnterior" aria-label="Voltar">‹</button>' : '<a class="voltar" href="#/novo" aria-label="Voltar">‹</a>'}
    <div><span class="passo-de">Passo ${n.passo} de ${n.tipo === 'encomenda' ? 4 : 3}</span><h1>${titulo}</h1>${ajuda ? `<p>${ajuda}</p>` : ''}</div>
  </header>`;

function sugestoesCliente(texto) {
  const t = texto.trim().toLowerCase();
  if (!t) return '';
  const achadas = S().clientes.filter((c) => c.nome.toLowerCase().includes(t)).slice(0, 5);
  const exata = achadas.some((c) => c.nome.toLowerCase() === t);
  return `${achadas.map((c) => `<button type="button" class="chip ${c.nome.toLowerCase() === t ? 'on' : ''}" data-acao="escolherCliente" data-nome="${esc(c.nome)}">${esc(c.nome)}</button>`).join('')}
    ${!exata ? `<span class="ajuda">${achadas.length ? 'Ou continue digitando para ' : ''}criar a cliente <b>${esc(texto.trim())}</b>.</span>` : ''}`;
}

// Aviso em âmbar quando sobra pouca folga entre este aluguel e outro do mesmo vestido.
function avisosApertados(lista) {
  const dias = (n) => (n === 0 ? 'Não sobra nenhum dia livre' : `Sobra${n > 1 ? 'm' : ''} só ${n} dia${n > 1 ? 's' : ''} livre${n > 1 ? 's' : ''}`);
  return lista.map(({ aluguel: a, livres, antes }) => {
    const p = periodo(a);
    const quem = `<b>${esc(nomeCliente(a.clienteId))}</b>`;
    return antes
      ? `<p class="alerta">Data apertada: ${quem} devolve em ${diaMes(p.devolucao)} e a higienização vai até ${diaMes(p.fim)}. ${dias(livres)} antes desta retirada.</p>`
      : `<p class="alerta">Data apertada: ${quem} retira em ${diaMes(p.ini)}. ${dias(livres)} depois da higienização deste aluguel.</p>`;
  }).join('');
}

function avisoConflito(n) {
  if (!n.pecaId || !n.evento) return '';
  const ini = n.retirada || somaDias(n.evento, -prazos.retirada);
  const dev = n.devolucao || somaDias(n.evento, prazos.devolucao);
  const fim = somaDias(dev, prazos.higienizacao);
  const cs = conflitos(S().alugueis, n.pecaId, ini, fim);
  const ap = apertados(S().alugueis, n.pecaId, ini, fim);
  if (!cs.length && ap.length) return avisosApertados(ap);
  if (!cs.length) return '<p class="alerta ok">A peça está livre nessas datas.</p>';
  return cs.map((a) => { const p = periodo(a); return `<p class="alerta perigo">Esta peça está com <b>${esc(nomeCliente(a.clienteId))}</b> de ${diaMes(p.ini)} a ${diaMes(p.fim)} (com higienização). Escolha outra data ou outra peça.</p>`; }).join('');
}

telas.novo = {
  render(tipo) {
    if (tipo !== 'encomenda' && tipo !== 'aluguel') {
      return `${cab('O que vamos registrar?', '', '#/semana')}
        <div class="grandes">
          <a class="btn gigante" href="#/novo/encomenda" data-acao="outroNovo" data-tipo="encomenda"><b>Encomenda</b><span>Peça sob medida</span></a>
          <a class="btn gigante" href="#/novo/aluguel" data-acao="outroNovo" data-tipo="aluguel"><b>Aluguel</b><span>Vestido do seu acervo</span></a>
        </div>`;
    }
    const n = novoForm(tipo);
    const pecas = S().pecas;
    const existente = n.cliente.trim() && clientePorNome(n.cliente);
    const titulo = tipo === 'encomenda' ? 'Nova encomenda' : 'Novo aluguel';

    // Passo 1: quem é a cliente
    if (n.passo === 1) {
      return `${cabPasso('Quem é a cliente?', n, titulo)}
        ${cartao(`
          ${rotulo('Nome da cliente', campo('ui.novo.cliente', n.cliente, 'text', 'id="novo-cliente" autocomplete="off" autocapitalize="words" enterkeyhint="next" placeholder="Ex.: Mariana Souza"'))}
          <div class="sugestoes" id="sugestoes">${sugestoesCliente(n.cliente)}</div>
          ${existente ? `<p class="alerta ok">Cliente já cadastrada${existente.whatsapp ? `, com WhatsApp ${esc(existente.whatsapp)}` : ''}.</p>`
            : rotulo('WhatsApp', campo('ui.novo.whatsapp', n.whatsapp, 'tel', 'inputmode="tel" placeholder="(11) 98765-4321"'), 'Opcional. Serve para mandar as mensagens prontas.')}
        `)}
        <button class="btn grande" data-acao="proximoPasso">Continuar</button>`;
    }

    // Passo 2: a peça e o evento
    if (n.passo === 2) {
      return `${cabPasso(tipo === 'encomenda' ? 'Qual é a peça?' : 'Qual vestido e quando?', n, `Para ${esc(n.cliente.trim())}`)}
        ${cartao(`
          ${tipo === 'encomenda'
            ? rotulo('Peça', campo('ui.novo.peca', n.peca, 'text', 'autocomplete="off" enterkeyhint="next" placeholder="Ex.: vestido de festa longo"'))
            : `<div class="campo"><span>Vestido do acervo</span>
                ${pecas.length ? `<div class="chips">${pecas.map((p) => `<button type="button" class="chip ${n.pecaId === p.id ? 'on' : ''}" data-acao="escolherPeca" data-id="${p.id}">${esc(p.nome)}</button>`).join('')}</div>` : ''}
                ${campo('ui.novo.peca', n.peca, 'text', `autocomplete="off" placeholder="${pecas.length ? 'Ou o nome de um vestido novo' : 'Nome do vestido, ex.: nude bordado'}"`)}
              </div>`}
          ${rotulo('Data do evento', campo('ui.novo.evento', n.evento, 'date', `min="${somaDias(hojeISO(), -365)}"`))}
          ${tipo === 'encomenda' && S().modelos.length ? `<div class="campo"><span>Lista de etapas</span><div class="chips">
            ${[{ id: '', nome: 'Completa' }, ...S().modelos].map((m) => `<button type="button" class="chip ${(n.modeloId || '') === m.id && (m.id === '' || S().modelos.some((x) => x.id === n.modeloId)) ? 'on' : ''}" data-acao="escolherModelo" data-id="${m.id}">${esc(m.nome)}</button>`).join('')}
          </div></div>` : ''}
          ${tipo === 'aluguel' && n.evento ? `
            <div class="duplo">
              ${rotulo('Retirada', campo('ui.novo.retirada', n.retirada || somaDias(n.evento, -prazos.retirada), 'date'))}
              ${rotulo('Devolução', campo('ui.novo.devolucao', n.devolucao || somaDias(n.evento, prazos.devolucao), 'date'))}
            </div>
            <p class="ajuda">Sugestão: ${txtPrazo(prazos.retirada, 'antes')} e ${txtPrazo(prazos.devolucao, 'depois', 'devolução')}. Pode mudar. <a href="#/ajustes">Mudar a sugestão</a></p>
            ${avisoConflito(n)}` : ''}
        `)}
        <button class="btn grande" data-acao="proximoPasso">Continuar</button>`;
    }

    // Passo 3 da encomenda: as primeiras datas (opcional)
    if (tipo === 'encomenda' && n.passo === 3) {
      return `${cabPasso('Já tem datas marcadas?', n, 'Opcional. Com data, a prova e a entrega aparecem na aba Semana.')}
        ${cartao(`
          <div class="campo"><span>Primeira prova</span><div class="dia-hora">
            <label class="mini-campo"><span>Dia</span>${campo('ui.novo.prova', n.prova, 'date', 'aria-label="Dia da primeira prova"')}</label>
            <label class="mini-campo"><span>Horário</span>${campo('ui.novo.provaHora', n.provaHora, 'time', 'aria-label="Horário da primeira prova"')}</label>
          </div></div>
          ${rotulo('Entrega', campo('ui.novo.entrega', n.entrega, 'date'), n.evento ? `O evento é em ${dataBR(n.evento)}. Sem data de entrega, o app usa a do evento.` : '')}
        `)}
        <button class="btn grande" data-acao="proximoPasso">Continuar</button>
        <button class="btn grande sec" data-acao="pularPasso">Pular, marco depois</button>`;
    }

    // Último passo: observações (opcional) e cadastrar
    return `${cabPasso('Alguma observação?', n, 'Opcional. Ex.: tecido que ela vai trazer, referência de foto, prazo especial.')}
      ${cartao(rotulo('Observações', area('ui.novo.obs', n.obs, 'rows="4" placeholder="Escreva aqui o que for importante lembrar"')))}
      <button class="btn grande" data-acao="salvarNovo">${tipo === 'encomenda' ? 'Cadastrar encomenda' : 'Cadastrar aluguel'}</button>`;
  },
  depois() { $main.querySelector('input:not([type=date]):not([type=time]), textarea')?.focus(); },
};

// Confirmação depois de cadastrar: resumo e o que fazer em seguida.
telas.cadastrado = {
  render(id) {
    const s = S();
    const e = s.encomendas.find((x) => x.id === id);
    const a = s.alugueis.find((x) => x.id === id);
    const item = e || a;
    if (!item) return `${cab('Cadastro', '', '#/semana')}<p class="vazio">Não encontrei esse cadastro.</p>`;
    const c = acharCliente(item.clienteId);
    const clienteNova = ui.cadastrado?.id === id && ui.cadastrado.clienteNova;
    const linha = (rot, val) => (val ? `<dt>${rot}</dt><dd>${val}</dd>` : '');
    const prova = e && e.etapas.find((x) => infoEtapa(e, x).prova && x.data);
    const ent = e && etapa(e, 'entrega');
    const pr = a && periodo(a);
    return `
      <div class="feito-topo"><span class="feito-check" aria-hidden="true">✓</span>
        <h1>${e ? 'Encomenda cadastrada!' : 'Aluguel cadastrado!'}</h1>
        <p>${clienteNova ? `A cliente <b>${esc(c.nome)}</b> também foi cadastrada.` : `Na ficha de <b>${esc(c?.nome || '')}</b>.`}</p></div>
      ${cartao(`<dl class="resumo">
        ${linha('Cliente', esc(c?.nome || ''))}
        ${linha('WhatsApp', c?.whatsapp ? esc(c.whatsapp) : '<span class="falta">não informado</span>')}
        ${linha(e ? 'Peça' : 'Vestido', esc(nomePeca(item)))}
        ${linha('Evento', `${dataBR(item.evento)} <small>(${faltam(item.evento)})</small>`)}
        ${e ? linha(prova ? infoEtapa(e, prova).nome : 'Prova', prova ? `${dataBR(prova.data)}${horaTxt(prova.hora)}` : '<span class="falta">sem data ainda</span>') : ''}
        ${e ? linha('Entrega', ent.data ? dataBR(ent.data) : '<span class="falta">no dia do evento</span>') : ''}
        ${a ? linha('Retirada', dataBR(pr.ini)) : ''}
        ${a ? linha('Devolução', dataBR(pr.devolucao)) : ''}
        ${linha('Observações', esc(item.obs))}
      </dl>`)}
      <h2 class="secao">E agora?</h2>
      <div class="acoes coluna">
        <a class="btn grande" href="${e ? `#/encomenda/${e.id}` : `#/locacao/${a.id}`}">${e ? 'Abrir a encomenda' : 'Abrir o aluguel'}</a>
        <p class="ajuda">${e ? 'Na encomenda você marca as etapas, as datas das provas e põe tudo na agenda do celular.' : 'No aluguel você marca a retirada, a devolução e a higienização, e põe as datas na agenda.'}</p>
        <a class="btn sec" href="#/novo/${item.tipo}" data-acao="outroNovo" data-tipo="${item.tipo}">${e ? 'Cadastrar outra encomenda' : 'Cadastrar outro aluguel'}</a>
        <a class="btn sec" href="#/semana">Ver a semana</a>
      </div>`;
  },
};

// ---------- Tela: Encomendas ----------

function proximoPasso(item) {
  const e = item.etapas.find((x) => !x.feitaEm);
  if (!e) return 'Tudo feito';
  return `Próximo: ${infoEtapa(item, e).rotulo}${e.data ? ` · ${quando(e.data)}` : ''}`;
}

const STATUS_ENC = { andamento: 'Em andamento', entregue: 'Entregues', cancelada: 'Canceladas' };
const abasEnc = () => `<div class="seg" role="radiogroup">${Object.entries({ andamento: 'Em andamento', ano: '12 meses', entregue: 'Entregues' })
  .map(([k, t]) => `<button role="radio" aria-checked="${ui.filtroEnc === k}" data-acao="filtroEnc" data-v="${k}">${t}</button>`).join('')}</div>`;

// Visão do ano: quantas encomendas e quantos aluguéis caem em cada mês, contra a meta e o limite dela.
const CAMPOS_METAS = [
  ['Sob medida', 'metaSobMedida', 'capacidadeMes'],
  ['Aluguel', 'metaAluguel', 'limiteAluguel'],
];
const numMeta = (k) => Number(S()[k]) || 0;
function camposMetas() {
  return `<div class="metas">${CAMPOS_METAS.map(([nome, meta, limite]) => `<div class="metas-tipo"><b>${nome}</b>
      <label class="limite"><span>Meta</span><input type="number" inputmode="numeric" min="0" data-bind="${meta}" value="${numMeta(meta) || ''}" placeholder="—"></label>
      <label class="limite"><span>Limite</span><input type="number" inputmode="numeric" min="0" data-bind="${limite}" value="${numMeta(limite) || ''}" placeholder="—"></label>
    </div>`).join('')}</div>
    <p class="ajuda"><b>Meta:</b> quanto você quer fazer no mês. Bateu, a barra fica verde. <b>Limite:</b> o máximo que você dá conta. Passou, fica vermelha.</p>`;
}

function visaoAno() {
  const s = S();
  const meses = resumoMeses(s, ui.inicioMeses);
  const esteMes = hojeISO().slice(0, 7);
  const tipos = [
    { nome: 'Sob medida', meta: numMeta('metaSobMedida'), limite: numMeta('capacidadeMes'), qtd: (m) => m.encomendas.length },
    { nome: 'Aluguel', meta: numMeta('metaAluguel'), limite: numMeta('limiteAluguel'), qtd: (m) => m.alugueis.length },
  ];
  for (const t of tipos) t.maior = Math.max(t.meta, t.limite, ...meses.map(t.qtd), 1) * 1.1;
  // Uma barra: quanto já tem, o risquinho da meta, a faixa vermelha clarinha depois do limite e o número ao lado.
  const barra = (t, n, sit) => `<span class="linha-meta ${sit}">
      <span class="meta-nome">${t.nome}</span>
      <span class="barra-mes">${t.limite ? `<u style="left:${(t.limite / t.maior) * 100}%"></u>` : ''}<i style="width:${Math.min(100, (n / t.maior) * 100)}%"></i>${t.meta ? `<em style="left:${(t.meta / t.maior) * 100}%"></em>` : ''}</span>
      <span class="mes-qtd"><b>${n}</b>${t.meta ? ` de ${t.meta}` : t.limite ? ` de ${t.limite}` : ''}${sit === 'meta' ? ' ✓' : ''}</span></span>`;
  return `
    <div class="cal-cab"><button data-acao="meses" data-d="-12" aria-label="12 meses antes">‹</button>
      <b>${ui.inicioMeses === esteMes ? 'Próximos 12 meses' : `${mesCurtoAno(meses[0].mes)} a ${mesCurtoAno(meses[11].mes)}`}</b>
      <button data-acao="meses" data-d="12" aria-label="12 meses depois">›</button></div>
    ${cartao(camposMetas())}
    <div class="ano">${meses.map((m) => {
      const passado = m.mes < esteMes;
      const linhas = tipos.map((t) => ({ t, n: t.qtd(m), sit: situacaoMes(t.qtd(m), t.meta, t.limite) }));
      const acima = !passado && linhas.some((l) => l.sit === 'acima');
      const avisos = passado ? '' : linhas.map(({ t, sit }) => (sit === 'acima' ? `<p class="lot-txt acima">Acima do limite de ${t.nome.toLowerCase()}: agenda apertada</p>`
        : sit === 'meta' ? `<p class="lot-txt meta">Meta de ${t.nome.toLowerCase()} batida ✓</p>` : '')).join('');
      return `<details class="mes-ano ${acima ? 'acima' : ''} ${passado ? 'passado' : ''} ${m.mes === esteMes ? 'atual' : ''}">
        <summary>
          <span class="mes-nome">${maiuscula(MESES[Number(m.mes.slice(5)) - 1])}${m.mes.slice(5) === '01' || m === meses[0] ? ` <small>${m.mes.slice(0, 4)}</small>` : ''}
            ${acima ? '<span class="apertada-txt">Agenda apertada</span>' : ''}</span>
          <span class="barras">${linhas.map((l) => barra(l.t, l.n, l.sit)).join('')}</span>
        </summary>
        <div class="mes-lista">
          ${avisos}
          ${m.encomendas.map((e) => `<a href="#/encomenda/${e.id}"><b>${esc(nomeCliente(e.clienteId))}</b> · ${esc(e.peca)} <span>${e.status === 'entregue' ? 'entregue' : `entrega ${diaMes(etapa(e, 'entrega').data || e.evento)}`}</span></a>`).join('')}
          ${m.alugueis.map((a) => `<a href="#/locacao/${a.id}"><b>${esc(nomeCliente(a.clienteId))}</b> · aluguel: ${esc(nomePeca(a))} <span>evento ${diaMes(a.evento)}</span></a>`).join('')}
          ${!m.encomendas.length && !m.alugueis.length ? '<p class="ajuda">Nada marcado neste mês.</p>' : ''}
        </div>
      </details>`;
    }).join('')}</div>`;
}

// Miniatura na lista: a primeira foto de referência (ou, sem ela, a de uma prova), para achar a encomenda de olho.
function miniEncomenda(e) {
  const id = e.fotos?.[0] || e.etapas.find((x) => x.fotos?.length)?.fotos[0];
  return id ? `<span class="mini-lista"><img data-foto="${id}" alt=""></span>` : `<span class="mini-lista vazia">${ico('camera')}</span>`;
}

telas.encomendas = {
  render() {
    const lista = S().encomendas.filter((e) => e.status === ui.filtroEnc).sort((a, b) => a.evento.localeCompare(b.evento));
    if (ui.filtroEnc === 'ano') return `${cab('Encomendas')}${abasEnc()}${visaoAno()}`;
    return `
      ${cab('Encomendas', lista.length ? 'Toque numa encomenda para ver ou atualizar as etapas e os dados.' : '')}
      ${abasEnc()}
      ${lista.length ? `<div class="lista">${lista.map((e) => `<a class="linha-lista com-foto" href="#/encomenda/${e.id}">${miniEncomenda(e)}
          <div><b>${esc(nomeCliente(e.clienteId))}</b><span>${esc(e.peca)}</span><span class="passo-txt">${proximoPasso(e)}</span></div>
          <div class="dir"><span>Evento</span><b>${diaMes(e.evento)}</b></div></a>`).join('')}</div>`
        : `<p class="vazio">${ui.filtroEnc === 'andamento' ? 'Nenhuma encomenda em andamento. Toque em <b>+ Novo</b> para registrar uma.' : ui.filtroEnc === 'cancelada' ? 'Nenhuma encomenda cancelada.' : 'Nada por aqui ainda.'}</p>`}
      ${ui.filtroEnc === 'cancelada' ? '<button class="link" data-acao="filtroEnc" data-v="andamento">‹ Voltar para as encomendas em andamento</button>'
        : S().encomendas.some((e) => e.status === 'cancelada') ? '<button class="link" data-acao="filtroEnc" data-v="cancelada">Ver canceladas</button>' : ''}
    `;
  },
};

// Linha de uma etapa: marcar com um toque, data, hora, agenda e anotações.
function linhaEtapa(item, def, raiz) {
  const e = etapa(item, def.k);
  const b = `${raiz}#${item.id}.etapas#${def.k}`;
  const naAgenda = e.agendaEm && e.agendaEm === `${e.data} ${e.hora}`;
  const anterior = def.prova ? provaAnterior(item, def.k) : null;
  const mostraData = def.data && (def.dataPadrao || e.data || ui.abrirData === `${item.id}:${def.k}`);
  return `<div class="etapa ${e.feitaEm ? 'feita' : ''}">
    <button class="check-etapa" data-acao="etapa" data-k="${def.k}" aria-pressed="${!!e.feitaEm}" aria-label="${esc(def.nome)}${e.feitaEm ? ', feita' : ''}">
      <span class="bola">${e.feitaEm ? '✓' : ''}</span>
      <span class="etapa-nome">${esc(def.nome)}${e.feitaEm ? `<small>feita em ${diaMes(e.feitaEm)}</small>` : ''}</span>
    </button>
    ${def.data && !mostraData && !e.feitaEm ? `<button class="link mais-data" data-acao="abrirData" data-k="${def.k}">+ data</button>` : ''}
    ${mostraData ? `<div class="etapa-data">
        <label class="mini-campo"><span>Dia</span>${campo(`${b}.data`, e.data, 'date', `aria-label="Dia: ${esc(def.rotulo || def.nome)}"`)}</label>
        <label class="mini-campo"><span>Horário</span>${campo(`${b}.hora`, e.hora, 'time', `aria-label="Horário: ${esc(def.rotulo || def.nome)}"`)}</label>
        ${e.data ? `<div class="acoes-etapa"><button class="acao-etapa ${naAgenda ? 'ok' : ''}" data-acao="agenda" data-k="${def.k}">${naAgenda ? `${ico('ok')}Na agenda` : `${ico('agenda')}${e.agendaEm ? 'Data mudou: pôr de novo' : 'Pôr na agenda'}`}</button>` : ''}
        ${e.data && !e.feitaEm && tipoLembrete(item, def.k) ? `<a class="acao-etapa ${e.lembreteEm ? 'ok' : ''}" href="#/lembrete/${item.id}/${def.k}">${e.lembreteEm ? `${ico('ok')}Lembrada em ${diaMes(e.lembreteEm)}` : `${ico('conversa')}Lembrar a cliente`}</a>` : ''}${e.data ? '</div>' : ''}
      </div>` : ''}
    ${def.prova && (e.feitaEm || e.notas || e.fotos?.length) ? `<div class="notas-prova">${rotulo('O que ficou decidido', area(`${b}.notas`, e.notas, 'placeholder="Ex.: subir a barra 2 cm"'))}
      ${galeria(`${raiz}#${item.id}.etapas#${def.k}`, e.fotos, { aviso: AVISO_FOTO_CLIENTE })}</div>` : ''}
    ${anterior && !e.feitaEm ? `<div class="nota-anterior"><b>Da ${infoEtapa(item, anterior).nome}${anterior.feitaEm ? ` (${diaMes(anterior.feitaEm)})` : ''}:</b> ${esc(anterior.notas || '')}
      ${galeria(`${raiz}#${item.id}.etapas#${anterior.k}`, anterior.fotos, { soVer: true })}</div>` : ''}
  </div>`;
}

function cartaoWhats(item, cliente) {
  if (!cliente?.whatsapp) {
    return cartao(`<h2>WhatsApp da cliente</h2><p class="ajuda">Para mandar mensagens prontas, coloque o WhatsApp na <a href="#/cliente/${cliente?.id}">ficha da ${esc(cliente?.nome || 'cliente')}</a>.</p>`);
  }
  const prox = item.etapas.find((e) => infoEtapa(item, e).prova && e.data && !e.feitaEm);
  return cartao(`<h2>WhatsApp da cliente</h2>
    <div class="acoes coluna">
      ${prox ? `<a class="btn sec" target="_blank" rel="noopener" href="${esc(linkWhats(cliente.whatsapp, mensagemProva(cliente.nome, prox.data, prox.hora, S().mensagens)))}">Confirmar: ${esc(infoEtapa(item, prox).nome)}</a>` : ''}
      <a class="btn sec" target="_blank" rel="noopener" href="${esc(linkWhats(cliente.whatsapp, mensagemPronta(cliente.nome, item.peca, S().mensagens)))}">Avisar que está pronta</a>
      <a class="link" target="_blank" rel="noopener" href="${esc(linkWhats(cliente.whatsapp, ''))}">Abrir a conversa</a>
    </div>`);
}

// Personalizar as etapas: renomear, mudar a ordem, tirar, acrescentar e salvar como modelo.
function editorEtapas(item) {
  const ultimo = item.etapas.length - 1;
  return `<div class="cartao-cab"><h2>Personalizar etapas</h2><button class="btn peq" data-acao="editEtapas">Pronto</button></div>
    <p class="ajuda">Mude o nome, a ordem ou tire o que esta peça não usa. A entrega fica sempre por último.</p>
    ${item.etapas.map((e, i) => {
      const info = infoEtapa(item, e);
      return `<div class="ed-etapa">
        <input type="text" data-bind="encomendas#${item.id}.etapas#${e.k}.nome" value="${esc(info.nome)}" aria-label="Nome da etapa">
        <div class="ed-acoes">
          ${info.prova ? '<span class="pill pill-prova">prova</span>' : ''}
          ${info.fixa ? '<span class="ed-fixa">sempre a última</span>' : `
          <button class="ed-btn" data-acao="moverEtapa" data-k="${e.k}" data-d="-1" aria-label="Subir ${esc(info.nome)}" ${i === 0 ? 'disabled' : ''}>↑ Subir</button>
          <button class="ed-btn" data-acao="moverEtapa" data-k="${e.k}" data-d="1" aria-label="Descer ${esc(info.nome)}" ${i >= ultimo - 1 ? 'disabled' : ''}>↓ Descer</button>
          <button class="ed-btn tirar" data-acao="removerEtapa" data-k="${e.k}" aria-label="Tirar ${esc(info.nome)}">Tirar</button>`}
        </div>
      </div>`;
    }).join('')}
    <div class="ed-nova">
      <h3>Acrescentar etapa</h3>
      <div class="novo-item">${campo('ui.novaEtapa', ui.novaEtapa, 'text', 'id="nova-etapa" placeholder="Ex.: Bordado, Lavanderia"')}<button class="btn" data-acao="addEtapa">Acrescentar</button></div>
      <button class="chip ${ui.novaEtapaProva ? 'on' : ''}" data-acao="provaNova">${ui.novaEtapaProva ? '✓ ' : ''}É uma prova</button>
    </div>
    <div class="ed-nova">
      <h3>Usar esta lista em outras peças</h3>
      <div class="novo-item">${campo('ui.nomeModelo', ui.nomeModelo, 'text', 'id="nome-modelo" placeholder="Nome do modelo, ex.: Noiva"')}<button class="btn sec" data-acao="salvarModelo">Salvar modelo</button></div>
    </div>`;
}

// Planejamento da peça: tecidos, aviamentos e como fazer (para ela ou a ajudante).
function listaPlano(e, lista, exemplo) {
  const b = `encomendas#${e.id}.plano.${lista}`;
  return `<div class="lista-plano">${e.plano[lista].map((a) => ui.editPlano === a.id ? `<div class="item-plano editando">
      <div class="ed-linha">${campo(`${b}#${a.id}.nome`, a.nome, 'text', `placeholder="${exemplo}" aria-label="Nome" id="plano-${a.id}"`)}
      ${campo(`${b}#${a.id}.qtd`, a.qtd, 'text', `class="qtd" placeholder="Qtd." aria-label="Quantidade" id="qtd-${a.id}"`)}</div>
      <div class="ed-linha"><button class="ed-btn tirar" data-acao="tirarPlano" data-lista="${lista}" data-id="${a.id}">Tirar</button>
      <button class="btn peq" data-acao="editarPlano" data-id="">Pronto</button></div>
    </div>` : `<div class="item-plano ${a.ok ? 'feita' : ''}">
      <button class="bola-btn" data-acao="marcarPlano" data-lista="${lista}" data-id="${a.id}" aria-pressed="${a.ok}" aria-label="${a.ok ? 'Já tem' : 'Marcar que já tem'}"><span class="bola">${a.ok ? '✓' : ''}</span></button>
      <button class="texto-plano" data-acao="editarPlano" data-id="${a.id}" aria-label="Mudar ${esc(a.nome)}"><span>${esc(a.nome) || '<i>sem nome</i>'}</span>${a.qtd ? `<b>${esc(a.qtd)}</b>` : ''}</button>
    </div>`).join('')}</div>`;
}

function cartaoPlano(e) {
  e.plano = normalizarPlano(e.plano);
  const p = e.plano;
  const temAv = new Set(p.aviamentos.map((a) => a.nome.trim().toLowerCase()));
  const sugestoes = AVIAMENTOS_COMUNS.filter((n) => ![...temAv].some((t) => t.startsWith(n.toLowerCase())));
  const faltam = [...p.tecidos, ...p.aviamentos].filter((a) => a.nome.trim() && !a.ok).length;
  const vazio = !p.tecidos.length && !p.aviamentos.length && !e.obs?.trim();
  // Fechado (só o título e quanto falta comprar); ela toca para abrir. Começando do zero, já vem aberto.
  if (vazio) ui.planoAberto = e.id;
  const aberto = ui.planoAberto === e.id;
  const resumo = faltam ? `${faltam} para comprar` : p.tecidos.length || p.aviamentos.length ? 'Tudo comprado ✓' : '';
  const cabecalho = `<button class="abre-cartao" data-acao="abrirPlano" aria-expanded="${aberto}">
      <span><h2>Planejamento da peça</h2>${resumo ? `<small class="${faltam ? '' : 'ok-txt'}">${resumo}</small>` : ''}</span>
      ${setaCartao(aberto)}</button>`;
  if (!aberto) return cartao(cabecalho, 'cartao-fechado', 'id="plano"');
  return cartao(`${cabecalho}
    <p class="ajuda">Toque na bolinha do que já tem. Toque no nome para mudar.</p>
    <h3 class="sub-plano">Tecidos</h3>
    ${listaPlano(e, 'tecidos', 'Ex.: Zibeline (saia)')}
    <button class="link mais-item" data-acao="novoPlano" data-lista="tecidos">+ Tecido</button>
    <h3 class="sub-plano">Aviamentos</h3>
    ${listaPlano(e, 'aviamentos', 'Ex.: Zíper invisível')}
    ${sugestoes.length ? `<div class="chips">${sugestoes.map((n) => `<button class="chip" data-acao="novoPlano" data-lista="aviamentos" data-nome="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>` : ''}
    <button class="link mais-item" data-acao="novoPlano" data-lista="aviamentos">+ Outro aviamento</button>
    ${rotulo('Observações', area(`encomendas#${e.id}.obs`, e.obs, 'rows="4" placeholder="Ex.: pence dupla nas costas, barra feita à mão"'))}
    <h3 class="sub-plano">Croqui da ficha</h3>
    <div class="chips">${CROQUIS.map(([k, nome]) => `<button class="chip ${(e.croqui || 'adulta') === k ? 'on' : ''}" data-acao="escolherCroqui" data-v="${k}">${nome}</button>`).join('')}</div>
    <div class="acoes-etapa ficha-btn">
      ${faltam ? `<button class="acao-etapa" data-acao="abrirCompras">${ico('sacola')}Lista de compra (${faltam})</button>` : ''}
      <a class="acao-etapa" href="#/fichaPeca/${e.id}">${ico('ficha')}Ficha para imprimir</a></div>`, '', 'id="plano"');
}

function guiaEncomenda(e, c) {
  if (e.status !== 'andamento' || e.guiaOculto) return '';
  const prova = e.etapas.find((x) => infoEtapa(e, x).prova);
  const temProva = prova && (prova.data || prova.feitaEm);
  const ent = etapa(e, 'entrega');
  const naAgenda = e.etapas.some((x) => x.agendaEm);
  return guia('Próximos passos', [
    ...(prova ? [{ texto: `Marcar a data da ${esc(infoEtapa(e, prova).nome)}`, ajuda: 'Com data, ela aparece na aba Semana.', feito: !!temProva,
      botao: `<button class="btn peq" data-acao="focarData" data-k="${prova.k}">Marcar</button>` }] : []),
    { texto: 'Marcar a data de entrega', ajuda: 'Se não marcar, o app usa a data do evento.', feito: !!ent.data || !!ent.feitaEm,
      botao: '<button class="btn peq" data-acao="focarData" data-k="entrega">Marcar</button>' },
    { texto: 'Pôr as datas na agenda do celular', ajuda: 'A agenda avisa na véspera e no dia.', feito: naAgenda,
      botao: e.etapas.some((x) => x.data) ? '<button class="btn peq sec" data-acao="focarEtapas">Ver datas</button>' : '' },
    { texto: `WhatsApp da ${esc(c?.nome?.split(' ')[0] || 'cliente')}`, ajuda: 'Para mandar as mensagens prontas.', feito: !!c?.whatsapp,
      botao: `<a class="btn peq" href="#/cliente/${e.clienteId}" data-acao="focarWhats">Preencher</a>` },
    { texto: 'Medidas da cliente', ajuda: 'Ficam guardadas na ficha dela, com data.', feito: !!c?.medidas.length,
      botao: `<a class="btn peq" href="#/medidas/${e.clienteId}">Tirar</a>` },
  ], 'ocultarGuia');
}

// Etapas da encomenda: fechado, mostra só a próxima por fazer (a feita sai e entra a seguinte).
// Um toque no título abre a lista inteira, para desfazer, ver as anotações ou personalizar.
const setaCartao = (aberto) => `<svg class="seta ${aberto ? 'aberta' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
function cartaoEtapas(e) {
  const pend = e.etapas.filter((x) => !x.feitaEm);
  const todas = ui.todasEtapas === e.id;
  const aberta = ui.abrirData?.startsWith(`${e.id}:`) ? ui.abrirData.split(':')[1] : '';
  // A etapa que ela mandou marcar a data (pelos próximos passos) aparece mesmo se não for a próxima.
  const mostrar = todas ? e.etapas : e.etapas.filter((x) => x === pend[0] || x.k === aberta);
  const resumo = pend.length ? `Faltam ${pend.length} de ${e.etapas.length}` : 'Todas feitas ✓';
  return `<button class="abre-cartao" id="etapas" data-acao="verTodasEtapas" aria-expanded="${todas}">
      <span><h2>Etapas</h2><small class="${pend.length ? '' : 'ok-txt'}">${resumo}</small></span>${setaCartao(todas)}</button>
    ${!todas && pend.length ? '<p class="ajuda">A próxima. Toque para marcar como feita.</p>' : ''}
    ${todas ? '<p class="ajuda">Toque numa etapa para marcar como feita, ou numa feita para desfazer.</p>' : ''}
    ${mostrar.map((x) => linhaEtapa(e, infoEtapa(e, x), 'encomendas')).join('')}
    ${todas ? '<button class="link mais-item" data-acao="editEtapas">Personalizar as etapas</button>' : ''}`;
}

telas.encomenda = {
  aba: 'encomendas',
  render(id) {
    const e = S().encomendas.find((x) => x.id === id);
    if (!e) return `${cab('Encomenda', '', '#/encomendas')}<p class="vazio">Essa encomenda não existe mais.</p>`;
    const c = acharCliente(e.clienteId);
    const b = `encomendas#${e.id}`;
    return `
      ${cab(esc(e.peca), `<a href="#/cliente/${e.clienteId}">${esc(nomeCliente(e.clienteId))}</a> · evento ${dataBR(e.evento)}, ${faltam(e.evento)}`, '#/encomendas')}
      ${e.status !== 'andamento' ? `<p class="alerta ${e.status === 'cancelada' ? 'perigo' : 'ok'}">${e.status === 'cancelada' ? 'Encomenda cancelada.' : 'Encomenda entregue.'}</p>` : ''}
      ${cartao(`<h2>Fotos de referência</h2><p class="ajuda">O modelo que a cliente trouxe, o croqui, o tecido. A primeira aparece na lista de encomendas, para achar mais fácil.</p>${galeria(b, e.fotos)}`)}
      ${cartaoWhats(e, c)}
      ${guiaEncomenda(e, c)}
      ${cartaoPlano(e)}
      ${cartao(ui.editEtapas === e.id ? editorEtapas(e) : cartaoEtapas(e))}
      ${cartao(`<h2>Dados da encomenda</h2>
        ${rotulo('Peça', campo(`${b}.peca`, e.peca))}
        ${rotulo('Data do evento', campo(`${b}.evento`, e.evento, 'date'))}`)}
      <div class="acoes">
        ${e.status === 'cancelada' ? '<button class="btn sec" data-acao="reabrir">Reabrir encomenda</button>' : e.status === 'andamento' ? '<button class="btn sec" data-acao="cancelar">Cancelar encomenda</button>' : ''}
        <button class="btn perigo" data-acao="apagarItem">Apagar</button>
      </div>`;
  },
};

// ---------- Tela: Clientes ----------

telas.clientes = {
  render() {
    const s = S();
    const q = ui.busca.trim().toLowerCase();
    const ativos = (c) => s.encomendas.filter((e) => e.clienteId === c.id && e.status === 'andamento').length + s.alugueis.filter((a) => a.clienteId === c.id && a.status === 'andamento').length;
    const lista = s.clientes.filter((c) => !q || c.nome.toLowerCase().includes(q))
      .map((c) => ({ c, n: ativos(c) })).sort((a, b) => (b.n > 0) - (a.n > 0) || a.c.nome.localeCompare(b.c.nome));
    return `
      ${cab('Clientes', s.clientes.length ? 'Toque no nome para ver ou preencher a ficha: WhatsApp, medidas e histórico.' : '')}
      <a class="btn grande sec" href="#/novaCliente">+ Nova cliente</a>
      ${s.clientes.length ? `<div class="busca">${campo('ui.busca', ui.busca, 'search', 'placeholder="Buscar pelo nome" aria-label="Buscar cliente" id="busca"')}</div>` : ''}
      <div class="lista" id="lista-clientes">${lista.map(({ c, n }) => `<a class="linha-lista" href="#/cliente/${c.id}">
          <div><b>${esc(c.nome)}</b><span>${c.medidas.length ? `Medidas de ${diaMes(c.medidas[c.medidas.length - 1].data)}` : 'Sem medidas ainda'}</span></div>
          <div class="dir">${n ? `<span class="pill">${n} ativo${n > 1 ? 's' : ''}</span>` : ''}</div></a>`).join('')}</div>
      ${!s.clientes.length ? '<p class="vazio">Nenhuma cliente ainda. Toque em <b>+ Nova cliente</b>, ou registre uma encomenda em <b>+ Novo</b>: a cliente é cadastrada junto.</p>' : !lista.length ? '<p class="vazio">Nenhuma cliente com esse nome.</p>' : ''}
    `;
  },
};

telas.novaCliente = {
  aba: 'clientes',
  render() {
    const n = ui.novaCliente;
    return `
      ${cab('Nova cliente', 'Só o nome é obrigatório. O resto você completa na ficha dela.', '#/clientes')}
      ${cartao(`
        ${rotulo('Nome da cliente', campo('ui.novaCliente.nome', n.nome, 'text', 'id="nc-nome" autocomplete="off" autocapitalize="words" placeholder="Ex.: Mariana Souza"'))}
        ${rotulo('WhatsApp', campo('ui.novaCliente.whatsapp', n.whatsapp, 'tel', 'inputmode="tel" placeholder="(11) 98765-4321"'), 'Opcional. Serve para mandar as mensagens prontas.')}
      `)}
      <button class="btn grande" data-acao="salvarCliente">Cadastrar cliente</button>`;
  },
  depois() { document.getElementById('nc-nome')?.focus(); },
};

// Resumo: o valor mais recente de cada medida, com a data quando é de uma medição anterior.
function resumoMedidas(medidas) {
  const ultima = medidas[medidas.length - 1];
  const linhas = new Map();
  for (const m of medidas) for (const [k, v] of Object.entries(m.valores)) linhas.set(k, { v, data: m.data, antes: linhas.get(k)?.v });
  const ordem = (k) => { const i = MEDIDAS.indexOf(k); return i < 0 ? 999 : i; };
  return `<dl class="medidas">${[...linhas].sort(([a], [b]) => ordem(a) - ordem(b)).map(([k, x]) => {
    const velha = x.data !== ultima.data;
    const mudou = !velha && x.antes && x.antes !== x.v;
    return `<dt>${esc(k)}</dt><dd>${esc(x.v)}${mudou ? ` <small>(era ${esc(x.antes)})</small>` : ''}${velha ? ` <small class="velha">de ${diaMes(x.data)}</small>` : ''}</dd>`;
  }).join('')}</dl>`;
}

function tabelaMedidas(m, anterior) {
  const nomes = Object.keys(m.valores);
  if (!nomes.length) return '<p class="ajuda">Nenhuma medida preenchida.</p>';
  return `<dl class="medidas">${nomes.map((k) => {
    const antes = anterior?.valores[k];
    const mudou = antes && antes !== m.valores[k];
    return `<dt>${esc(k)}</dt><dd>${esc(m.valores[k])}${mudou ? ` <small>(era ${esc(antes)})</small>` : ''}</dd>`;
  }).join('')}</dl>`;
}

telas.cliente = {
  aba: 'clientes',
  depois() {
    if (!ui.focoWhats) return;
    ui.focoWhats = false;
    const el = document.getElementById('ficha-whats');
    el?.scrollIntoView({ block: 'center' }); el?.focus();
  },
  render(id) {
    const s = S();
    const c = acharCliente(id);
    if (!c) return `${cab('Cliente', '', '#/clientes')}<p class="vazio">Essa cliente não existe mais.</p>`;
    const b = `clientes#${c.id}`;
    const meds = c.medidas;
    const ultima = meds[meds.length - 1];
    const encs = s.encomendas.filter((e) => e.clienteId === c.id).sort((a, b2) => b2.evento.localeCompare(a.evento));
    const alus = s.alugueis.filter((a) => a.clienteId === c.id).sort((a, b2) => b2.evento.localeCompare(a.evento));
    const temTrabalho = encs.length || alus.length;
    return `
      ${cab(esc(c.nome), '', '#/clientes')}
      ${ui.recem?.id === c.id ? sucesso(`<b>Cliente cadastrada.</b> Agora é só seguir os próximos passos.`) : ''}
      ${!c.guiaOculto ? guia('Próximos passos', [
        { texto: 'WhatsApp', ajuda: 'Para mandar as mensagens prontas.', feito: !!c.whatsapp, botao: '<button class="btn peq" data-acao="focarWhats">Preencher</button>' },
        { texto: 'Medidas', ajuda: 'Ficam guardadas com a data.', feito: !!meds.length, botao: `<a class="btn peq" href="#/medidas/${c.id}">Tirar</a>` },
        { texto: 'Registrar uma encomenda ou um aluguel', ajuda: 'O nome dela já vem preenchido.', feito: !!temTrabalho,
          botao: `<a class="btn peq" href="#/novo/encomenda" data-acao="novoParaCliente" data-tipo="encomenda">Encomenda</a><a class="btn peq sec" href="#/novo/aluguel" data-acao="novoParaCliente" data-tipo="aluguel">Aluguel</a>` },
      ], 'ocultarGuia') : ''}
      ${cartao(`
        ${rotulo('Nome', campo(`${b}.nome`, c.nome, 'text', 'autocapitalize="words"'))}
        ${rotulo('WhatsApp', campo(`${b}.whatsapp`, c.whatsapp, 'tel', 'id="ficha-whats" inputmode="tel" placeholder="(11) 98765-4321"'))}
        ${c.whatsapp ? `<a class="link" target="_blank" rel="noopener" href="${esc(linkWhats(c.whatsapp, ''))}">Abrir conversa no WhatsApp</a>` : ''}
        ${rotulo('Observações', area(`${b}.obs`, c.obs, 'placeholder="Ex.: prefere decote fechado"'))}
      `)}
      ${cartao(`
        <div class="cartao-cab"><h2>Medidas</h2><a class="btn peq" href="#/medidas/${c.id}">+ Nova medição</a></div>
        ${ultima ? `<p class="ajuda">Última medição: ${dataBR(ultima.data)}</p>${resumoMedidas(meds)}
          <a class="acao-etapa ficha-btn" href="#/ficha/${c.id}">${ico('ficha')}Ficha para imprimir</a>
          ${meds.length > 1 ? `<details class="antigas"><summary>Medições anteriores (${meds.length - 1})</summary>
            ${meds.slice(0, -1).reverse().map((m) => `<h3>${dataBR(m.data)}</h3>${tabelaMedidas(m)}`).join('')}</details>` : ''}`
          : '<p class="ajuda">Nenhuma medida ainda. Toque em <b>+ Nova medição</b> quando tirar as medidas dela.</p>'}
      `)}
      ${cartao(`<h2>Histórico</h2>
        ${encs.length || alus.length ? `<div class="lista">
          ${encs.map((e) => {
            const notas = e.etapas.filter((p) => infoEtapa(e, p).prova && p.notas?.trim());
            return `<a class="linha-lista" href="#/encomenda/${e.id}"><div><b>${esc(e.peca)}</b><span>Encomenda · evento ${dataBR(e.evento)}</span>
              ${notas.map((p) => `<span class="nota-hist">${esc(infoEtapa(e, p).nome)}${p.feitaEm ? ` (${diaMes(p.feitaEm)})` : ''}: ${esc(p.notas)}</span>`).join('')}</div>
              <div class="dir"><span class="pill">${{ andamento: 'Em andamento', entregue: 'Entregue', cancelada: 'Cancelada' }[e.status]}</span></div></a>`;
          }).join('')}
          ${alus.map((a) => `<a class="linha-lista" href="#/locacao/${a.id}"><div><b>${esc(nomePeca(a))}</b><span>Aluguel · evento ${dataBR(a.evento)}</span></div>
              <div class="dir"><span class="pill">${a.status === 'andamento' ? 'Em andamento' : a.status === 'concluido' ? 'Concluído' : 'Cancelado'}</span></div></a>`).join('')}
        </div>` : '<p class="ajuda">Nenhuma encomenda ou aluguel ainda.</p>'}
      `)}
      <div class="acoes"><button class="btn perigo" data-acao="apagarCliente">Apagar cliente</button></div>
      <p class="ajuda">Apagar a cliente apaga também as medidas, as encomendas, os aluguéis e as fotos dela.</p>
    `;
  },
};

telas.medidas = {
  aba: 'clientes',
  render(id) {
    const c = acharCliente(id);
    if (!c) return `${cab('Medidas', '', '#/clientes')}<p class="vazio">Essa cliente não existe mais.</p>`;
    if (!ui.medicao || ui.medicao.clienteId !== id) ui.medicao = { clienteId: id, data: hojeISO(), valores: {}, extra: '' };
    const m = ui.medicao;
    const ultima = c.medidas[c.medidas.length - 1];
    const ocultas = new Set(S().medidasOcultas);
    // Medida escondida ainda aparece se a cliente já tem valor nela (para não sumir com o que foi anotado).
    const temValor = new Set([...c.medidas.flatMap((x) => Object.keys(x.valores)), ...Object.keys(m.valores)]);
    const campoMed = (k, num = '') => `<label class="medida"><span>${num ? `<i>${num}</i>` : ''}${esc(k)}</span>
      <input type="text" inputmode="decimal" data-bind="ui.medicao.valores.${esc(k)}" value="${esc(m.valores[k] || '')}" placeholder="${esc(ultima?.valores[k] || '')}"></label>`;
    const grupos = GRUPOS_MEDIDAS.map((g) => {
      const itens = g.medidas.filter((x) => !ocultas.has(x.nome) || temValor.has(x.nome));
      return itens.length ? `<h3 class="grupo-med">${g.nome}</h3><div class="grade-medidas">${itens.map((x) => campoMed(x.nome, x.num)).join('')}</div>` : '';
    }).join('');
    const outras = [...temValor].filter((k) => !MEDIDAS.includes(k));
    return `
      ${cab('Nova medição', esc(c.nome), `#/cliente/${id}`)}
      ${cartao(`
        ${rotulo('Data', campo('ui.medicao.data', m.data, 'date'))}
        <p class="ajuda">Em centímetros. Preencha só as que precisar.${ultima ? ' Em cinza, a medida anterior.' : ''}</p>
        <a class="link escolher-med" href="#/escolherMedidas/${id}">Escolher quais medidas aparecem</a>
        ${grupos}
        ${outras.length ? `<h3 class="grupo-med">Outras</h3><div class="grade-medidas">${outras.map((k) => campoMed(k)).join('')}</div>` : ''}
        <div class="novo-item">${campo('ui.medicao.extra', m.extra, 'text', 'placeholder="Outra medida, ex.: Altura do joelho"')}<button class="btn sec" data-acao="medidaExtra">Acrescentar</button></div>
      `)}
      <button class="btn grande" data-acao="salvarMedicao">Salvar medidas</button>
    `;
  },
};

// Escolher as medidas que aparecem na medição (as do guia; ela desmarca as que não usa).
telas.escolherMedidas = {
  aba: 'clientes',
  render(id) {
    const ocultas = new Set(S().medidasOcultas);
    const voltar = id ? `#/medidas/${id}` : '#/ajustes';
    const usadas = MEDIDAS.length - MEDIDAS.filter((k) => ocultas.has(k)).length;
    return `
      ${cab('Suas medidas', `${usadas} de ${MEDIDAS.length} aparecem na medição e nas fichas`, voltar)}
      <p class="dica">Toque para tirar as que você não usa. Dá para trazer de volta quando quiser.</p>
      ${GRUPOS_MEDIDAS.map((g) => cartao(`<h2>${g.nome}</h2>${g.medidas.map((x) => {
        const usa = !ocultas.has(x.nome);
        return `<button class="escolha-med ${usa ? 'on' : ''}" data-acao="alternarMedida" data-nome="${esc(x.nome)}" aria-pressed="${usa}">
          <span class="bola">${usa ? '✓' : ''}</span><span class="escolha-txt"><b><i>${x.num}</i>${esc(x.nome)}</b><small>${esc(x.dica)}</small></span></button>`;
      }).join('')}`)).join('')}
      <div class="acoes">${ocultas.size ? '<button class="btn sec" data-acao="mostrarTodasMedidas">Mostrar todas</button>' : ''}
        <a class="btn" href="${voltar}">Pronto</a></div>
    `;
  },
};

// ---------- Tela: Aluguel ----------

const PILL_SIT = { disponivel: 'pill-ok', reservada: 'pill-res', cliente: 'pill-cli', higienizacao: 'pill-hig' };

telas.aluguel = {
  render() {
    const s = S();
    const ativos = s.alugueis.filter((a) => a.status === 'andamento').sort((a, b) => periodo(a).ini.localeCompare(periodo(b).ini));
    return `
      ${cab('Aluguel', ui.abaAluguel === 'pecas' ? 'Cadastre aqui os vestidos que você aluga. Toque num vestido para ver o calendário e os dados dele.' : 'Toque num aluguel para marcar retirada, devolução e higienização.')}
      <div class="seg" role="radiogroup">
        <button role="radio" aria-checked="${ui.abaAluguel === 'pecas'}" data-acao="abaAluguel" data-v="pecas">Peças (${s.pecas.length})</button>
        <button role="radio" aria-checked="${ui.abaAluguel === 'alugueis'}" data-acao="abaAluguel" data-v="alugueis">Aluguéis ativos (${ativos.length})</button>
      </div>
      ${ui.abaAluguel === 'pecas' ? `
        ${s.pecas.length ? `<div class="lista">${s.pecas.map((p) => {
          const sit = situacaoPeca(s.alugueis, p.id);
          const detalhe = sit.k === 'cliente' ? `devolve ${diaMes(sit.ate)}` : sit.proxima ? `próxima reserva ${diaMes(sit.proxima)}` : '';
          return `<a class="linha-lista com-foto" href="#/peca/${p.id}">${p.fotos?.length ? `<span class="mini-lista"><img data-foto="${p.fotos[0]}" alt=""></span>` : `<span class="mini-lista vazia">${ico('camera')}</span>`}<div><b>${esc(p.nome)}</b><span>${[p.tamanho && `Tam. ${esc(p.tamanho)}`, p.cor && esc(p.cor)].filter(Boolean).join(' · ') || '&nbsp;'}</span></div>
            <div class="dir"><span class="pill ${PILL_SIT[sit.k]}">${sit.texto}</span>${detalhe ? `<span>${detalhe}</span>` : ''}</div></a>`;
        }).join('')}</div>` : '<p class="vazio">Cadastre os vestidos do seu acervo para controlar as datas de cada um.</p>'}
        ${cartao(`<div class="novo-item">${campo('ui.novaPeca', ui.novaPeca, 'text', 'placeholder="Nome da peça, ex.: vestido nude bordado" id="nova-peca"')}<button class="btn" data-acao="addPeca">Cadastrar</button></div>`)}
      ` : `
        ${ativos.length ? `<div class="lista">${ativos.map((a) => { const p = periodo(a); return `<a class="linha-lista" href="#/locacao/${a.id}">
            <div><b>${esc(nomeCliente(a.clienteId))}</b><span>${esc(nomePeca(a))}</span><span class="passo-txt">${proximoPasso(a)}</span></div>
            <div class="dir"><span>${diaMes(p.ini)} a ${diaMes(p.devolucao)}</span></div></a>`; }).join('')}</div>`
          : '<p class="vazio">Nenhum aluguel em andamento. Toque em <b>+ Novo</b> e escolha <b>Aluguel</b>.</p>'}
      `}
    `;
  },
  depois() { if (ui.abaAluguel === 'pecas' && ui.focoPeca) { document.getElementById('nova-peca')?.focus(); ui.focoPeca = false; } },
};

function calendario(ym, alugueis) {
  const [a, m] = ym.split('-').map(Number);
  const primeiro = new Date(a, m - 1, 1).getDay();
  const dias = new Date(a, m, 0).getDate();
  const hoje = hojeISO();
  const cel = [];
  for (let i = 0; i < primeiro; i++) cel.push('<span></span>');
  for (let d = 1; d <= dias; d++) {
    const iso = `${ym}-${String(d).padStart(2, '0')}`;
    const alu = alugueis.find((x) => { const p = periodo(x); return iso >= p.ini && iso <= p.fim; });
    const hig = alu && iso > periodo(alu).devolucao;
    cel.push(`<span class="dia ${alu ? (hig ? 'hig' : 'ocupado') : ''} ${iso === hoje ? 'hoje' : ''}" ${alu ? `title="${esc(nomeCliente(alu.clienteId))}"` : ''}>${d}</span>`);
  }
  return `<div class="cal-cab"><button data-acao="mesPeca" data-d="-1" aria-label="Mês anterior">‹</button><b>${maiuscula(mesNome(ym))}</b><button data-acao="mesPeca" data-d="1" aria-label="Próximo mês">›</button></div>
    <div class="cal">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x) => `<span class="sem">${x}</span>`).join('')}${cel.join('')}</div>
    <p class="legenda-cal"><span class="dia ocupado"></span> Alugada <span class="dia hig"></span> Higienização</p>`;
}

telas.peca = {
  aba: 'aluguel',
  render(id) {
    const s = S();
    const p = s.pecas.find((x) => x.id === id);
    if (!p) return `${cab('Peça', '', '#/aluguel')}<p class="vazio">Essa peça não existe mais.</p>`;
    const b = `pecas#${p.id}`;
    const dela = s.alugueis.filter((a) => a.pecaId === p.id && a.status !== 'cancelado').sort((x, y) => periodo(y).ini.localeCompare(periodo(x).ini));
    const sit = situacaoPeca(s.alugueis, p.id);
    return `
      ${cab(esc(p.nome), `<span class="pill ${PILL_SIT[sit.k]}">${sit.texto}</span>`, '#/aluguel')}
      ${cartao(`<h2>Fotos</h2>${galeria(b, p.fotos)}`)}
      ${cartao(calendario(ui.mesPeca, dela))}
      ${cartao(`<h2>Aluguéis desta peça</h2>
        ${dela.length ? `<div class="lista">${dela.map((a) => { const pr = periodo(a); return `<a class="linha-lista" href="#/locacao/${a.id}"><div><b>${esc(nomeCliente(a.clienteId))}</b><span>${diaMes(pr.ini)} a ${diaMes(pr.devolucao)} · evento ${diaMes(a.evento)}</span></div>
          <div class="dir"><span class="pill">${a.status === 'concluido' ? 'Concluído' : 'Em andamento'}</span></div></a>`; }).join('')}</div>` : '<p class="ajuda">Ainda não foi alugada.</p>'}
        <a class="btn sec" href="#/novo/aluguel" data-acao="alugarPeca" data-id="${p.id}">Alugar esta peça</a>`)}
      ${cartao(`<h2>Dados da peça</h2>
        ${rotulo('Nome', campo(`${b}.nome`, p.nome))}
        <div class="duplo">${rotulo('Tamanho', campo(`${b}.tamanho`, p.tamanho))}${rotulo('Cor', campo(`${b}.cor`, p.cor))}</div>
        ${rotulo('Observações', area(`${b}.obs`, p.obs, 'placeholder="Ex.: barra feita para salto 12"'))}`)}
      <div class="acoes"><button class="btn perigo" data-acao="apagarPeca">Apagar peça</button></div>
    `;
  },
};

telas.locacao = {
  aba: 'aluguel',
  render(id) {
    const s = S();
    const a = s.alugueis.find((x) => x.id === id);
    if (!a) return `${cab('Aluguel', '', '#/aluguel')}<p class="vazio">Esse aluguel não existe mais.</p>`;
    const c = acharCliente(a.clienteId);
    const b = `alugueis#${a.id}`;
    const pr = periodo(a);
    const cs = a.status === 'cancelado' ? [] : conflitos(s.alugueis, a.pecaId, pr.ini, pr.fim, a.id);
    return `
      ${cab(esc(nomePeca(a)), `<a href="#/cliente/${a.clienteId}">${esc(nomeCliente(a.clienteId))}</a> · evento ${dataBR(a.evento)}, ${faltam(a.evento)}`, '#/aluguel')}
      ${a.status === 'andamento' && !a.guiaOculto ? guia('Próximos passos', [
        { texto: 'Pôr a retirada na agenda', ajuda: 'A agenda avisa na véspera e no dia.', feito: !!etapa(a, 'retirada').agendaEm, botao: '<button class="btn peq" data-acao="agenda" data-k="retirada">Pôr na agenda</button>' },
        { texto: 'Pôr a devolução na agenda', feito: !!etapa(a, 'devolucao').agendaEm, botao: '<button class="btn peq" data-acao="agenda" data-k="devolucao">Pôr na agenda</button>' },
        { texto: `WhatsApp da ${esc(c?.nome?.split(' ')[0] || 'cliente')}`, ajuda: 'Para falar com ela antes da retirada.', feito: !!c?.whatsapp,
          botao: `<a class="btn peq" href="#/cliente/${a.clienteId}" data-acao="focarWhats">Preencher</a>` },
      ], 'ocultarGuia') : ''}
      ${a.status !== 'andamento' ? `<p class="alerta ${a.status === 'cancelado' ? 'perigo' : 'ok'}">${a.status === 'cancelado' ? 'Aluguel cancelado.' : 'Aluguel concluído. A peça está disponível de novo.'}</p>` : ''}
      ${cs.map((x) => { const p = periodo(x); return `<p class="alerta perigo">Conflito: a peça também está com <b>${esc(nomeCliente(x.clienteId))}</b> de ${diaMes(p.ini)} a ${diaMes(p.fim)} (com higienização).</p>`; }).join('')}
      ${a.status === 'andamento' ? avisosApertados(apertados(s.alugueis, a.pecaId, pr.ini, pr.fim, a.id)) : ''}
      ${cartao(`<h2>Etapas</h2><p class="ajuda">Toque numa etapa para marcar como feita.</p>
        ${a.etapas.map((x) => linhaEtapa(a, infoEtapa(a, x), 'alugueis')).join('')}`)}
      ${cartao(rotulo('Observações', area(`${b}.obs`, a.obs, 'placeholder="Ex.: ajustar a alça antes da retirada"')))}
      ${c?.whatsapp ? cartao(`<h2>WhatsApp da cliente</h2><a class="btn sec" target="_blank" rel="noopener" href="${esc(linkWhats(c.whatsapp, ''))}">Abrir a conversa</a>`) : ''}
      ${cartao(rotulo('Data do evento', campo(`${b}.evento`, a.evento, 'date')))}
      <div class="acoes">
        ${a.status === 'cancelado' ? '<button class="btn sec" data-acao="reabrir">Reabrir aluguel</button>' : a.status === 'andamento' ? '<button class="btn sec" data-acao="cancelar">Cancelar aluguel</button>' : ''}
        <button class="btn perigo" data-acao="apagarItem">Apagar</button>
      </div>`;
  },
};

// ---------- Tela: Lembrete para a cliente ----------

function dadosLembrete(id, k) {
  const s = S();
  const item = s.encomendas.find((x) => x.id === id) || s.alugueis.find((x) => x.id === id);
  if (!item || !etapa(item, k)?.data || !tipoLembrete(item, k)) return null;
  const cliente = acharCliente(item.clienteId);
  return { item, k, cliente, conteudo: conteudoLembrete({ item, k, cliente, peca: nomePeca(item), atelie: s.atelie, mensagens: s.mensagens }) };
}

let imagemAtual = null;

telas.lembrete = {
  render(id, k) {
    const d = dadosLembrete(id, k);
    if (!d) return `${cab('Lembrete', '', '#/semana')}<p class="vazio">Esse compromisso não tem data marcada. Marque a data para mandar o lembrete.</p>`;
    const { item, cliente, conteudo: c } = d;
    const e = etapa(item, k);
    const voltar = item.tipo === 'aluguel' ? `#/locacao/${item.id}` : `#/encomenda/${item.id}`;
    const faltaAtelie = !S().atelie.nome || !S().atelie.endereco;
    return `
      ${cab('Lembrete para a cliente', `${esc(cliente?.nome || '')} · ${esc(c.quando)}`, voltar)}
      ${e.lembreteEm ? sucesso(`Lembrete enviado em ${dataBR(e.lembreteEm)}. Pode mandar de novo, se quiser.`) : ''}
      ${faltaAtelie ? `<p class="alerta">Falta ${!S().atelie.nome ? 'o nome' : ''}${!S().atelie.nome && !S().atelie.endereco ? ' e ' : ''}${!S().atelie.endereco ? 'o endereço' : ''} do ateliê. <a href="#/ajustes">Preencher em Ajustes</a></p>` : ''}
      <img id="previa-lembrete" class="previa-img" alt="Lembrete para ${esc(cliente?.nome || 'a cliente')}">
      <div class="acoes coluna">
        <button class="btn grande" data-acao="mandarLembrete">Mandar a imagem</button>
        ${cliente?.whatsapp ? `<a class="btn sec" target="_blank" rel="noopener" href="${esc(linkWhats(cliente.whatsapp, textoLembrete(c)))}" data-acao="marcarLembrete">Mandar como texto no WhatsApp dela</a>`
          : `<p class="ajuda">Para mandar o texto direto no WhatsApp dela, coloque o número na <a href="#/cliente/${item.clienteId}">ficha da cliente</a>.</p>`}
        <button class="btn sec" data-acao="copiarLembrete">Copiar o texto</button>
      </div>
      <p class="ajuda">As orientações e o endereço vêm de <a href="#/ajustes">Ajustes</a>.</p>`;
  },
  async depois(id, k) {
    const d = dadosLembrete(id, k);
    if (!d) return;
    const blob = await imagemLembrete(d.conteudo);
    imagemAtual = { blob, nome: `lembrete-${(d.cliente?.nome || 'cliente').split(' ')[0].toLowerCase()}.png`, texto: textoLembrete(d.conteudo) };
    const img = document.getElementById('previa-lembrete');
    if (img) img.src = URL.createObjectURL(blob);
  },
};

// Ficha de medidas da cliente em imagem, para imprimir ou guardar.
function dadosFicha(id) {
  const cliente = acharCliente(id);
  if (!cliente) return null;
  const encs = S().encomendas.filter((e) => e.clienteId === id && e.status === 'andamento').sort((a, b) => a.evento.localeCompare(b.evento));
  return { cliente, conteudo: conteudoFicha({ cliente, atelie: S().atelie, encomenda: encs[0], ocultas: S().medidasOcultas }) };
}

telas.ficha = {
  aba: 'clientes',
  render(id) {
    const d = dadosFicha(id);
    if (!d) return `${cab('Ficha de medidas', '', '#/clientes')}<p class="vazio">Essa cliente não existe mais.</p>`;
    if (!d.conteudo.grupos.length) return `${cab('Ficha de medidas', esc(d.cliente.nome), `#/cliente/${id}`)}<p class="vazio">Ainda não há medidas dela. <a href="#/medidas/${id}">Tirar as medidas</a></p>`;
    return `
      ${cab('Ficha de medidas', esc(d.cliente.nome), `#/cliente/${id}`)}
      <img id="previa-ficha" class="previa-img previa-ficha" alt="Ficha de medidas de ${esc(d.cliente.nome)}">
      <div class="acoes coluna">
        <button class="btn grande" data-acao="mandarFicha">Salvar ou mandar a imagem</button>
        <button class="btn sec" data-acao="imprimirFicha">Imprimir</button>
      </div>
      <p class="ajuda">Vão as medidas mais recentes dela, na ordem do guia, e as observações da ficha.${S().atelie.nome ? '' : ' O nome do ateliê vem de <a href="#/ajustes">Ajustes</a>.'}</p>`;
  },
  async depois(id) {
    const d = dadosFicha(id);
    if (!d?.conteudo.grupos.length) return;
    const blob = await imagemFicha(d.conteudo);
    imagemAtual = { blob, nome: `medidas-${(d.cliente.nome || 'cliente').split(' ')[0].toLowerCase()}.png` };
    const img = document.getElementById('previa-ficha');
    if (img) img.src = URL.createObjectURL(blob);
  },
};

// Ficha da peça: planejamento + etapas + medidas, para deixar junto com a peça.
function dadosPeca(id) {
  const e = S().encomendas.find((x) => x.id === id);
  return e ? { e, conteudo: conteudoPeca({ encomenda: e, cliente: acharCliente(e.clienteId), atelie: S().atelie, ocultas: S().medidasOcultas }) } : null;
}
const carregarImagem = (url) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; });

telas.fichaPeca = {
  aba: 'encomendas',
  render(id) {
    const d = dadosPeca(id);
    if (!d) return `${cab('Ficha da peça', '', '#/encomendas')}<p class="vazio">Essa encomenda não existe mais.</p>`;
    return `
      ${cab('Ficha da peça', esc(d.e.peca), `#/encomenda/${id}`)}
      <p class="ajuda">São duas folhas para deixar juntas com a peça. O que estiver em branco sai com linha para escrever à mão.</p>
      <h3>Folha 1 · Produção</h3>
      <img id="previa-ficha" class="previa-img previa-ficha" alt="Folha de produção">
      <h3>Folha 2 · Croqui e medidas</h3>
      <img id="previa-ficha2" class="previa-img previa-ficha" alt="Folha do croqui e das medidas">
      <div class="acoes coluna">
        <button class="btn grande" data-acao="imprimirFicha">Imprimir as duas folhas</button>
        <button class="btn sec" data-acao="mandarFicha">Salvar ou mandar as imagens</button>
      </div>`;
  },
  async depois(id) {
    const d = dadosPeca(id);
    if (!d) return;
    const croqui = await carregarImagem(`croquis/croqui-${d.conteudo.croqui}.png`);
    const [b1, b2] = await imagensPeca(d.conteudo, { croqui });
    const nome = (d.conteudo.nome || 'cliente').split(' ')[0].toLowerCase();
    imagemAtual = { arquivos: [{ blob: b1, nome: `${nome}-producao.png` }, { blob: b2, nome: `${nome}-croqui-medidas.png` }] };
    const i1 = document.getElementById('previa-ficha');
    const i2 = document.getElementById('previa-ficha2');
    if (i1) i1.src = URL.createObjectURL(b1);
    if (i2) i2.src = URL.createObjectURL(b2);
  },
};

function editorOrientacoes() {
  const o = S().atelie.orientacoes;
  return [['provas', 'Provas e medidas'], ['aluguel', 'Aluguel (retirada e devolução)']].map(([g, t]) => `
    <h3>${t}</h3>
    ${o[g].map((txt, i) => `<div class="orient">
      ${area(`atelie.orientacoes.${g}.${i}`, txt, 'rows="2" aria-label="Orientação"')}
      <button class="ed-btn tirar" data-acao="tirarOrient" data-g="${g}" data-i="${i}" aria-label="Tirar orientação">Tirar</button></div>`).join('')}
    <button class="link" data-acao="addOrient" data-g="${g}">+ Acrescentar orientação</button>`).join('');
}

// ---------- Primeiro acesso: os dados do ateliê, uma vez só ----------

const PASSOS_ATELIE = 4;
const cabComecar = (n, titulo, ajuda) => `
  <header class="topo">
    <button class="voltar" data-acao="comecarVoltar" aria-label="Voltar">‹</button>
    <div><span class="passo-de">Passo ${n} de ${PASSOS_ATELIE}</span><h1>${titulo}</h1>${ajuda ? `<p>${ajuda}</p>` : ''}</div>
  </header>`;
const botoesComecar = (texto = 'Continuar') => `<button class="btn grande" data-acao="comecarProximo">${texto}</button>
  <button class="btn grande sec" data-acao="comecarProximo">Pular por enquanto</button>`;

telas.comecar = {
  render() {
    const a = S().atelie;
    const passo = ui.comecar || 0;
    if (passo === 0) {
      return `<div class="boas-vindas">
          <img src="icons/icon.svg" alt="" width="88" height="88">
          <h1>Bem-vinda ao Ateliê em Dia</h1>
          <p>Antes de começar, ${PASSOS_ATELIE} perguntas rápidas sobre o seu ateliê. Você só faz isso uma vez.</p>
          <p class="ajuda">Esses dados aparecem nos lembretes que você manda para as clientes.</p>
        </div>
        <button class="btn grande" data-acao="comecarProximo">Começar</button>
        <button class="btn grande sec" data-acao="comecarDepois">Fazer depois</button>`;
    }
    if (passo === 1) {
      return `${cabComecar(1, 'Qual é o nome do seu ateliê?', 'Aparece no topo dos lembretes.')}
        ${cartao(rotulo('Nome do ateliê', campo('atelie.nome', a.nome, 'text', 'autocapitalize="words" placeholder="Ex.: Ateliê Ingrid Castro"')))}
        <button class="btn grande" data-acao="comecarProximo">Continuar</button>`;
    }
    if (passo === 2) {
      return `${cabComecar(2, 'Qual é o WhatsApp do ateliê?', 'Para a cliente falar com você. Vai no rodapé dos lembretes.')}
        ${cartao(rotulo('WhatsApp do ateliê', campo('atelie.whatsapp', a.whatsapp, 'tel', 'inputmode="tel" placeholder="(11) 98765-4321"')))}
        ${botoesComecar()}`;
    }
    if (passo === 3) {
      return `${cabComecar(3, 'Onde fica o ateliê?', 'Para a cliente saber onde é a prova.')}
        ${cartao(rotulo('Endereço', campo('atelie.endereco', a.endereco, 'text', 'placeholder="Ex.: Rua das Flores, 120, sala 3, Centro"')))}
        ${botoesComecar()}`;
    }
    if (passo === 4) {
      return `${cabComecar(4, 'O que a cliente precisa saber?', 'Estas orientações vão no lembrete antes de cada prova ou aluguel. Já deixamos algumas sugestões: mude, tire ou acrescente.')}
        ${cartao(editorOrientacoes())}
        ${cartao(`<h2>Metas do mês <small>(opcional)</small></h2>${camposMetas()}<p class="ajuda">Dá para mudar depois em Encomendas › 12 meses.</p>`)}
        <button class="btn grande" data-acao="comecarProximo">Concluir</button>`;
    }
    // Fim: resumo
    const linha = (rot, val) => `<dt>${rot}</dt><dd>${val ? esc(val) : '<span class="falta">não informado</span>'}</dd>`;
    return `<div class="feito-topo"><span class="feito-check" aria-hidden="true">✓</span>
        <h1>Tudo pronto!</h1><p>Você pode mudar esses dados quando quiser em <b>Ajustes</b> (⚙︎).</p></div>
      ${cartao(`<dl class="resumo">
        ${linha('Ateliê', a.nome)}${linha('WhatsApp', a.whatsapp)}${linha('Endereço', a.endereco)}
        ${linha('Orientações', `${a.orientacoes.provas.filter((x) => x.trim()).length + a.orientacoes.aluguel.filter((x) => x.trim()).length}`)}
        ${CAMPOS_METAS.map(([nome, meta, limite]) => linha(nome, [numMeta(meta) && `meta ${numMeta(meta)}`, numMeta(limite) && `limite ${numMeta(limite)}`].filter(Boolean).join(', '))).join('')}
      </dl>`)}
      <h2 class="secao">E agora?</h2>
      <div class="acoes coluna">
        <a class="btn grande" href="#/novo/encomenda" data-acao="outroNovo" data-tipo="encomenda">Registrar a primeira encomenda</a>
        <button class="btn sec" data-acao="comecarFim">Ir para a semana</button>
      </div>`;
  },
  depois() { $main.querySelector('input')?.focus(); },
};

// ---------- Tela: Ajustes ----------

telas.ajustes = {
  aba: 'semana',
  render() {
    const s = S();
    return `
      ${cab('Ajustes', '', '#/semana')}
      ${cartao(`<h2>Seu ateliê</h2><p class="ajuda">Aparece nos lembretes para a cliente e nas fichas para imprimir.</p>
        ${rotulo('Nome do ateliê', campo('atelie.nome', s.atelie.nome, 'text', 'placeholder="Ex.: Ateliê Ingrid Castro"'))}
        ${rotulo('Endereço', campo('atelie.endereco', s.atelie.endereco, 'text', 'placeholder="Ex.: Rua das Flores, 120, sala 3"'), 'Para a cliente saber onde é a prova.')}
        ${rotulo('WhatsApp do ateliê', campo('atelie.whatsapp', s.atelie.whatsapp, 'tel', 'inputmode="tel" placeholder="(11) 98765-4321"'))}`, '', 'id="seu-atelie"')}
      ${cartao(`<h2>Orientações para a cliente</h2>
        <p class="ajuda">Vão no lembrete antes de cada compromisso. Mude o texto, tire ou acrescente.</p>
        ${editorOrientacoes()}`)}
      ${cartao(`<h2>Medidas</h2>
        <p class="ajuda">As medidas do guia que aparecem na medição e nas fichas para imprimir. Tire as que você não usa.</p>
        <a class="btn sec" href="#/escolherMedidas">Escolher medidas (${MEDIDAS.length - S().medidasOcultas.filter((k) => MEDIDAS.includes(k)).length} de ${MEDIDAS.length})</a>`)}
      ${cartao(`<h2>Mensagens prontas</h2>
        <p class="ajuda">Os textos que o app monta para mandar no WhatsApp. Mude do seu jeito. As palavras entre chaves são trocadas sozinhas: <b>{nome}</b> vira o nome da cliente, <b>{quando}</b> o dia e a hora, <b>{peca}</b> a peça.</p>
        ${[['prova', 'Confirmar a prova', 'Na encomenda, botão "Confirmar".'], ['pronta', 'Avisar que está pronta', 'Na encomenda, botão "Avisar que está pronta".'],
          ['final', 'Final do lembrete', 'A última frase do lembrete de prova, entrega e aluguel.']]
          .map(([k, t, onde]) => `<div class="msg-edit">${rotulo(t, area(`mensagens.${k}`, S().mensagens?.[k] || MENSAGENS_PADRAO[k], `rows="${k === 'final' ? 2 : 3}"`), onde)}
            ${S().mensagens?.[k]?.trim() && S().mensagens[k] !== MENSAGENS_PADRAO[k] ? `<button class="link" data-acao="mensagemOriginal" data-k="${k}">Voltar ao texto original</button>` : ''}</div>`).join('')}`)}
      ${cartao(`<h2>Prazos do aluguel</h2>
        <p class="ajuda">Usados para sugerir as datas de cada aluguel novo e para o calendário dos vestidos. Em cada aluguel você ainda pode mudar a retirada e a devolução.</p>
        <div class="prazos">
          ${[['retirada', 'Retirada', 'dias antes do evento'], ['devolucao', 'Devolução', 'dias depois do evento'],
            ['higienizacao', 'Higienização', 'dias depois da devolução'], ['folga', 'Avisar "data apertada"', 'com até quantos dias livres entre dois aluguéis']]
            .map(([k, t, ajuda]) => `<label class="prazo"><span><b>${t}</b><small>${ajuda}</small></span>
              <input type="number" inputmode="numeric" min="0" max="30" data-bind="prazosAluguel.${k}" value="${esc(S().prazosAluguel?.[k] ?? PRAZOS_PADRAO[k])}"></label>`).join('')}
        </div>
        <p class="ajuda">Mudar a higienização vale também para os aluguéis já cadastrados: o vestido fica bloqueado esse tempo depois de cada devolução.</p>`, '', 'id="prazos-aluguel"')}
      ${cartao(`<h2>Modelos de etapas</h2>
        ${s.modelos.length ? `<div class="lista">${s.modelos.map((m) => `<div class="linha-lista"><div><b>${esc(m.nome)}</b><span>${m.etapas.length} etapas</span></div>
          <button class="btn perigo peq" data-acao="apagarModelo" data-id="${m.id}">Apagar</button></div>`).join('')}</div>`
          : '<p class="ajuda">Para criar um modelo, abra uma encomenda, toque em <b>Personalizar</b> nas etapas e depois em <b>Salvar modelo</b>.</p>'}
        ${s.modelos.length ? '<p class="ajuda">Os modelos aparecem para escolher quando você registra uma encomenda nova.</p>' : ''}`)}
      ${cartao(`<h2>Backup</h2>
        <p>Tudo o que você registra fica só neste celular, inclusive as fotos. Faça um backup de tempos em tempos e guarde o arquivo no Drive, no iCloud ou mande para você mesma no WhatsApp. As fotos vão dentro do backup.</p>
        <p class="ajuda">${s.ultimoBackup ? `Último backup: ${dataBR(hojeISO(new Date(s.ultimoBackup)))}` : 'Nenhum backup feito ainda.'} O arquivo tem os dados das suas clientes: guarde com cuidado.</p>
        ${ui.backupPronto ? `<p class="alerta ok">Backup pronto${ui.backupPronto.fotos ? `, com ${ui.backupPronto.fotos} foto${ui.backupPronto.fotos > 1 ? 's' : ''}` : ''}. Toque para salvar ou mandar.</p>
          <button class="btn grande" data-acao="enviarBackupPronto">Salvar ou mandar o backup</button>` : ''}
        <div class="acoes"><button class="btn" data-acao="exportar">Fazer backup</button>
          <label class="btn sec">Restaurar um backup<input type="file" accept="application/json,.json" data-acao="importar" hidden></label></div>`)}
      ${cartao(`<h2>Privacidade</h2>
        <p>Os dados ficam guardados só neste aparelho. Ninguém mais tem acesso a eles, nem a Ingrid.</p>
        <p>As medidas e os contatos das suas clientes são dados pessoais. Você é responsável por eles: anote só o necessário e apague a ficha de quem pedir.</p>
        <p>Fotos de prova também são dados pessoais. Fotografe só com a autorização da cliente, prefira fotografar só a peça, sem o rosto, e apague as fotos quando ela pedir. Ao apagar uma cliente, as fotos dela são apagadas junto.</p>`)}
      ${cartao(`<h2>Guardar na tela do celular</h2>
        <p><b>iPhone:</b> no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.</p>
        <p><b>Android:</b> no Chrome, toque no menu (⋮) e depois em Instalar app.</p>`)}
      ${cartao(`<h2>Apagar tudo</h2><p class="ajuda">Apaga clientes, encomendas, peças, aluguéis e fotos deste aparelho. Faça um backup antes.</p>
        <div class="acoes"><button class="btn perigo" data-acao="apagarTudo">Apagar todos os dados</button></div>`)}
    `;
  },
};

// ---------- Agenda ----------

function porNaAgenda(item, k) {
  const e = etapa(item, k);
  const def = infoEtapa(item, k);
  const c = acharCliente(item.clienteId);
  const anterior = def.prova ? provaAnterior(item, k) : null;
  const ev = {
    id: `${item.id}-${k}`,
    titulo: `${def.rotulo} · ${c?.nome || ''} · ${nomePeca(item)}`,
    data: e.data, hora: e.hora,
    descricao: [c?.whatsapp && `WhatsApp: ${c.whatsapp}`, anterior?.notas?.trim() && `Da ${infoEtapa(item, anterior).nome}: ${anterior.notas}`].filter(Boolean).join('\n'),
  };
  if (ehAndroid()) {
    window.open(linkGoogleAgenda(ev), '_blank', 'noopener');
  } else {
    const ics = arquivoAgenda(ev);
    if (ehIOS()) {
      // O iPhone bloqueia abrir o arquivo em outra aba (e no app instalado ela nem existe).
      // O próprio app (service worker) entrega o arquivo num endereço dele, na mesma tela,
      // e o iPhone mostra "Adicionar à agenda".
      if (navigator.serviceWorker?.controller) location.href = `agenda.ics?ics=${encodeURIComponent(ics)}`;
      else location.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    } else {
      store.baixar(new Blob([ics], { type: 'text/calendar' }), `${def.rotulo}.ics`.replace(/[^\wÀ-ú .-]/g, ''));
    }
  }
  e.agendaEm = `${e.data} ${e.hora}`;
  tocar(item);
  store.salvar();
  render();
}

// ---------- Ações ----------

const itemDaRota = () => {
  const { nome, id } = rota();
  return nome === 'locacao' ? S().alugueis.find((a) => a.id === id) : S().encomendas.find((e) => e.id === id);
};

function concluirEtapa(item, k) {
  S().dicaConcluirVista = true; // depois do primeiro uso, a dica some
  const antes = { feitaEm: etapa(item, k).feitaEm, status: item.status };
  marcarEtapa(item, k, true);
  tocar(item);
  store.salvar();
  const def = infoEtapa(item, k);
  const voltar = () => { etapa(item, k).feitaEm = antes.feitaEm; item.status = antes.status; ui.notas = null; store.salvar(); render(); };
  if (def.prova) {
    // Prova: abre "O que ficou decidido?", que tem o próprio desfazer.
    ui.notas = { tipo: item.tipo, id: item.id, k, voltar };
    render();
    document.getElementById('notas-folha')?.focus();
    return;
  }
  render();
  toast(`${def.nome}: ${nomeCliente(item.clienteId)}`, voltar);
}

const acoes = {
  instalar() { promptInstalar?.prompt(); promptInstalar = null; },
  fecharInstalar() { S().avisoInstalarVisto = true; store.salvar(); render(); },
  async exportar() {
    toast('Preparando o backup…');
    let b;
    try { b = await store.prepararBackup(); } catch { return toast('Não foi possível preparar o backup.'); }
    const mb = b.blob.size / 1048576;
    try {
      await store.enviarBackup(b);
      ui.backupPronto = null;
      toast(`Backup criado${mb >= 1 ? ` (${mb.toFixed(0)} MB)` : ''}`);
    } catch {
      // O celular pediu um novo toque (as fotos demoraram para entrar no arquivo).
      ui.backupPronto = b;
      if (rota().nome !== 'ajustes') return ir('#/ajustes');
    }
    render();
  },
  async enviarBackupPronto() {
    const b = ui.backupPronto;
    if (!b) return;
    try { await store.enviarBackup(b); ui.backupPronto = null; toast('Backup criado'); } catch { toast('Não foi possível compartilhar. Tente de novo.'); }
    render();
  },
  desfazer() { const f = desfazer; desfazer = null; document.getElementById('toast').classList.remove('on'); f?.(); },
  concluir(el) {
    const lista = el.dataset.tipo === 'aluguel' ? S().alugueis : S().encomendas;
    concluirEtapa(lista.find((x) => x.id === el.dataset.id), el.dataset.k);
  },
  fecharNotas() { ui.notas = null; store.salvar(); render(); },
  desfazerProva() { ui.notas?.voltar(); },
  etapa(el) {
    const item = itemDaRota();
    const k = el.dataset.k;
    if (etapa(item, k).feitaEm) { marcarEtapa(item, k, false); tocar(item); store.salvar(); render(); return; }
    concluirEtapa(item, k); // prova: abre a folha "O que ficou decidido?"
  },
  abrirPlano() {
    const e = itemDaRota();
    const fechando = ui.planoAberto === e.id;
    ui.planoAberto = fechando ? null : e.id; ui.editPlano = null;
    if (fechando) for (const l of ['tecidos', 'aviamentos']) e.plano[l] = e.plano[l].filter((x) => x.nome.trim());
    store.salvar(); const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  // Lista de compra: o que falta comprar, para levar na loja.
  abrirCompras() {
    const e = itemDaRota();
    ui.compras = { id: e.id, ids: [...e.plano.tecidos, ...e.plano.aviamentos].filter((a) => a.nome.trim() && !a.ok).map((a) => a.id) };
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  fecharCompras() { ui.compras = null; const y = window.scrollY; render(); window.scrollTo(0, y); },
  comprado(el) {
    const e = itemDaRota();
    const a = [...e.plano.tecidos, ...e.plano.aviamentos].find((x) => x.id === el.dataset.id);
    if (!a) return;
    a.ok = !a.ok; tocar(e); store.salvar();
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  async mandarCompras() {
    const e = itemDaRota();
    const texto = textoCompras(e);
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else { await navigator.clipboard.writeText(texto); toast('Lista copiada. É só colar no WhatsApp.'); }
    } catch (err) { if (err.name !== 'AbortError') toast('Não foi possível mandar.'); }
  },
  verTodasEtapas() { const item = itemDaRota(); ui.todasEtapas = ui.todasEtapas === item.id ? null : item.id; const y = window.scrollY; render(); window.scrollTo(0, y); },
  agenda(el) { porNaAgenda(itemDaRota(), el.dataset.k); },
  escolherCliente(el) { ui.novo.cliente = el.dataset.nome; render(); },
  escolherPeca(el) { ui.novo.pecaId = ui.novo.pecaId === el.dataset.id ? '' : el.dataset.id; ui.novo.peca = ''; render(); },
  alugarPeca(el) { ui.novo = novoVazio('aluguel', { pecaId: el.dataset.id }); },
  salvarNovo() {
    const s = S();
    const n = ui.novo;
    const nome = n.cliente.trim();
    if (!nome) return toast('Escreva o nome da cliente.');
    if (n.tipo === 'encomenda' && !n.peca.trim()) return toast('Escreva qual é a peça.');
    if (n.tipo === 'aluguel' && !n.pecaId && !n.peca.trim()) return toast('Escolha a peça do acervo ou escreva o nome de uma nova.');
    if (!n.evento) return toast('Escolha a data do evento.');
    const clienteNova = !clientePorNome(nome);
    const cliente = clientePorNome(nome) || novaCliente(nome);
    if (n.whatsapp.trim() && !cliente.whatsapp) { cliente.whatsapp = n.whatsapp.trim(); tocar(cliente); }
    const base = { id: uid(), clienteId: cliente.id, evento: n.evento, obs: n.obs.trim(), status: 'andamento', criadoEm: agora(), alteradoEm: agora() };
    if (n.tipo === 'encomenda') {
      const modelo = s.modelos.find((m) => m.id === n.modeloId) || null;
      s.ultimoModelo = modelo ? modelo.id : '';
      const e = { ...base, tipo: 'encomenda', peca: n.peca.trim(), etapas: etapasEncomenda(modelo), versaoEtapas: VERSAO_ETAPAS };
      const prova = e.etapas.find((x) => infoEtapa(e, x).prova);
      if (prova && n.prova) { prova.data = n.prova; prova.hora = n.provaHora; }
      if (n.entrega) etapa(e, 'entrega').data = n.entrega;
      s.encomendas.push(e);
      ui.novo = null; ui.cadastrado = { id: e.id, clienteNova }; store.salvar(); ir(`#/cadastrado/${e.id}`);
    } else {
      let pecaId = n.pecaId;
      if (!pecaId) { const p = { id: uid(), nome: n.peca.trim(), tamanho: '', cor: '', obs: '', criadoEm: agora(), alteradoEm: agora() }; s.pecas.push(p); pecaId = p.id; }
      const etapas = etapasAluguel(n.evento);
      if (n.retirada) etapas.find((e) => e.k === 'retirada').data = n.retirada;
      if (n.devolucao) etapas.find((e) => e.k === 'devolucao').data = n.devolucao;
      const a = { ...base, tipo: 'aluguel', pecaId, etapas, versaoEtapas: VERSAO_ETAPAS };
      s.alugueis.push(a);
      ui.novo = null; ui.cadastrado = { id: a.id, clienteNova }; store.salvar(); ir(`#/cadastrado/${a.id}`);
    }
  },
  filtroEnc(el) { ui.filtroEnc = el.dataset.v; render(); },
  proximoPasso() {
    const n = ui.novo;
    if (n.passo === 1 && !n.cliente.trim()) return toast('Escreva o nome da cliente.');
    if (n.passo === 2) {
      if (n.tipo === 'encomenda' && !n.peca.trim()) return toast('Escreva qual é a peça.');
      if (n.tipo === 'aluguel' && !n.pecaId && !n.peca.trim()) return toast('Escolha o vestido ou escreva o nome de um novo.');
      if (!n.evento) return toast('Escolha a data do evento.');
    }
    n.passo += 1; render(); window.scrollTo(0, 0);
  },
  pularPasso() { ui.novo.prova = ''; ui.novo.provaHora = ''; ui.novo.entrega = ''; acoes.proximoPasso(); },
  passoAnterior() { ui.novo.passo = Math.max(1, ui.novo.passo - 1); render(); window.scrollTo(0, 0); },
  outroNovo(el) { ui.novo = novoVazio(el.dataset.tipo); },
  async mandarLembrete() {
    if (!imagemAtual) return;
    const arq = new File([imagemAtual.blob], imagemAtual.nome, { type: 'image/png' });
    if (navigator.canShare?.({ files: [arq] })) {
      try { await navigator.share({ files: [arq] }); } catch (e) { if (e.name === 'AbortError') return; }
    } else {
      store.baixar(imagemAtual.blob, imagemAtual.nome);
      toast('Imagem baixada');
    }
    acoes.marcarLembrete();
  },
  async mandarFicha() {
    if (!imagemAtual) return;
    const lista = imagemAtual.arquivos || [imagemAtual];
    const arqs = lista.map((a) => new File([a.blob], a.nome, { type: 'image/png' }));
    if (navigator.canShare?.({ files: arqs })) {
      try { await navigator.share({ files: arqs }); } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível compartilhar.'); }
    } else {
      lista.forEach((a) => store.baixar(a.blob, a.nome));
      toast(lista.length > 1 ? 'Imagens baixadas' : 'Imagem baixada');
    }
  },
  imprimirFicha() {
    const folhas = [...document.querySelectorAll('.previa-ficha')].filter((i) => i.src);
    if (!folhas.length) return;
    // Uma folha A4 por imagem (veja @media print no CSS).
    document.getElementById('impressao')?.remove();
    const caixa = document.createElement('div');
    caixa.id = 'impressao';
    folhas.forEach((i) => { const im = document.createElement('img'); im.src = i.src; im.alt = ''; caixa.appendChild(im); });
    document.body.appendChild(caixa);
    document.body.classList.add('imprimindo');
    const fim = () => { document.body.classList.remove('imprimindo'); caixa.remove(); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    setTimeout(() => window.print(), 50);
  },
  escolherCroqui(el) { const e = itemDaRota(); e.croqui = el.dataset.v; tocar(e); store.salvar(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  async copiarLembrete() {
    if (!imagemAtual) return;
    try { await navigator.clipboard.writeText(imagemAtual.texto); toast('Texto copiado. É só colar no WhatsApp.'); acoes.marcarLembrete(); }
    catch { toast('Não foi possível copiar.'); }
  },
  marcarLembrete() {
    const { id, extra: k } = rota();
    const s = S();
    const item = s.encomendas.find((x) => x.id === id) || s.alugueis.find((x) => x.id === id);
    if (!item) return;
    etapa(item, k).lembreteEm = hojeISO(); tocar(item); store.salvar();
    setTimeout(render, 300);
  },
  addOrient(el) { S().atelie.orientacoes[el.dataset.g].push(''); store.salvar(); render(); const t = [...document.querySelectorAll(`[data-bind^="atelie.orientacoes.${el.dataset.g}."]`)].pop(); t?.focus(); },
  tirarOrient(el) { S().atelie.orientacoes[el.dataset.g].splice(Number(el.dataset.i), 1); store.salvar(); render(); },
  comecarProximo() {
    ui.comecar = (ui.comecar || 0) + 1;
    if (ui.comecar > PASSOS_ATELIE) { S().inicioFeito = true; store.salvar(); }
    render(); window.scrollTo(0, 0);
  },
  comecarFim() { ui.comecar = 0; render(); window.scrollTo(0, 0); },
  comecarVoltar() { ui.comecar = Math.max(0, (ui.comecar || 0) - 1); render(); window.scrollTo(0, 0); },
  comecarDepois() { S().inicioFeito = true; ui.comecar = 0; store.salvar(); render(); },
  comecarDeNovo() { S().inicioFeito = false; ui.comecar = 1; render(); window.scrollTo(0, 0); },
  salvarCliente() {
    const nome = ui.novaCliente.nome.trim();
    if (!nome) return toast('Escreva o nome da cliente.');
    const existente = clientePorNome(nome);
    if (existente) { ui.novaCliente = { nome: '', whatsapp: '' }; toast('Essa cliente já estava cadastrada'); return ir(`#/cliente/${existente.id}`); }
    const c = novaCliente(nome);
    c.whatsapp = ui.novaCliente.whatsapp.trim();
    ui.novaCliente = { nome: '', whatsapp: '' };
    ui.recem = { id: c.id };
    store.salvar(); ir(`#/cliente/${c.id}`);
  },
  novoParaCliente(el) {
    const c = acharCliente(rota().id);
    ui.novo = novoVazio(el.dataset.tipo, { cliente: c.nome, passo: 2 });
  },
  ocultarGuia() {
    const { nome, id } = rota();
    const obj = nome === 'cliente' ? acharCliente(id) : itemDaRota();
    obj.guiaOculto = true; tocar(obj); store.salvar(); render();
  },
  // Leva até o campo de data da etapa (abre o "+ data" se precisar).
  focarData(el) {
    const item = itemDaRota();
    ui.abrirData = `${item.id}:${el.dataset.k}`; render();
    const campoData = document.querySelector(`[data-bind$="etapas#${el.dataset.k}.data"]`);
    campoData?.scrollIntoView({ block: 'center' }); campoData?.focus();
  },
  focarEtapas() { const item = itemDaRota(); if (item?.tipo === 'encomenda') { ui.todasEtapas = item.id; render(); } document.getElementById('etapas')?.scrollIntoView({ block: 'start' }); },
  focarWhats() { ui.focoWhats = true; if (rota().nome === 'cliente') { render(); } },
  editEtapas() { const item = itemDaRota(); ui.editEtapas = ui.editEtapas === item.id ? null : item.id; ui.novaEtapa = ''; ui.nomeModelo = ''; render(); },
  moverEtapa(el) { const item = itemDaRota(); if (moverEtapa(item, el.dataset.k, Number(el.dataset.d))) { tocar(item); store.salvar(); render(); } },
  removerEtapa(el) {
    const item = itemDaRota();
    const e = etapa(item, el.dataset.k);
    if ((e.feitaEm || e.notas?.trim() || e.data) && !confirm(`Tirar "${infoEtapa(item, e).nome}"? A data e as anotações dela também saem.`)) return;
    removerEtapa(item, el.dataset.k); tocar(item); store.salvar(); limparFotosDepois(); render();
  },
  addEtapa() {
    const nome = ui.novaEtapa.trim();
    if (!nome) return toast('Escreva o nome da etapa.');
    const item = itemDaRota();
    adicionarEtapa(item, nome, ui.novaEtapaProva);
    ui.novaEtapa = ''; ui.novaEtapaProva = false; tocar(item); store.salvar(); render();
    document.getElementById('nova-etapa')?.focus();
  },
  novoPlano(el) {
    const e = itemDaRota();
    e.plano = normalizarPlano(e.plano);
    const item = { id: uid(), nome: el.dataset.nome || '', qtd: '', ok: false };
    e.plano[el.dataset.lista].push(item);
    ui.editPlano = item.id;
    tocar(e); store.salvar();
    const y = window.scrollY; render(); window.scrollTo(0, y);
    // Do botão pronto, vai para a quantidade; do "+ Tecido" ou "+ Outro", para o nome.
    document.getElementById(`${item.nome ? 'qtd' : 'plano'}-${item.id}`)?.focus({ preventScroll: true });
  },
  editarPlano(el) {
    const e = itemDaRota();
    // Ao fechar, some o item que ficou sem nome.
    for (const l of ['tecidos', 'aviamentos']) e.plano[l] = e.plano[l].filter((x) => x.nome.trim() || x.id === el.dataset.id);
    ui.editPlano = el.dataset.id || null;
    store.salvar();
    const y = window.scrollY; render(); window.scrollTo(0, y);
    document.getElementById(`plano-${ui.editPlano}`)?.focus({ preventScroll: true });
  },
  marcarPlano(el) {
    const e = itemDaRota();
    const a = e.plano?.[el.dataset.lista]?.find((x) => x.id === el.dataset.id);
    if (!a) return;
    a.ok = !a.ok; tocar(e); store.salvar();
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  tirarPlano(el) {
    const e = itemDaRota();
    const lista = el.dataset.lista;
    const a = e.plano?.[lista]?.find((x) => x.id === el.dataset.id);
    if (!a) return;
    const antes = [...e.plano[lista]];
    e.plano[lista] = antes.filter((x) => x !== a);
    ui.editPlano = null; tocar(e); store.salvar();
    const y = window.scrollY; render(); window.scrollTo(0, y);
    if (a.nome.trim()) toast(`${a.nome.trim()} saiu da lista`, () => { e.plano[lista] = antes; tocar(e); store.salvar(); render(); });
  },
  provaNova() { ui.novaEtapaProva = !ui.novaEtapaProva; render(); },
  salvarModelo() {
    const nome = ui.nomeModelo.trim();
    if (!nome) return toast('Dê um nome para o modelo, ex.: Noiva.');
    const s = S();
    const existente = s.modelos.find((m) => m.nome.toLowerCase() === nome.toLowerCase());
    if (existente && !confirm(`Já existe o modelo "${existente.nome}". Trocar pela lista desta encomenda?`)) return;
    const m = { id: existente?.id || uid(), ...modeloDe(itemDaRota(), nome) };
    s.modelos = [...s.modelos.filter((x) => x.id !== m.id), m];
    ui.nomeModelo = ''; store.salvar(); toast(`Modelo "${nome}" salvo`); render();
  },
  apagarModelo(el) {
    const m = S().modelos.find((x) => x.id === el.dataset.id);
    if (!confirm(`Apagar o modelo "${m.nome}"? As encomendas que já usam essa lista não mudam.`)) return;
    S().modelos = S().modelos.filter((x) => x.id !== m.id); store.salvar(); render();
  },
  escolherModelo(el) { ui.novo.modeloId = el.dataset.id; render(); },
  comecarNovo() { ui.novo = null; },
  meses(el) { ui.inicioMeses = somaMeses(ui.inicioMeses, Number(el.dataset.d)); render(); },
  abrirData(el) { ui.abrirData = `${itemDaRota().id}:${el.dataset.k}`; render(); document.querySelector(`[data-bind$="etapas#${el.dataset.k}.data"]`)?.focus(); },
  abaAluguel(el) { ui.abaAluguel = el.dataset.v; render(); },
  mesPeca(el) {
    const [a, m] = ui.mesPeca.split('-').map(Number);
    const d = new Date(a, m - 1 + Number(el.dataset.d), 1);
    ui.mesPeca = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    render();
  },
  addPeca() {
    const nome = ui.novaPeca.trim();
    if (!nome) return toast('Escreva o nome da peça.');
    S().pecas.push({ id: uid(), nome, tamanho: '', cor: '', obs: '', criadoEm: agora(), alteradoEm: agora() });
    ui.novaPeca = ''; ui.focoPeca = true; store.salvar(); toast('Peça cadastrada'); render();
  },
  apagarPeca() {
    const id = rota().id;
    const usados = S().alugueis.filter((a) => a.pecaId === id && a.status === 'andamento').length;
    if (usados) return toast('Essa peça tem aluguel em andamento. Conclua ou cancele antes de apagar.');
    if (!confirm('Apagar esta peça? O histórico de aluguéis dela também some.')) return;
    S().pecas = S().pecas.filter((p) => p.id !== id);
    S().alugueis = S().alugueis.filter((a) => a.pecaId !== id);
    store.salvar(); limparFotosDepois(); ir('#/aluguel');
  },
  cancelar() { const item = itemDaRota(); item.status = item.tipo === 'aluguel' ? 'cancelado' : 'cancelada'; tocar(item); store.salvar(); render(); },
  reabrir() { const item = itemDaRota(); item.status = 'andamento'; tocar(item); store.salvar(); render(); },
  apagarItem() {
    const item = itemDaRota();
    if (!confirm(`Apagar ${item.tipo === 'aluguel' ? 'este aluguel' : 'esta encomenda'}? Isso não pode ser desfeito.`)) return;
    if (item.tipo === 'aluguel') S().alugueis = S().alugueis.filter((a) => a.id !== item.id);
    else S().encomendas = S().encomendas.filter((e) => e.id !== item.id);
    store.salvar(); limparFotosDepois(); ir(item.tipo === 'aluguel' ? '#/aluguel' : '#/encomendas');
  },
  apagarCliente() {
    const c = acharCliente(rota().id);
    if (!confirm(`Apagar ${c.nome}? As medidas, as encomendas, os aluguéis e as fotos dela também serão apagados. Isso não pode ser desfeito.`)) return;
    store.apagarCliente(c.id); store.salvar(); limparFotosDepois(); toast('Cliente apagada'); ir('#/clientes');
  },
  mensagemOriginal(el) { S().mensagens[el.dataset.k] = ''; store.salvar(); toast('Texto original de volta'); const y = window.scrollY; render(); window.scrollTo(0, y); },
  verFoto(el) { ui.foto = { alvo: el.dataset.alvo, id: el.dataset.id }; const y = window.scrollY; render(); window.scrollTo(0, y); },
  fecharFoto() { ui.foto = null; const y = window.scrollY; render(); window.scrollTo(0, y); },
  async apagarFoto() {
    if (!confirm('Apagar esta foto? Ela sai deste celular.')) return;
    const { alvo, id } = ui.foto;
    const r = resolver(`${alvo}.fotos`);
    if (r?.alvo.fotos) r.alvo.fotos = r.alvo.fotos.filter((x) => x !== id);
    const [raiz, rid] = alvo.split('.')[0].split('#');
    const dono = S()[raiz]?.find((x) => x.id === rid);
    if (dono) tocar(dono);
    store.salvar();
    ui.foto = null;
    await apagarFoto(id).catch(() => {});
    toast('Foto apagada'); const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  alternarMedida(el) {
    const nome = el.dataset.nome;
    const ocultas = S().medidasOcultas;
    const i = ocultas.indexOf(nome);
    if (i >= 0) ocultas.splice(i, 1); else ocultas.push(nome);
    store.salvar();
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  mostrarTodasMedidas() { S().medidasOcultas = []; store.salvar(); render(); },
  medidaExtra() {
    const nome = ui.medicao.extra.trim();
    if (!nome) return;
    ui.medicao.valores[nome] = ui.medicao.valores[nome] || '';
    ui.medicao.extra = ''; render();
    document.querySelector(`[data-bind="ui.medicao.valores.${CSS.escape(nome)}"]`)?.focus();
  },
  salvarMedicao() {
    const m = ui.medicao;
    const valores = Object.fromEntries(Object.entries(m.valores).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v));
    if (!Object.keys(valores).length) return toast('Preencha pelo menos uma medida.');
    const c = acharCliente(m.clienteId);
    c.medidas.push({ id: uid(), data: m.data || hojeISO(), valores });
    c.medidas.sort((a, b) => a.data.localeCompare(b.data));
    tocar(c); ui.medicao = null; store.salvar(); toast('Medidas salvas'); ir(`#/cliente/${c.id}`);
  },
  apagarTudo() {
    if (!confirm('Apagar TODOS os dados deste aparelho? Isso não pode ser desfeito.')) return;
    if (!confirm('Tem certeza? Sem backup, não há como recuperar.')) return;
    store.apagarTudo(); toast('Dados apagados'); ir('#/semana');
  },
};

// ---------- Eventos ----------

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.dataset?.bind || ['date', 'time', 'checkbox'].includes(el.type)) return;
  // Telefone: põe parênteses, espaço e traço sozinho (só quando ela digita no fim, para não pular o cursor).
  if (el.type === 'tel' && el.selectionStart === el.value.length) {
    const f = formatarTelefone(el.value);
    if (f !== el.value) el.value = f;
  }
  setPath(el.dataset.bind, el.value);
  // Atualizações parciais, sem tirar o foco do campo.
  if (el.dataset.bind === 'ui.novo.cliente') document.getElementById('sugestoes').innerHTML = sugestoesCliente(el.value);
  if (el.dataset.bind === 'ui.novo.peca' && ui.novo?.pecaId) { ui.novo.pecaId = ''; document.querySelectorAll('.chip.on[data-acao="escolherPeca"]').forEach((c) => c.classList.remove('on')); }
  if (el.dataset.bind === 'ui.busca') {
    const q = el.value.trim().toLowerCase();
    document.querySelectorAll('#lista-clientes .linha-lista').forEach((a) => { a.hidden = q && !a.querySelector('b').textContent.toLowerCase().includes(q); });
  }
});

// Saiu do campo de data ou hora: atualiza a tela um instante depois. Se ela tocou num botão,
// o botão já redesenha; se foi para outro campo, espera ela sair dele também.
document.addEventListener('focusout', () => {
  if (!redesenhoPendente) return;
  const pedido = Date.now();
  setTimeout(() => {
    if (!redesenhoPendente || ultimoRender > pedido) return;
    const ativo = document.activeElement;
    if (ativo && $main.contains(ativo) && ['INPUT', 'TEXTAREA'].includes(ativo.tagName)) return;
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }, 350);
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  // Data e hora: só guarda. Redesenhar agora fecharia o calendário do celular no meio da escolha
  // (o iPhone já preenche a data de hoje ao abrir). A tela atualiza quando ela sai do campo.
  if (el.dataset?.bind && ['date', 'time'].includes(el.type)) { setPath(el.dataset.bind, el.value); redesenhoPendente = true; return; }
  if (el.dataset?.bind && el.type === 'tel') { el.value = formatarTelefone(el.value); setPath(el.dataset.bind, el.value); return; }
  if (el.dataset?.bind?.startsWith('prazosAluguel.')) {
    const k = el.dataset.bind.split('.')[1];
    S().prazosAluguel[k] = prazoValido(k, el.value === '' ? PRAZOS_PADRAO[k] : el.value);
    store.salvar(); toast('Prazo salvo'); const y = window.scrollY; render(); window.scrollTo(0, y); return;
  }
  if (['metaSobMedida', 'capacidadeMes', 'metaAluguel', 'limiteAluguel'].includes(el.dataset?.bind)) { setPath(el.dataset.bind, Math.max(0, Math.round(Number(el.value) || 0))); render(); return; }
  if (el.dataset?.acao === 'addFoto' && el.files.length) {
    const alvo = el.dataset.alvo;
    const arquivos = [...el.files];
    el.value = '';
    toast(arquivos.length > 1 ? 'Guardando as fotos…' : 'Guardando a foto…');
    (async () => {
      let ok = 0;
      for (const f of arquivos) {
        try {
          const id = await guardarFoto(f);
          const r = resolver(`${alvo}.fotos`);
          if (!r) { await apagarFoto(id); continue; }
          r.alvo.fotos = [...(r.alvo.fotos || []), id];
          ok++;
        } catch { /* foto que não abriu: segue para a próxima */ }
      }
      const [raiz, rid] = alvo.split('.')[0].split('#');
      const dono = S()[raiz]?.find((x) => x.id === rid);
      if (dono) tocar(dono);
      store.salvar();
      if (!ok) return toast('Não foi possível guardar a foto.');
      toast(ok > 1 ? `${ok} fotos guardadas` : 'Foto guardada');
      // Na folha de anotações da prova, só atualiza as miniaturas (sem fechar a folha).
      const y = window.scrollY; render(); window.scrollTo(0, y);
    })();
    return;
  }
  if (el.dataset?.acao === 'importar' && el.files[0]) {
    if (!confirm('Restaurar este backup? Os dados atuais deste aparelho serão substituídos.')) { el.value = ''; return; }
    store.importar(el.files[0]).then(() => { toast('Backup restaurado'); ir('#/semana'); }).catch((e) => toast(e.message || 'Não foi possível ler o arquivo.'));
  }
});

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.tagName === 'INPUT') return;
  const f = acoes[el.dataset.acao];
  if (!f) return;
  if (el.tagName === 'BUTTON' || el.classList.contains('folha-fundo')) ev.preventDefault();
  f(el);
});

// Enter no nome da cliente pula para o próximo campo.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT') return;
  if (ev.target.id === 'nova-peca') { ev.preventDefault(); acoes.addPeca(); return; }
  if (ev.target.dataset.bind === 'ui.medicao.extra') { ev.preventDefault(); acoes.medidaExtra(); return; }
  if (ev.target.id === 'nova-etapa') { ev.preventDefault(); acoes.addEtapa(); return; }
  if (ev.target.id?.startsWith('qtd-')) { ev.preventDefault(); acoes.editarPlano({ dataset: { id: '' } }); return; }
  if (ev.target.dataset.bind === 'ui.novaCliente.whatsapp') { ev.preventDefault(); acoes.salvarCliente(); return; }
  if (ev.target.id === 'nome-modelo') { ev.preventDefault(); acoes.salvarModelo(); return; }
  const campos = [...$main.querySelectorAll('input:not([type=hidden]), textarea')];
  const i = campos.indexOf(ev.target);
  if (i >= 0 && campos[i + 1]) { ev.preventDefault(); campos[i + 1].focus(); return; }
  const avancar = $main.querySelector('[data-acao="proximoPasso"], [data-acao="comecarProximo"]');
  if (avancar) { ev.preventDefault(); avancar.click(); }
});

window.addEventListener('hashchange', () => {
  ui.notas = null; ui.editEtapas = null; ui.foto = null;
  if (rota().nome !== 'semana') ui.comecar = 0; // saiu do primeiro acesso
  render(); window.scrollTo(0, 0);
});
window.addEventListener('pagehide', store.gravar);
document.addEventListener('visibilitychange', () => { if (document.hidden) store.gravar(); });

store.carregar();
// Garante os campos novos do ateliê mesmo se o celular ainda tiver um arquivo antigo guardado.
if (!Array.isArray(S().medidasOcultas)) S().medidasOcultas = [];
S().prazosAluguel = { ...PRAZOS_PADRAO, ...S().prazosAluguel };
S().mensagens = { prova: '', pronta: '', final: '', ...S().mensagens };
S().atelie = { nome: '', endereco: '', whatsapp: '', orientacoes: structuredClone(ORIENTACOES_PADRAO), ...S().atelie };
if (S().inicioFeito === undefined) S().inicioFeito = !!(S().atelie.nome || S().encomendas.length || S().alugueis.length || S().clientes.length);
store.pedirArmazenamentoPersistente();
render();
protegerApp({ nome: 'Ateliê em Dia', icone: 'icons/icon-192.png', cor: '#6E2A3C' });

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

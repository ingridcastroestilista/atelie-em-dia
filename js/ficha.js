// Ficha de medidas da cliente em imagem (tamanho de folha A4), para imprimir ou guardar.
import { dataBR, diaMes, etapa, infoEtapa } from './regras.js';
import { GRUPOS_MEDIDAS, MEDIDAS } from './store.js';

// O valor mais recente de cada medida, na ordem do guia, separado por grupo.
export function conteudoFicha({ cliente, atelie, encomenda, ocultas = [] }) {
  const meds = cliente?.medidas || [];
  const ultima = meds[meds.length - 1];
  const valores = new Map();
  // Medida que ela escondeu (Escolher medidas) não vai para o papel.
  const esconder = new Set(ocultas);
  for (const m of meds) for (const [k, v] of Object.entries(m.valores)) if (String(v).trim() && !esconder.has(k)) valores.set(k, { v: String(v).trim(), data: m.data });
  const linha = (nome, num = '') => {
    const x = valores.get(nome);
    return { num, nome, valor: x.v.replace('.', ','), antiga: ultima && x.data !== ultima.data ? diaMes(x.data) : '' };
  };
  const grupos = GRUPOS_MEDIDAS.map((g) => ({ nome: g.nome, linhas: g.medidas.filter((x) => valores.has(x.nome)).map((x) => linha(x.nome, x.num)) }));
  const outras = [...valores.keys()].filter((k) => !MEDIDAS.includes(k));
  if (outras.length) grupos.push({ nome: 'Outras', linhas: outras.map((k) => linha(k)) });
  return {
    atelie: (atelie?.nome || '').trim(),
    whatsAtelie: (atelie?.whatsapp || '').trim(),
    nome: (cliente?.nome || '').trim(),
    whatsapp: (cliente?.whatsapp || '').trim(),
    data: ultima ? dataBR(ultima.data) : '',
    peca: encomenda ? `${encomenda.peca}${encomenda.evento ? ` · evento em ${dataBR(encomenda.evento)}` : ''}` : '',
    obs: (cliente?.obs || '').trim(),
    grupos: grupos.filter((g) => g.linhas.length),
  };
}

const MARSALA = '#6E2A3C';
const TINTA = '#2B2522';
const CINZA = '#6B6B6B';
const LINHA = '#D9D2CE';

function quebrar(ctx, texto, largura) {
  const out = [];
  let atual = '';
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) { out.push(atual); atual = p; } else atual = teste;
  }
  if (atual) out.push(atual);
  return out;
}

// A4 em pé (1240 × 1754, 150 dpi). Fundo branco e pouca tinta, para sair bem na impressora.
export async function imagemFicha(c) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1240;
  const H = 1754;
  const M = 90;
  const serif = '"Fraunces", Georgia, serif';
  const sans = '"Inter", system-ui, sans-serif';
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Cabeçalho: ateliê à esquerda, "Ficha de medidas" à direita, linha marsala.
  ctx.fillStyle = MARSALA;
  ctx.font = `600 50px ${serif}`;
  ctx.fillText(quebrar(ctx, c.atelie || 'Ficha de medidas', 700)[0], M, 130);
  ctx.font = `600 24px ${sans}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.textAlign = 'right';
  ctx.fillText(c.atelie ? 'FICHA DE MEDIDAS' : '', W - M, 126);
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillRect(M, 160, W - 2 * M, 4);

  // Dados da cliente.
  let y = 235;
  ctx.fillStyle = TINTA;
  ctx.font = `600 44px ${serif}`;
  ctx.fillText(quebrar(ctx, c.nome, W - 2 * M)[0] || '', M, y);
  y += 52;
  ctx.font = `400 26px ${sans}`;
  ctx.fillStyle = CINZA;
  const info = [c.whatsapp && `WhatsApp ${c.whatsapp}`, c.data && `Medidas de ${c.data}`].filter(Boolean).join('   ·   ');
  if (info) { ctx.fillText(info, M, y); y += 40; }
  if (c.peca) { ctx.fillText(quebrar(ctx, `Peça: ${c.peca}`, W - 2 * M)[0], M, y); y += 40; }
  y += 20;

  // Medidas em duas colunas; os grupos vão para a coluna com menos linhas.
  const colW = (W - 2 * M - 60) / 2;
  const ALT = 46;
  const TIT = 64;
  const alturaGrupo = (g) => TIT + g.linhas.length * ALT + 16;
  const colunas = [{ x: M, y, grupos: [] }, { x: M + colW + 60, y, grupos: [] }];
  for (const g of c.grupos) {
    const col = colunas[0].y <= colunas[1].y ? colunas[0] : colunas[1];
    col.grupos.push({ g, y: col.y });
    col.y += alturaGrupo(g);
  }
  const fimMedidas = Math.max(colunas[0].y, colunas[1].y);
  // Se não couber na folha, as linhas ficam um pouco mais juntas.
  const espaco = H - 260 - y;
  const escala = fimMedidas - y > espaco ? espaco / (fimMedidas - y) : 1;
  for (const col of colunas) {
    for (const { g, y: gy0 } of col.grupos) {
      let gy = y + (gy0 - y) * escala;
      const alt = ALT * escala;
      ctx.fillStyle = MARSALA;
      ctx.font = `600 22px ${sans}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
      ctx.fillText(g.nome.toUpperCase(), col.x, gy + 34 * escala);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      gy += TIT * escala;
      for (const l of g.linhas) {
        const base = gy + alt * 0.68;
        ctx.font = `600 22px ${sans}`;
        ctx.fillStyle = '#A8A29E';
        if (l.num) ctx.fillText(l.num, col.x, base);
        ctx.font = `400 26px ${sans}`;
        ctx.fillStyle = TINTA;
        const valor = `${l.valor} cm`;
        ctx.font = `600 26px ${sans}`;
        const wValor = ctx.measureText(valor).width;
        ctx.font = `400 26px ${sans}`;
        const xNome = col.x + (l.num ? 42 : 0);
        let nome = l.nome;
        const maxNome = colW - (xNome - col.x) - wValor - 24;
        // Nome comprido: letra um pouco menor antes de cortar.
        for (let t = 26; t > 20 && ctx.measureText(nome).width > maxNome; t -= 1) ctx.font = `400 ${t - 1}px ${sans}`;
        while (ctx.measureText(nome).width > maxNome && nome.length > 4) nome = `${nome.slice(0, -2)}…`;
        ctx.fillText(nome, xNome, base);
        ctx.textAlign = 'right';
        ctx.font = `600 26px ${sans}`;
        ctx.fillText(valor, col.x + colW, base);
        if (l.antiga) { ctx.font = `400 18px ${sans}`; ctx.fillStyle = CINZA; ctx.fillText(`de ${l.antiga}`, col.x + colW - wValor - 10, base); }
        ctx.textAlign = 'left';
        ctx.fillStyle = LINHA;
        ctx.fillRect(col.x, gy + alt - 1, colW, 1);
        gy += alt;
      }
    }
  }

  // Observações e rodapé.
  let yObs = y + (fimMedidas - y) * escala + 10;
  if (c.obs && yObs < H - 200) {
    ctx.fillStyle = MARSALA;
    ctx.font = `600 22px ${sans}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillText('OBSERVAÇÕES', M, yObs + 30);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = TINTA;
    ctx.font = `400 26px ${sans}`;
    yObs += 72;
    for (const l of quebrar(ctx, c.obs, W - 2 * M).slice(0, 4)) { ctx.fillText(l, M, yObs); yObs += 36; }
  }
  ctx.fillStyle = LINHA;
  ctx.fillRect(M, H - 110, W - 2 * M, 2);
  ctx.fillStyle = CINZA;
  ctx.font = `400 22px ${sans}`;
  ctx.fillText([c.atelie, c.whatsAtelie && `WhatsApp ${c.whatsAtelie}`].filter(Boolean).join('   ·   '), M, H - 70);
  ctx.textAlign = 'right';
  ctx.fillText('Medidas em centímetros', W - M, H - 70);
  ctx.textAlign = 'left';
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

// ---------- Ficha da peça (planejamento), para imprimir e deixar junto com a peça ----------

export const planoVazio = () => ({ tecidos: [], aviamentos: [], instrucoes: '' });
// Aviamentos mais usados, para acrescentar com um toque.
export const AVIAMENTOS_COMUNS = ['Entretela', 'Bojo', 'Zíper', 'Colchetes', 'Crinol', 'Barbatanas', 'Botões', 'Linha', 'Elástico', 'Pedraria'];
const idItem = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const itemPlano = (x) => ({ id: x.id || idItem(), nome: String(x.nome ?? ''), qtd: String(x.qtd ?? ''), ok: !!x.ok });

// Acerta o planejamento guardado (inclusive o formato antigo, com um tecido só e forro).
export function normalizarPlano(p = {}) {
  const out = { ...planoVazio(), ...p };
  if (!Array.isArray(out.tecidos)) out.tecidos = [];
  if (p.tecido || p.forro) {
    if (p.tecido) out.tecidos.unshift({ nome: p.tecido, qtd: p.metragem || '' });
    if (p.forro) out.tecidos.push({ nome: `Forro: ${p.forro}` });
    delete out.tecido; delete out.metragem; delete out.forro;
  }
  out.tecidos = out.tecidos.map(itemPlano);
  out.aviamentos = (Array.isArray(out.aviamentos) ? out.aviamentos : []).map(itemPlano);
  out.instrucoes = String(out.instrucoes ?? '');
  return out;
}

const diaHora = (data, hora) => (data ? `${diaMes(data)}${hora ? ` às ${hora.replace(':00', 'h').replace(':', 'h')}` : ''}` : '');

export const CROQUIS = [['adulta', 'Adulta'], ['gestante', 'Gestante'], ['plus', 'Plus size'], ['infantil', 'Infantil']];

// Tudo o que vai nas duas folhas da ficha da peça. ocultas: medidas do guia que ela não usa.
export function conteudoPeca({ encomenda: e, cliente, atelie, ocultas = [] }) {
  const p = normalizarPlano(e.plano);
  const ent = etapa(e, 'entrega');
  // A medida mais recente de cada nome. Na folha vão só as medidas do guia que ela escolheu usar
  // (as vazias com linha para escrever) e as extras que ela mesma criou.
  const meds = cliente?.medidas || [];
  const valores = new Map();
  for (const m of meds) for (const [k, v] of Object.entries(m.valores)) if (String(v).trim()) valores.set(k, String(v).trim().replace('.', ','));
  const esconder = new Set(ocultas);
  const nomes = [...MEDIDAS.filter((k) => !esconder.has(k)), ...[...valores.keys()].filter((k) => !MEDIDAS.includes(k))];
  return {
    atelie: (atelie?.nome || '').trim(),
    whatsAtelie: (atelie?.whatsapp || '').trim(),
    peca: (e.peca || '').trim(),
    nome: (cliente?.nome || '').trim(),
    whatsapp: (cliente?.whatsapp || '').trim(),
    evento: e.evento ? dataBR(e.evento) : '',
    entrega: ent?.data ? diaHora(ent.data, ent.hora) : '',
    tecidos: p.tecidos.filter((a) => a.nome.trim()).map((a) => ({ nome: a.nome.trim(), qtd: a.qtd.trim() })),
    aviamentos: p.aviamentos.filter((a) => a.nome.trim()).map((a) => ({ nome: a.nome.trim(), qtd: a.qtd.trim() })),
    // Observações da encomenda (e o texto "como fazer" de quem usou a primeira versão).
    obs: [e.obs, p.instrucoes].map((t) => (t || '').trim()).filter(Boolean).join('\n'),
    // Só a entrega sai com data; nas outras ela escreve à mão.
    etapas: e.etapas.map((x) => ({ nome: infoEtapa(e, x).nome, quando: x.k === 'entrega' ? diaHora(x.data, x.hora) : '' })),
    provas: e.etapas.filter((x) => infoEtapa(e, x).prova).map((x) => infoEtapa(e, x).nome),
    croqui: CROQUIS.some(([k]) => k === e.croqui) ? e.croqui : 'adulta',
    dataMedidas: meds.length ? dataBR(meds[meds.length - 1].data) : '',
    medidas: nomes.map((nome) => ({ nome, valor: valores.get(nome) || '' })),
  };
}

function titulo(ctx, txt, x, y, sans) {
  ctx.fillStyle = MARSALA;
  ctx.font = `600 22px ${sans}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillText(txt.toUpperCase(), x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}
function caixinha(ctx, x, y) {
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#8A817C';
  ctx.strokeRect(x, y, 26, 26);
}
const linhaEmBranco = (ctx, x, y, w) => { ctx.fillStyle = LINHA; ctx.fillRect(x, y, w, 2); };

const W_A4 = 1240, H_A4 = 1754, MARGEM = 80, RODAPE = 130;
const LIMITE = H_A4 - RODAPE - 20; // até onde o conteúdo pode ir
const SERIF = '"Fraunces", Georgia, serif';
const SANS = '"Inter", system-ui, sans-serif';

// Cabeçalho comum às duas folhas. Devolve onde o conteúdo começa.
function cabecalho(ctx, c, nomeFolha, f, linhas) {
  const W = W_A4, M = MARGEM, larg = W - 2 * M;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, ctx.canvas.height);
  ctx.fillStyle = MARSALA;
  ctx.font = `600 46px ${SERIF}`;
  ctx.fillText(quebrar(ctx, c.atelie || c.peca || 'Ficha da peça', 680)[0], M, 120);
  ctx.font = `600 24px ${SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.textAlign = 'right';
  ctx.fillText(nomeFolha.toUpperCase(), W - M, 116);
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillRect(M, 150, larg, 4);
  let y = 218;
  ctx.fillStyle = TINTA;
  ctx.font = `600 ${f(44)}px ${SERIF}`;
  for (const l of quebrar(ctx, c.peca, larg).slice(0, 2)) { ctx.fillText(l, M, y); y += f(52); }
  ctx.font = `400 ${f(26)}px ${SANS}`;
  ctx.fillStyle = CINZA;
  for (const t of linhas.filter(Boolean)) { ctx.fillText(quebrar(ctx, t, larg)[0], M, y); y += f(38); }
  return y;
}
function rodape(ctx, c, texto) {
  const M = MARGEM, H = H_A4;
  ctx.fillStyle = LINHA;
  ctx.fillRect(M, H - 110, W_A4 - 2 * M, 2);
  ctx.fillStyle = CINZA;
  ctx.font = `400 22px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText([c.atelie, c.whatsAtelie && `WhatsApp ${c.whatsAtelie}`].filter(Boolean).join('   ·   '), M, H - 70);
  ctx.textAlign = 'right';
  ctx.fillText(texto, W_A4 - M, H - 70);
  ctx.textAlign = 'left';
}
// Espaço para escrever a data: "___ / ___".
function espacoData(ctx, xFim, yy, larg, f) {
  const meio = (larg - 18) / 2;
  linhaEmBranco(ctx, xFim - larg, yy + 4, meio);
  linhaEmBranco(ctx, xFim - meio, yy + 4, meio);
  ctx.font = `400 ${f(24)}px ${SANS}`; ctx.fillStyle = '#A8A29E'; ctx.textAlign = 'center';
  ctx.fillText('/', xFim - meio - 9, yy + 2); ctx.textAlign = 'left';
}
// Texto que diminui um pouco e, se ainda não couber, é cortado com "…".
function caber(ctx, texto, max, px, peso = 400, minimo = 19) {
  let t = px;
  ctx.font = `${peso} ${t}px ${SANS}`;
  while (ctx.measureText(texto).width > max && t > minimo) ctx.font = `${peso} ${--t}px ${SANS}`;
  let n = texto;
  while (ctx.measureText(n).width > max && n.length > 4) n = `${n.slice(0, -2)}…`;
  return n;
}

// ---------- Folha 1: produção (materiais, etapas e anotações das provas) ----------

function desenharProducao(ctx, c, k) {
  const W = W_A4, M = MARGEM, larg = W - 2 * M;
  const f = (px) => Math.round(px * Math.max(k, 0.86));
  const R = 46 * k;
  const y0 = cabecalho(ctx, c, 'Produção', f, [
    [c.nome && `Cliente: ${c.nome}`, c.whatsapp].filter(Boolean).join('   ·   '),
    [c.evento && `Evento: ${c.evento}`, c.entrega && `Entrega: ${c.entrega}`].filter(Boolean).join('   ·   '),
  ]);
  const tit = (txt, x, yy) => titulo(ctx, txt, x, yy, SANS);
  const item = (a, x, yy, w) => {
    caixinha(ctx, x, yy - 22);
    let wq = 0;
    if (a.qtd) { ctx.font = `600 ${f(23)}px ${SANS}`; ctx.fillStyle = TINTA; ctx.textAlign = 'right'; ctx.fillText(a.qtd, x + w, yy); ctx.textAlign = 'left'; wq = ctx.measureText(a.qtd).width + 14; }
    if (!a.nome) { linhaEmBranco(ctx, x + 42, yy + 4, w - 42); return; }
    ctx.fillStyle = TINTA;
    ctx.fillText(caber(ctx, a.nome, w - 42 - wq, f(25)), x + 42, yy);
  };
  const branco = (q) => Array.from({ length: q }, () => ({ nome: '', qtd: '' }));
  const lista = (nome, itens, vazias, x, yy, w) => {
    tit(nome, x, yy);
    yy += 12 * k;
    for (const a of itens.length ? itens : branco(vazias)) { yy += R; item(a, x, yy, w); }
    return yy;
  };

  // Materiais: tecidos numa coluna, aviamentos na outra.
  let y = y0 + 24 * k + 22;
  const meia = (larg - 50) / 2;
  const fim = Math.max(lista('Tecidos', c.tecidos, 4, M, y, meia), lista('Aviamentos', c.aviamentos, 6, M + meia + 50, y, meia));
  y = fim + 60 * k;

  if (c.obs) {
    tit('Observações', M, y);
    y += 44 * k;
    ctx.font = `400 ${f(25)}px ${SANS}`; ctx.fillStyle = TINTA;
    for (const par of c.obs.split(/\n+/)) for (const l of quebrar(ctx, par, larg)) { ctx.fillText(l, M, y); y += f(36); }
    y += 30 * k;
  }

  // Etapas em duas colunas, com espaço para a data.
  tit('Etapas', M, y);
  y += 12 * k;
  const metade = Math.ceil(c.etapas.length / 2);
  c.etapas.forEach((et, i) => {
    const x = i < metade ? M : M + meia + 50;
    const yy = y + R * ((i % metade) + 1);
    caixinha(ctx, x, yy - 22);
    let wd = 110;
    if (et.quando) { ctx.font = `600 ${f(23)}px ${SANS}`; ctx.fillStyle = MARSALA; ctx.textAlign = 'right'; ctx.fillText(et.quando, x + meia, yy); ctx.textAlign = 'left'; wd = ctx.measureText(et.quando).width; }
    else espacoData(ctx, x + meia, yy, 110, f);
    ctx.fillStyle = TINTA;
    ctx.fillText(caber(ctx, et.nome, meia - 42 - wd - 14, f(25)), x + 42, yy);
  });
  y += R * metade + 64 * k;

  // Anotações das provas: só o título e linhas até o fim da folha; ela decide como usar.
  const RL = 44 * k;
  tit('Anotações das provas', M, y);
  y += 10 * k;
  const linhas = Math.max(4, Math.floor((LIMITE - y - 10) / RL));
  for (let l = 0; l < linhas; l++) { y += RL; linhaEmBranco(ctx, M, y, larg); }
  y += 10;
  return y;
}

// ---------- Folha 2: croqui e medidas ----------

function desenharCliente(ctx, c, croqui) {
  const W = W_A4, M = MARGEM, larg = W - 2 * M;
  const f = (px) => px;
  const y0 = cabecalho(ctx, c, 'Croqui e medidas', f, [
    [c.nome && `Cliente: ${c.nome}`, c.whatsapp].filter(Boolean).join('   ·   '),
    c.dataMedidas ? `Medidas em centímetros, tiradas em ${c.dataMedidas}` : 'Medidas em centímetros',
  ]);
  const tit = (txt, x, yy) => titulo(ctx, txt, x, yy, SANS);
  const top = y0 + 46;

  const fimMedidas = LIMITE;

  // Medidas numa coluna à esquerda: o espaço entre as linhas se ajusta à quantidade.
  const wM = 430;
  tit('Medidas', M, top);
  const n = Math.max(c.medidas.length, 1);
  const R = Math.min(46, (fimMedidas - top - 14) / n);
  const px = Math.max(17, Math.min(24, Math.round(R * 0.62)));
  c.medidas.forEach((m, i) => {
    const yy = top + 14 + R * (i + 1) - R * 0.25;
    let wv;
    if (m.valor) {
      ctx.font = `600 ${px}px ${SANS}`; ctx.fillStyle = TINTA; ctx.textAlign = 'right';
      ctx.fillText(m.valor, M + wM, yy); ctx.textAlign = 'left'; wv = ctx.measureText(m.valor).width + 12;
    } else { linhaEmBranco(ctx, M + wM - 80, yy + 3, 80); wv = 92; }
    ctx.fillStyle = TINTA;
    ctx.fillText(caber(ctx, m.nome, wM - wv, px, 400, 15), M, yy);
  });

  // Croqui à direita, em cinza claro, para desenhar por cima.
  if (croqui) {
    const xC = M + wM + 50, wC = W - M - xC, hC = fimMedidas - top + 10;
    const w0 = croqui.naturalWidth || croqui.width, h0 = croqui.naturalHeight || croqui.height;
    const e = Math.min(wC / w0, hC / h0);
    ctx.globalAlpha = 0.42;
    ctx.drawImage(croqui, xC + (wC - w0 * e) / 2, top - 20, w0 * e, h0 * e);
    ctx.globalAlpha = 1;
  }
}

const novaFolha = (h = H_A4) => { const cv = document.createElement('canvas'); cv.width = W_A4; cv.height = h; return cv; };
const paraPng = (cv) => new Promise((ok) => cv.toBlob(ok, 'image/png'));

// As duas folhas em imagem (A4). croqui: imagem já carregada (opcional).
export async function imagensPeca(c, { croqui = null } = {}) {
  if (document.fonts?.ready) await document.fonts.ready;
  // Folha 1: procura o espaçamento que cabe (do mais folgado ao mais junto).
  let cv, y;
  for (const k of [1, 0.94, 0.88, 0.82, 0.76, 0.7]) {
    cv = novaFolha(3000);
    y = desenharProducao(cv.getContext('2d'), c, k);
    if (y <= LIMITE) break;
  }
  const f1 = novaFolha();
  const o1 = f1.getContext('2d');
  o1.fillStyle = '#FFFFFF'; o1.fillRect(0, 0, W_A4, H_A4);
  const esc = Math.min(1, LIMITE / y); // muita coisa mesmo: diminui tudo um pouco (raro)
  o1.drawImage(cv, 0, 0, W_A4, y, (W_A4 - W_A4 * esc) / 2, 0, W_A4 * esc, y * esc);
  rodape(o1, c, 'Folha 1 de 2 · deixe junto com a peça');

  const f2 = novaFolha();
  const o2 = f2.getContext('2d');
  desenharCliente(o2, c, croqui);
  rodape(o2, c, 'Folha 2 de 2');
  return Promise.all([paraPng(f1), paraPng(f2)]);
}

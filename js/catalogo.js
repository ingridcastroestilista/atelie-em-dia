// Catálogo de aluguel: escolhe vestidos do acervo (por tamanho, cor e data livre)
// e gera um PDF com 4 vestidos por página, para mandar para a cliente.

import { conflitos, somaDias, prazos, dataBR } from './regras.js';

const normal = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Tamanhos e cores que existem no acervo, para os botões de filtro (na ordem: números primeiro).
export function opcoesFiltro(pecas, campo) {
  const vistos = new Map();
  for (const p of pecas) { const v = String(p[campo] || '').trim(); if (v && !vistos.has(normal(v))) vistos.set(normal(v), v); }
  return [...vistos.values()].sort((a, b) => (parseFloat(a) || 999) - (parseFloat(b) || 999) || a.localeCompare(b, 'pt-BR'));
}

// A peça está livre para um evento nessa data? (retirada antes, devolução e higienização depois)
export function livreNaData(alugueis, pecaId, data) {
  if (!data) return true;
  const ini = somaDias(data, -prazos.retirada);
  const fim = somaDias(data, prazos.devolucao + prazos.higienizacao);
  return !conflitos(alugueis, pecaId, ini, fim).length;
}

// filtro: { tamanho, cor, data }. Devolve { pecas, reservadas } (quantas saíram por estarem reservadas).
export function filtrarPecas(pecas, alugueis, { tamanho = '', cor = '', data = '' } = {}) {
  const porDados = pecas.filter((p) => (!tamanho || normal(p.tamanho) === normal(tamanho)) && (!cor || normal(p.cor) === normal(cor)));
  const livres = porDados.filter((p) => livreNaData(alugueis, p.id, data));
  return { pecas: livres, reservadas: porDados.length - livres.length };
}

// "450" / "450,5" / "R$ 1.200" → número (ou null se não tiver valor)
export function lerValor(v) {
  const t = String(v ?? '').replace(/[^\d,.]/g, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/\.(?=\d{3}\b)/g, ''));
  return Number.isFinite(n) ? n : null;
}
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const valorTxt = (v) => { const n = lerValor(v); return n === null ? '' : BRL.format(n); };

// Linha de baixo do título: "Tamanho 42 · Livres em 12/03/2027"
export function subtitulo({ tamanho, cor, data }) {
  return [tamanho && `Tamanho ${tamanho}`, cor && cor, data && `Livres em ${dataBR(data)}`].filter(Boolean).join(' · ');
}

// ---------- Desenho das páginas ----------

const W = 1240, H = 1754, M = 80;
const MARSALA = '#6E2A3C', TINTA = '#2B2522', CINZA = '#6B625D', FUNDO_FOTO = '#F3ECE8';
const SERIF = '"Fraunces", Georgia, serif';
const SANS = '"Inter", system-ui, sans-serif';
export const POR_PAGINA = 4;

function cortar(ctx, texto, max) {
  let n = String(texto || '');
  while (ctx.measureText(n).width > max && n.length > 4) n = `${n.slice(0, -2)}…`;
  return n;
}
function cantos(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Foto inteira dentro do quadro (sem cortar a barra nem o decote), centralizada.
function fotoInteira(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const e = Math.min(w / iw, h / ih);
  const dw = iw * e, dh = ih * e;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function pagina(itens, { atelie, whats, sub, mostrarValor, n, total }) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
  // Cabeçalho
  ctx.fillStyle = MARSALA; ctx.font = `600 50px ${SERIF}`;
  ctx.fillText(cortar(ctx, atelie || 'Catálogo de aluguel', W - 2 * M - 320), M, 130);
  ctx.font = `600 22px ${SANS}`; ctx.textAlign = 'right';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
  ctx.fillText('CATÁLOGO DE ALUGUEL', W - M, 126);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  ctx.fillRect(M, 160, W - 2 * M, 4);
  let topo = 200;
  if (sub) { ctx.fillStyle = CINZA; ctx.font = `400 28px ${SANS}`; ctx.fillText(cortar(ctx, sub, W - 2 * M), M, 222); topo = 262; }

  // Grade 2 × 2
  const gap = 48, colW = (W - 2 * M - gap) / 2;
  const base = H - 150; // acima do rodapé
  const linhaH = (base - topo - gap) / 2;
  const textoH = mostrarValor ? 150 : 110;
  const fotoH = linhaH - textoH;
  itens.forEach(({ peca: p, img }, i) => {
    const x = M + (i % 2) * (colW + gap);
    const y = topo + Math.floor(i / 2) * (linhaH + gap);
    ctx.save(); cantos(ctx, x, y, colW, fotoH, 18); ctx.clip();
    ctx.fillStyle = FUNDO_FOTO; ctx.fillRect(x, y, colW, fotoH);
    if (img) fotoInteira(ctx, img, x, y, colW, fotoH);
    else { ctx.fillStyle = '#B9ADA7'; ctx.font = `400 26px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('Sem foto', x + colW / 2, y + fotoH / 2); ctx.textAlign = 'left'; }
    ctx.restore();
    let ty = y + fotoH + 50;
    ctx.fillStyle = TINTA; ctx.font = `600 34px ${SERIF}`;
    ctx.fillText(cortar(ctx, p.nome, colW), x, ty);
    ty += 42;
    ctx.fillStyle = CINZA; ctx.font = `400 26px ${SANS}`;
    ctx.fillText(cortar(ctx, [p.tamanho && `Tam. ${p.tamanho}`, p.cor].filter(Boolean).join(' · '), colW), x, ty);
    const v = mostrarValor && valorTxt(p.valor);
    if (v) { ty += 46; ctx.fillStyle = MARSALA; ctx.font = `600 32px ${SANS}`; ctx.fillText(v, x, ty); }
  });

  // Rodapé
  ctx.fillStyle = '#E2D8D3'; ctx.fillRect(M, H - 110, W - 2 * M, 2);
  ctx.fillStyle = CINZA; ctx.font = `400 24px ${SANS}`;
  ctx.fillText(cortar(ctx, [atelie, whats && `WhatsApp ${whats}`].filter(Boolean).join('   ·   '), W - 2 * M - 220), M, H - 66);
  if (total > 1) { ctx.textAlign = 'right'; ctx.fillText(`Página ${n} de ${total}`, W - M, H - 66); ctx.textAlign = 'left'; }
  return cv;
}

// itens: [{ peca, img }] (img já carregada ou null). Devolve as páginas em canvas.
export async function paginasCatalogo(itens, opcoes) {
  if (document.fonts?.ready) await document.fonts.ready;
  const total = Math.ceil(itens.length / POR_PAGINA);
  const out = [];
  for (let i = 0; i < total; i++) out.push(pagina(itens.slice(i * POR_PAGINA, (i + 1) * POR_PAGINA), { ...opcoes, n: i + 1, total }));
  return out;
}

// ---------- PDF com várias páginas A4 (uma imagem JPEG por página), sem bibliotecas ----------

export async function pdfDePaginas(canvases) {
  const jpegs = [];
  for (const c of canvases) jpegs.push({ w: c.width, h: c.height, dados: new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.88))).arrayBuffer()) });
  return montarPdf(jpegs);
}

export function montarPdf(jpegs) {
  const PW = 595.28, PH = 841.89; // A4 em pontos
  const enc = new TextEncoder();
  const partes = [];
  const offsets = [];
  let tam = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tam += b.length; };
  const obj = (i, corpo) => { offsets[i] = tam; put(`${i} 0 obj\n`); corpo(); put('\nendobj\n'); };
  const n = jpegs.length;
  // 1 catálogo, 2 páginas; para cada página k: página 3+3k, imagem 4+3k, conteúdo 5+3k
  const pag = (k) => 3 + 3 * k;
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Kids [${jpegs.map((_, k) => `${pag(k)} 0 R`).join(' ')}] /Count ${n} >>`));
  jpegs.forEach((j, k) => {
    const cont = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
    obj(pag(k), () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${pag(k) + 1} 0 R >> >> /Contents ${pag(k) + 2} 0 R >>`));
    obj(pag(k) + 1, () => {
      put(`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.dados.length} >>\nstream\n`);
      put(j.dados);
      put('\nendstream');
    });
    obj(pag(k) + 2, () => put(`<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`));
  });
  const total = 3 + 3 * n;
  const xref = tam;
  put(`xref\n0 ${total}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, { type: 'application/pdf' });
}

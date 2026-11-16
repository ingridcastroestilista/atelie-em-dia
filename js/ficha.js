// Ficha de medidas da cliente em imagem (tamanho de folha A4), para imprimir ou guardar.
import { dataBR, diaMes } from './regras.js';
import { GRUPOS_MEDIDAS, MEDIDAS } from './store.js';

// O valor mais recente de cada medida, na ordem do guia, separado por grupo.
export function conteudoFicha({ cliente, atelie, encomenda }) {
  const meds = cliente?.medidas || [];
  const ultima = meds[meds.length - 1];
  const valores = new Map();
  for (const m of meds) for (const [k, v] of Object.entries(m.valores)) if (String(v).trim()) valores.set(k, { v: String(v).trim(), data: m.data });
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

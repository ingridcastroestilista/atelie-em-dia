// Lembrete para a cliente: texto e imagem para o WhatsApp, com a data, o endereço e as orientações do ateliê.
import { hojeISO, diasEntre, dataBR, infoEtapa, etapa, fraseFinal } from './regras.js';

export const ORIENTACOES_PADRAO = {
  provas: [
    'Traga o sapato e a lingerie que vai usar no dia.',
    'Venha com no máximo 2 acompanhantes.',
    'Tolerância de 15 minutos. Depois disso, a prova precisa ser remarcada.',
    'Precisa remarcar? Avise com pelo menos 24h.',
  ],
  aluguel: [
    'Não lave o vestido: a higienização é feita aqui.',
    'Devolva na data combinada, por favor.',
  ],
};

// Que tipo de compromisso é (define o título, a frase e as orientações).
export function tipoLembrete(item, k) {
  if (item.tipo === 'aluguel') return k === 'retirada' || k === 'devolucao' ? k : null;
  if (k === 'medidas') return 'medidas';
  if (k === 'entrega') return 'entrega';
  return infoEtapa(item, k).prova ? 'prova' : null;
}

const TITULO = {
  prova: 'Lembrete da sua prova',
  medidas: 'Lembrete: tirar as medidas',
  entrega: 'Sua encomenda está pronta',
  retirada: 'Retirada do vestido',
  devolucao: 'Devolução do vestido',
};

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
// "09:30" → "às 9h30"; "15:00" → "às 15h"
const horaTxt = (h) => {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  return `às ${Number(hh)}h${mm && mm !== '00' ? mm : ''}`;
};

// "Amanhã, sexta-feira, 21/11, às 15h"
export function quandoLongo(data, hora, hoje = hojeISO()) {
  const [a, m, d] = data.split('-').map(Number);
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  const n = diasEntre(hoje, data);
  const rel = n === 0 ? 'Hoje, ' : n === 1 ? 'Amanhã, ' : '';
  const base = `${rel}${rel ? dia : dia.charAt(0).toUpperCase() + dia.slice(1)}, ${dataBR(data).slice(0, 5)}`;
  return hora ? `${base}, ${horaTxt(hora)}` : base;
}

// Tudo o que vai no lembrete, já separado (o texto e a imagem usam o mesmo conteúdo).
export function conteudoLembrete({ item, k, cliente, peca, atelie, mensagens }, hoje = hojeISO()) {
  const tipo = tipoLembrete(item, k);
  const e = etapa(item, k);
  const nome = primeiroNome(cliente?.nome);
  const pecaTxt = peca ? peca.toLowerCase() : '';
  const frase = {
    prova: `sua prova${pecaTxt ? ` do ${pecaTxt}` : ''} está marcada.`,
    medidas: `vamos tirar suas medidas${pecaTxt ? ` para o ${pecaTxt}` : ''}.`,
    entrega: `sua encomenda${pecaTxt ? ` (${pecaTxt})` : ''} fica pronta para buscar.`,
    retirada: `a retirada do vestido${peca ? ` ${peca}` : ''} está marcada.`,
    devolucao: `a devolução do vestido${peca ? ` ${peca}` : ''} está marcada.`,
  }[tipo];
  const orient = atelie?.orientacoes || ORIENTACOES_PADRAO;
  const lista = tipo === 'prova' || tipo === 'medidas' ? orient.provas : tipo === 'retirada' || tipo === 'devolucao' ? orient.aluguel : [];
  return {
    tipo,
    titulo: TITULO[tipo],
    saudacao: `Oi, ${nome}! Passando para lembrar: ${frase}`,
    quando: quandoLongo(e.data, e.hora, hoje),
    endereco: (atelie?.endereco || '').trim(),
    orientacoes: (lista || []).map((t) => t.trim()).filter(Boolean),
    tituloOrient: tipo === 'medidas' ? 'Para tirar as medidas' : tipo === 'prova' ? 'Para a sua prova' : 'Importante',
    atelie: (atelie?.nome || '').trim(),
    whatsapp: (atelie?.whatsapp || '').trim(),
    final: fraseFinal(mensagens),
  };
}

export function textoLembrete(c) {
  return [
    c.atelie ? `*${c.atelie}*` : null,
    c.saudacao,
    '',
    `📅 *${c.quando}*`,
    c.endereco ? `📍 ${c.endereco}` : null,
    ...(c.orientacoes.length ? ['', `*${c.tituloOrient}:*`, ...c.orientacoes.map((o) => `• ${o}`)] : []),
    '',
    c.final,
  ].filter((l) => l !== null).join('\n');
}

// ---------- Imagem (1080 de largura, altura conforme o conteúdo) ----------

const MARSALA = '#6E2A3C';

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

export async function imagemLembrete(c) {
  if (document.fonts?.ready) await document.fonts.ready;
  const W = 1080;
  const M = 88;
  const serif = '"Fraunces", Georgia, serif';
  const sans = '"Inter", system-ui, sans-serif';
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');

  // Mede tudo primeiro, depois desenha.
  const blocos = [];
  const add = (texto, fonte, cor, antes, extra = {}) => {
    ctx.font = fonte;
    const recuo = extra.recuo || 0;
    const tam = parseInt(fonte.match(/(\d+)px/)[1], 10);
    blocos.push({ ls: quebrar(ctx, texto, W - 2 * M - recuo), fonte, cor, antes, alt: tam * 1.3, recuo, ...extra });
  };
  add(c.titulo.toUpperCase(), `600 30px ${sans}`, MARSALA, 70, { espaco: true });
  add(c.saudacao, `400 40px ${sans}`, '#2B2522', 22);
  add(c.quando, `600 64px ${serif}`, MARSALA, 44, { caixa: true });
  if (c.endereco) add(c.endereco, `500 36px ${sans}`, '#2B2522', 50, { marca: '📍', recuo: 56 });
  if (c.orientacoes.length) {
    add(c.tituloOrient.toUpperCase(), `600 28px ${sans}`, MARSALA, 56, { espaco: true });
    c.orientacoes.forEach((o, i) => add(o, `400 36px ${sans}`, '#2B2522', i ? 14 : 20, { marca: '•', recuo: 40 }));
  }
  add(c.final, `400 32px ${sans}`, '#6B6B6B', 56);

  const topo = 170;
  const corpo = blocos.reduce((t, b) => t + b.antes + b.ls.length * b.alt + (b.caixa ? 40 : 0), 0);
  const rodape = c.whatsapp ? 140 : 70;
  cv.width = W;
  cv.height = topo + corpo + rodape;

  ctx.fillStyle = '#FBF8F6';
  ctx.fillRect(0, 0, W, cv.height);
  ctx.fillStyle = MARSALA;
  ctx.fillRect(0, 0, W, topo);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 60px ${serif}`;
  ctx.fillText(quebrar(ctx, c.atelie || 'Lembrete', W - 2 * M)[0], M, 108);

  let y = topo;
  for (const b of blocos) {
    y += b.antes;
    if (b.caixa) { // a data num quadro claro, para chamar atenção
      ctx.fillStyle = '#F3E6E9';
      ctx.beginPath();
      ctx.roundRect?.(M - 28, y - 4, W - 2 * M + 56, b.ls.length * b.alt + 44, 24);
      if (!ctx.roundRect) ctx.rect(M - 28, y - 4, W - 2 * M + 56, b.ls.length * b.alt + 44);
      ctx.fill();
      y += 20;
    }
    ctx.font = b.fonte;
    if ('letterSpacing' in ctx) ctx.letterSpacing = b.espaco ? '3px' : '0px';
    b.ls.forEach((l, i) => {
      y += b.alt;
      const base = y - b.alt * 0.24;
      if (b.marca && i === 0) { ctx.fillStyle = MARSALA; ctx.fillText(b.marca, M, base); }
      ctx.fillStyle = b.cor;
      ctx.fillText(l, M + b.recuo, base);
    });
    if (b.caixa) y += 20;
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  if (c.whatsapp) {
    ctx.fillStyle = '#F4F2F0';
    ctx.fillRect(0, cv.height - 110, W, 110);
    ctx.fillStyle = MARSALA;
    ctx.font = `600 36px ${sans}`;
    ctx.fillText(`WhatsApp ${c.whatsapp}`, M, cv.height - 44);
  }
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

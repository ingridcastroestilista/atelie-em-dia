// Regras do app, sem tela: etapas, "Esta semana", conflito de aluguel, agenda e WhatsApp.
// Tudo aqui é testado em tests/regras.test.js.

// ---------- Datas (sempre 'AAAA-MM-DD', no horário do celular) ----------

export function hojeISO(d = new Date()) {
  const z = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function somaDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return hojeISO(new Date(a, m - 1, d + dias));
}

export function diasEntre(de, ate) {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 864e5);
}

export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
export const diaMes = (iso) => dataBR(iso).slice(0, 5);

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diaSemana = (iso) => { const [a, m, d] = iso.split('-').map(Number); return SEMANA[new Date(a, m - 1, d).getDay()]; };

// "Hoje", "Amanhã", "Ontem", "Sex 21/11"
export function quando(iso, hoje = hojeISO()) {
  const d = diasEntre(hoje, iso);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  return `${diaSemana(iso)} ${diaMes(iso)}`;
}

// ---------- Etapas ----------

// grupo: a cor na tela "Esta semana". data: pode ter data marcada.
// dataPadrao: o campo de data já aparece aberto (nas outras, fica atrás de "+ data").
export const ETAPAS_ENCOMENDA = [
  { k: 'medidas', nome: 'Tirar medidas', grupo: 'producao', data: true },
  { k: 'tecido', nome: 'Comprar tecido e aviamentos', rotulo: 'Comprar tecido', grupo: 'producao', data: true },
  { k: 'modelagem', nome: 'Modelagem', grupo: 'producao', data: true },
  { k: 'corte', nome: 'Corte', grupo: 'producao', data: true },
  { k: 'prova1', nome: 'Prova 1', grupo: 'prova', data: true, dataPadrao: true, prova: true },
  { k: 'costura', nome: 'Costura', grupo: 'producao', data: true },
  { k: 'prova2', nome: 'Prova 2', grupo: 'prova', data: true, dataPadrao: true, prova: true },
  { k: 'prova3', nome: 'Prova 3', grupo: 'prova', data: true, prova: true },
  { k: 'acabamento', nome: 'Acabamento', grupo: 'producao', data: true },
  { k: 'pronto', nome: 'Pronto', grupo: 'producao' },
  { k: 'entrega', nome: 'Entregue', rotulo: 'Entrega', grupo: 'entrega', data: true, dataPadrao: true },
];

export const ETAPAS_ALUGUEL = [
  { k: 'reservado', nome: 'Reservado', grupo: 'aluguel' },
  { k: 'retirada', nome: 'Retirado', rotulo: 'Retirada', grupo: 'aluguel', data: true, dataPadrao: true },
  { k: 'devolucao', nome: 'Devolvido', rotulo: 'Devolução', grupo: 'aluguel', data: true, dataPadrao: true },
  { k: 'higienizacao', nome: 'Higienizado', rotulo: 'Higienização/ajuste', grupo: 'aluguel' },
];

export const GRUPOS = { prova: 'Prova', entrega: 'Entrega', producao: 'Produção', aluguel: 'Aluguel' };

// Prazos do aluguel, a partir da data do evento.
export const RETIRADA_ANTES = 2;
export const DEVOLUCAO_DEPOIS = 1;
export const DIAS_HIGIENIZACAO = 2;

const novaEtapa = (k, data = '') => ({ k, data, hora: '', feitaEm: null, notas: '', agendaEm: null });
const chaveNova = () => `c${Math.random().toString(36).slice(2, 8)}`;

// Lista de etapas de uma encomenda nova: a completa ou a de um modelo salvo.
// Modelo: { nome, etapas: [{ k }] para etapas da lista padrão, [{ nome, prova }] para as criadas por ela }.
export function etapasEncomenda(modelo = null) {
  if (!modelo) return ETAPAS_ENCOMENDA.map((e) => novaEtapa(e.k));
  const lista = modelo.etapas.filter((x) => x.k !== 'entrega').map((x) => {
    const conhecida = x.k && ETAPAS_ENCOMENDA.some((d) => d.k === x.k);
    const e = novaEtapa(conhecida ? x.k : chaveNova());
    if (x.nome && (!conhecida || x.nome !== defEtapa('encomenda', x.k).nome)) e.nome = x.nome;
    if (!conhecida) e.prova = !!x.prova;
    return e;
  });
  const entrega = modelo.etapas.find((x) => x.k === 'entrega');
  const ent = novaEtapa('entrega');
  if (entrega?.nome && entrega.nome !== 'Entregue') ent.nome = entrega.nome;
  return [...lista, ent];
}

// A lista de uma encomenda vira modelo (sem datas, sem anotações).
export function modeloDe(item, nome) {
  return {
    nome,
    etapas: item.etapas.map((e) => {
      const conhecida = ETAPAS_ENCOMENDA.some((d) => d.k === e.k);
      if (conhecida) return e.nome ? { k: e.k, nome: e.nome } : { k: e.k };
      return { nome: e.nome, prova: !!e.prova };
    }),
  };
}

export function etapasAluguel(evento, hoje = hojeISO()) {
  return ETAPAS_ALUGUEL.map((e) => {
    if (e.k === 'reservado') return { ...novaEtapa(e.k), feitaEm: hoje };
    if (e.k === 'retirada') return novaEtapa(e.k, somaDias(evento, -RETIRADA_ANTES));
    if (e.k === 'devolucao') return novaEtapa(e.k, somaDias(evento, DEVOLUCAO_DEPOIS));
    return novaEtapa(e.k);
  });
}

export const etapa = (item, k) => item.etapas.find((e) => e.k === k);

// Encomendas criadas antes da lista completa ganham as etapas novas, uma vez só.
// Depois disso a lista é dela: o app não mexe mais (ela pode ter personalizado).
export const VERSAO_ETAPAS = 2;
export function migrarEtapas(item) {
  if (item.versaoEtapas >= VERSAO_ETAPAS) return item;
  const defs = item.tipo === 'aluguel' ? ETAPAS_ALUGUEL : ETAPAS_ENCOMENDA;
  item.etapas = defs.map((d) => item.etapas.find((e) => e.k === d.k) || novaEtapa(d.k));
  item.versaoEtapas = VERSAO_ETAPAS;
  return item;
}
export const defEtapa = (tipo, k) => (tipo === 'aluguel' ? ETAPAS_ALUGUEL : ETAPAS_ENCOMENDA).find((e) => e.k === k);

// Como uma etapa aparece: a da lista padrão, com o nome que ela deu; ou a que ela criou.
export function infoEtapa(item, k) {
  const e = typeof k === 'string' ? etapa(item, k) : k;
  const def = defEtapa(item.tipo, e.k);
  const prova = def ? !!def.prova : !!e.prova;
  return {
    k: e.k,
    nome: e.nome || def?.nome || 'Etapa',
    rotulo: e.nome || def?.rotulo || def?.nome || 'Etapa',
    grupo: def?.grupo || (prova ? 'prova' : 'producao'),
    prova,
    data: def ? !!def.data : true,
    dataPadrao: def ? !!def.dataPadrao : prova,
    propria: !def,
    fixa: e.k === 'entrega' || item.tipo === 'aluguel',
  };
}

// ---------- Personalizar as etapas de uma encomenda ----------

// Etapa nova entra antes de "Pronto" (ou antes da entrega, se não houver "Pronto").
export function adicionarEtapa(item, nome, prova = false) {
  const e = { ...novaEtapa(chaveNova()), nome: nome.trim(), prova: !!prova };
  let i = item.etapas.findIndex((x) => x.k === 'pronto');
  if (i < 0) i = item.etapas.findIndex((x) => x.k === 'entrega');
  item.etapas.splice(i < 0 ? item.etapas.length : i, 0, e);
  return e;
}

export function removerEtapa(item, k) {
  if (k === 'entrega') return false;
  item.etapas = item.etapas.filter((e) => e.k !== k);
  return true;
}

// Sobe (-1) ou desce (+1). A entrega fica sempre por último.
export function moverEtapa(item, k, d) {
  const i = item.etapas.findIndex((e) => e.k === k);
  const j = i + d;
  if (i < 0 || k === 'entrega' || j < 0 || j >= item.etapas.length || item.etapas[j].k === 'entrega') return false;
  [item.etapas[i], item.etapas[j]] = [item.etapas[j], item.etapas[i]];
  return true;
}

// Anotações da prova anterior mais próxima que tenha anotações (para mostrar na prova seguinte).
export function provaAnterior(encomenda, k) {
  const provas = encomenda.etapas.filter((e) => infoEtapa(encomenda, e).prova);
  const i = provas.findIndex((e) => e.k === k);
  for (let j = i - 1; j >= 0; j--) {
    if (provas[j].notas?.trim()) return provas[j];
  }
  return null;
}

// Marca ou desmarca uma etapa e ajusta o status do trabalho.
export function marcarEtapa(item, k, feita, hoje = hojeISO()) {
  const e = etapa(item, k);
  e.feitaEm = feita ? hoje : null;
  if (item.tipo === 'encomenda' && k === 'entrega') item.status = feita ? 'entregue' : 'andamento';
  if (item.tipo === 'aluguel' && k === 'higienizacao') item.status = feita ? 'concluido' : 'andamento';
  return item;
}

// ---------- "Esta semana" ----------

const BOTAO = { entrega: 'Entregue', retirada: 'Retirado', devolucao: 'Devolvido', higienizacao: 'Pronto' };

// Compromissos em aberto de encomendas e aluguéis em andamento.
export function compromissos(s) {
  const lista = [];
  const add = (item, k, data, extra = {}) => {
    const info = infoEtapa(item, k);
    const e = etapa(item, k);
    lista.push({ id: `${item.id}:${k}`, itemId: item.id, tipo: item.tipo, k, data, hora: e.hora || '', rotulo: info.rotulo, botao: BOTAO[k] || (info.prova ? 'Feita' : 'Feito'), grupo: info.grupo, clienteId: item.clienteId, ...extra });
  };
  for (const enc of s.encomendas) {
    if (enc.status !== 'andamento') continue;
    for (const e of enc.etapas) {
      if (e.k === 'entrega' || !e.data || e.feitaEm) continue;
      add(enc, e.k, e.data, infoEtapa(enc, e).prova ? { notasAnteriores: provaAnterior(enc, e.k)?.notas || '' } : {});
    }
    const ent = etapa(enc, 'entrega');
    if (!ent.feitaEm) add(enc, 'entrega', ent.data || enc.evento, { semData: !ent.data });
  }
  for (const alu of s.alugueis) {
    if (alu.status !== 'andamento') continue;
    const ret = etapa(alu, 'retirada');
    const dev = etapa(alu, 'devolucao');
    const hig = etapa(alu, 'higienizacao');
    if (!ret.feitaEm && ret.data) add(alu, 'retirada', ret.data);
    if (!dev.feitaEm && dev.data) add(alu, 'devolucao', dev.data);
    if (dev.feitaEm && !hig.feitaEm) add(alu, 'higienizacao', dev.feitaEm);
  }
  return lista.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}

// Separa em atrasados, esta semana (hoje + 6 dias) e depois.
export function semana(s, hoje = hojeISO()) {
  const fim = somaDias(hoje, 6);
  const todos = compromissos(s);
  return {
    atrasados: todos.filter((c) => c.data < hoje),
    semana: todos.filter((c) => c.data >= hoje && c.data <= fim),
    depois: todos.filter((c) => c.data > fim),
  };
}

// ---------- Visão do ano ----------

// Mês de cada encomenda: o da entrega marcada ou, sem ela, o do evento. Canceladas não contam.
export const mesDaEncomenda = (enc) => (etapa(enc, 'entrega')?.data || enc.evento).slice(0, 7);

// 12 meses a partir de 'AAAA-MM'.
export function somaMeses(ym, n) {
  const [a, m] = ym.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function resumoMeses(s, inicio, qtd = 12) {
  return Array.from({ length: qtd }, (_, i) => {
    const mes = somaMeses(inicio, i);
    return {
      mes,
      encomendas: s.encomendas.filter((e) => e.status !== 'cancelada' && mesDaEncomenda(e) === mes),
      alugueis: s.alugueis.filter((a) => a.status !== 'cancelado' && a.evento.slice(0, 7) === mes),
    };
  });
}

// Lotação do mês em relação ao limite que ela definiu.
export function lotacao(qtd, limite) {
  if (!limite) return 'sem-limite';
  if (qtd > limite) return 'acima';
  if (qtd === limite) return 'cheio';
  return 'livre';
}

// ---------- Aluguel: período ocupado e conflito ----------

// A peça fica ocupada da retirada até a devolução, mais os dias de higienização.
export function periodo(alu) {
  const ini = etapa(alu, 'retirada').data || somaDias(alu.evento, -RETIRADA_ANTES);
  const dev = etapa(alu, 'devolucao').data || somaDias(alu.evento, DEVOLUCAO_DEPOIS);
  return { ini, fim: somaDias(dev, DIAS_HIGIENIZACAO), devolucao: dev };
}

export function conflitos(alugueis, pecaId, ini, fim, ignorarId = null) {
  return alugueis.filter((a) => {
    if (a.pecaId !== pecaId || a.id === ignorarId || a.status === 'cancelado') return false;
    const p = periodo(a);
    return p.ini <= fim && ini <= p.fim;
  });
}

// Data apertada: não cruza com outro aluguel, mas sobra pouca folga
// (até FOLGA_APERTADA dias livres) entre a higienização de um e a retirada do outro.
export const FOLGA_APERTADA = 2;
export function apertados(alugueis, pecaId, ini, fim, ignorarId = null, folga = FOLGA_APERTADA) {
  return alugueis.flatMap((a) => {
    if (a.pecaId !== pecaId || a.id === ignorarId || a.status === 'cancelado') return [];
    const p = periodo(a);
    if (p.ini <= fim && ini <= p.fim) return []; // isso é conflito, não aperto
    const livres = p.fim < ini ? diasEntre(p.fim, ini) - 1 : diasEntre(fim, p.ini) - 1;
    return livres <= folga ? [{ aluguel: a, livres, antes: p.fim < ini }] : [];
  });
}

// Situação da peça hoje, para a lista do acervo.
export function situacaoPeca(alugueis, pecaId, hoje = hojeISO()) {
  const dela = alugueis.filter((a) => a.pecaId === pecaId && a.status !== 'cancelado');
  const comCliente = dela.find((a) => etapa(a, 'retirada').feitaEm && !etapa(a, 'devolucao').feitaEm);
  if (comCliente) return { k: 'cliente', texto: 'Com cliente', aluguel: comCliente, ate: periodo(comCliente).devolucao };
  const lavando = dela.find((a) => etapa(a, 'devolucao').feitaEm && !etapa(a, 'higienizacao').feitaEm);
  if (lavando) return { k: 'higienizacao', texto: 'Em higienização/ajuste', aluguel: lavando };
  const proximas = dela.filter((a) => a.status === 'andamento' && !etapa(a, 'retirada').feitaEm && periodo(a).fim >= hoje)
    .sort((a, b) => periodo(a).ini.localeCompare(periodo(b).ini));
  if (proximas.length) {
    const p = periodo(proximas[0]);
    if (p.ini <= hoje) return { k: 'reservada', texto: 'Reservada', aluguel: proximas[0], desde: p.ini };
    return { k: 'disponivel', texto: 'Disponível', proxima: p.ini, aluguel: proximas[0] };
  }
  return { k: 'disponivel', texto: 'Disponível' };
}

// ---------- Agenda do celular ----------

const compacta = (iso) => iso.replace(/-/g, '');
const horaCompacta = (h) => `${h.replace(':', '')}00`;
const escIcs = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// Hora local → UTC no formato do arquivo de agenda.
function utc(iso, hhmm) {
  const [a, m, d] = iso.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(a, m - 1, d, h, min).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Arquivo .ics com dois alarmes: véspera às 18h e no dia às 8h.
export function arquivoAgenda({ id, titulo, data, hora = '', descricao = '' }, agora = new Date()) {
  const inicio = hora
    ? `DTSTART:${compacta(data)}T${horaCompacta(hora)}\r\nDTEND:${compacta(data)}T${horaCompacta(somaHora(hora, 1))}`
    : `DTSTART;VALUE=DATE:${compacta(data)}\r\nDTEND;VALUE=DATE:${compacta(somaDias(data, 1))}`;
  const alarme = (quandoUtc, texto) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${escIcs(texto)}\r\nTRIGGER;VALUE=DATE-TIME:${quandoUtc}\r\nEND:VALARM`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Atelie em Dia//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@atelie-em-dia`,
    `DTSTAMP:${agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    inicio,
    `SUMMARY:${escIcs(titulo)}`,
    descricao ? `DESCRIPTION:${escIcs(descricao)}` : null,
    alarme(utc(somaDias(data, -1), '18:00'), `Amanhã: ${titulo}`),
    alarme(utc(data, '08:00'), `Hoje: ${titulo}`),
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function somaHora(hhmm, h) {
  const [hh, mm] = hhmm.split(':').map(Number);
  return `${String(Math.min(23, hh + h)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Link do Google Agenda (Android). O alarme fica o padrão da agenda dela.
export function linkGoogleAgenda({ titulo, data, hora = '', descricao = '' }) {
  const datas = hora
    ? `${compacta(data)}T${horaCompacta(hora)}/${compacta(data)}T${horaCompacta(somaHora(hora, 1))}`
    : `${compacta(data)}/${compacta(somaDias(data, 1))}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: datas, details: descricao, ctz: 'America/Sao_Paulo' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

// ---------- WhatsApp ----------

// Formata enquanto ela digita: "11987654321" → "(11) 98765-4321"; fixo: "(11) 3456-7890".
// Número com "+" (de fora do Brasil) fica como ela escreveu.
export function formatarTelefone(v) {
  const txt = String(v || '');
  if (txt.trim().startsWith('+')) return txt;
  let d = txt.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const r = d.slice(2);
  if (r.length <= 4) return `(${ddd}) ${r}`;
  const corte = r.length === 9 ? 5 : 4;
  return `(${ddd}) ${r.slice(0, corte)}-${r.slice(corte)}`;
}

// "(11) 98765-4321" → "5511987654321"
export function numeroWhats(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d;
}

export function linkWhats(tel, texto) {
  const n = numeroWhats(tel);
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

export function mensagemProva(cliente, data, hora) {
  const dia = `${diaSemanaLongo(data)}, ${diaMes(data)}`;
  return `Oi, ${primeiroNome(cliente)}! Confirmando sua prova ${dia}${hora ? ` às ${hora.replace(':00', 'h').replace(':', 'h')}` : ''}. Até lá!`;
}

export function mensagemPronta(cliente, peca) {
  return `Oi, ${primeiroNome(cliente)}! Sua encomenda${peca ? ` (${peca.toLowerCase()})` : ''} está pronta. Quando fica bom para buscar?`;
}

const SEMANA_LONGA = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];
function diaSemanaLongo(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return SEMANA_LONGA[new Date(a, m - 1, d).getDay()];
}

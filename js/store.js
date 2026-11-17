// Dados guardados só no celular (localStorage), backup em arquivo.
import { hojeISO, migrarEtapas, fotosUsadas, PRAZOS_PADRAO } from './regras.js';
import { fotosParaBackup, restaurarFotos, apagarTodas } from './fotos.js';
import { ORIENTACOES_PADRAO } from './lembrete.js';

const CHAVE = 'atelie-em-dia:v1';
const VERSAO = 1;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const agora = () => new Date().toISOString();

// As 38 medidas do guia "Como tirar medidas" da Ingrid, na mesma ordem e numeração.
// Cada uma tem uma dica curta de como medir. Ela esconde as que não usa (medidasOcultas).
export const GRUPOS_MEDIDAS = [
  { nome: 'Corpo', medidas: [
    ['Busto', 'Contorno na altura dos mamilos.'],
    ['Alto busto', 'Contorno na altura das cavas, com a fita por baixo dos braços.'],
    ['Cintura', 'Contorno na linha da cintura (geralmente 2 a 3 cm acima do umbigo).'],
    ['Altura do corpo: frente', 'Do ombro, junto ao pescoço, até a cintura, passando sobre o busto.'],
    ['Altura do corpo: costas', 'Do ombro, junto ao pescoço, até a cintura, pelas costas.'],
    ['Altura do centro das costas', 'Da base do pescoço até a cintura, no centro das costas.'],
    ['Altura do centro da frente', 'Da base do pescoço até a cintura, no centro da frente.'],
    ['Pescoço', 'Contorno na base do pescoço.'],
    ['Altura do busto', 'Da base do pescoço até o mamilo, com o sutiã da peça.'],
    ['Raio do busto', 'Do mamilo até a base do seio.'],
    ['Distância do busto', 'Entre os mamilos.'],
    ['Cava a cava: frente', 'Entre as cavas da frente, com o corpo relaxado.'],
    ['Cava a cava: costas', 'Entre as cavas das costas.'],
    ['Ombro', 'Da base do pescoço até a ponta do ombro.'],
    ['Ombro a ombro', 'Entre as pontas dos ombros (frente e costas).'],
    ['Queda de ombro', 'Régua na horizontal sobre o ombro: distância até a ponta do ombro.'],
    ['Lateral', 'Da axila até a cintura, com o braço abaixado.'],
    ['Circunferência da cava', 'Em volta da cava, pela ponta do ombro e por baixo do braço.'],
  ] },
  { nome: 'Saia', medidas: [
    ['Quadril', 'Maior contorno na região das nádegas.'],
    ['Altura do quadril', 'Da cintura até o maior contorno do quadril, pela lateral.'],
    ['Altura da saia', 'Da cintura até acima do joelho, pela lateral.'],
    ['Quadril alto / bacia', 'Contorno acima das nádegas, no osso da bacia.'],
    ['Quadril baixo', 'Contorno abaixo das nádegas.'],
    ['Altura da bacia', 'Da cintura até a bacia (para corset, confira sentada).'],
    ['Altura do quadril baixo', 'Da cintura até abaixo das nádegas, pela lateral.'],
  ] },
  { nome: 'Manga', medidas: [
    ['Braço', 'Contorno logo abaixo da axila, na parte mais larga.'],
    ['Comprimento da manga', 'Do ombro até o osso do punho (média do braço dobrado e estendido).'],
    ['Cotovelo dobrado', 'Contorno do cotovelo com o braço dobrado a 90°.'],
    ['Punho', 'Contorno do pulso, sobre o osso.'],
    ['Mão', 'Parte mais larga da mão, dedos estendidos e polegar junto.'],
    ['Altura do cotovelo', 'Do ombro até o osso do cotovelo.'],
    ['Cabeça da manga', 'Do ombro até a altura da cava.'],
  ] },
  { nome: 'Auxiliares', medidas: [
    ['Circunferência abaixo do busto', 'Contorno logo abaixo do busto.'],
    ['Transversal da frente', 'Da ponta do ombro até a cintura, no centro da frente.'],
    ['Transversal das costas', 'Da ponta do ombro até a cintura, no centro das costas.'],
    ['Altura abaixo do busto', 'Da cintura até a linha abaixo do busto.'],
    ['Altura do sereia', 'Da cintura até a abertura do sereia (acima do joelho).'],
    ['Decotes', 'Da base do pescoço até o decote escolhido.'],
  ] },
];
let n = 0;
GRUPOS_MEDIDAS.forEach((g) => { g.medidas = g.medidas.map(([nome, dica]) => ({ num: String(++n).padStart(2, '0'), nome, dica })); });
export const MEDIDAS = GRUPOS_MEDIDAS.flatMap((g) => g.medidas.map((m) => m.nome));

function inicial() {
  return {
    versao: VERSAO,
    criadoEm: agora(),
    atelie: { nome: '', endereco: '', whatsapp: '', orientacoes: structuredClone(ORIENTACOES_PADRAO) },
    medidasOcultas: [], // medidas do guia que ela não usa
    prazosAluguel: { ...PRAZOS_PADRAO }, // retirada, devolução, higienização e folga, em dias
    mensagens: { prova: '', pronta: '', final: '' }, // textos prontos mudados por ela (vazio = original)
    // Por mês (0 = não definido). Meta = o que ela quer alcançar; limite = o máximo que dá conta.
    // capacidadeMes é o limite de sob medida (nome antigo, mantido para não perder o que ela já tinha).
    metaSobMedida: 0, capacidadeMes: 0, metaAluguel: 0, limiteAluguel: 0,
    modelos: [],      // listas de etapas salvas por ela (ex.: Noiva)
    ultimoModelo: '', // o modelo escolhido na última encomenda
    clientes: [],
    encomendas: [],
    pecas: [],
    alugueis: [],
    ultimoBackup: null,
    avisoInstalarVisto: false,
    boasVindasVista: false,
    // inicioFeito: definido no primeiro uso (app.js), para quem já tinha dados não ver as boas-vindas
  };
}

let state = null;

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    state = bruto ? { ...inicial(), ...JSON.parse(bruto) } : inicial();
  } catch {
    state = inicial();
  }
  migrar();
  return state;
}

export const get = () => state;

function migrar() {
  // Quem já usava o app ganha os campos novos do ateliê, com as orientações sugeridas.
  state.atelie = { endereco: '', whatsapp: '', orientacoes: structuredClone(ORIENTACOES_PADRAO), ...state.atelie };
  if (!Array.isArray(state.medidasOcultas)) state.medidasOcultas = [];
  state.prazosAluguel = { ...PRAZOS_PADRAO, ...state.prazosAluguel };
  state.mensagens = { prova: '', pronta: '', final: '', ...state.mensagens };
  state.encomendas.forEach(migrarEtapas);
  state.alugueis.forEach(migrarEtapas);
}

let timer = null;
export function salvar() {
  clearTimeout(timer);
  timer = setTimeout(gravar, 200);
}

export function gravar() {
  clearTimeout(timer);
  try { localStorage.setItem(CHAVE, JSON.stringify(state)); } catch (e) { console.error('Não foi possível salvar', e); }
}

export function pedirArmazenamentoPersistente() {
  navigator.storage?.persist?.().catch(() => {});
}

// Marca a data de alteração (para a futura versão com servidor).
export const tocar = (obj) => { obj.alteradoEm = agora(); return obj; };

// ---------- Clientes ----------

export const acharCliente = (id) => state.clientes.find((c) => c.id === id);

export function clientePorNome(nome) {
  const n = nome.trim().toLowerCase();
  return state.clientes.find((c) => c.nome.trim().toLowerCase() === n);
}

export function novaCliente(nome) {
  const c = { id: uid(), nome: nome.trim(), whatsapp: '', obs: '', medidas: [], criadoEm: agora(), alteradoEm: agora() };
  state.clientes.push(c);
  return c;
}

export function apagarCliente(id) {
  state.clientes = state.clientes.filter((c) => c.id !== id);
  state.encomendas = state.encomendas.filter((e) => e.clienteId !== id);
  state.alugueis = state.alugueis.filter((a) => a.clienteId !== id);
}

// ---------- Backup ----------

// Monta o arquivo de backup, com as fotos dentro. Pode levar alguns segundos se houver muitas fotos.
export async function prepararBackup() {
  const fotos = await fotosParaBackup(fotosUsadas(state));
  state.ultimoBackup = agora();
  gravar();
  const blob = new Blob([JSON.stringify({ ...state, fotos })], { type: 'application/json' });
  const nome = `atelie-em-dia-backup-${hojeISO()}.json`;
  return { blob, nome, arquivo: new File([blob], nome, { type: 'application/json' }), fotos: fotos.length };
}

// Manda o backup pelo menu de compartilhar (ou baixa o arquivo).
// Se o celular recusar porque passou tempo demais desde o toque, avisa com NotAllowedError
// para o app mostrar um botão e ela tocar de novo.
export async function enviarBackup(b) {
  if (navigator.canShare?.({ files: [b.arquivo] })) {
    try {
      await navigator.share({ files: [b.arquivo], title: 'Backup Ateliê em Dia' });
    } catch (e) {
      if (e.name === 'NotAllowedError') throw e;
      if (e.name !== 'AbortError') baixar(b.blob, b.nome);
    }
    return;
  }
  baixar(b.blob, b.nome);
}

export function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function importar(arquivo) {
  const dados = JSON.parse(await arquivo.text());
  if (!dados || !Array.isArray(dados.clientes) || !Array.isArray(dados.encomendas)) {
    throw new Error('Esse arquivo não é um backup do Ateliê em Dia.');
  }
  const { fotos = [], ...resto } = dados;
  await restaurarFotos(fotos);
  state = { ...inicial(), ...resto };
  migrar();
  gravar();
}

export function apagarTudo() {
  state = inicial();
  gravar();
  apagarTodas().catch(() => {});
}

// Dados guardados só no celular (localStorage), backup em arquivo.
import { hojeISO, migrarEtapas } from './regras.js';
import { ORIENTACOES_PADRAO } from './lembrete.js';

const CHAVE = 'atelie-em-dia:v1';
const VERSAO = 1;

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const agora = () => new Date().toISOString();

// Medidas mais usadas; ela preenche só as que usa e pode acrescentar outras.
export const MEDIDAS = [
  'Busto', 'Cintura', 'Quadril', 'Altura do busto', 'Separação do busto', 'Ombro a ombro', 'Ombro',
  'Cava', 'Braço', 'Comprimento da manga', 'Comprimento da frente', 'Comprimento das costas',
  'Altura do quadril', 'Comprimento da saia', 'Altura total',
];

function inicial() {
  return {
    versao: VERSAO,
    criadoEm: agora(),
    atelie: { nome: '', endereco: '', whatsapp: '', orientacoes: structuredClone(ORIENTACOES_PADRAO) },
    capacidadeMes: 0, // quantas encomendas ela dá conta por mês (0 = não definido)
    modelos: [],      // listas de etapas salvas por ela (ex.: Noiva)
    ultimoModelo: '', // o modelo escolhido na última encomenda
    clientes: [],
    encomendas: [],
    pecas: [],
    alugueis: [],
    ultimoBackup: null,
    avisoInstalarVisto: false,
    boasVindasVista: false,
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

export function exportar() {
  state.ultimoBackup = agora();
  gravar();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const nome = `atelie-em-dia-backup-${hojeISO()}.json`;
  const arquivo = new File([blob], nome, { type: 'application/json' });
  if (navigator.canShare?.({ files: [arquivo] })) {
    return navigator.share({ files: [arquivo], title: 'Backup Ateliê em Dia' }).catch(() => baixar(blob, nome));
  }
  baixar(blob, nome);
  return Promise.resolve();
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
  state = { ...inicial(), ...dados };
  migrar();
  gravar();
}

export function apagarTudo() {
  state = inicial();
  gravar();
}

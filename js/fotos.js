// Fotos guardadas só no celular, no banco do navegador (IndexedDB), que comporta bem mais que o
// localStorage. Os dados do app guardam só o código de cada foto (ex.: peca.fotos = ['f1', ...]).
// Cada foto é reduzida antes de guardar (lado maior 1280 px, JPEG): cerca de 150 a 250 KB.

const BANCO = 'atelie-em-dia-fotos';
const TABELA = 'fotos';
const LADO = 1280;

let conexao = null;
function banco() {
  if (!conexao) {
    conexao = new Promise((ok, erro) => {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(TABELA, { keyPath: 'id' });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
  }
  return conexao;
}

async function pedido(modo, fn) {
  const db = await banco();
  return new Promise((ok, erro) => {
    const tx = db.transaction(TABELA, modo);
    const req = fn(tx.objectStore(TABELA));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => erro(tx.error);
    tx.onabort = () => erro(tx.error || new Error('Não foi possível guardar a foto.'));
  });
}

const novoId = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Reduz a foto (e acerta a rotação do celular) antes de guardar.
async function reduzir(arquivo) {
  let img;
  try {
    img = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    img = await new Promise((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('Não foi possível abrir essa imagem.'));
      i.src = URL.createObjectURL(arquivo);
    });
  }
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  const escala = Math.min(1, LADO / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * escala);
  cv.height = Math.round(h * escala);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  img.close?.();
  return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.82));
}

export async function guardarFoto(arquivo) {
  const blob = await reduzir(arquivo);
  const id = novoId();
  await pedido('readwrite', (t) => t.put({ id, blob, criadoEm: new Date().toISOString() }));
  return id;
}

const enderecos = new Map(); // id → endereço da imagem já carregada
export async function enderecoFoto(id) {
  if (enderecos.has(id)) return enderecos.get(id);
  const reg = await pedido('readonly', (t) => t.get(id));
  if (!reg) return '';
  const url = URL.createObjectURL(reg.blob);
  enderecos.set(id, url);
  return url;
}

export async function apagarFoto(id) {
  await pedido('readwrite', (t) => t.delete(id));
  if (enderecos.has(id)) { URL.revokeObjectURL(enderecos.get(id)); enderecos.delete(id); }
}

// Apaga as fotos que nenhum registro usa mais (vestido, prova ou encomenda apagados).
export async function limparSoltas(usadas) {
  const ids = await pedido('readonly', (t) => t.getAllKeys());
  const soltas = (ids || []).filter((id) => !usadas.has(id));
  for (const id of soltas) await apagarFoto(id);
  return soltas.length;
}

export async function apagarTodas() {
  await pedido('readwrite', (t) => t.clear());
  enderecos.forEach((u) => URL.revokeObjectURL(u));
  enderecos.clear();
}

// ---------- Backup: as fotos vão dentro do arquivo, em texto (base64) ----------

const paraTexto = (blob) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.readAsDataURL(blob); });

export async function fotosParaBackup(usadas) {
  const todas = await pedido('readonly', (t) => t.getAll());
  const out = [];
  for (const f of todas || []) if (usadas.has(f.id)) out.push({ id: f.id, tipo: f.blob.type || 'image/jpeg', criadoEm: f.criadoEm, dados: await paraTexto(f.blob) });
  return out;
}

export async function restaurarFotos(lista) {
  await apagarTodas();
  for (const f of lista || []) {
    const bytes = Uint8Array.from(atob(f.dados), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: f.tipo || 'image/jpeg' });
    await pedido('readwrite', (t) => t.put({ id: f.id, blob, criadoEm: f.criadoEm }));
  }
}

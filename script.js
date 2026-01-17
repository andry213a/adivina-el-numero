/* Adivina_el_numero — JS completo (proyecto final) */

/* ====== Config de modos ====== */
const LEVELS = {
  easy:       { label: 'Fácil',      max: 100,            defaultAttempts: 12 },
  normal:     { label: 'Normal',     max: 1000,           defaultAttempts: 15 },
  hard:       { label: 'Difícil',    max: 10000,          defaultAttempts: 20 },
  expert:     { label: 'Experto',    max: 100000,         defaultAttempts: 25 },
  chosen:     { label: 'Elegido',    max: 1000000,        defaultAttempts: 30 },
  gods:       { label: 'Dioses',     max: 1000000000,     defaultAttempts: 40 },
  infinite:   { label: 'Infinito',   max: null,           defaultAttempts: Infinity },
  multiverse: { label: 'Multiverso', max: 1000000,        defaultAttempts: 30 },
  prophet:    { label: 'Profeta',    max: 10000,          defaultAttempts: 20 },
  chaos:      { label: 'Caos',       max: 100000,         defaultAttempts: 25 },
  lightning:  { label: 'Relámpago',  max: 1000,           defaultAttempts: 10 },
  sage:       { label: 'Sabio',      max: 10000,          defaultAttempts: 20 },
  simulation: { label: 'Simulación', max: 100000,         defaultAttempts: 25 },
  eco:        { label: 'Eco',        max: 50000,          defaultAttempts: 25 },
  dark:       { label: 'Oscuro',     max: 100000,         defaultAttempts: 20 },
  master:     { label: 'Maestro',    max: 100000,         defaultAttempts: 25 }
};

/* ====== DOM ====== */
const difficultyEl = document.getElementById('difficulty');
const limitToggle = document.getElementById('limitToggle');
const attemptsEl = document.getElementById('attempts');
const startBtn = document.getElementById('startBtn');
const guessInput = document.getElementById('guessInput');
const guessBtn = document.getElementById('guessBtn');
const resetBtn = document.getElementById('resetBtn');
const voiceBtn = document.getElementById('voiceBtn');
const statusEl = document.getElementById('status');
const rangeDisplay = document.getElementById('rangeDisplay');
const triesEl = document.getElementById('tries');
const maxTriesEl = document.getElementById('maxTries');
const lastGuess = document.getElementById('lastGuess');
const suggestionEl = document.getElementById('suggestion');
const probabilityEl = document.getElementById('probability');
const shareBtn = document.getElementById('shareBtn');
const soundToggle = document.getElementById('soundToggle');
const recordsList = document.getElementById('recordsList');
const clearRecordsBtn = document.getElementById('clearRecords');
const helpBtn = document.getElementById('helpBtn');
const helpDialog = document.getElementById('helpDialog');
const closeHelp = document.getElementById('closeHelp');
const versionEl = document.getElementById('version');

let MIN = 1, MAX = 100;
let secret = null;
let tries = 0;
let maxTries = Infinity;
let finished = false;
let currentMin = 1, currentMax = 100;
let recognition = null;
let listening = false;
let multiverseTimer = null;
let lightningTimer = null;

/* ====== Utilidades ====== */
function fmt(n){ return Number(n).toLocaleString('es-ES'); }
function enable(el, v=true){ el.disabled = !v; if (el.getAttribute('aria-pressed')!==null){ el.setAttribute('aria-pressed', String(!el.disabled)); } }
function setStatus(text, cls=''){ statusEl.classList.remove('success','danger'); if (cls) statusEl.classList.add(cls); statusEl.textContent = text; }
function playTone(type){
  if (!soundToggle.checked) return;
  try{
    const ctx = window._audioCtx || (window._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    if (type === 'succeed'){ o.frequency.value = 880; } else { o.frequency.value = 160; }
    g.gain.value = 0;
    o.connect(g); g.connect(ctx.destination);
    o.start(t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.stop(t + 0.20);
  }catch(e){}
}

/* ====== localStorage records ====== */
function recordKey(mode){ return `guess_best_${mode}`; }
function getRecord(mode){
  try{ const raw = localStorage.getItem(recordKey(mode)); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function setRecord(mode, data){
  try{ localStorage.setItem(recordKey(mode), JSON.stringify(data)); }catch(e){}
}
function clearAllRecords(){ Object.keys(LEVELS).forEach(k => localStorage.removeItem(recordKey(k))); renderRecords(); }

/* ====== Render records panel ====== */
function renderRecords(){
  recordsList.innerHTML = '';
  Object.keys(LEVELS).forEach(k=>{
    const rec = getRecord(k);
    const el = document.createElement('div');
    const left = document.createElement('div');
    left.innerHTML = `<strong>${LEVELS[k].label}</strong>`;
    const right = document.createElement('div');
    right.style.color = '#cbd5e1';
    right.style.fontSize = '13px';
    right.textContent = rec ? `${rec.tries} intentos — ${new Date(rec.date).toLocaleString()}` : '—';
    el.appendChild(left); el.appendChild(right);
    recordsList.appendChild(el);
  });
}

/* ====== Sugerencia y probabilidad ====== */
function updateSuggestion(){
  if (currentMin > currentMax){ suggestionEl.textContent = '—'; probabilityEl.textContent = ''; return; }
  const mid = Math.floor((currentMin + currentMax) / 2);
  suggestionEl.textContent = fmt(mid);
  const remaining = Math.max(0, currentMax - currentMin + 1);
  probabilityEl.textContent = remaining > 0 ? `Probabilidad actual: 1 entre ${fmt(remaining)}.` : '';
}

/* ====== Generadores de comportamiento especial ====== */
function startMultiverse(){
  if (multiverseTimer) clearInterval(multiverseTimer);
  multiverseTimer = setInterval(()=>{
    if (!finished){
      secret = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
      setStatus('Multiverso: el número cambió.', '');
    }
  }, 10000);
}
function stopMultiverse(){ if (multiverseTimer) clearInterval(multiverseTimer); multiverseTimer = null; }

function startLightning(){
  if (lightningTimer) clearTimeout(lightningTimer);
  lightningTimer = setTimeout(()=>{
    if (!finished){ endGame(false, 'timeout'); }
  }, 10000);
}
function stopLightning(){ if (lightningTimer) clearTimeout(lightningTimer); lightningTimer = null; }

/* ====== Conversión simple palabras->número (heurística) ====== */
function wordsToNumber(text){
  text = text.toLowerCase().replace(/y/g,' ').replace(/-/g,' ').replace(/[^a-z0-9\s]/g,'').trim();
  if (!text) return null;
  const map = {
    'cero':0,'uno':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,
    'once':11,'doce':12,'trece':13,'catorce':14,'quince':15,'dieciseis':16,'dieciséis':16,'diecisiete':17,'dieciocho':18,'diecinueve':19,
    'veinte':20,'veintiuno':21,'veintidos':22,'veintidós':22,'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,'noventa':90,
    'cien':100,'ciento':100,'doscientos':200,'trescientos':300,'cuatrocientos':400,'quinientos':500,'seiscientos':600,'setecientos':700,'ochocientos':800,'novecientos':900,
    'mil':1000,'millon':1000000,'millón':1000000
  };
  const parts = text.split(/\s+/);
  let total = 0, group = 0;
  for (let w of parts){
    if (map[w] === undefined) continue;
    const val = map[w];
    if (val === 1000 || val === 1000000){
      group = (group || 1) * val;
      total += group; group = 0;
    } else {
      group += val;
    }
  }
  const result = total + group;
  return result > 0 ? result : null;
}

/* ====== Voice setup ====== */
function setupVoice(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SpeechRecognition){ voiceBtn.style.display = 'none'; return; }
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener('result', (e)=>{
    const raw = e.results[0][0].transcript || '';
    const digits = raw.replace(/[^\d\-]/g,'').trim();
    let parsed = null;
    if (digits.length && /^\-?\d+$/.test(digits)) parsed = digits;
    else parsed = wordsToNumber(raw);
    if (parsed !== null){
      guessInput.value = parsed;
      guessInput.classList.add('flash');
      setTimeout(()=> guessInput.classList.remove('flash'), 700);
      handleGuess();
    } else {
      setStatus('No entendí un número claro. Intenta de nuevo.');
    }
  });
  recognition.addEventListener('end', ()=> { listening = false; voiceBtn.setAttribute('aria-pressed','false'); voiceBtn.textContent = '🎤 Voz'; });
  recognition.addEventListener('error', ()=> { listening = false; voiceBtn.setAttribute('aria-pressed','false'); voiceBtn.textContent = '🎤 Voz'; setStatus('Error en reconocimiento de voz.'); });
}
function toggleVoice(){
  if (!recognition) return;
  if (listening){ recognition.stop(); listening = false; voiceBtn.setAttribute('aria-pressed','false'); voiceBtn.textContent = '🎤 Voz'; }
  else { try{ recognition.start(); listening = true; voiceBtn.setAttribute('aria-pressed','true'); voiceBtn.textContent = '🔴 Escuchando...'; }catch(e){ listening = false; } }
}

/* ====== Inicio de juego ====== */
function prepareGameFromSelection(){
  const mode = difficultyEl.value;
  const lvl = LEVELS[mode] || LEVELS.easy;
  if (mode === 'infinite'){
    const min = 1_000_000, max = 1_000_000_000;
    MAX = Math.floor(Math.random() * (max - min + 1)) + min;
  } else if (mode === 'master'){
    const all = Object.keys(LEVELS).map(k => getRecord(k)?.tries).filter(Boolean);
    const avg = all.length ? Math.max(1000, Math.floor(all.reduce((a,b)=>a+b,0)/all.length) * 100) : 100000;
    MAX = Math.min(Math.max(avg, 10000), 1000000);
  } else {
    MAX = lvl.max || 100000;
  }
  MIN = 1;
  currentMin = MIN; currentMax = MAX;
  rangeDisplay.textContent = (mode === 'dark') ? '—' : `${fmt(MIN)} … ${fmt(MAX)}`;

  if (limitToggle.checked){
    const userAttempts = Number(attemptsEl.value);
    if (!Number.isFinite(userAttempts) || userAttempts < 1){ maxTries = lvl.defaultAttempts; attemptsEl.value = lvl.defaultAttempts; }
    else { maxTries = Math.floor(userAttempts); }
  } else { maxTries = Infinity; attemptsEl.value = ''; }
  maxTriesEl.textContent = maxTries === Infinity ? '∞' : String(maxTries);

  versionEl.textContent = `v2.0 — ${lvl.label}`;
}

function newGame(){
  stopMultiverse(); stopLightning();
  prepareGameFromSelection();
  secret = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
  tries = 0; finished = false;
  triesEl.textContent = tries;
  lastGuess.textContent = '—';
  suggestionEl.textContent = '—';
  probabilityEl.textContent = '';
  enable(guessInput,true); enable(guessBtn,true); enable(resetBtn,true);
  enable(difficultyEl,false); enable(limitToggle,false); enable(attemptsEl,false); enable(startBtn,false);
  shareBtn.disabled = true;
  guessInput.value = '';
  guessInput.focus();
  const mode = difficultyEl.value;

  if (mode === 'multiverse') startMultiverse();
  if (mode === 'lightning') startLightning();
  if (mode === 'infinite'){ setStatus(`Rango aleatorio: 1 … ${fmt(MAX)}. ¡Suerte!`); } 
  else if (mode === 'dark'){ setStatus('Modo Oscuro: rango oculto. Confía en tus instintos.'); }
  else setStatus(`Se ha elegido un número entre ${fmt(MIN)} y ${fmt(MAX)}. ¡Suerte!`);
  updateSuggestion();
}

/* ====== Finalizar juego ====== */
function endGame(win, reason='normal'){
  finished = true;
  enable(guessInput,false); enable(guessBtn,false);
  enable(difficultyEl,true); enable(limitToggle,true); enable(attemptsEl,true); enable(startBtn,true);
  stopMultiverse(); stopLightning();
  if (win){
    playTone('succeed'); setStatus(`¡Correcto! Has adivinado ${fmt(secret)} en ${tries} intentos.`, 'success');
    const level = difficultyEl.value;
    const prev = getRecord(level);
    const now = Date.now();
    if (!prev || tries < prev.tries){ setRecord(level, {tries, date: now}); renderRecords(); }
    shareBtn.disabled = false;
  } else {
    playTone('fail');
    const msg = reason === 'timeout' ? `Tiempo agotado. El número era ${fmt(secret)}.` : `Has perdido. El número era ${fmt(secret)}.`;
    setStatus(msg, 'danger');
    shareBtn.disabled = false;
  }
}

/* ====== Manejo de suposición ====== */
function handleGuess(){
  if (finished) return;
  const raw = String(guessInput.value).trim();
  if (!raw){ setStatus('Introduce un número para probar.'); return; }

  const cleaned = raw.replace(/[^\d\-]/g,'');
  const n = Number(cleaned.length ? cleaned : raw);
  const mode = difficultyEl.value;

  let guessNum = Number.isFinite(n) && Number.isInteger(n) ? n : wordsToNumber(raw);
  if (guessNum === null || !Number.isFinite(guessNum) || !Number.isInteger(guessNum)){
    setStatus('Introduce un número entero válido.');
    return;
  }

  if (guessNum < MIN || guessNum > MAX){
    setStatus(`Introduce un número entre ${fmt(MIN)} y ${fmt(MAX)}.`);
    return;
  }

  tries++; triesEl.textContent = tries;
  lastGuess.textContent = fmt(guessNum);

  if (mode === 'chaos' && guessNum !== secret){
    secret = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
    setStatus('Caos: el número cambió tras tu intento.');
  }

  if (mode === 'eco'){
    const base = guessNum < secret ? 'más alto' : 'más bajo';
    setStatus(`Eco: ${base}... ${Math.random() < 0.5 ? '...eco...' : '...zzzt...'}`);
  }

  if (mode === 'prophet'){
    const hints = [
      'El número se oculta tras la niebla.',
      'Tu intuición será tu guía.',
      'No confíes en lo obvio.',
      'Busca lo que no cambia.'
    ];
    setStatus(hints[Math.floor(Math.random()*hints.length)]);
  }

  if (mode === 'sage' && tries % 3 === 0){
    const mid = Math.floor((currentMin + currentMax) / 2);
    setStatus(`Pista del sabio: el número está cerca de ${fmt(mid)}.`);
  }

  if (mode === 'simulation'){
    const responses = [
      'Procesando… la probabilidad ha cambiado.',
      'Análisis heurístico: la vecindad de tu suposición es más probable.',
      'Simulación completa: ajustar estrategia.'
    ];
    setStatus(responses[Math.floor(Math.random()*responses.length)]);
  }

  if (guessNum === secret){
    endGame(true);
    return;
  } else if (guessNum < secret){
    setStatus('Demasiado bajo. Intenta un número más alto.');
    if (guessNum >= currentMin) currentMin = guessNum + 1;
  } else {
    setStatus('Demasiado alto. Intenta un número más bajo.');
    if (guessNum <= currentMax) currentMax = guessNum - 1;
  }

  updateSuggestion();

  if (limitToggle.checked && tries >= maxTries){
    endGame(false);
    return;
  }

  if (difficultyEl.value === 'master'){
    const recs = Object.keys(LEVELS).map(k => getRecord(k)?.tries).filter(Boolean);
    if (recs.length){
      const factor = Math.max(1, Math.floor(recs.reduce((a,b)=>a+b,0)/recs.length / 10));
      const shift = Math.floor((Math.random()*2-1) * factor);
      secret = Math.min(Math.max(MIN, secret + shift), MAX);
    }
  }

  guessInput.value = '';
  guessInput.focus();
}

/* ====== Compartir resultado ====== */
function shareResult(){
  const levelLabel = LEVELS[difficultyEl.value]?.label || 'Modo';
  const rec = getRecord(difficultyEl.value);
  const bestText = rec ? `${rec.tries} (récord)` : 'sin récord';
  const text = `Adivina_el_numero — ${levelLabel}\nResultado: ${statusEl.textContent}\nIntentos: ${tries}\nMejor: ${bestText}`;
  if (navigator.share){
    navigator.share({title:'Adivina_el_numero', text}).catch(()=> { navigator.clipboard && navigator.clipboard.writeText(text); alert('Resultado copiado al portapapeles.'); });
  } else if (navigator.clipboard){
    navigator.clipboard.writeText(text).then(()=> alert('Resultado copiado al portapapeles.'), ()=> alert('No se pudo copiar.'));
  } else {
    prompt('Copia tu resultado:', text);
  }
}

/* ====== Eventos UI ====== */
startBtn.addEventListener('click', newGame);
resetBtn.addEventListener('click', ()=> newGame());
guessBtn.addEventListener('click', handleGuess);
guessInput.addEventListener('keydown', (e)=> { if (e.key === 'Enter') handleGuess(); });

difficultyEl.addEventListener('change', ()=>{
  const lvl = LEVELS[difficultyEl.value] || LEVELS.easy;
  rangeDisplay.textContent = `${fmt(1)} … ${fmt(lvl.max || 100000)}`;
  if (limitToggle.checked && (!attemptsEl.value || Number(attemptsEl.value) < 1)) attemptsEl.value = lvl.defaultAttempts;
  versionEl.textContent = `v2.0 — ${lvl.label}`;
});
limitToggle.addEventListener('change', ()=> {
  if (limitToggle.checked){
    const lvl = LEVELS[difficultyEl.value];
    if (!attemptsEl.value || Number(attemptsEl.value) < 1) attemptsEl.value = lvl.defaultAttempts;
  } else { attemptsEl.value = ''; maxTriesEl.textContent = '∞'; }
});

shareBtn.addEventListener('click', shareResult);
clearRecordsBtn.addEventListener('click', ()=> { if (confirm('Borrar todos los récords guardados en este navegador?')) clearAllRecords(); });

helpBtn.addEventListener('click', ()=> { if (typeof helpDialog.showModal === 'function') helpDialog.showModal(); else alert('Ayuda: elige modo, Iniciar, escribe un número y pulsa Probar.'); });
closeHelp.addEventListener('click', ()=> helpDialog.close());
voiceBtn.addEventListener('click', toggleVoice);

/* ====== Inicialización ====== */
function init(){
  attemptsEl.value = LEVELS[difficultyEl.value].defaultAttempts;
  rangeDisplay.textContent = `${fmt(1)} … ${fmt(LEVELS[difficultyEl.value].max)}`;
  maxTriesEl.textContent = '—';
  enable(guessInput,false); enable(guessBtn,false); enable(resetBtn,false);
  renderRecords();
  setupVoice();
}
init();

/* Export para debugging */
window.__guessGame = { LEVELS, newGame, handleGuess, endGame, getRecord, setRecord, clearAllRecords };
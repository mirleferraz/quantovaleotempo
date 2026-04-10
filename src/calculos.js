/**
 * Módulo de lógica de negócio — Quanto Vale o Tempo
 * Funções puras extraídas do index.html para facilitar testes unitários.
 */

'use strict';

// ── CONSTANTES ────────────────────────────────────────────────
const TC = {
  carro:     { emoji:'🚗', name:'Carro',         factor:1.0, travelMode:'DRIVING'  },
  metro:     { emoji:'🚇', name:'Metrô/Ônibus',  factor:0.75,travelMode:'TRANSIT'  },
  bike:      { emoji:'🚲', name:'Bike',           factor:0.4, travelMode:'BICYCLING'},
  caminhada: { emoji:'🚶', name:'A pé',           factor:0.2, travelMode:'WALKING'  },
  app:       { emoji:'📱', name:'App (Uber/99)', factor:1.1, travelMode:'DRIVING'  }
};

// ── MATH ──────────────────────────────────────────────────────
/**
 * Calcula métricas de custo e tempo para um trajeto.
 * @param {Object} r - dados do trajeto
 * @returns {Object} métricas calculadas
 */
function metricas(r) {
  const minIda    = parseFloat(r.tempo)       || 0;
  const minVolta  = parseFloat(r.tempoVolta)  || minIda;
  const minDia    = minIda + minVolta;
  const dias      = parseInt(r.dias)           || 5;
  const vh        = (r.salario || 0) / (r.horasMes || 160);
  const cpm       = vh / 60;
  const minMes    = minDia * dias * 4.3;
  const minAno    = minDia * dias * 52;
  return {
    minIda, minVolta, minDia, minMes, minAno,
    custoMes:    minMes * cpm,
    custoAno:    minAno * cpm,
    custoDirMes: (parseFloat(r.custoDireto) || 0) * dias * 4.3,
    pct:         r.salario ? (minMes * cpm / r.salario * 100) : 0,
    diasVida:    minAno / 60 / 24,
    horasAno:    minAno / 60,
    vh
  };
}

// ── FORMATAÇÃO ────────────────────────────────────────────────
/**
 * Formata minutos em string legível (ex: 1h30min).
 * @param {number} min
 * @returns {string}
 */
function fTempo(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h${m}min`;
}

/**
 * Formata valor em Real Brasileiro (BRL).
 * @param {number} v
 * @returns {string}
 */
function fBRL(v) {
  if (!v || isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata valor arredondado com prefixo R$ e separador de milhar.
 * @param {number} v
 * @returns {string}
 */
function fK(v) {
  if (!v || isNaN(v)) return 'R$ 0';
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}

// ── CEP UTILITIES ─────────────────────────────────────────────
/**
 * Extrai CEP de uma string; retorna apenas quando há exatamente 8 dígitos.
 * @param {string} val
 * @returns {string|null}
 */
function extractCEP(val) {
  const d = val.replace(/\D/g, '');
  return d.length === 8 ? d : null;
}

/**
 * Aplica máscara de CEP (XXXXX-XXX) a uma string.
 * @param {string} val
 * @returns {string}
 */
function formatCEPInput(val) {
  const d = val.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
}

// ── TRAFFIC LABEL ─────────────────────────────────────────────
/**
 * Classifica o nível de tráfego com base na razão duração-com-tráfego / sem-tráfego.
 * @param {number} ratio
 * @returns {string} 'alta' | 'média' | 'baixa'
 */
function trafLabel(ratio) {
  return ratio > 1.4 ? 'alta' : ratio > 1.15 ? 'média' : 'baixa';
}

// ── RUSH LABEL (IA fallback) ──────────────────────────────────
/**
 * Classifica o horário de pico com base na hora fornecida (string "HH:MM").
 * @param {string} hor
 * @returns {string}
 */
function rushLabel(hor) {
  const h = parseInt(hor);
  if ((h >= 7 && h <= 9) || (h >= 17 && h <= 19)) return 'alta';
  if ((h >= 6 && h <= 10) || (h >= 16 && h <= 20)) return 'média';
  return 'baixa';
}

// ── VALOR HORA ────────────────────────────────────────────────
/**
 * Calcula o valor por hora a partir do salário e horas mensais.
 * @param {number} salario
 * @param {number} horasMes
 * @returns {number}
 */
function calcularValorHora(salario, horasMes = 160) {
  if (!salario || salario <= 0) return 0;
  return salario / horasMes;
}

// ── CUSTO POR MINUTO ──────────────────────────────────────────
/**
 * Retorna o custo por minuto a partir do salário e horas mensais.
 * @param {number} salario
 * @param {number} horasMes
 * @returns {number}
 */
function custoPorMinuto(salario, horasMes = 160) {
  return calcularValorHora(salario, horasMes) / 60;
}

// ── VALIDAÇÕES DE API KEY ─────────────────────────────────────
/**
 * Valida se uma key do Google Maps tem o prefixo correto.
 * @param {string} key
 * @returns {boolean}
 */
function isValidGMapsKey(key) {
  return typeof key === 'string' && key.startsWith('AIza');
}

/**
 * Valida se uma key da Anthropic tem o prefixo correto.
 * @param {string} key
 * @returns {boolean}
 */
function isValidAnthropicKey(key) {
  return typeof key === 'string' && key.startsWith('sk-ant-');
}

// ── BADGE DE STATUS DE API ────────────────────────────────────
/**
 * Retorna o texto e className do badge de status com base nas APIs ativas.
 * @param {boolean} gmReady   - Google Maps SDK carregado e validado
 * @param {string}  anthropicKey - Anthropic API key (string não-vazia = configurada)
 * @returns {{ className: string, text: string }}
 */
function getApiStatusBadge(gmReady, anthropicKey) {
  if (gmReady && anthropicKey) {
    return { className: 'badge badge-success badge-dot badge-live', text: 'Google Maps + IA' };
  } else if (gmReady) {
    return { className: 'badge badge-success badge-dot badge-live', text: 'Google Maps ativo' };
  } else if (anthropicKey) {
    return { className: 'badge badge-accent badge-dot badge-live', text: '✦ IA ativa' };
  } else {
    return { className: 'badge badge-accent badge-dot', text: 'Sem API configurada' };
  }
}

module.exports = {
  TC,
  metricas,
  fTempo,
  fBRL,
  fK,
  extractCEP,
  formatCEPInput,
  trafLabel,
  rushLabel,
  calcularValorHora,
  custoPorMinuto,
  isValidGMapsKey,
  isValidAnthropicKey,
  getApiStatusBadge,
};

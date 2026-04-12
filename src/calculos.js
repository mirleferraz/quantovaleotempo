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

// ── HAVERSINE / LOCAL ROUTE ESTIMATION ───────────────────────
/**
 * Calcula a distância em km entre dois pontos usando a fórmula de Haversine.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distância em km
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estima tempo de trajeto localmente a partir de coordenadas lat/lng.
 * Usa fator de desvio urbano 1,4× sobre a distância em linha reta.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @param {string} mode    - 'carro' | 'app' | 'metro' | 'bike' | 'caminhada'
 * @param {string} horario - string "HH:MM"
 * @returns {{ tempoMin: number, distKm: number, traf: string }}
 */
function estimarRotaLocal(lat1, lng1, lat2, lng2, mode, horario) {
  const straight   = haversineKm(lat1, lng1, lat2, lng2);
  const roadKm     = parseFloat((straight * 1.4).toFixed(1));
  const avgSpeed   = { carro: 35, app: 35, metro: 28, bike: 15, caminhada: 5 };
  const speed      = avgSpeed[mode] || 35;
  const h          = parseInt(horario);
  const rushFactor = ((h >= 7 && h <= 9) || (h >= 17 && h <= 19)) ? 1.5
                   : ((h >= 6 && h <= 10) || (h >= 16 && h <= 20)) ? 1.25 : 1.0;
  const traf       = rushFactor >= 1.5 ? 'alta' : rushFactor >= 1.25 ? 'média' : 'baixa';
  const applyRush  = mode === 'carro' || mode === 'app';
  const tempoMin   = Math.max(1, Math.round((roadKm / speed) * 60 * (applyRush ? rushFactor : 1)));
  return { tempoMin, distKm: roadKm, traf };
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
  haversineKm,
  estimarRotaLocal,
};

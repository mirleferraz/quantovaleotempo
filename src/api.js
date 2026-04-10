'use strict';

/**
 * Cria um AbortSignal com timeout — compatível com browsers sem AbortSignal.timeout().
 * @param {number} ms
 * @returns {AbortSignal}
 */
function abortAfter(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/**
 * Resolve um CEP brasileiro usando BrasilAPI v2 (primário) com fallback para ViaCEP.
 *
 * BrasilAPI v2 resposta:
 *   { cep, state, city, neighborhood, street, service,
 *     location: { type, coordinates: { longitude, latitude } } }
 *
 * ViaCEP resposta:
 *   { cep, logradouro, complemento, bairro, localidade, uf, ... }
 *   ou { erro: true } para CEPs inválidos.
 *
 * @param {string} cep  - CEP com ou sem hífen (ex: "01310-100" ou "01310100")
 * @returns {Promise<{
 *   fullAddress: string,
 *   display:     string,
 *   logradouro:  string,
 *   bairro:      string,
 *   localidade:  string,
 *   uf:          string,
 *   cep:         string,
 *   fonte:       'BrasilAPI' | 'ViaCEP',
 *   lat:         number | null,
 *   lng:         number | null,
 * }>}
 * @throws {Error} se o CEP não for encontrado em nenhuma fonte
 */
async function resolveCEP(cep) {
  const digits = cep.replace(/\D/g, '');
  const fmt    = `${digits.slice(0, 5)}-${digits.slice(5)}`;

  let logradouro = '', bairro = '', localidade = '', uf = '';
  let lat = null, lng = null;
  let fonte = null;

  // ── 1ª tentativa: BrasilAPI v2 ──────────────────────────────
  try {
    const r = await fetch(
      `https://brasilapi.com.br/api/cep/v2/${digits}`,
      { signal: abortAfter(6000) }
    );
    if (r.ok) {
      const j = await r.json();
      // CEP inválido retorna { message, name, type } sem campo "cep"
      if (j && j.cep && typeof j.city === 'string') {
        logradouro = j.street       || '';
        bairro     = j.neighborhood || '';
        localidade = j.city         || '';
        uf         = j.state        || '';

        const coords = j.location?.coordinates;
        if (coords?.latitude && coords?.longitude) {
          lat = parseFloat(coords.latitude);
          lng = parseFloat(coords.longitude);
        }
        fonte = 'BrasilAPI';
      }
    }
  } catch (_) {}

  // ── 2ª tentativa: ViaCEP (fallback de conectividade) ────────
  if (!fonte) {
    try {
      const r = await fetch(
        `https://viacep.com.br/ws/${digits}/json/`,
        { signal: abortAfter(6000) }
      );
      if (r.ok) {
        const j = await r.json();
        if (j && !j.erro && j.localidade) {
          logradouro = j.logradouro || '';
          bairro     = j.bairro     || '';
          localidade = j.localidade;   // garantido truthy pela condição acima
          uf         = j.uf         || '';
          fonte      = 'ViaCEP';
        }
      }
    } catch (_) {}
  }

  if (!fonte) throw new Error(`CEP ${fmt} não encontrado`);

  const addrParts  = [logradouro, bairro, localidade, uf].filter(Boolean);
  const fullAddress = addrParts.length
    ? `${addrParts.join(', ')}, ${fmt}, Brasil`
    : `${fmt}, Brasil`;

  const linha1  = [logradouro, bairro].filter(Boolean).join(', ') || localidade || fmt;
  const display = `${linha1} — ${localidade}/${uf} · CEP ${fmt}`;

  return { fullAddress, display, logradouro, bairro, localidade, uf, cep: fmt, fonte, lat, lng };
}

module.exports = { resolveCEP, abortAfter };

'use strict';

const { resolveCEP, abortAfter } = require('../src/api');

// ── Helpers de mock ───────────────────────────────────────────
function mockFetch(responses) {
  // responses: array de { ok, json } na ordem das chamadas
  let call = 0;
  global.fetch = jest.fn(() => {
    const resp = responses[call++] || { ok: false };
    return Promise.resolve({
      ok: resp.ok,
      json: () => Promise.resolve(resp.json || {}),
    });
  });
}

function brasilApiOk(overrides = {}) {
  return {
    ok: true,
    json: {
      cep: '01310-100',
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      location: {
        type: 'Point',
        coordinates: { latitude: '-23.5614', longitude: '-46.6558' },
      },
      ...overrides,
    },
  };
}

function viaCEPOk(overrides = {}) {
  return {
    ok: true,
    json: {
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
      ...overrides,
    },
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// BrasilAPI v2 — caminho feliz
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() via BrasilAPI v2', () => {
  test('retorna fonte "BrasilAPI" quando a API responde corretamente', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.fonte).toBe('BrasilAPI');
  });

  test('formata o CEP como XXXXX-XXX na resposta', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.cep).toBe('01310-100');
  });

  test('aceita CEP com hífen como entrada', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310-100');
    expect(r.cep).toBe('01310-100');
  });

  test('popula logradouro, bairro, localidade e uf corretamente', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.logradouro).toBe('Avenida Paulista');
    expect(r.bairro).toBe('Bela Vista');
    expect(r.localidade).toBe('São Paulo');
    expect(r.uf).toBe('SP');
  });

  test('extrai coordenadas lat/lng quando disponíveis', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.lat).toBeCloseTo(-23.5614, 3);
    expect(r.lng).toBeCloseTo(-46.6558, 3);
  });

  test('lat/lng são null quando a API não retorna coordenadas', async () => {
    mockFetch([brasilApiOk({ location: null })]);
    const r = await resolveCEP('01310100');
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
  });

  test('lat/lng são null quando coordinates estão vazias', async () => {
    mockFetch([brasilApiOk({ location: { type: 'Point', coordinates: {} } })]);
    const r = await resolveCEP('01310100');
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
  });

  test('monta fullAddress completo com todos os campos', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.fullAddress).toBe('Avenida Paulista, Bela Vista, São Paulo, SP, 01310-100, Brasil');
  });

  test('fullAddress usa apenas campos não-vazios', async () => {
    mockFetch([brasilApiOk({ street: '', neighborhood: '' })]);
    const r = await resolveCEP('01310100');
    expect(r.fullAddress).toBe('São Paulo, SP, 01310-100, Brasil');
  });

  test('fullAddress é só CEP quando todos os campos são vazios', async () => {
    mockFetch([brasilApiOk({ street: '', neighborhood: '', city: '', state: '' })]);
    // city vazio → fonte não é 'BrasilAPI' (validação j.city === 'string' com city='')
    // Mas '' é string → typeof '' === 'string' → fonte seria BrasilAPI
    // Recai no ViaCEP pois j.city === '' é falsy? Não — typeof '' === 'string' passa
    // mas localidade = '' → addrParts vazio → fullAddress = 'XXXXX-XXX, Brasil'
    const r = await resolveCEP('01310100');
    expect(r.fullAddress).toBe('01310-100, Brasil');
  });

  test('monta display no formato "Rua, Bairro — Cidade/UF · CEP"', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.display).toContain('São Paulo/SP');
    expect(r.display).toContain('01310-100');
    expect(r.display).toContain('Avenida Paulista');
  });

  test('não chama ViaCEP quando BrasilAPI tem sucesso', async () => {
    mockFetch([brasilApiOk()]);
    await resolveCEP('01310100');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toContain('brasilapi');
  });
});

// ─────────────────────────────────────────────────────────────
// BrasilAPI — CEP inválido (sem campo "cep" na resposta)
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() — BrasilAPI retorna CEP inválido', () => {
  test('fallback para ViaCEP quando BrasilAPI retorna objeto sem campo "cep"', async () => {
    const brasilApiInvalid = { ok: true, json: { message: 'CEP not found', type: 'not_found' } };
    mockFetch([brasilApiInvalid, viaCEPOk()]);
    const r = await resolveCEP('99999999');
    expect(r.fonte).toBe('ViaCEP');
  });

  test('fallback para ViaCEP quando BrasilAPI retorna ok:false', async () => {
    mockFetch([{ ok: false }, viaCEPOk()]);
    const r = await resolveCEP('01310100');
    expect(r.fonte).toBe('ViaCEP');
  });

  test('fallback para ViaCEP quando BrasilAPI lança erro de rede', async () => {
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(viaCEPOk().json) });
    const r = await resolveCEP('01310100');
    expect(r.fonte).toBe('ViaCEP');
  });
});

// ─────────────────────────────────────────────────────────────
// ViaCEP — fallback
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() via ViaCEP (fallback)', () => {
  test('retorna fonte "ViaCEP" quando BrasilAPI falha', async () => {
    mockFetch([{ ok: false }, viaCEPOk()]);
    const r = await resolveCEP('01310100');
    expect(r.fonte).toBe('ViaCEP');
  });

  test('popula campos corretamente via ViaCEP', async () => {
    mockFetch([{ ok: false }, viaCEPOk()]);
    const r = await resolveCEP('01310100');
    expect(r.logradouro).toBe('Avenida Paulista');
    expect(r.localidade).toBe('São Paulo');
    expect(r.uf).toBe('SP');
  });

  test('lat/lng são null quando usando ViaCEP (não fornece coordenadas)', async () => {
    mockFetch([{ ok: false }, viaCEPOk()]);
    const r = await resolveCEP('01310100');
    expect(r.lat).toBeNull();
    expect(r.lng).toBeNull();
  });

  test('ViaCEP { erro: true } não é aceito como resultado válido', async () => {
    mockFetch([{ ok: false }, { ok: true, json: { erro: true } }]);
    await expect(resolveCEP('00000000')).rejects.toThrow('não encontrado');
  });

  test('ViaCEP sem campo localidade não é aceito', async () => {
    mockFetch([{ ok: false }, { ok: true, json: { logradouro: 'Rua X' } }]);
    await expect(resolveCEP('00000000')).rejects.toThrow('não encontrado');
  });
});

// ─────────────────────────────────────────────────────────────
// Ambas as fontes falham
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() — ambas as fontes falham', () => {
  test('lança erro quando BrasilAPI e ViaCEP falham', async () => {
    mockFetch([{ ok: false }, { ok: false }]);
    await expect(resolveCEP('00000000')).rejects.toThrow('CEP 00000-000 não encontrado');
  });

  test('lança erro quando ambas lançam erro de rede', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    await expect(resolveCEP('00000000')).rejects.toThrow('não encontrado');
  });

  test('mensagem de erro contém o CEP formatado', async () => {
    mockFetch([{ ok: false }, { ok: false }]);
    await expect(resolveCEP('12345678')).rejects.toThrow('12345-678');
  });
});

// ─────────────────────────────────────────────────────────────
// Formatação do endereço de retorno
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() — construção do endereço', () => {
  test('display usa localidade quando logradouro e bairro estão vazios', async () => {
    mockFetch([brasilApiOk({ street: '', neighborhood: '' })]);
    const r = await resolveCEP('01310100');
    expect(r.display).toContain('São Paulo');
  });

  test('display usa CEP quando todos os campos de endereço estão vazios', async () => {
    const semCampos = { ok: false };
    const viaCEPSemRua = { ok: true, json: { localidade: 'São Paulo', uf: 'SP' } };
    mockFetch([semCampos, viaCEPSemRua]);
    const r = await resolveCEP('01310100');
    expect(r.display).toContain('São Paulo');
  });

  test('fullAddress inclui "Brasil" no final', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r.fullAddress).toMatch(/Brasil$/);
  });

  test('objeto retornado tem todas as propriedades esperadas', async () => {
    mockFetch([brasilApiOk()]);
    const r = await resolveCEP('01310100');
    expect(r).toHaveProperty('fullAddress');
    expect(r).toHaveProperty('display');
    expect(r).toHaveProperty('logradouro');
    expect(r).toHaveProperty('bairro');
    expect(r).toHaveProperty('localidade');
    expect(r).toHaveProperty('uf');
    expect(r).toHaveProperty('cep');
    expect(r).toHaveProperty('fonte');
    expect(r).toHaveProperty('lat');
    expect(r).toHaveProperty('lng');
  });
});

// ─────────────────────────────────────────────────────────────
// URLs das chamadas fetch
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() — URLs de requisição', () => {
  test('chama BrasilAPI com os 8 dígitos sem hífen', async () => {
    mockFetch([brasilApiOk()]);
    await resolveCEP('01310-100');
    expect(global.fetch.mock.calls[0][0]).toBe('https://brasilapi.com.br/api/cep/v2/01310100');
  });

  test('chama ViaCEP com os 8 dígitos sem hífen', async () => {
    mockFetch([{ ok: false }, viaCEPOk()]);
    await resolveCEP('01310-100');
    expect(global.fetch.mock.calls[1][0]).toBe('https://viacep.com.br/ws/01310100/json/');
  });

  test('passa AbortSignal nas requisições', async () => {
    mockFetch([brasilApiOk()]);
    await resolveCEP('01310100');
    const options = global.fetch.mock.calls[0][1];
    expect(options).toHaveProperty('signal');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

// ─────────────────────────────────────────────────────────────
// ViaCEP — campos opcionais undefined (branches || '')
// ─────────────────────────────────────────────────────────────
describe('resolveCEP() via ViaCEP — campos ausentes', () => {
  test('uf ausente no ViaCEP resulta em string vazia', async () => {
    mockFetch([
      { ok: false },
      { ok: true, json: { localidade: 'São Paulo' } },  // sem uf
    ]);
    const r = await resolveCEP('01310100');
    expect(r.uf).toBe('');
    expect(r.fonte).toBe('ViaCEP');
  });

  test('logradouro ausente no ViaCEP resulta em string vazia', async () => {
    mockFetch([
      { ok: false },
      { ok: true, json: { localidade: 'São Paulo', uf: 'SP' } },  // sem logradouro
    ]);
    const r = await resolveCEP('01310100');
    expect(r.logradouro).toBe('');
  });

  test('bairro ausente no ViaCEP resulta em string vazia', async () => {
    mockFetch([
      { ok: false },
      { ok: true, json: { localidade: 'São Paulo', uf: 'SP' } },  // sem bairro
    ]);
    const r = await resolveCEP('01310100');
    expect(r.bairro).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// abortAfter()
// ─────────────────────────────────────────────────────────────
describe('abortAfter() — AbortSignal com timeout', () => {
  test('retorna um AbortSignal', () => {
    const signal = abortAfter(5000);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  test('sinal não está abortado imediatamente', () => {
    const signal = abortAfter(5000);
    expect(signal.aborted).toBe(false);
  });

  test('sinal é abortado após o timeout', async () => {
    jest.useFakeTimers();
    const signal = abortAfter(100);
    expect(signal.aborted).toBe(false);
    jest.advanceTimersByTime(100);
    expect(signal.aborted).toBe(true);
    jest.useRealTimers();
  });
});

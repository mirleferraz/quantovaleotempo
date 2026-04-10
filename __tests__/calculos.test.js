'use strict';

const {
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
} = require('../src/calculos');

// ─────────────────────────────────────────────────────────────
// TC — constantes de transporte
// ─────────────────────────────────────────────────────────────
describe('TC — Modos de transporte', () => {
  test('deve conter os 5 modos de transporte', () => {
    expect(Object.keys(TC)).toEqual(['carro', 'metro', 'bike', 'caminhada', 'app']);
  });

  test('cada modo deve ter emoji, name, factor e travelMode', () => {
    Object.values(TC).forEach(modo => {
      expect(modo).toHaveProperty('emoji');
      expect(modo).toHaveProperty('name');
      expect(modo).toHaveProperty('factor');
      expect(modo).toHaveProperty('travelMode');
    });
  });

  test('fator do carro deve ser 1.0', () => {
    expect(TC.carro.factor).toBe(1.0);
  });

  test('fator da bike deve ser 0.4', () => {
    expect(TC.bike.factor).toBe(0.4);
  });

  test('fator do app (Uber) deve ser 1.1 — o mais alto', () => {
    expect(TC.app.factor).toBe(1.1);
  });

  test('caminhada deve ter o menor fator', () => {
    const fatores = Object.values(TC).map(t => t.factor);
    expect(TC.caminhada.factor).toBe(Math.min(...fatores));
  });

  test('travelMode do metrô deve ser TRANSIT', () => {
    expect(TC.metro.travelMode).toBe('TRANSIT');
  });
});

// ─────────────────────────────────────────────────────────────
// metricas()
// ─────────────────────────────────────────────────────────────
describe('metricas() — cálculo de custo de deslocamento', () => {
  const rotaBase = {
    tempo: 30,
    tempoVolta: 30,
    dias: 5,
    salario: 4800,
    horasMes: 160,
    custoDireto: 0
  };

  test('caso base: 30min ida, 30min volta, R$4800 salário', () => {
    const m = metricas(rotaBase);
    expect(m.minIda).toBe(30);
    expect(m.minVolta).toBe(30);
    expect(m.minDia).toBe(60);
  });

  test('minutos por mês = minDia × dias × 4.3', () => {
    const m = metricas(rotaBase);
    expect(m.minMes).toBeCloseTo(60 * 5 * 4.3, 5);
  });

  test('minutos por ano = minDia × dias × 52', () => {
    const m = metricas(rotaBase);
    expect(m.minAno).toBe(60 * 5 * 52);
  });

  test('valor por hora = salário / horasMes', () => {
    const m = metricas(rotaBase);
    expect(m.vh).toBeCloseTo(4800 / 160, 5);
  });

  test('custo mensal = minMes × (vh / 60)', () => {
    const m = metricas(rotaBase);
    const cpm = (4800 / 160) / 60;
    expect(m.custoMes).toBeCloseTo(m.minMes * cpm, 5);
  });

  test('custo anual = minAno × (vh / 60)', () => {
    const m = metricas(rotaBase);
    const cpm = (4800 / 160) / 60;
    expect(m.custoAno).toBeCloseTo(m.minAno * cpm, 5);
  });

  test('dias de vida perdidos = minAno / 60 / 24', () => {
    const m = metricas(rotaBase);
    expect(m.diasVida).toBeCloseTo(m.minAno / 60 / 24, 5);
  });

  test('horas por ano = minAno / 60', () => {
    const m = metricas(rotaBase);
    expect(m.horasAno).toBeCloseTo(m.minAno / 60, 5);
  });

  test('percentual sobre salário deve ser > 0 quando há salário', () => {
    const m = metricas(rotaBase);
    expect(m.pct).toBeGreaterThan(0);
  });

  test('percentual sobre salário deve ser 0 quando salário é 0', () => {
    const m = metricas({ ...rotaBase, salario: 0 });
    expect(m.pct).toBe(0);
  });

  test('custo direto mensal = custoDireto × dias × 4.3', () => {
    const m = metricas({ ...rotaBase, custoDireto: 10 });
    expect(m.custoDirMes).toBeCloseTo(10 * 5 * 4.3, 5);
  });

  test('sem custoDireto, custoDirMes deve ser 0', () => {
    const m = metricas(rotaBase);
    expect(m.custoDirMes).toBe(0);
  });

  test('tempoVolta ausente deve espelhar tempo de ida', () => {
    const m = metricas({ ...rotaBase, tempoVolta: undefined });
    expect(m.minVolta).toBe(30);
    expect(m.minDia).toBe(60);
  });

  test('tempoVolta diferente da ida deve ser respeitado', () => {
    const m = metricas({ ...rotaBase, tempo: 30, tempoVolta: 45 });
    expect(m.minVolta).toBe(45);
    expect(m.minDia).toBe(75);
  });

  test('dias padrão deve ser 5 quando ausente', () => {
    const m = metricas({ tempo: 30, salario: 4800, horasMes: 160 });
    expect(m.minMes).toBeCloseTo(60 * 5 * 4.3, 5);
  });

  test('horasMes padrão deve ser 160 quando ausente', () => {
    const m = metricas({ tempo: 30, dias: 5, salario: 4800 });
    expect(m.vh).toBeCloseTo(4800 / 160, 5);
  });

  test('valores zerados não devem causar NaN', () => {
    const m = metricas({ tempo: 0, tempoVolta: 0, dias: 5, salario: 0, horasMes: 160 });
    Object.values(m).forEach(v => expect(isNaN(v)).toBe(false));
  });

  test('custo aumenta proporcionalmente ao tempo de trajeto', () => {
    const curto = metricas({ ...rotaBase, tempo: 20, tempoVolta: 20 });
    const longo = metricas({ ...rotaBase, tempo: 60, tempoVolta: 60 });
    expect(longo.custoMes).toBeGreaterThan(curto.custoMes);
  });

  test('custo aumenta proporcionalmente ao salário', () => {
    const baixo = metricas({ ...rotaBase, salario: 2000 });
    const alto  = metricas({ ...rotaBase, salario: 10000 });
    expect(alto.custoMes).toBeGreaterThan(baixo.custoMes);
  });
});

// ─────────────────────────────────────────────────────────────
// fTempo()
// ─────────────────────────────────────────────────────────────
describe('fTempo() — formatação de minutos', () => {
  test('0 minutos retorna "—"', () => {
    expect(fTempo(0)).toBe('—');
  });

  test('null retorna "—"', () => {
    expect(fTempo(null)).toBe('—');
  });

  test('undefined retorna "—"', () => {
    expect(fTempo(undefined)).toBe('—');
  });

  test('30 minutos retorna "30min"', () => {
    expect(fTempo(30)).toBe('30min');
  });

  test('59 minutos retorna "59min"', () => {
    expect(fTempo(59)).toBe('59min');
  });

  test('60 minutos retorna "1h"', () => {
    expect(fTempo(60)).toBe('1h');
  });

  test('90 minutos retorna "1h30min"', () => {
    expect(fTempo(90)).toBe('1h30min');
  });

  test('120 minutos retorna "2h"', () => {
    expect(fTempo(120)).toBe('2h');
  });

  test('150 minutos retorna "2h30min"', () => {
    expect(fTempo(150)).toBe('2h30min');
  });

  test('45 minutos retorna "45min"', () => {
    expect(fTempo(45)).toBe('45min');
  });

  test('1 minuto retorna "1min"', () => {
    expect(fTempo(1)).toBe('1min');
  });

  test('240 minutos retorna "4h"', () => {
    expect(fTempo(240)).toBe('4h');
  });

  test('valores fracionários são arredondados nos minutos', () => {
    expect(fTempo(60.4)).toBe('1h');
    expect(fTempo(60.6)).toBe('1h1min');
  });
});

// ─────────────────────────────────────────────────────────────
// fBRL()
// ─────────────────────────────────────────────────────────────
describe('fBRL() — formatação em Real Brasileiro', () => {
  test('0 retorna "—"', () => {
    expect(fBRL(0)).toBe('—');
  });

  test('null retorna "—"', () => {
    expect(fBRL(null)).toBe('—');
  });

  test('NaN retorna "—"', () => {
    expect(fBRL(NaN)).toBe('—');
  });

  test('valor positivo retorna string com "R$"', () => {
    expect(fBRL(100)).toContain('R$');
  });

  test('formata 1000 com separador de milhar (pt-BR)', () => {
    const result = fBRL(1000);
    // pt-BR usa ponto como separador de milhar: R$ 1.000,00
    expect(result).toMatch(/1[.,]000/);
  });

  test('formata centavos corretamente', () => {
    const result = fBRL(1.5);
    expect(result).toMatch(/1[,.]50|1,5/);
  });

  test('valor negativo é formatado', () => {
    const result = fBRL(-100);
    expect(result).toContain('R$');
  });
});

// ─────────────────────────────────────────────────────────────
// fK()
// ─────────────────────────────────────────────────────────────
describe('fK() — formatação abreviada com R$', () => {
  test('0 retorna "R$ 0"', () => {
    expect(fK(0)).toBe('R$ 0');
  });

  test('null retorna "R$ 0"', () => {
    expect(fK(null)).toBe('R$ 0');
  });

  test('NaN retorna "R$ 0"', () => {
    expect(fK(NaN)).toBe('R$ 0');
  });

  test('valor começa com "R$ "', () => {
    expect(fK(500)).toMatch(/^R\$ /);
  });

  test('valor é arredondado para inteiro', () => {
    expect(fK(999.9)).toBe('R$ 1.000');
  });

  test('1000 é formatado com separador de milhar', () => {
    const result = fK(1000);
    expect(result).toMatch(/1\.000|1,000/);
  });

  test('valores fracionários são arredondados', () => {
    expect(fK(1234.6)).toBe('R$ 1.235');
  });
});

// ─────────────────────────────────────────────────────────────
// extractCEP()
// ─────────────────────────────────────────────────────────────
describe('extractCEP() — extração de CEP', () => {
  test('CEP com 8 dígitos sem hífen retorna os dígitos', () => {
    expect(extractCEP('01310100')).toBe('01310100');
  });

  test('CEP com hífen (XXXXX-XXX) retorna 8 dígitos sem hífen', () => {
    expect(extractCEP('01310-100')).toBe('01310100');
  });

  test('CEP incompleto (7 dígitos) retorna null', () => {
    expect(extractCEP('0131010')).toBeNull();
  });

  test('CEP incompleto (5 dígitos) retorna null', () => {
    expect(extractCEP('01310')).toBeNull();
  });

  test('string vazia retorna null', () => {
    expect(extractCEP('')).toBeNull();
  });

  test('texto com letras retorna null', () => {
    expect(extractCEP('Rua das Flores')).toBeNull();
  });

  test('texto com 8 dígitos misturado a letras retorna null (apenas dígitos)', () => {
    // "Av. 01310100" → extrai "01310100" = 8 dígitos → retorna
    expect(extractCEP('Av. 01310100')).toBe('01310100');
  });

  test('CEP com 9 dígitos retorna null (mais de 8)', () => {
    expect(extractCEP('013101001')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// formatCEPInput()
// ─────────────────────────────────────────────────────────────
describe('formatCEPInput() — máscara de CEP', () => {
  test('5 dígitos não inserem hífen ainda', () => {
    expect(formatCEPInput('01310')).toBe('01310');
  });

  test('6 dígitos inserem hífen após posição 5', () => {
    expect(formatCEPInput('013101')).toBe('01310-1');
  });

  test('8 dígitos formatam como XXXXX-XXX', () => {
    expect(formatCEPInput('01310100')).toBe('01310-100');
  });

  test('já formatado (XXXXX-XXX) mantém o formato', () => {
    expect(formatCEPInput('01310-100')).toBe('01310-100');
  });

  test('mais de 8 dígitos são truncados em 8', () => {
    expect(formatCEPInput('013101001')).toBe('01310-100');
  });

  test('string vazia retorna string vazia', () => {
    expect(formatCEPInput('')).toBe('');
  });

  test('letras são ignoradas', () => {
    expect(formatCEPInput('abc01310100')).toBe('01310-100');
  });
});

// ─────────────────────────────────────────────────────────────
// trafLabel()
// ─────────────────────────────────────────────────────────────
describe('trafLabel() — classificação de tráfego', () => {
  test('ratio > 1.4 retorna "alta"', () => {
    expect(trafLabel(1.5)).toBe('alta');
    expect(trafLabel(2.0)).toBe('alta');
  });

  test('ratio entre 1.15 e 1.4 retorna "média"', () => {
    expect(trafLabel(1.3)).toBe('média');
    expect(trafLabel(1.16)).toBe('média');
  });

  test('ratio == 1.4 retorna "média" (limite exclusivo)', () => {
    expect(trafLabel(1.4)).toBe('média');
  });

  test('ratio <= 1.15 retorna "baixa"', () => {
    expect(trafLabel(1.0)).toBe('baixa');
    expect(trafLabel(1.15)).toBe('baixa');
  });

  test('ratio == 1.0 (sem tráfego) retorna "baixa"', () => {
    expect(trafLabel(1.0)).toBe('baixa');
  });
});

// ─────────────────────────────────────────────────────────────
// rushLabel()
// ─────────────────────────────────────────────────────────────
describe('rushLabel() — classificação de horário de pico', () => {
  test('07:00 é horário de pico — "alta"', () => {
    expect(rushLabel('07:00')).toBe('alta');
  });

  test('08:00 é horário de pico — "alta"', () => {
    expect(rushLabel('08:00')).toBe('alta');
  });

  test('09:00 é horário de pico — "alta"', () => {
    expect(rushLabel('09:00')).toBe('alta');
  });

  test('18:00 é horário de pico — "alta"', () => {
    expect(rushLabel('18:00')).toBe('alta');
  });

  test('12:00 é fora do pico — "baixa"', () => {
    expect(rushLabel('12:00')).toBe('baixa');
  });

  test('06:00 é horário de pico médio — "média"', () => {
    expect(rushLabel('06:00')).toBe('média');
  });

  test('10:00 é horário de pico médio — "média"', () => {
    expect(rushLabel('10:00')).toBe('média');
  });

  test('16:00 é horário de pico médio — "média"', () => {
    expect(rushLabel('16:00')).toBe('média');
  });

  test('20:00 é horário de pico médio — "média"', () => {
    expect(rushLabel('20:00')).toBe('média');
  });

  test('02:00 (madrugada) é "baixa"', () => {
    expect(rushLabel('02:00')).toBe('baixa');
  });
});

// ─────────────────────────────────────────────────────────────
// calcularValorHora()
// ─────────────────────────────────────────────────────────────
describe('calcularValorHora() — valor por hora', () => {
  test('salário 4800 / 160h = R$ 30/h', () => {
    expect(calcularValorHora(4800, 160)).toBeCloseTo(30, 5);
  });

  test('salário 0 retorna 0', () => {
    expect(calcularValorHora(0, 160)).toBe(0);
  });

  test('sem horasMes usa padrão 160', () => {
    expect(calcularValorHora(4800)).toBeCloseTo(30, 5);
  });

  test('salário negativo retorna 0', () => {
    expect(calcularValorHora(-1000, 160)).toBe(0);
  });

  test('salário 10000 / 200h = R$ 50/h', () => {
    expect(calcularValorHora(10000, 200)).toBeCloseTo(50, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// custoPorMinuto()
// ─────────────────────────────────────────────────────────────
describe('custoPorMinuto() — custo por minuto', () => {
  test('salário 4800 / 160h → R$ 0,50/min', () => {
    expect(custoPorMinuto(4800, 160)).toBeCloseTo(0.5, 5);
  });

  test('salário 0 retorna 0', () => {
    expect(custoPorMinuto(0, 160)).toBe(0);
  });

  test('custo por minuto é valor hora / 60', () => {
    const vh = calcularValorHora(6000, 160);
    expect(custoPorMinuto(6000, 160)).toBeCloseTo(vh / 60, 8);
  });
});

// ─────────────────────────────────────────────────────────────
// isValidGMapsKey()
// ─────────────────────────────────────────────────────────────
describe('isValidGMapsKey() — validação de API key do Google Maps', () => {
  test('key começando com "AIza" é válida', () => {
    expect(isValidGMapsKey('AIzaSyAbcDefGhijklMnopqrst')).toBe(true);
  });

  test('key sem prefixo "AIza" é inválida', () => {
    expect(isValidGMapsKey('invalid-key-here')).toBe(false);
  });

  test('string vazia é inválida', () => {
    expect(isValidGMapsKey('')).toBe(false);
  });

  test('null é inválido', () => {
    expect(isValidGMapsKey(null)).toBe(false);
  });

  test('undefined é inválido', () => {
    expect(isValidGMapsKey(undefined)).toBe(false);
  });

  test('número é inválido', () => {
    expect(isValidGMapsKey(12345)).toBe(false);
  });

  test('prefixo parcial "AIz" é inválido', () => {
    expect(isValidGMapsKey('AIzkey')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Testes de integração — metricas() com cenários reais
// ─────────────────────────────────────────────────────────────
describe('Integração — cenários reais de trajeto', () => {
  test('trabalhador que gasta 2h/dia em transporte perde mais de 10 dias de vida por ano', () => {
    const m = metricas({
      tempo: 60, tempoVolta: 60, dias: 5,
      salario: 4800, horasMes: 160
    });
    expect(m.diasVida).toBeGreaterThan(10);
  });

  test('custo anual > custo mensal', () => {
    const m = metricas({
      tempo: 30, tempoVolta: 30, dias: 5,
      salario: 4800, horasMes: 160
    });
    expect(m.custoAno).toBeGreaterThan(m.custoMes);
  });

  test('custo anual / custo mensal ≈ 52 / 4.3 (semanas no ano / semanas no mês)', () => {
    const m = metricas({
      tempo: 30, tempoVolta: 30, dias: 5,
      salario: 4800, horasMes: 160
    });
    // custoAno usa 52 semanas; custoMes usa 4.3 → razão exata = 52 / 4.3 ≈ 12.09
    const ratio = m.custoAno / m.custoMes;
    expect(ratio).toBeCloseTo(52 / 4.3, 5);
  });

  test('pct nunca ultrapassa 100% para salários razoáveis', () => {
    const m = metricas({
      tempo: 60, tempoVolta: 60, dias: 5,
      salario: 4800, horasMes: 160
    });
    expect(m.pct).toBeLessThan(100);
  });

  test('fTempo(metricas().minDia) retorna string legível', () => {
    const m = metricas({
      tempo: 30, tempoVolta: 45, dias: 5,
      salario: 4800, horasMes: 160
    });
    expect(fTempo(m.minDia)).toBe('1h15min');
  });

  test('fK(metricas().custoMes) retorna string com R$', () => {
    const m = metricas({
      tempo: 60, tempoVolta: 60, dias: 5,
      salario: 6000, horasMes: 160
    });
    const formatted = fK(m.custoMes);
    expect(formatted).toMatch(/^R\$ /);
  });
});

// ─────────────────────────────────────────────────────────────
// custoPorMinuto() — branch de parâmetro default
// ─────────────────────────────────────────────────────────────
describe('custoPorMinuto() — parâmetro horasMes default', () => {
  test('sem horasMes usa padrão 160', () => {
    expect(custoPorMinuto(4800)).toBeCloseTo(0.5, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// isValidAnthropicKey()
// ─────────────────────────────────────────────────────────────
describe('isValidAnthropicKey() — validação de Anthropic API key', () => {
  test('key começando com "sk-ant-" é válida', () => {
    expect(isValidAnthropicKey('sk-ant-api03-abcdefg')).toBe(true);
  });

  test('key sem prefixo "sk-ant-" é inválida', () => {
    expect(isValidAnthropicKey('sk-other-key')).toBe(false);
  });

  test('prefixo parcial "sk-ant" (sem hífen final) é inválido', () => {
    expect(isValidAnthropicKey('sk-antkey')).toBe(false);
  });

  test('string vazia é inválida', () => {
    expect(isValidAnthropicKey('')).toBe(false);
  });

  test('null é inválido', () => {
    expect(isValidAnthropicKey(null)).toBe(false);
  });

  test('undefined é inválido', () => {
    expect(isValidAnthropicKey(undefined)).toBe(false);
  });

  test('número é inválido', () => {
    expect(isValidAnthropicKey(12345)).toBe(false);
  });

  test('Google Maps key não passa na validação Anthropic', () => {
    expect(isValidAnthropicKey('AIzaSyAbcDef')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// getApiStatusBadge()
// ─────────────────────────────────────────────────────────────
describe('getApiStatusBadge() — badge de status das APIs', () => {
  test('ambas as APIs ativas: exibe "Google Maps + IA"', () => {
    const b = getApiStatusBadge(true, 'sk-ant-key');
    expect(b.text).toBe('Google Maps + IA');
    expect(b.className).toContain('badge-success');
  });

  test('só Google Maps ativo: exibe "Google Maps ativo"', () => {
    const b = getApiStatusBadge(true, '');
    expect(b.text).toBe('Google Maps ativo');
    expect(b.className).toContain('badge-success');
  });

  test('só Anthropic ativa: exibe "✦ IA ativa"', () => {
    const b = getApiStatusBadge(false, 'sk-ant-key');
    expect(b.text).toBe('✦ IA ativa');
    expect(b.className).toContain('badge-accent');
  });

  test('nenhuma API configurada: exibe "Sem API configurada"', () => {
    const b = getApiStatusBadge(false, '');
    expect(b.text).toBe('Sem API configurada');
    expect(b.className).toContain('badge-accent');
    expect(b.className).not.toContain('badge-live');
  });

  test('badge-live aparece quando pelo menos uma API está ativa', () => {
    expect(getApiStatusBadge(true, '').className).toContain('badge-live');
    expect(getApiStatusBadge(false, 'sk-ant-key').className).toContain('badge-live');
  });

  test('badge-live não aparece quando nenhuma API está ativa', () => {
    expect(getApiStatusBadge(false, '').className).not.toContain('badge-live');
  });

  test('ambas ativas retorna badge-success (não badge-accent)', () => {
    const b = getApiStatusBadge(true, 'sk-ant-key');
    expect(b.className).toContain('badge-success');
    expect(b.className).not.toContain('badge-accent');
  });
});

/**
 * Testes DOM — funções que dependem de elementos HTML
 * Usa jest-environment-jsdom para simular o browser.
 *
 * @jest-environment jsdom
 */
'use strict';

// ── Helpers para montar o DOM mínimo necessário ───────────────
function criarElemento(id, tag = 'div') {
  const el = document.createElement(tag);
  el.id = id;
  document.body.appendChild(el);
  return el;
}

function limparDOM() {
  document.body.innerHTML = '';
}

// ── Replicação das funções DOM do index.html ──────────────────
// (mesma lógica; testada aqui isoladamente do contexto global)

function setAnthropicStatus(s, els) {
  const map = {
    ok:      ['operational', '✓ Anthropic API Key salva — IA ativa'],
    removed: ['pending',     'Key removida. Calcule rotas com o Google Maps.'],
  };
  const [cls, msg] = map[s] || map.removed;
  els.card.style.display = 'block';
  els.dot.className = 'status-dot ' + cls;
  els.txt.textContent = msg;
}

function setMapStatus(s, els) {
  const map = {
    testing: ['degraded',    'Carregando SDK do Google Maps...'],
    ok:      ['operational', '✓ Google Maps conectado com sucesso'],
    error:   ['down',        '✕ Falha. Verifique key e APIs ativadas no GCP.'],
    idle:    ['pending',     'Key salva — clique em "Conectar e testar"'],
    removed: ['pending',     'Key removida. Usando Claude IA como fallback.'],
  };
  const [cls, msg] = map[s] || map.idle;
  els.card.style.display = 'block';
  els.dot.className = 'status-dot ' + cls;
  els.txt.textContent = msg;
  if (s === 'error' && els.checklist) {
    els.checklist.style.display = 'block';
  }
}

function toggleKeyVisibility(input, btn) {
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? 'mostrar' : 'ocultar';
}

// ─────────────────────────────────────────────────────────────
// setAnthropicStatus()
// ─────────────────────────────────────────────────────────────
describe('setAnthropicStatus() — indicador de status da Anthropic key', () => {
  let card, dot, txt, els;

  beforeEach(() => {
    limparDOM();
    card = criarElemento('anthropic-status-card');
    dot  = criarElemento('anthropic-status-dot');
    txt  = criarElemento('anthropic-status-text');
    els  = { card, dot, txt };
  });

  test('estado "ok" exibe mensagem de sucesso', () => {
    setAnthropicStatus('ok', els);
    expect(txt.textContent).toContain('IA ativa');
    expect(dot.className).toContain('operational');
    expect(card.style.display).toBe('block');
  });

  test('estado "removed" exibe mensagem de remoção', () => {
    setAnthropicStatus('removed', els);
    expect(txt.textContent).toContain('Key removida');
    expect(dot.className).toContain('pending');
  });

  test('estado desconhecido cai no fallback "removed"', () => {
    setAnthropicStatus('qualquer-coisa', els);
    expect(txt.textContent).toContain('Key removida');
    expect(dot.className).toContain('pending');
  });

  test('card fica visível após qualquer chamada', () => {
    card.style.display = 'none';
    setAnthropicStatus('ok', els);
    expect(card.style.display).toBe('block');
  });
});

// ─────────────────────────────────────────────────────────────
// setMapStatus()
// ─────────────────────────────────────────────────────────────
describe('setMapStatus() — indicador de status do Google Maps', () => {
  let card, dot, txt, checklist, els;

  beforeEach(() => {
    limparDOM();
    card      = criarElemento('maps-status-card');
    dot       = criarElemento('maps-status-dot');
    txt       = criarElemento('maps-status-text');
    checklist = criarElemento('maps-error-checklist');
    checklist.style.display = 'none';
    els = { card, dot, txt, checklist };
  });

  test('"testing" exibe mensagem de carregamento', () => {
    setMapStatus('testing', els);
    expect(txt.textContent).toContain('Carregando');
    expect(dot.className).toContain('degraded');
  });

  test('"ok" exibe mensagem de sucesso', () => {
    setMapStatus('ok', els);
    expect(txt.textContent).toContain('conectado com sucesso');
    expect(dot.className).toContain('operational');
  });

  test('"error" exibe mensagem de falha e mostra checklist', () => {
    setMapStatus('error', els);
    expect(txt.textContent).toContain('Falha');
    expect(dot.className).toContain('down');
    expect(checklist.style.display).toBe('block');
  });

  test('"idle" exibe mensagem de espera', () => {
    setMapStatus('idle', els);
    expect(txt.textContent).toContain('clique em');
    expect(dot.className).toContain('pending');
  });

  test('"removed" exibe mensagem de remoção', () => {
    setMapStatus('removed', els);
    expect(txt.textContent).toContain('removida');
    expect(dot.className).toContain('pending');
  });

  test('estado desconhecido cai no fallback "idle"', () => {
    setMapStatus('xyz', els);
    expect(dot.className).toContain('pending');
  });

  test('estados sem erro não mostram checklist', () => {
    setMapStatus('ok', els);
    expect(checklist.style.display).toBe('none');
  });
});

// ─────────────────────────────────────────────────────────────
// toggleKeyVisibility()
// ─────────────────────────────────────────────────────────────
describe('toggleKeyVisibility() — mostrar/ocultar chave de API', () => {
  let input, btn;

  beforeEach(() => {
    limparDOM();
    input = document.createElement('input');
    input.type = 'password';
    btn = document.createElement('button');
    btn.textContent = 'mostrar';
    document.body.appendChild(input);
    document.body.appendChild(btn);
  });

  test('de password para text ao primeiro clique', () => {
    toggleKeyVisibility(input, btn);
    expect(input.type).toBe('text');
    expect(btn.textContent).toBe('ocultar');
  });

  test('de text para password ao segundo clique', () => {
    toggleKeyVisibility(input, btn);
    toggleKeyVisibility(input, btn);
    expect(input.type).toBe('password');
    expect(btn.textContent).toBe('mostrar');
  });

  test('texto do botão reflete o estado atual do campo', () => {
    toggleKeyVisibility(input, btn);
    expect(btn.textContent).toBe('ocultar');
    toggleKeyVisibility(input, btn);
    expect(btn.textContent).toBe('mostrar');
  });
});

// ─────────────────────────────────────────────────────────────
// toast() — notificações
// ─────────────────────────────────────────────────────────────
describe('toast() — exibição de notificações', () => {
  function toast(msg, type = 'success') {
    const c = document.getElementById('toasts');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span><div>${msg}</div>`;
    c.appendChild(t);
    return t;   // retorna o elemento para testar
  }

  beforeEach(() => {
    limparDOM();
    criarElemento('toasts');
  });

  test('toast de sucesso tem classe "toast-success"', () => {
    const t = toast('Salvo!');
    expect(t.className).toContain('toast-success');
  });

  test('toast de erro tem classe "toast-error"', () => {
    const t = toast('Falhou', 'error');
    expect(t.className).toContain('toast-error');
  });

  test('mensagem é inserida no DOM', () => {
    toast('Trajeto salvo!');
    expect(document.getElementById('toasts').textContent).toContain('Trajeto salvo!');
  });

  test('múltiplos toasts são empilhados', () => {
    toast('A');
    toast('B');
    toast('C');
    expect(document.getElementById('toasts').children.length).toBe(3);
  });

  test('ícone de sucesso é ✓', () => {
    const t = toast('ok');
    expect(t.querySelector('span').textContent).toBe('✓');
  });

  test('ícone de erro é ✕', () => {
    const t = toast('falha', 'error');
    expect(t.querySelector('span').textContent).toBe('✕');
  });
});

// ─────────────────────────────────────────────────────────────
// guard calculandoRota — previne chamadas concorrentes
// ─────────────────────────────────────────────────────────────
describe('guard calculandoRota — concorrência em calcularTempo()', () => {
  function criarCalculadoraComGuard(handler) {
    let calculandoRota = false;
    return async function calcularTempo() {
      if (calculandoRota) return 'bloqueado';
      calculandoRota = true;
      try {
        return await handler();
      } finally {
        calculandoRota = false;
      }
    };
  }

  test('segunda chamada simultânea é bloqueada', async () => {
    let resolvePrimeira;
    const primeiraPromise = new Promise(r => { resolvePrimeira = r; });
    const calcular = criarCalculadoraComGuard(() => primeiraPromise);
    const p1 = calcular();
    const p2 = calcular();
    expect(await p2).toBe('bloqueado');
    resolvePrimeira('ok');
    expect(await p1).toBe('ok');
  });

  test('após a primeira concluir, nova chamada é permitida', async () => {
    const calcular = criarCalculadoraComGuard(() => Promise.resolve('feito'));
    await calcular();
    expect(await calcular()).toBe('feito');
  });

  test('guard é liberado mesmo se a chamada lança erro', async () => {
    const calcular = criarCalculadoraComGuard(() => Promise.reject(new Error('falha')));
    await calcular().catch(() => {});
    expect(await calcular().catch(() => 'ok-depois-de-erro')).toBe('ok-depois-de-erro');
  });
});

// ─────────────────────────────────────────────────────────────
// parâmetro manual em calcularTempo() — toasts condicionais
// ─────────────────────────────────────────────────────────────
describe('calcularTempo(manual) — toasts só em chamada explícita', () => {
  // Simula a lógica de validação sem DOM completo
  function criarValidador({ gmReady, anthropicKey }) {
    const toasts = [];
    function toast(msg) { toasts.push(msg); }

    function calcularTempo(manual = false) {
      if (!gmReady && !anthropicKey) {
        if (manual) toast('Configure Google Maps ou Anthropic IA nas configurações');
        return 'sem-api';
      }
      return 'executou';
    }

    return { calcularTempo, toasts };
  }

  test('auto-trigger sem API: nenhum toast é exibido', () => {
    const { calcularTempo, toasts } = criarValidador({ gmReady: false, anthropicKey: '' });
    calcularTempo();          // auto-trigger (manual = false)
    expect(toasts).toHaveLength(0);
  });

  test('clique manual sem API: toast de orientação é exibido', () => {
    const { calcularTempo, toasts } = criarValidador({ gmReady: false, anthropicKey: '' });
    calcularTempo(true);      // manual
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toContain('Configure');
  });

  test('com API configurada: executa normalmente em ambos os modos', () => {
    const { calcularTempo, toasts } = criarValidador({ gmReady: false, anthropicKey: 'sk-ant-key' });
    expect(calcularTempo()).toBe('executou');
    expect(calcularTempo(true)).toBe('executou');
    expect(toasts).toHaveLength(0);
  });

  test('auto-triggers consecutivos sem API não acumulam toasts', () => {
    const { calcularTempo, toasts } = criarValidador({ gmReady: false, anthropicKey: '' });
    calcularTempo();
    calcularTempo();
    calcularTempo();
    expect(toasts).toHaveLength(0);
  });
});

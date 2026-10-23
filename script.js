(function () {
var $ = function (i) { return document.getElementById(i); }, TK = 'vp_token';
var me = null, prods = [], filter = 'all', editId = null, pendImg = '', gtin = '';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3000); }

/* ---------- API ---------- */
function api(m, u, b) {
  var h = { 'Content-Type': 'application/json' }, t = localStorage.getItem(TK);
  if (t) h.Authorization = 'Bearer ' + t;
  return fetch(u, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (r.status === 401 && t) logout();
      if (r.status === 402) paywall();
      if (!r.ok) throw new Error(d.error || 'Erro de conexão.');
      return d;
    });
  });
}

/* ---------- login / cadastro ---------- */
function tab(l) { $('fL').classList.toggle('hide', !l); $('fR').classList.toggle('hide', l); $('tL').classList.toggle('on', l); $('tR').classList.toggle('on', !l); }
$('tL').onclick = function () { tab(true); }; $('tR').onclick = function () { tab(false); };
function enter(d) { localStorage.setItem(TK, d.token); boot(); }
$('bR').onclick = function () {
  var er = $('eR'), p = $('rp').value;
  if (p !== $('rp2').value) { er.textContent = 'As senhas não são iguais.'; return; }
  api('POST', '/api/register', { name: $('rn').value, store: $('rc').value, email: $('re').value, password: p })
    .then(enter).catch(function (e) { er.textContent = e.message; });
};
$('bL').onclick = function () {
  api('POST', '/api/login', { email: $('le').value, password: $('lp').value })
    .then(enter).catch(function (e) { $('eL').textContent = e.message; });
};
$('lp').onkeydown = function (ev) { if (ev.key === 'Enter') $('bL').click(); };
function logout() { localStorage.removeItem(TK); me = null; $('app').classList.add('hide'); $('auth').classList.remove('hide'); $('lp').value = ''; }
$('bOut').onclick = logout;

function boot() {
  if (!localStorage.getItem(TK)) { $('auth').classList.remove('hide'); return; }
  api('GET', '/api/me').then(function (u) {
    me = u; $('auth').classList.add('hide'); $('app').classList.remove('hide'); head(); return load();
  }).catch(function () { $('auth').classList.remove('hide'); });
}
function load() { return api('GET', '/api/products').then(function (p) { prods = p; render(); }).catch(function () { prods = []; render(); }); }

function head() {
  $('hStore').textContent = me.store; $('hUser').textContent = me.name;
  $('hLogo').innerHTML = me.logo ? '<img alt="" src="' + me.logo + '">' : esc(me.store.charAt(0).toUpperCase());
  $('bAdm').classList.toggle('hide', me.role !== 'admin');
  var a = me.access, b = $('banner');
  if (me.role === 'admin' || (a.status === 'active' && a.days > 7)) { b.classList.add('hide'); return; }
  b.classList.remove('hide');
  b.innerHTML = '<span>' + (a.status === 'trial' ? 'Teste grátis: ' + a.days + ' dias restantes.' : a.status === 'active' ? 'Sua assinatura vence em ' + a.days + ' dias.' : 'Acesso encerrado.') + '</span><button class="btn sm" id="bSub" type="button">Assinar</button>';
  $('bSub').onclick = subscribe;
}

/* ---------- assinatura ---------- */
function subscribe() { api('POST', '/api/billing/checkout', { plan: 'mensal' }).then(function (d) { location.href = d.url; }).catch(function (e) { toast(e.message); }); }
function paywall() {
  if ($('pw')) return;
  modal('<div id="pw"><h2>Acesso encerrado</h2><p class="sub">Assine para continuar. Seus produtos continuam guardados.</p><div class="mact"><button class="btn ghost" id="mo" type="button">Sair</button><button class="btn" id="mb" type="button">Assinar</button></div></div>');
  $('mb').onclick = subscribe; $('mo').onclick = function () { shut(); logout(); };
}

/* ---------- lista ---------- */
function parseD(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
function days(s) { var t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate()); return Math.round((parseD(s) - t) / 864e5); }
function status(d) { return d < 0 ? 'red' : d <= 7 ? 'org' : d <= 30 ? 'yel' : 'grn'; }
function label(d) { if (d < 0) return 'Vencido há ' + (-d) + (d === -1 ? ' dia' : ' dias'); if (d === 0) return 'Vence hoje'; if (d === 1) return 'Vence amanhã'; return 'Vence em ' + d + ' dias'; }
function fmt(s) { if (!s) return '—'; var a = s.split('-'); return a[2] + '/' + a[1] + '/' + a[0]; }

function render() {
  var q = $('q').value.trim().toLowerCase(), c = { red: 0, org: 0, yel: 0, grn: 0 };
  prods.forEach(function (p) { c[status(days(p.exp))]++; });
  var defs = [['all', 'Todos', prods.length, 's-grn'], ['red', 'Vencidos', c.red, 's-red'], ['org', 'Até 7 dias', c.org, 's-org'], ['yel', 'Até 30 dias', c.yel, 's-yel']];
  $('stats').innerHTML = defs.map(function (d) {
    return '<button type="button" class="st ' + (d[0] === 'all' ? '' : d[3]) + (filter === d[0] ? ' on' : '') + '" style="' + (d[0] === 'all' ? 'background:var(--card);border-color:' + (filter === 'all' ? 'var(--ink)' : 'var(--line)') : '') + '" data-f="' + d[0] + '"><b>' + d[2] + '</b><span>' + d[1] + '</span></button>';
  }).join('');
  Array.prototype.forEach.call($('stats').children, function (b) { b.onclick = function () { filter = b.getAttribute('data-f'); render(); }; });
  var arr = prods.filter(function (p) {
    if (filter !== 'all' && status(days(p.exp)) !== filter) return false;
    return !q || [p.name, p.flavor, p.lot, p.dist].join(' ').toLowerCase().indexOf(q) > -1;
  }).sort(function (a, b) { return days(a.exp) - days(b.exp); });
  if (!arr.length) { $('list').innerHTML = '<div class="empty">' + (prods.length ? 'Nenhum produto encontrado com esse filtro.' : 'Nenhum produto ainda.<br>Toque em <b>Cadastrar produto</b> para começar.') + '</div>'; return; }
  $('list').innerHTML = arr.map(function (p) {
    var d = days(p.exp), s = status(d);
    return '<div class="p"><div class="img">' + (p.img ? '<img alt="" src="' + p.img + '">' : '📦') + '</div><div><h3>' + esc(p.name) + (p.flavor ? ' · ' + esc(p.flavor) : '') + '</h3><div class="meta">Validade ' + fmt(p.exp) + ' · Lote ' + esc(p.lot || '—') + ' · ' + esc(p.qty) + ' un.</div><div class="meta">Compra ' + fmt(p.buy) + (p.dist ? ' · ' + esc(p.dist) : '') + '</div><span class="tag s-' + s + '">' + label(d) + '</span></div><div class="acts"><button class="btn ghost sm" data-e="' + p.id + '" type="button">Editar</button><button class="btn danger sm" data-x="' + p.id + '" type="button">Dar baixa</button></div></div>';
  }).join('');
  Array.prototype.forEach.call(document.querySelectorAll('[data-e]'), function (b) { b.onclick = function () { prodForm(b.getAttribute('data-e')); }; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-x]'), function (b) {
    b.onclick = function () {
      if (!confirm('Dar baixa neste produto? Ele sai da lista.')) return;
      api('DELETE', '/api/products/' + b.getAttribute('data-x')).then(function () { toast('Produto removido'); return load(); }).catch(function (e) { toast(e.message); });
    };
  });
}
$('q').oninput = render;

/* ---------- modal / imagem ---------- */
function shut() { $('modalHost').innerHTML = ''; }
function modal(html, wide) { $('modalHost').innerHTML = '<div class="ov"><div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>'; }
function shrink(file, max, cb) {
  var r = new FileReader(); r.onload = function () {
    var im = new Image(); im.onload = function () {
      var k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); cb(cv.toDataURL('image/jpeg', .72));
    }; im.src = r.result;
  }; r.readAsDataURL(file);
}

/* ---------- cadastro de produto ---------- */
function prodForm(id) {
  editId = id || null;
  var p = id ? prods.filter(function (x) { return String(x.id) === id; })[0] : {};
  pendImg = p.img || ''; gtin = p.gtin || '';
  var hoje = new Date().toISOString().slice(0, 10);
  modal('<h2>' + (id ? 'Editar produto' : 'Cadastrar produto') + '</h2>' +
    '<div class="tools"><button class="btn sm" id="bScan" type="button">📷 Escanear código</button><label class="btn ghost sm">🔎 Ler lote pela foto<input id="po" type="file" accept="image/*" capture="environment"></label></div>' +
    '<div class="pick"><div class="logo" id="pv" style="background:var(--bg);color:var(--mut);font-size:28px">' + (pendImg ? '<img alt="" src="' + pendImg + '">' : '📷') + '</div><label class="btn ghost sm" style="margin:0">Foto do produto<input id="pf" type="file" accept="image/*"></label></div>' +
    '<label for="pn">Nome do produto</label><input id="pn" placeholder="Ex.: Biscoito recheado" value="' + esc(p.name) + '">' +
    '<label for="pa">Sabor</label><input id="pa" placeholder="Ex.: Chocolate" value="' + esc(p.flavor) + '">' +
    '<div class="row"><div><label for="px">Validade</label><input id="px" type="date" value="' + esc(p.exp) + '"></div><div><label for="pq">Quantidade</label><input id="pq" type="number" min="1" inputmode="numeric" value="' + esc(p.qty || '') + '"></div></div>' +
    '<div class="row"><div><label for="pl">Lote</label><input id="pl" value="' + esc(p.lot) + '"></div><div><label for="pb">Data da compra</label><input id="pb" type="date" value="' + esc(p.buy || hoje) + '"></div></div>' +
    '<label for="pd">Distribuidor</label><input id="pd" value="' + esc(p.dist) + '">' +
    '<div class="err" id="ep"></div><div class="mact"><button class="btn ghost" id="mc" type="button">Cancelar</button><button class="btn" id="ms" type="button">Salvar</button></div>');
  $('pf').onchange = function () { var f = this.files[0]; if (!f) return; shrink(f, 220, function (d) { pendImg = d; $('pv').innerHTML = '<img alt="" src="' + d + '">'; }); };
  $('bScan').onclick = scan;
  $('po').onchange = function () { if (this.files[0]) ocr(this.files[0]); };
  $('mc').onclick = shut;
  $('ms').onclick = function () {
    var o = { name: $('pn').value, flavor: $('pa').value, exp: $('px').value, qty: $('pq').value, lot: $('pl').value, buy: $('pb').value, dist: $('pd').value, img: pendImg, gtin: gtin };
    api(editId ? 'PUT' : 'POST', '/api/products' + (editId ? '/' + editId : ''), o)
      .then(function () { shut(); toast('Produto salvo'); return load(); })
      .catch(function (e) { $('ep').textContent = e.message; });
  };
}
$('bAdd').onclick = function () { prodForm(); };

/* ---------- leitor de código de barras ---------- */
// Lê códigos GS1 (com lote e validade): (01)GTIN(10)LOTE(17)AAMMDD  — também aceita o formato sem parênteses
function gs1(t) {
  var o = {}, i = 0, x = t.replace(/^\](d2|C1|Q3)/, '');
  if (x.charAt(0) === '(') { var m, re = /\((\d+)\)([^(]*)/g; while ((m = re.exec(x))) o[m[1]] = m[2]; return o; }
  if (x.slice(0, 2) !== '01' || x.length < 16) return null;
  while (i < x.length) {
    var ai = x.substr(i, 2), L = { '01': 14, '11': 6, '15': 6, '17': 6 }[ai]; i += 2;
    if (L) { o[ai] = x.substr(i, L); i += L; }
    else if (ai === '10' || ai === '21') { var e = x.indexOf('\x1d', i); if (e < 0) e = x.length; o[ai] = x.substring(i, e); i = e + 1; }
    else break;
  }
  return o;
}
function ymd(s) { var y = 2000 + (+s.slice(0, 2)), m = s.slice(2, 4), d = s.slice(4, 6); if (d === '00') d = String(new Date(y, +m, 0).getDate()); return y + '-' + m + '-' + d; }

function onCode(t) {
  var g = gs1(t), code = g ? g['01'] : t.replace(/\D/g, ''), got = [];
  if (g && g['10']) { $('pl').value = g['10']; got.push('lote'); }
  if (g && g['17']) { $('px').value = ymd(g['17']); got.push('validade'); }
  gtin = code || '';
  toast(got.length ? 'Li ' + got.join(' e ') + ' do código.' : 'Código lido. Código de barras comum não traz lote nem validade.');
  if (gtin && !$('pn').value) api('GET', '/api/lookup/' + gtin).then(function (r) {
    if (r.name) { $('pn').value = r.name; $('pa').value = r.flavor || ''; if (r.img && !pendImg) { pendImg = r.img; $('pv').innerHTML = '<img alt="" src="' + r.img + '">'; } }
    else setTimeout(function () { toast('Produto novo: digite nome e sabor só desta vez.'); }, 3100);
  }).catch(function () { });
}

function scan() {
  var ov = document.createElement('div'); ov.className = 'ov'; ov.style.zIndex = 40;
  ov.innerHTML = '<div class="modal"><h2>Escanear código</h2><video id="vid" playsinline muted></video><p class="sub" id="sm">Aponte a câmera para o código de barras, QR ou DataMatrix.</p><div class="mact"><button class="btn ghost" id="sx" type="button">Fechar</button></div></div>';
  document.body.appendChild(ov);
  var stop = false, stream = null, reader = null, v = $('vid');
  function end() { stop = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); if (reader) { try { reader.reset(); } catch (e) { } } ov.remove(); }
  function done(txt) { end(); onCode(txt); }
  $('sx').onclick = end;
  function fail() { $('sm').textContent = 'Não consegui abrir a câmera. Permita o acesso (o site precisa estar em HTTPS).'; }
  if ('BarcodeDetector' in window) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
      stream = s; v.srcObject = s; v.play();
      var det = new BarcodeDetector();
      (function loop() { if (stop) return; det.detect(v).then(function (r) { if (r.length) done(r[0].rawValue); else setTimeout(loop, 200); }).catch(function () { setTimeout(loop, 300); }); })();
    }).catch(fail);
  } else { // iPhone/Safari e navegadores sem BarcodeDetector
    var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
    s.onload = function () { reader = new ZXing.BrowserMultiFormatReader(); reader.decodeFromVideoDevice(undefined, 'vid', function (r) { if (r && !stop) done(r.getText()); }).catch(fail); };
    s.onerror = fail; document.head.appendChild(s);
  }
}

/* ---------- ler lote e validade impressos (OCR, melhor esforço) ---------- */
function ocr(file) {
  toast('Lendo o texto da embalagem...');
  function run() {
    Tesseract.recognize(file, 'por').then(function (r) {
      var t = r.data.text, m = t.match(/\bLOTE\s*[:.\-]?\s*([A-Z0-9]{3,12})|\bL\s*[:.\-]\s*([A-Z0-9]{3,12})/i), best = '', re = /(\d{2})[\/.\-](\d{2})[\/.\-](\d{2,4})/g, d;
      if (m) $('pl').value = (m[1] || m[2]).toUpperCase();
      while ((d = re.exec(t))) { var iso = (d[3].length === 2 ? '20' + d[3] : d[3]) + '-' + d[2] + '-' + d[1]; if (iso > best) best = iso; } // pega a data mais distante (validade)
      if (best) $('px').value = best;
      toast(m || best ? 'Confira lote e validade nos campos.' : 'Não achei lote nem validade. Tente outra foto, bem de perto.');
    }).catch(function () { toast('Não consegui ler a foto.'); });
  }
  if (window.Tesseract) run();
  else { var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = run; document.head.appendChild(s); }
}

/* ---------- perfil ---------- */
$('bProf').onclick = function () {
  pendImg = me.logo || '';
  modal('<h2>Perfil</h2><div class="pick"><div class="logo" id="pv">' + (pendImg ? '<img alt="" src="' + pendImg + '">' : esc(me.store.charAt(0).toUpperCase())) + '</div><label class="btn ghost sm" style="margin:0">Logo ou foto<input id="pf" type="file" accept="image/*"></label></div>' +
    '<label for="un">Seu nome</label><input id="un" value="' + esc(me.name) + '">' +
    '<label for="us">Nome da loja ou comércio</label><input id="us" value="' + esc(me.store) + '">' +
    '<label for="uc">CNPJ (opcional)</label><input id="uc" inputmode="numeric" placeholder="00.000.000/0000-00" value="' + esc(me.cnpj) + '">' +
    '<label>E-mail de acesso</label><input value="' + esc(me.email) + '" disabled>' +
    '<div class="err" id="ep"></div><div class="mact"><button class="btn ghost" id="mc" type="button">Cancelar</button><button class="btn" id="ms" type="button">Salvar</button></div>');
  $('pf').onchange = function () { var f = this.files[0]; if (!f) return; shrink(f, 160, function (d) { pendImg = d; $('pv').innerHTML = '<img alt="" src="' + d + '">'; }); };
  $('mc').onclick = shut;
  $('ms').onclick = function () {
    api('PUT', '/api/me', { name: $('un').value, store: $('us').value, cnpj: $('uc').value, logo: pendImg })
      .then(function (u) { me = u; shut(); head(); toast('Perfil atualizado'); }).catch(function (e) { $('ep').textContent = e.message; });
  };
};

/* ---------- painel admin ---------- */
function admin() {
  api('GET', '/api/admin/users').then(function (us) {
    modal('<h2>Painel admin</h2><p class="sub">' + us.length + ' contas</p><div class="tw"><table><tr><th>Loja</th><th>E-mail</th><th>Acesso</th><th>Itens</th><th></th></tr>' +
      us.map(function (u) {
        return '<tr><td>' + esc(u.store) + '</td><td>' + esc(u.email) + '</td><td>' + (u.blocked ? 'bloqueado' : u.access.status + (u.access.days != null ? ' (' + u.access.days + 'd)' : '')) + '</td><td>' + u.n + '</td><td>' +
          (u.role === 'admin' ? '' : '<button class="btn sm" data-g="' + u.id + '" type="button">+30 dias</button> <button class="btn danger sm" data-k="' + u.id + '" data-v="' + (u.blocked ? 0 : 1) + '" type="button">' + (u.blocked ? 'Liberar' : 'Bloquear') + '</button>') + '</td></tr>';
      }).join('') + '</table></div><div class="mact"><button class="btn ghost" id="ap" type="button">Ver produtos de todas as lojas</button><button class="btn" id="mc" type="button">Fechar</button></div><div class="tw" id="apl"></div>', true);
    $('mc').onclick = shut;
    Array.prototype.forEach.call(document.querySelectorAll('[data-g]'), function (b) { b.onclick = function () { api('POST', '/api/admin/users/' + b.getAttribute('data-g') + '/grant', { days: 30 }).then(admin); }; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (b) { b.onclick = function () { api('POST', '/api/admin/users/' + b.getAttribute('data-k') + '/block', { blocked: b.getAttribute('data-v') === '1' }).then(admin); }; });
    $('ap').onclick = function () {
      api('GET', '/api/admin/products').then(function (ps) {
        $('apl').innerHTML = '<table><tr><th>Loja</th><th>Produto</th><th>Validade</th><th>Qtd</th><th>Lote</th></tr>' + ps.map(function (p) {
          return '<tr><td>' + esc(p.store) + '</td><td>' + esc(p.name) + (p.flavor ? ' · ' + esc(p.flavor) : '') + '</td><td>' + fmt(p.exp) + '</td><td>' + p.qty + '</td><td>' + esc(p.lot) + '</td></tr>';
        }).join('') + '</table>';
      });
    };
  }).catch(function (e) { toast(e.message); });
}
$('bAdm').onclick = admin;

boot();
})();

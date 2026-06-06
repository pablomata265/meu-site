/* ============================================================
   script.js — formulário de agendamento + Google Calendar
   ============================================================

   ESTRUTURA:
   1. Configuração
   2. Estado global
   3. Constantes (meses, dias, slots)
   4. Navegação entre páginas
   5. Etapa 1 — dados pessoais + validação
   6. Etapa 2 — calendário
   7. Etapa 3 — horários (busca horários ocupados na API)
   8. Etapa 4 — confirmação
   9. Etapa 5 — finalizar (salva no Google Calendar)
   10. Reset do formulário
   11. Inicialização
   ============================================================ */


/* ── 1. Configuração ── */

// ⚠️  Troque pela URL do seu backend depois de fazer o deploy
var API_URL = 'https://meu-site-production-86c0.up.railway.app';

// Duração de cada atendimento em minutos
var DURACAO_MIN = 60;


/* ── 2. Estado global ── */
var state = { nome: '', sobrenome: '', tel: '', data: null, hora: '' };
var calYear, calMonth;
var selectedDay  = null;
var selectedSlot = null;
var now = new Date();
calYear  = now.getFullYear();
calMonth = now.getMonth();


/* ── 3. Constantes ── */
var MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];
var DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Todos os horários que o prestador oferece
var ALL_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30'
];

// Horários ocupados — preenchido dinamicamente pela API
var UNAVAIL = [];


/* ── 4. Navegação entre páginas ── */
function goPage(to, from) {
  document.getElementById('p' + from).classList.remove('active');
  var next = document.getElementById('p' + to);
  next.classList.add('active');
  next.style.animation = 'none';
  next.offsetHeight; // força reflow para re-acionar animação
  next.style.animation = '';
  updateProgress(to);
}

function updateProgress(step) {
  for (var i = 1; i <= 4; i++) {
    var dot = document.getElementById('dot' + i);
    var lbl = document.getElementById('lbl' + i);
    if (i < step) {
      dot.className = 'p-dot done';
      dot.innerHTML = '<svg class="check-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (i === step) {
      dot.className = 'p-dot active';
      dot.innerHTML = i;
    } else {
      dot.className = 'p-dot idle';
      dot.innerHTML = i;
    }
    lbl.className = 'p-label' + (i < step ? ' done' : i === step ? ' active' : '');
  }
  for (var j = 1; j <= 3; j++) {
    document.getElementById('line' + j).className = 'p-line' + (j < step ? ' done' : '');
  }
}


/* ── 5. Etapa 1 — dados pessoais + validação ── */
function goStep2() {
  var nome     = document.getElementById('nome').value.trim();
  var sobre    = document.getElementById('sobrenome').value.trim();
  var tel      = document.getElementById('tel').value.trim();
  var telClean = tel.replace(/\D/g, '');
  var telOk    = telClean.length >= 10 && telClean.length <= 11;

  document.getElementById('f-nome').classList.toggle('has-err', !nome);
  document.getElementById('f-sobrenome').classList.toggle('has-err', !sobre);
  document.getElementById('f-tel').classList.toggle('has-err', !telOk);

  if (!nome || !sobre || !telOk) return;

  state.nome      = nome;
  state.sobrenome = sobre;
  state.tel       = tel;

  goPage(2, 1);
  renderCal();
}

// Máscara de telefone brasileiro
document.getElementById('tel').addEventListener('input', function (e) {
  var v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  } else {
    v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  }
  e.target.value = v;
});

// Limpa erro ao digitar
['nome', 'sobrenome', 'tel'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', function () {
    document.getElementById('f-' + id).classList.remove('has-err');
  });
});


/* ── 6. Etapa 2 — calendário ── */
function changeMonth(d) {
  calMonth += d;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCal();
}

function renderCal() {
  document.getElementById('cal-title').textContent = MONTHS[calMonth] + ' ' + calYear;
  var grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  DAYS.forEach(function (d) {
    var el = document.createElement('div');
    el.className   = 'cal-dname';
    el.textContent = d;
    grid.appendChild(el);
  });

  var firstDay  = new Date(calYear, calMonth, 1).getDay();
  var totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  var todayFlat = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (var i = 0; i < firstDay; i++) {
    var el = document.createElement('div');
    el.className = 'cal-day empty';
    grid.appendChild(el);
  }

  for (var d = 1; d <= totalDays; d++) {
    var el       = document.createElement('div');
    var thisDate = new Date(calYear, calMonth, d);
    var isPast   = thisDate < todayFlat;
    var isToday  = thisDate.getTime() === todayFlat.getTime();
    var classes  = 'cal-day';

    if (isPast)  classes += ' past';
    if (isToday) classes += ' today';
    if (selectedDay && selectedDay.getTime() === thisDate.getTime()) classes += ' selected';

    el.className   = classes;
    el.textContent = d;

    if (!isPast) {
      (function (date, elem) {
        elem.addEventListener('click', function () { selectDay(date, elem); });
      })(thisDate, el);
    }
    grid.appendChild(el);
  }
}

function selectDay(date, el) {
  selectedDay = date;
  document.querySelectorAll('.cal-day').forEach(function (e) {
    e.classList.remove('selected');
  });
  el.classList.add('selected');
}

function goStep3() {
  if (!selectedDay) { alert('Por favor, selecione uma data.'); return; }

  state.data = selectedDay;
  var label  = selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('slot-date-label').textContent =
    label.charAt(0).toUpperCase() + label.slice(1);

  // Mostra os slots com loading enquanto busca na API
  buscarSlots(selectedDay);
  goPage(3, 2);
}


/* ── 7. Etapa 3 — horários (busca ocupados no Google Calendar) ── */

// Formata Date para "YYYY-MM-DD" sem conversão de fuso
function formatarData(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function buscarSlots(date) {
  var grid = document.getElementById('slot-grid');
  grid.innerHTML = '<p style="font-size:13px;color:var(--text-3);padding:12px 0">Carregando horários...</p>';

  var dataStr = formatarData(date);

  fetch(API_URL + '/api/slots?data=' + dataStr)
    .then(function (r) {
      if (!r.ok) throw new Error('Erro ao buscar horários');
      return r.json();
    })
    .then(function (data) {
      UNAVAIL = data.ocupados || [];
      renderSlots();
    })
    .catch(function (err) {
      console.error(err);
      // Se a API falhar, mostra todos os slots disponíveis como fallback
      UNAVAIL = [];
      renderSlots();
      grid.insertAdjacentHTML('afterbegin',
        '<p style="font-size:12px;color:var(--danger);margin-bottom:8px">⚠️ Não foi possível verificar disponibilidade em tempo real.</p>'
      );
    });
}

function renderSlots() {
  var grid = document.getElementById('slot-grid');
  grid.innerHTML = '';
  selectedSlot   = null;

  ALL_SLOTS.forEach(function (s) {
    var el   = document.createElement('div');
    var isUn = UNAVAIL.indexOf(s) !== -1;
    el.className   = 'slot' + (isUn ? ' unavail' : '');
    el.textContent = s;
    if (!isUn) {
      el.addEventListener('click', function () { selectSlot(s, el); });
    }
    grid.appendChild(el);
  });
}

function selectSlot(s, el) {
  selectedSlot = s;
  document.querySelectorAll('.slot').forEach(function (e) {
    e.classList.remove('selected');
  });
  el.classList.add('selected');
}

function goStep4() {
  if (!selectedSlot) { alert('Por favor, selecione um horário.'); return; }

  state.hora = selectedSlot;

  document.getElementById('s-nome').textContent = state.nome + ' ' + state.sobrenome;
  document.getElementById('s-tel').textContent  = state.tel;
  document.getElementById('s-data').textContent =
    state.data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('s-hora').textContent = state.hora + 'h';

  goPage(4, 3);
}


/* ── 8. Etapa 5 — finalizar (salva evento no Google Calendar) ── */
function finalizar() {
  var btnConfirmar = document.querySelector('#p4 .btn-primary');
  btnConfirmar.disabled    = true;
  btnConfirmar.textContent = 'Salvando...';

  fetch(API_URL + '/api/agendamentos', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome:     state.nome + ' ' + state.sobrenome,
      telefone: state.tel,
      data:     formatarData(state.data),   // "YYYY-MM-DD"
      horario:  state.hora                  // "HH:MM"
    })
  })
  .then(function (r) {
    if (!r.ok) throw new Error('Erro ao salvar agendamento');
    return r.json();
  })
  .then(function () {
    mostrarSucesso();
  })
  .catch(function (err) {
    console.error(err);
    btnConfirmar.disabled    = false;
    btnConfirmar.textContent = 'Confirmar agendamento';
    alert('Ocorreu um erro ao salvar. Tente novamente.');
  });
}

function mostrarSucesso() {
  var dataStr = state.data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  document.getElementById('success-detail').innerHTML =
    '<strong>' + state.nome + ' ' + state.sobrenome + '</strong><br>' +
    dataStr.charAt(0).toUpperCase() + dataStr.slice(1) + ' às ' + state.hora + 'h<br>' +
    'Confirmação enviada para ' + state.tel;

  for (var i = 1; i <= 4; i++) {
    var dot = document.getElementById('dot' + i);
    dot.className = 'p-dot done';
    dot.innerHTML = '<svg class="check-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    document.getElementById('lbl' + i).className = 'p-label done';
  }
  for (var j = 1; j <= 3; j++) {
    document.getElementById('line' + j).className = 'p-line done';
  }

  goPage(5, 4);
}


/* ── 9. Reset do formulário ── */
function resetForm() {
  state        = { nome: '', sobrenome: '', tel: '', data: null, hora: '' };
  selectedDay  = null;
  selectedSlot = null;
  UNAVAIL      = [];

  ['nome', 'sobrenome', 'tel'].forEach(function (id) {
    document.getElementById(id).value = '';
    document.getElementById('f-' + id).classList.remove('has-err');
  });

  calYear  = now.getFullYear();
  calMonth = now.getMonth();

  document.getElementById('p5').classList.remove('active');
  document.getElementById('p1').classList.add('active');
  updateProgress(1);
}


/* ── 10. Inicialização ── */
updateProgress(1);

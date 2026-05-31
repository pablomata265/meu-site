/* ============================================================
   server.js — backend Node.js + Google Calendar API
   ============================================================

   SETUP (rode uma vez antes de tudo):

     npm install express googleapis cors dotenv

   VARIÁVEIS DE AMBIENTE (.env):
     CLIENT_ID       → do Google Cloud Console
     CLIENT_SECRET   → do Google Cloud Console
     REDIRECT_URI    → http://localhost (só para gerar token)
     REFRESH_TOKEN   → gerado pelo script gerar-token.js
     PORT            → 3000 (opcional)

   RODAR LOCALMENTE:
     node server.js

   FAZER DEPLOY (Railway ou Render):
     1. Suba o projeto no GitHub
     2. Conecte ao Railway/Render
     3. Configure as variáveis de ambiente no painel deles
     4. Deploy automático
   ============================================================ */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const { google } = require('googleapis');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──
app.use(cors());          // permite chamadas do seu site HTML
app.use(express.json());  // lê o body em JSON

// ── Autenticação Google ──
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.REFRESH_TOKEN
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// ── Fuso horário do prestador ──
const TIMEZONE = 'America/Sao_Paulo';

// ── Duração do atendimento em minutos ──
const DURACAO_MIN = 60;


/* ------------------------------------------------------------
   GET /api/slots?data=YYYY-MM-DD

   Retorna quais horários já estão ocupados naquele dia,
   consultando os eventos do Google Calendar do prestador.

   Resposta: { ocupados: ["09:00", "14:30", ...] }
   ------------------------------------------------------------ */
app.get('/api/slots', async (req, res) => {
  const { data } = req.query;

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Parâmetro "data" inválido. Use YYYY-MM-DD.' });
  }

  try {
    // Intervalo do dia inteiro no fuso brasileiro
    const inicio = new Date(data + 'T00:00:00-03:00');
    const fim    = new Date(data + 'T23:59:59-03:00');

    const resposta = await calendar.events.list({
      calendarId:   'primary',
      timeMin:      inicio.toISOString(),
      timeMax:      fim.toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
    });

    const eventos = resposta.data.items || [];

    // Extrai apenas o "HH:MM" de cada evento
    const ocupados = eventos
      .filter(e => e.start && e.start.dateTime)
      .map(e => {
        const d = new Date(e.start.dateTime);
        // Converte para horário de Brasília
        const brt = new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
        const hh  = String(brt.getHours()).padStart(2, '0');
        const mm  = String(brt.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      });

    res.json({ ocupados });

  } catch (err) {
    console.error('Erro ao buscar slots:', err.message);
    res.status(500).json({ erro: 'Não foi possível buscar os horários disponíveis.' });
  }
});


/* ------------------------------------------------------------
   POST /api/agendamentos

   Cria um novo evento no Google Calendar do prestador.

   Body esperado:
   {
     "nome":     "João Silva",
     "telefone": "(21) 99999-9999",
     "data":     "2025-07-10",
     "horario":  "14:00"
   }

   Resposta: { ok: true, eventoId: "..." }
   ------------------------------------------------------------ */
app.post('/api/agendamentos', async (req, res) => {
  const { nome, telefone, data, horario } = req.body;

  // Validação básica
  if (!nome || !telefone || !data || !horario) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, telefone, data, horario.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Campo "data" deve ser YYYY-MM-DD.' });
  }
  if (!/^\d{2}:\d{2}$/.test(horario)) {
    return res.status(400).json({ erro: 'Campo "horario" deve ser HH:MM.' });
  }

  try {
    const [hh, mm] = horario.split(':').map(Number);

    // Monta o início do evento no fuso de SP
    const inicioStr = `${data}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;

    // Calcula o fim somando a duração
    const inicioDate = new Date(inicioStr + '-03:00');
    const fimDate    = new Date(inicioDate.getTime() + DURACAO_MIN * 60 * 1000);

    const evento = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary:     `Agendamento — ${nome}`,
        description: `Cliente: ${nome}\nTelefone: ${telefone}`,
        start: {
          dateTime: inicioDate.toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: fimDate.toISOString(),
          timeZone: TIMEZONE,
        },
        // Lembrete 1h antes por e-mail e 30min antes por notificação
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email',  minutes: 60 },
            { method: 'popup',  minutes: 30 },
          ],
        },
      },
    });

    console.log(`✅ Agendamento criado: ${nome} em ${data} às ${horario}`);
    res.json({ ok: true, eventoId: evento.data.id });

  } catch (err) {
    console.error('Erro ao criar agendamento:', err.message);
    res.status(500).json({ erro: 'Não foi possível criar o agendamento.' });
  }
});


/* ------------------------------------------------------------
   Rota de health check — útil para verificar se o servidor
   está rodando no Railway/Render
   ------------------------------------------------------------ */
app.get('/', (req, res) => {
  res.json({ status: 'ok', mensagem: 'Servidor de agendamento rodando.' });
});


// ── Inicia o servidor ──
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});

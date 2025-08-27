const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('.'));

// Файл даних
const DATA_FILE = 'schedule.txt';
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, 'Дата;Квартира;Автор;Текст\n', 'utf8');
}

// Файл паролів
const PASS_FILE = 'passwords.txt';
if (!fs.existsSync(PASS_FILE)) {
  fs.writeFileSync(PASS_FILE, '10;10\n11;11\n12;12\n13;13\n', 'utf8');
}

// Файл логів
const LOG_FILE = 'activity.log';
if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '', 'utf8');
}

// Сесії для авторизації
const sessions = new Map();

// Функція для логування
function logActivity(req, action, extra='') {
  const ip = req.ip || req.connection.remoteAddress;
  const date = new Date().toISOString();
  const user = sessions.get(req.body.token) || 'Неавторизований';
  const line = `${date};${ip};${user};${action};${extra}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

// Логін через passwords.txt
app.post('/api/login', (req, res) => {
  const { apt, password } = req.body;

  const lines = fs.readFileSync(PASS_FILE,'utf8').trim().split('\n');

  const valid = lines.some(line => {
    const [a,p] = line.split(';').map(s => s.trim());
    return String(a) === String(apt) && String(p) === String(password);
  });

  if(valid){
    const token = Math.random().toString(36).substr(2,16);
    sessions.set(token, apt);
    logActivity(req, 'login', `Успішний вхід, квартира ${apt}`);
    res.json({ ok: true, token, apt });
  } else {
    logActivity(req, 'login', `Невдалий вхід, квартира ${apt}`);
    res.json({ ok: false });
  }
});

// Завантаження даних
app.get('/api/load', (req, res) => {
  const lines = fs.readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('Дата;'));

  const data = lines.map(line => {
    const [date, apt, author, text] = line.split(';');
    return { date: date || '', apt: apt || '', author: author || '', text: text || '' };
  });

  res.json(data);
});

// Додавання запису
app.post('/api/add', (req, res) => {
  const { token } = req.body;
  if (!sessions.has(token)) return res.json({ ok: false });

  const apt = sessions.get(token);
  const date = new Date().toISOString().slice(0, 10);
  const text = 'Прибрано';

  fs.appendFileSync(DATA_FILE, `${date};${apt};${apt};${text}\n`, 'utf8');
  logActivity(req, 'add', `Додано запис для квартири ${apt}`);
  res.json({ ok: true });
});

// Оновлення запису
app.post('/api/update', (req, res) => {
  const { token, index, text } = req.body;
  if (!sessions.has(token)) return res.json({ ok: false });

  const lines = fs.readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('Дата;'));

  if (!lines[index]) return res.json({ ok: false });

  const parts = lines[index].split(';');
  if (parts[2] !== sessions.get(token)) return res.json({ ok: false });

  parts[3] = text;
  lines[index] = parts.join(';');
  fs.writeFileSync(DATA_FILE, 'Дата;Квартира;Автор;Текст\n'+lines.join('\n')+'\n','utf8');

  logActivity(req, 'update', `Оновлено запис #${index} для квартири ${parts[1]}`);
  res.json({ ok: true });
});

// Видалення запису
app.post('/api/delete', (req, res) => {
  const { token, index } = req.body;
  if (!sessions.has(token)) return res.json({ ok: false });

  const lines = fs.readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('Дата;'));

  if (!lines[index]) return res.json({ ok: false });

  const parts = lines[index].split(';');
  if (parts[2] !== sessions.get(token)) return res.json({ ok: false });

  lines.splice(index, 1);
  fs.writeFileSync(DATA_FILE, 'Дата;Квартира;Автор;Текст\n'+lines.join('\n')+'\n','utf8');

  logActivity(req, 'delete', `Видалено запис #${index} для квартири ${parts[1]}`);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

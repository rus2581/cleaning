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

// Сесії для авторизації
const sessions = new Map();

// Логін через passwords.txt
app.post('/api/login', (req, res) => {
  const { apt, password } = req.body;

  const lines = fs.readFileSync(PASS_FILE, 'utf8')
                  .trim().split('\n');

  const valid = lines.some(line => {
    const [a,p] = line.split(';');
    return String(a) === String(apt) && String(p) === String(password);
  });

  if(valid){
    const token = Math.random().toString(36).substr(2,16);
    sessions.set(token, apt);
    res.json({ ok: true, token, apt });
  } else {
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

  fs.writeFileSync(DATA_FILE, 'Дата;Квартира;Автор;Текст\n' + lines.join('\n') + '\n','utf8');
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

  fs.writeFileSync(DATA_FILE, 'Дата;Квартира;Автор;Текст\n' + lines.join('\n') + '\n', 'utf8');
  res.json({ ok: true });
});

// Запуск сервера
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

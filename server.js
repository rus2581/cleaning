const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('.'));

// === Этап 6: создаем JSON из переменной окружения ===
fs.writeFileSync('service-account.json', process.env.GOOGLE_SERVICE_ACCOUNT);

// === Google Drive API setup ===
const KEYFILE = './service-account.json';
const FOLDER_ID = '1g5BkD-BjIOJvoqwcXFeqxbLnYXCJoZiS'; // вставь сюда ID папки на Google Drive

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILE,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

// === Сессии для авторизации ===
const sessions = new Map();

// === Функции работы с Google Drive ===
async function loadFile(filename) {
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${filename}'`,
    fields: 'files(id,name)'
  });
  if (!res.data.files.length) return '';
  const fileId = res.data.files[0].id;
  const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
  return file.data;
}

async function saveFile(filename, content) {
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${filename}'`,
    fields: 'files(id,name)'
  });
  if (!res.data.files.length) {
    await drive.files.create({
      requestBody: { name: filename, parents: [FOLDER_ID] },
      media: { mimeType: 'text/plain', body: content }
    });
  } else {
    const fileId = res.data.files[0].id;
    await drive.files.update({ fileId, media: { mimeType: 'text/plain', body: content } });
  }
}

async function appendFile(filename, content) {
  const existing = await loadFile(filename);
  await saveFile(filename, existing + content);
}

// === Файл с паролями квартир ===
const PASS_FILE = 'passwords.txt';
if (!fs.existsSync(PASS_FILE)) {
  fs.writeFileSync(PASS_FILE, '10;10\n11;11\n12;12\n13;13\n', 'utf8');
}

// === Логирование действий ===
async function logActivity(user, action, extra='') {
  const date = new Date().toISOString();
  const line = `${date};${user};${action};${extra}\n`;
  await appendFile('activity.log', line);
}

// === API ===

// Логин
app.post('/api/login', async (req, res) => {
  const { apt, password } = req.body;
  const lines = fs.readFileSync(PASS_FILE, 'utf8').trim().split('\n');
  const valid = lines.some(line => line.split(';').map(s=>s.trim()).join('') === apt + password);

  if(valid){
    const token = Math.random().toString(36).substr(2,16);
    sessions.set(token, apt);
    await logActivity(apt, 'login', 'успешный вход');
    res.json({ ok: true, token, apt });
  } else {
    await logActivity(apt, 'login', 'неудачный вход');
    res.json({ ok: false });
  }
});

// Загрузка данных таблицы
app.get('/api/load', async (req, res) => {
  const dataRaw = await loadFile('schedule.txt');
  const lines = dataRaw.split('\n').filter(l=>l.trim() && !l.startsWith('Дата;'));
  const data = lines.map(line => {
    const [date, apt, author, text] = line.split(';');
    return { date, apt, author, text };
  });
  res.json(data);
});

// Добавление записи
app.post('/api/add', async (req, res) => {
  const { token } = req.body;
  if (!sessions.has(token)) return res.json({ ok:false });
  const apt = sessions.get(token);
  const date = new Date().toISOString().slice(0,10);
  const text = 'Прибрано';
  await appendFile('schedule.txt', `${date};${apt};${apt};${text}\n`);
  await logActivity(apt, 'add', 'Добавлена запись');
  res.json({ ok:true });
});

// Обновление записи
app.post('/api/update', async (req, res) => {
  const { token, index, text } = req.body;
  if (!sessions.has(token)) return res.json({ ok:false });
  const apt = sessions.get(token);
  const dataRaw = await loadFile('schedule.txt');
  const lines = dataRaw.split('\n').filter(l=>l.trim() && !l.startsWith('Дата;'));
  if (!lines[index]) return res.json({ ok:false });

  const parts = lines[index].split(';');
  if (parts[2] !== apt) return res.json({ ok:false });

  parts[3] = text;
  lines[index] = parts.join(';');
  await saveFile('schedule.txt', 'Дата;Квартира;Автор;Текст\n' + lines.join('\n') + '\n');
  await logActivity(apt, 'update', `Обновлена запись #${index}`);
  res.json({ ok:true });
});

// Удаление записи
app.post('/api/delete', async (req, res) => {
  const { token, index } = req.body;
  if (!sessions.has(token)) return res.json({ ok:false });
  const apt = sessions.get(token);
  const dataRaw = await loadFile('schedule.txt');
  const lines = dataRaw.split('\n').filter(l=>l.trim() && !l.startsWith('Дата;'));
  if (!lines[index]) return res.json({ ok:false });

  const parts = lines[index].split(';');
  if (parts[2] !== apt) return res.json({ ok:false });

  lines.splice(index,1);
  await saveFile('schedule.txt', 'Дата;Квартира;Автор;Текст\n' + lines.join('\n') + '\n');
  await logActivity(apt, 'delete', `Удалена запись #${index}`);
  res.json({ ok:true });
});

// Запуск сервера
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

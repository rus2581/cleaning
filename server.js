const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('.')); // для index.html

const DATA_FILE = 'schedule.txt';
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '', 'utf8');

const sessions = new Map(); // token -> apt

// --- Логін ---
app.post('/api/login', (req,res)=>{
  const {apt,password} = req.body;
  // простий пароль = номер квартири
  if(String(password) === String(apt)){
    const token = Math.random().toString(36).substr(2,16);
    sessions.set(token, apt);
    res.json({ok:true, token, apt});
  } else res.json({ok:false});
});

// --- Завантажити всі записи ---
app.get('/api/load', (req,res)=>{
  const lines = fs.readFileSync(DATA_FILE,'utf8').trim().split('\n').filter(Boolean);
  const data = lines.map(line=>{
    const [date, apt, author, text] = line.split(';');
    return {date, apt, author, text};
  });
  res.json(data);
});

// --- Додати запис ---
app.post('/api/add', (req,res)=>{
  const {token} = req.body;
  if(!sessions.has(token)) return res.json({ok:false});
  const apt = sessions.get(token);
  const date = new Date().toISOString().slice(0,10);
  const text = 'Прибрано';
  fs.appendFileSync(DATA_FILE, `${date};${apt};${apt};${text}\n`, 'utf8');
  res.json({ok:true});
});

// --- Оновити запис ---
app.post('/api/update', (req,res)=>{
  const {token,index,text} = req.body;
  if(!sessions.has(token)) return res.json({ok:false});
  const lines = fs.readFileSync(DATA_FILE,'utf8').trim().split('\n');
  if(!lines[index]) return res.json({ok:false});
  const parts = lines[index].split(';');
  if(parts[2] !== sessions.get(token)) return res.json({ok:false}); // лише автор може змінювати
  parts[3] = text;
  lines[index] = parts.join(';');
  fs.writeFileSync(DATA_FILE, lines.join('\n')+'\n','utf8');
  res.json({ok:true});
});

// --- Видалити запис ---
app.post('/api/delete', (req,res)=>{
  const {token,index} = req.body;
  if(!sessions.has(token)) return res.json({ok:false});
  const lines = fs.readFileSync(DATA_FILE,'utf8').trim().split('\n');
  if(!lines[index]) return res.json({ok:false});
  const parts = lines[index].split(';');
  if(parts[2] !== sessions.get(token)) return res.json({ok:false});
  lines.splice(index,1);
  fs.writeFileSync(DATA_FILE, lines.join('\n')+'\n','utf8');
  res.json({ok:true});
});

app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`));

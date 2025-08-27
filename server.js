const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "schedule.txt");

// Паролі квартир
const PASSWORDS = { 10:"pass10", 11:"pass11", 12:"pass12", 13:"pass13" };
const sessions = new Map(); // token -> квартира

// Перевірка наявності файлу
function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE,"Дата;Квартира;Автор;Текст\n","utf8");
  }
}
ensureFile();

// Вхід
app.post("/api/login",(req,res)=>{
  const {apt,password} = req.body;
  if(PASSWORDS[apt] && PASSWORDS[apt]===password){
    const token = crypto.randomBytes(16).toString("hex");
    sessions.set(token, String(apt));
    return res.json({ok:true,token,apt});
  }
  res.json({ok:false,message:"Невірний пароль"});
});

// Завантаження записів
app.get("/api/load",(req,res)=>{
  ensureFile();
  const data = fs.readFileSync(DATA_FILE,"utf8").trim().split(/\r?\n/).slice(1).map(l=>{
    const [date,apt,author,text] = l.split(";");
    return {date,apt,author,text};
  });
  res.json(data);
});

// Додавання нового запису
app.post("/api/add",(req,res)=>{
  const {token} = req.body;
  if(!sessions.has(token)) return res.json({ok:false,message:"Немає доступу"});
  const apt = sessions.get(token);
  const date = new Date().toISOString().slice(0,10);
  const text = "Прибрано";
  const line = `${date};${apt};${apt};${text}\n`;
  fs.appendFileSync(DATA_FILE,line,"utf8");
  res.json({ok:true,date,apt,text,author:apt});
});

// Оновлення запису
app.post("/api/update",(req,res)=>{
  const {token,index,text} = req.body;
  if(!sessions.has(token)) return res.json({ok:false,message:"Немає доступу"});
  const apt = sessions.get(token);
  const lines = fs.readFileSync(DATA_FILE,"utf8").trim().split(/\r?\n/);
  const header = lines[0];
  const data = lines.slice(1).map(l=>l.split(";"));
  if(data[index][2]!==apt) return res.json({ok:false,message:"Немає прав"});
  data[index][3]=text;
  const out = [header,...data.map(r=>r.join(";"))].join("\n");
  fs.writeFileSync(DATA_FILE,out,"utf8");
  res.json({ok:true});
});

// Видалення запису
app.post("/api/delete",(req,res)=>{
  const {token,index} = req.body;
  if(!sessions.has(token)) return res.json({ok:false,message:"Немає доступу"});
  const apt = sessions.get(token);
  const lines = fs.readFileSync(DATA_FILE,"utf8").trim().split(/\r?\n/);
  const header = lines[0];
  let data = lines.slice(1).map(l=>l.split(";"));
  if(data[index][2]!==apt) return res.json({ok:false,message:"Немає прав"});
  data.splice(index,1);
  const out = [header,...data.map(r=>r.join(";"))].join("\n");
  fs.writeFileSync(DATA_FILE,out,"utf8");
  res.json({ok:true});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("Server running on port "+PORT));

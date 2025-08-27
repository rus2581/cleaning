const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// Статичні файли (index.html)
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "schedule.txt");

const PASSWORDS = { 10:"pass10", 11:"pass11", 12:"pass12", 13:"pass13" };
const sessions = new Map();

function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "Дата;10;11;12;13\n", "utf8");
  }
}
ensureFile();

app.post("/api/login", (req,res)=>{
  const {apt,password} = req.body;
  if(PASSWORDS[apt] && PASSWORDS[apt]===password){
    const token = crypto.randomBytes(16).toString("hex");
    sessions.set(token, String(apt));
    return res.json({ok:true,token});
  }
  res.json({ok:false,message:"Невірний пароль"});
});

app.get("/api/load",(req,res)=>{
  ensureFile();
  res.send(fs.readFileSync(DATA_FILE,"utf8"));
});

app.post("/api/save",(req,res)=>{
  const {token,apt,rows} = req.body;
  if(!sessions.has(token) || sessions.get(token)!==String(apt)){
    return res.json({ok:false,message:"Немає доступу"});
  }
  const lines = fs.readFileSync(DATA_FILE,"utf8").trim().split(/\r?\n/);
  const header = lines[0];
  let map = {};
  lines.slice(1).forEach(l=>{
    const [d,a10,a11,a12,a13]=l.split(";");
    map[d]={10:a10||"",11:a11||"",12:a12||"",13:a13||""};
  });
  rows.forEach(r=>{
    if(!map[r.date]) map[r.date]={10:"",11:"",12:"",13:""};
    map[r.date][apt]=r.value;
  });
  const out=[header];
  Object.keys(map).sort().forEach(d=>{
    const m=map[d];
    out.push([d,m[10],m[11],m[12],m[13]].join(";"));
  });
  fs.writeFileSync(DATA_FILE,out.join("\n"),"utf8");
  res.json({ok:true});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("Server running on port "+PORT));

const express=require('express');
const path=require('path');
const Database=require('better-sqlite3');
const jwt=require('jsonwebtoken');
const crypto=require('crypto');

const app=express();
const PORT=process.env.PORT||3000;
const JWT_SECRET=process.env.JWT_SECRET||crypto.createHash('sha256').update('cyberforce-development-secret').digest('hex');
const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'admin@cyberforce.local';
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'ChangeMe123!';
const db=new Database(process.env.DB_PATH||path.join(__dirname,'cyberforce.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'officer');
CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Active',created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS contacts(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL,company TEXT,phone TEXT,service TEXT,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'New',created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
const user=db.prepare('SELECT id FROM users WHERE email=?').get(ADMIN_EMAIL);
if(!user) db.prepare('INSERT INTO users(email,password,role) VALUES(?,?,?)').run(ADMIN_EMAIL,ADMIN_PASSWORD,'officer');
const count=db.prepare('SELECT COUNT(*) c FROM services').get().c;
if(!count){const ins=db.prepare('INSERT INTO services(name,description) VALUES(?,?)');['Penetration Testing|Find exploitable weaknesses before attackers do.','Security Operations|24/7 monitoring, detection and response.','Cloud Security|Secure cloud workloads, identities and configurations.','Incident Response|Contain, investigate and recover from cyber incidents.','Vulnerability Management|Continuously identify and prioritize vulnerabilities.','Security Awareness|Build stronger human defenses with practical training.'].forEach(x=>{const [a,b]=x.split('|');ins.run(a,b);});}

app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
app.use(express.static(__dirname));

function auth(req,res,next){const token=req.cookies?.cf_token;let t=token;if(!t&&req.headers.authorization?.startsWith('Bearer '))t=req.headers.authorization.slice(7);if(!t)return res.status(401).json({error:'Unauthorized'});try{req.user=jwt.verify(t,JWT_SECRET);next();}catch{return res.status(401).json({error:'Invalid session'});}}
app.use((req,res,next)=>{const h=req.headers.cookie||'';const m=h.match(/(?:^|; )cf_token=([^;]+)/);req.cookies={cf_token:m?decodeURIComponent(m[1]):null};next();});
function issue(res,user){const token=jwt.sign({id:user.id,email:user.email,role:user.role},JWT_SECRET,{expiresIn:'8h'});res.setHeader('Set-Cookie',`cf_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax${process.env.NODE_ENV==='production'?'; Secure':''}`);return token;}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'CyberForce API'}));
app.get('/api/services',(req,res)=>res.json(db.prepare('SELECT * FROM services ORDER BY id').all()));
app.post('/api/contact',(req,res)=>{const {name,email,company='',phone='',service='',message}=req.body||{};if(!name||!email||!message)return res.status(400).json({error:'Name, email and message are required.'});const r=db.prepare('INSERT INTO contacts(name,email,company,phone,service,message) VALUES(?,?,?,?,?,?)').run(String(name).trim(),String(email).trim(),String(company),String(phone),String(service),String(message).trim());res.status(201).json({ok:true,id:r.lastInsertRowid});});

app.post('/api/auth/login',(req,res)=>{const {email,password}=req.body||{};const u=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!u||u.password!==password)return res.status(401).json({error:'Invalid email or password'});issue(res,u);res.json({ok:true,user:{id:u.id,email:u.email,role:u.role}});});
app.post('/api/auth/logout',(req,res)=>{res.setHeader('Set-Cookie','cf_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');res.json({ok:true});});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));

app.get('/api/admin/stats',auth,(req,res)=>res.json({contacts:db.prepare('SELECT COUNT(*) c FROM contacts').get().c,newContacts:db.prepare("SELECT COUNT(*) c FROM contacts WHERE status='New'").get().c,inProgress:db.prepare("SELECT COUNT(*) c FROM contacts WHERE status='In Progress'").get().c}));
app.get('/api/admin/contacts',auth,(req,res)=>res.json(db.prepare('SELECT * FROM contacts ORDER BY datetime(created_at) DESC').all()));
app.patch('/api/admin/contacts/:id',auth,(req,res)=>{const allowed=['New','Contacted','In Progress','Resolved','Archived'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status'});db.prepare('UPDATE contacts SET status=? WHERE id=?').run(req.body.status,req.params.id);res.json({ok:true});});
app.delete('/api/admin/contacts/:id',auth,(req,res)=>{db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);res.json({ok:true});});
app.get('/api/admin/services',auth,(req,res)=>res.json(db.prepare('SELECT * FROM services ORDER BY id').all()));
app.post('/api/admin/services',auth,(req,res)=>{if(!req.body.name)return res.status(400).json({error:'Name required'});const r=db.prepare('INSERT INTO services(name,description) VALUES(?,?)').run(req.body.name,req.body.description||'');res.status(201).json({id:r.lastInsertRowid});});
app.patch('/api/admin/services/:id',auth,(req,res)=>{db.prepare('UPDATE services SET name=COALESCE(?,name),description=COALESCE(?,description) WHERE id=?').run(req.body.name??null,req.body.description??null,req.params.id);res.json({ok:true});});
app.delete('/api/admin/services/:id',auth,(req,res)=>{db.prepare('DELETE FROM services WHERE id=?').run(req.params.id);res.json({ok:true});});

app.get('/officer',(req,res)=>res.sendFile(path.join(__dirname,'dashboard.html')));
app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Not found'});res.sendFile(path.join(__dirname,'index.html'));});
app.listen(PORT,()=>console.log(`CyberForce running on port ${PORT}`));

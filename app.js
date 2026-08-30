const WA="https://wa.me/916306927241";
async function loadServices(){
  const r=await fetch("/api/services"); const services=await r.json();
  const grid=document.getElementById("serviceGrid"), select=document.getElementById("serviceSelect");
  grid.innerHTML=services.filter(s=>s.status==="Active").map((s,i)=>`<article class="service-card" style="--d:${i*60}ms"><div class="service-icon">◈</div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p><a href="#contact">Learn more ↗</a></article>`).join("");
  select.innerHTML='<option value="">Select a service</option>'+services.filter(s=>s.status==="Active").map(s=>`<option>${esc(s.name)}</option>`).join("");
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
document.getElementById("contactForm").addEventListener("submit",async e=>{
  e.preventDefault(); const msg=document.getElementById("formMsg"); msg.textContent="Sending...";
  const data=Object.fromEntries(new FormData(e.target));
  const r=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  const j=await r.json(); msg.textContent=r.ok?"Request received — our team will contact you soon.":(j.error||"Unable to send request.");
  if(r.ok)e.target.reset();
});
loadServices();
document.querySelectorAll(".service-card").forEach(c=>c.addEventListener("mousemove",e=>{const r=c.getBoundingClientRect();c.style.transform=`perspective(800px) rotateX(${-(e.clientY-r.top-r.height/2)/25}deg) rotateY(${(e.clientX-r.left-r.width/2)/25}deg) translateY(-6px)`}));
document.addEventListener("mouseout",e=>{if(e.target.classList?.contains("service-card"))e.target.style.transform=""});

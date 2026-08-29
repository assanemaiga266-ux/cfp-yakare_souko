/* ============================================================
   CFP YAKARÉ SOUKO — Application de gestion
   ============================================================ */

/* ---------- 1. CONFIGURATION FIREBASE ----------
   Remplace les valeurs ci-dessous par celles de TON projet Firebase
   (Console Firebase > Paramètres du projet > Tes applications > SDK config).
   ---------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCGJE3Dr30eujNQfUECTIRnAuROiVR1PWU",
  authDomain: "cfp-yakare-souko.firebaseapp.com",
  projectId: "cfp-yakare-souko",
  storageBucket: "cfp-yakare-souko.firebasestorage.app",
  messagingSenderId: "642420663151",
  appId: "1:642420663151:web:9688b9eb665cf3254a3e9a"
};

let db = null;
let firebaseReady = false;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(()=>{});
  firebaseReady = true;
} catch (e) {
  console.warn("Firebase pas encore configuré :", e);
}

/* ---------- 2. DONNEES LOCALES (cache) ---------- */
let FILIERES = [];
let APPRENANTS = [];
let FORMATEURS = [];
let SEANCES = [];
let PAIEMENTS = [];
let DEPENSES = [];

const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

const FILIERES_DEFAUT = [
  { nom: "Coupe Couture", duree: "1 an", icon: "🧵", tarifInscription: 10000, tarifMensuel: 7500 },
  { nom: "Henné", duree: "3 mois", icon: "🎨", tarifInscription: 10000, tarifMensuel: 6000 },
  { nom: "Tatouage", duree: "3 mois", icon: "🖋️", tarifInscription: 10000, tarifMensuel: 6000 },
  { nom: "Makeup", duree: "3 mois", icon: "💄", tarifInscription: 10000, tarifMensuel: 6000 },
  { nom: "Foulard", duree: "3 mois", icon: "🧣", tarifInscription: 10000, tarifMensuel: 6000 },
  { nom: "Coiffure", duree: "6 mois", icon: "💇🏾‍♀️", tarifInscription: 10000, tarifMensuel: 6500 },
  { nom: "Pose Perruque", duree: "6 mois", icon: "👱🏾‍♀️", tarifInscription: 10000, tarifMensuel: 6500 },
  { nom: "Installation Solaire", duree: "1 an", icon: "🔆", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Plomberie", duree: "1 an", icon: "🔧", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Sanitaire", duree: "1 an", icon: "🚿", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Carrelage", duree: "6 mois", icon: "🧱", tarifInscription: 12000, tarifMensuel: 8000 },
  { nom: "Pavé", duree: "6 mois", icon: "🪨", tarifInscription: 12000, tarifMensuel: 8000 },
  { nom: "Électricité Bâtiment", duree: "1 an", icon: "💡", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Peinture", duree: "6 mois", icon: "🖌️", tarifInscription: 12000, tarifMensuel: 7000 },
  { nom: "Décoration", duree: "6 mois", icon: "🖼️", tarifInscription: 12000, tarifMensuel: 7000 },
  { nom: "Décor Événementielle", duree: "3 mois", icon: "🎉", tarifInscription: 10000, tarifMensuel: 6500 },
  { nom: "Pâtisserie", duree: "3 mois", icon: "🧁", tarifInscription: 10000, tarifMensuel: 7000 },
  { nom: "Cuisine", duree: "6 mois", icon: "🍲", tarifInscription: 12000, tarifMensuel: 7500 },
  { nom: "Woussoulan", duree: "1 mois", icon: "🧶", tarifInscription: 8000, tarifMensuel: 5000 },
  { nom: "Agro Alimentaire", duree: "6 mois", icon: "🌾", tarifInscription: 12000, tarifMensuel: 7000 },
  { nom: "Maçonnerie", duree: "1 an", icon: "🧱", tarifInscription: 15000, tarifMensuel: 9000 }
];

/* ---------- 3. UTILITAIRES ---------- */
function fmtFCFA(n){ return (Number(n)||0).toLocaleString('fr-FR') ; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function uid(){ return Math.random().toString(36).slice(2,10); }
function initiales(nom,prenom){ return ((prenom?.[0]||"")+(nom?.[0]||"")).toUpperCase() || "?"; }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function filiereNom(id){ const f = FILIERES.find(x=>x.id===id); return f? f.nom : "—"; }
function formateurNom(id){ const f = FORMATEURS.find(x=>x.id===id); return f? f.nom : "—"; }
function apprenantNomComplet(a){ return `${a.prenom||""} ${a.nom||""}`.trim(); }

/* ---------- 4. FIRESTORE : chargement + seed ---------- */
function slugify(str){
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/(^-|-$)/g,'');
}

async function seedFilieresSiVide(){
  if (!firebaseReady) return;
  const batch = db.batch();
  for (const f of FILIERES_DEFAUT){
    const ref = db.collection('filieres').doc(slugify(f.nom));
    const doc = await ref.get();
    if (!doc.exists){
      batch.set(ref, f);
    }
  }
  await batch.commit();
}

function erreurFirestore(e){
  console.error("Erreur Firestore:", e);
  if (e && e.code === 'permission-denied'){
    showToast("⛔ Accès refusé — vérifie que tes règles Firestore sont bien publiées");
  } else {
    showToast("⚠️ Erreur de connexion à Firebase");
  }
}

function ecouterCollections(){
  if (!firebaseReady){
    showToast("⚠️ Configure Firebase dans app.js pour activer la sauvegarde");
    FILIERES = FILIERES_DEFAUT.map(f=>({...f, id: uid()}));
    renderAll();
    return;
  }
  db.collection('filieres').orderBy('nom').onSnapshot(snap=>{
    FILIERES = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  }, erreurFirestore);
  db.collection('apprenants').orderBy('dateInscription','desc').onSnapshot(snap=>{
    APPRENANTS = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  }, erreurFirestore);
  db.collection('formateurs').onSnapshot(snap=>{
    FORMATEURS = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  }, erreurFirestore);
  db.collection('seances').onSnapshot(snap=>{
    SEANCES = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  }, erreurFirestore);
  db.collection('paiements').orderBy('date','desc').onSnapshot(snap=>{
    PAIEMENTS = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  }, erreurFirestore);
  db.collection('depenses').orderBy('date','desc').onSnapshot(snap=>{
    DEPENSES = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  }, erreurFirestore);
}

async function saveDoc(collection, data, id=null){
  if (!firebaseReady){ showToast("⚠️ Firebase non configuré"); return null; }
  if (id){
    await db.collection(collection).doc(id).set(data, {merge:true});
    return id;
  } else {
    const ref = await db.collection(collection).add(data);
    return ref.id;
  }
}
async function deleteDoc(collection, id){
  if (!firebaseReady) return;
  await db.collection(collection).doc(id).delete();
}

/* ---------- 5. NAVIGATION ---------- */
document.querySelectorAll('nav.bottom button').forEach(btn=>{
  btn.addEventListener('click', ()=> goToTab(btn.dataset.tab));
});
function goToTab(tab){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('nav.bottom button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  const navBtn = document.querySelector(`nav.bottom button[data-tab="${tab}"]`);
  if (navBtn) navBtn.classList.add('active');
  currentTab = tab;
  updateFab();
}
let currentTab = 'dashboard';

/* ---------- 6. FAB (bouton +) contextuel ---------- */
const fabBtn = document.getElementById('fabBtn');
function updateFab(){
  const map = {
    apprenants: ()=>openModalApprenant(),
    filieres: null,
    formateurs: ()=>openModalFormateur(),
    planning: ()=>openModalSeance(),
    paiements: ()=>openModalPaiement(),
    livre: ()=>openModalDepense(),
    dashboard: null,
    attestations: null
  };
  const action = map[currentTab];
  fabBtn.style.display = action ? 'flex' : 'none';
  fabBtn.onclick = action || null;
}
fabBtn.addEventListener('click', ()=>{});

/* ---------- 7. MODAL GENERIQUE ---------- */
const overlay = document.getElementById('overlay');
const modalBody = document.getElementById('modalBody');
function openModal(html){
  modalBody.innerHTML = `<button class="close-x" onclick="closeModal()">✕</button>` + html;
  overlay.classList.add('active');
}
function closeModal(){ overlay.classList.remove('active'); }
overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });

/* ---------- 8. RENDER GLOBAL ---------- */
function renderAll(){
  renderDashboard();
  renderApprenants();
  renderFilieres();
  renderFormateurs();
  renderPlanning();
  renderPaiements();
  renderLivre();
  renderCertSelect();
  fillFiliereFilterOptions();
}

/* ---------- 9. DASHBOARD ---------- */
function renderDashboard(){
  document.getElementById('statApprenants').textContent = APPRENANTS.length;
  document.getElementById('statFilieres').textContent = FILIERES.length;

  const now = new Date();
  const moisActuel = now.toISOString().slice(0,7);
  const revenusMois = PAIEMENTS.filter(p=>p.date && p.date.slice(0,7)===moisActuel)
    .reduce((s,p)=>s+Number(p.montant||0),0);
  document.getElementById('statRevenus').textContent = fmtFCFA(revenusMois);

  const enRetard = calculerApprenantsEnRetard();
  document.getElementById('statImpayes').textContent = enRetard.length;

  const list = document.getElementById('dashFiliereList');
  if (FILIERES.length===0){
    list.innerHTML = `<div class="empty"><div class="icon">🧰</div><p>Aucune filière</p></div>`;
  } else {
    list.innerHTML = FILIERES.map(f=>{
      const count = APPRENANTS.filter(a=>a.filiereId===f.id).length;
      return `<div class="filiere-row">
        <div><div class="fname">${f.icon||'📘'} ${f.nom}</div><div class="fdur">${f.duree}</div></div>
        <div class="count-pill">${count}</div>
      </div>`;
    }).join('');
  }

  const recentsWrap = document.getElementById('dashRecents');
  const recents = APPRENANTS.slice(0,5);
  if (recents.length===0){
    recentsWrap.innerHTML = `<div class="empty"><div class="icon">🪡</div><p>Aucun apprenant pour le moment</p></div>`;
  } else {
    recentsWrap.innerHTML = recents.map(a=>`
      <div class="person-row">
        <div class="avatar">${initiales(a.nom,a.prenom)}</div>
        <div class="person-info">
          <div class="pname">${apprenantNomComplet(a)}</div>
          <div class="pmeta">${filiereNom(a.filiereId)}</div>
        </div>
      </div>`).join('');
  }
}

/* ---------- 10. APPRENANTS ---------- */
function fillFiliereFilterOptions(){
  const sel = document.getElementById('filterFiliere');
  const current = sel.value;
  sel.innerHTML = `<option value="">Toutes filières</option>` +
    FILIERES.map(f=>`<option value="${f.id}">${f.icon||''} ${f.nom}</option>`).join('');
  sel.value = current;
}
document.getElementById('searchApprenant').addEventListener('input', renderApprenants);
document.getElementById('filterFiliere').addEventListener('change', renderApprenants);

function renderApprenants(){
  const q = (document.getElementById('searchApprenant').value||'').toLowerCase();
  const filiereFiltre = document.getElementById('filterFiliere').value;
  let list = APPRENANTS.filter(a=>{
    const matchQ = apprenantNomComplet(a).toLowerCase().includes(q) || (a.telephone||'').includes(q);
    const matchF = !filiereFiltre || a.filiereId===filiereFiltre;
    return matchQ && matchF;
  });
  const wrap = document.getElementById('apprenantsList');
  if (list.length===0){
    wrap.innerHTML = `<div class="empty"><div class="icon">🧑🏾‍🎓</div><p>Aucun apprenant trouvé.<br>Touche + pour en inscrire un.</p></div>`;
    return;
  }
  wrap.innerHTML = list.map(a=>{
    const enRetard = calculerApprenantsEnRetard().some(x=>x.id===a.id);
    return `<div class="person-row" onclick="openModalApprenant('${a.id}')">
      <div class="avatar">${initiales(a.nom,a.prenom)}</div>
      <div class="person-info">
        <div class="pname">${apprenantNomComplet(a)}</div>
        <div class="pmeta">${filiereNom(a.filiereId)}${a.duree? ' · '+a.duree : ''} · ${a.telephone||'—'}</div>
      </div>
      <span class="badge ${enRetard?'warn':'ok'}">${enRetard?'Retard':'À jour'}</span>
    </div>`;
  }).join('');
}

function openModalApprenant(id=null){
  const a = id ? APPRENANTS.find(x=>x.id===id) : null;
  const filiereOptions = FILIERES.map(f=>`<option value="${f.id}" ${a?.filiereId===f.id?'selected':''}>${f.icon||''} ${f.nom}</option>`).join('');
  openModal(`
    <h2>${a? 'Modifier' : 'Nouvel'} apprenant</h2>
    <div class="field"><label>Prénom</label><input id="fPrenom" value="${a?.prenom||''}"></div>
    <div class="field"><label>Nom</label><input id="fNom" value="${a?.nom||''}"></div>
    <div class="field"><label>Téléphone</label><input id="fTel" type="tel" value="${a?.telephone||''}"></div>
    <div class="field"><label>Filière</label><select id="fFiliere" onchange="majDureeParDefaut()"><option value="">— Choisir —</option>${filiereOptions}</select></div>
    <div class="field"><label>Durée de la formation</label><input id="fDuree" value="${a?.duree||''}" placeholder="Ex: 6 mois"></div>
    <div class="field"><label>Date d'inscription</label><input id="fDate" type="date" value="${a?.dateInscription||todayISO()}"></div>
    <div class="field"><label>Tuteur / Contact d'urgence (optionnel)</label><input id="fTuteur" value="${a?.tuteur||''}"></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerApprenant('${id||''}')">Enregistrer</button>
    </div>
    ${a? `<button class="btn btn-danger btn-block" style="margin-top:10px;" onclick="supprimerApprenant('${id}')">Supprimer</button>` : ''}
  `);
}
function majDureeParDefaut(){
  const filiereId = document.getElementById('fFiliere').value;
  const dureeField = document.getElementById('fDuree');
  if (filiereId && !dureeField.value){
    const f = FILIERES.find(x=>x.id===filiereId);
    if (f) dureeField.value = f.duree;
  }
}
async function enregistrerApprenant(id){
  const data = {
    prenom: document.getElementById('fPrenom').value.trim(),
    nom: document.getElementById('fNom').value.trim(),
    telephone: document.getElementById('fTel').value.trim(),
    filiereId: document.getElementById('fFiliere').value,
    duree: document.getElementById('fDuree').value.trim(),
    dateInscription: document.getElementById('fDate').value || todayISO(),
    tuteur: document.getElementById('fTuteur').value.trim()
  };
  if (!data.nom || !data.filiereId){ showToast("Nom et filière obligatoires"); return; }
  await saveDoc('apprenants', data, id||null);
  closeModal();
  showToast(id? "Apprenant modifié" : "Apprenant inscrit ✅");
}
async function supprimerApprenant(id){
  if (!confirm("Supprimer cet apprenant ?")) return;
  await deleteDoc('apprenants', id);
  closeModal();
  showToast("Apprenant supprimé");
}

/* ---------- 11. FILIERES ---------- */
function renderFilieres(){
  const wrap = document.getElementById('filieresList');
  if (FILIERES.length===0){
    wrap.innerHTML = `<div class="empty"><div class="icon">🧰</div><p>Aucune filière configurée</p></div>`;
    return;
  }
  wrap.innerHTML = FILIERES.map(f=>{
    const count = APPRENANTS.filter(a=>a.filiereId===f.id).length;
    return `<div class="metier-card">
      <div class="icon">${f.icon||'📘'}</div>
      <h3>${f.nom}</h3>
      <div class="meta">
        <span>⏱ ${f.duree}</span>
        <span>${count} apprenant(s)</span>
      </div>
      <div class="meta">
        <span class="mono">Inscription ${fmtFCFA(f.tarifInscription)} F</span>
        <span class="mono">Mensuel ${fmtFCFA(f.tarifMensuel)} F</span>
      </div>
      <div class="actions">
        <button class="btn btn-outline btn-sm" onclick="openModalFiliere('${f.id}')">✏️ Modifier</button>
      </div>
    </div>`;
  }).join('');
}
function openModalFiliere(id){
  const f = FILIERES.find(x=>x.id===id);
  if (!f) return;
  openModal(`
    <h2>${f.icon||''} ${f.nom}</h2>
    <div class="field"><label>Durée</label><input id="fFDuree" value="${f.duree}"></div>
    <div class="field"><label>Frais d'inscription (FCFA)</label><input id="fFInsc" type="number" value="${f.tarifInscription}"></div>
    <div class="field"><label>Mensualité (FCFA)</label><input id="fFMens" type="number" value="${f.tarifMensuel}"></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerFiliere('${id}')">Enregistrer</button>
    </div>
  `);
}
async function enregistrerFiliere(id){
  const data = {
    duree: document.getElementById('fFDuree').value.trim(),
    tarifInscription: Number(document.getElementById('fFInsc').value)||0,
    tarifMensuel: Number(document.getElementById('fFMens').value)||0
  };
  await saveDoc('filieres', data, id);
  closeModal();
  showToast("Filière mise à jour");
}

/* ---------- 12. FORMATEURS ---------- */
function renderFormateurs(){
  const wrap = document.getElementById('formateursList');
  if (FORMATEURS.length===0){
    wrap.innerHTML = `<div class="empty"><div class="icon">👩🏾‍🏫</div><p>Aucun formateur.<br>Touche + pour en ajouter un.</p></div>`;
    return;
  }
  wrap.innerHTML = FORMATEURS.map(f=>{
    const nbFilieres = (f.filiereIds||[]).length;
    return `<div class="person-row" onclick="openModalFormateur('${f.id}')">
      <div class="avatar">${initiales(f.nom,'')}</div>
      <div class="person-info">
        <div class="pname">${f.nom}</div>
        <div class="pmeta">${(f.filiereIds||[]).map(id=>filiereNom(id)).join(', ') || 'Aucune filière assignée'}</div>
      </div>
    </div>`;
  }).join('');
}
function openModalFormateur(id=null){
  const f = id ? FORMATEURS.find(x=>x.id===id) : null;
  const checks = FILIERES.map(fl=>{
    const checked = f?.filiereIds?.includes(fl.id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.5px;">
      <input type="checkbox" value="${fl.id}" class="filiereCheck" ${checked}> ${fl.icon||''} ${fl.nom}
    </label>`;
  }).join('');
  openModal(`
    <h2>${f?'Modifier':'Nouveau'} formateur</h2>
    <div class="field"><label>Nom complet</label><input id="fFormNom" value="${f?.nom||''}"></div>
    <div class="field"><label>Téléphone</label><input id="fFormTel" type="tel" value="${f?.telephone||''}"></div>
    <div class="field"><label>Filières enseignées</label>${checks}</div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerFormateur('${id||''}')">Enregistrer</button>
    </div>
    ${f? `<button class="btn btn-danger btn-block" style="margin-top:10px;" onclick="supprimerFormateur('${id}')">Supprimer</button>` : ''}
  `);
}
async function enregistrerFormateur(id){
  const filiereIds = Array.from(document.querySelectorAll('.filiereCheck:checked')).map(c=>c.value);
  const data = {
    nom: document.getElementById('fFormNom').value.trim(),
    telephone: document.getElementById('fFormTel').value.trim(),
    filiereIds
  };
  if (!data.nom){ showToast("Nom obligatoire"); return; }
  await saveDoc('formateurs', data, id||null);
  closeModal();
  showToast(id?"Formateur modifié":"Formateur ajouté ✅");
}
async function supprimerFormateur(id){
  if (!confirm("Supprimer ce formateur ?")) return;
  await deleteDoc('formateurs', id);
  closeModal();
  showToast("Formateur supprimé");
}

/* ---------- 13. PLANNING ---------- */
let planningJourActif = "Lundi";
function renderPlanningChips(){
  const wrap = document.getElementById('planningDayChips');
  wrap.innerHTML = JOURS.map(j=>`<button class="chip ${j===planningJourActif?'active':''}" onclick="setPlanningJour('${j}')">${j}</button>`).join('');
}
function setPlanningJour(j){ planningJourActif = j; renderPlanning(); }
function renderPlanning(){
  renderPlanningChips();
  const wrap = document.getElementById('planningList');
  const list = SEANCES.filter(s=>s.jour===planningJourActif).sort((a,b)=>(a.heureDebut||'').localeCompare(b.heureDebut||''));
  if (list.length===0){
    wrap.innerHTML = `<div class="empty"><div class="icon">🗓️</div><p>Aucune séance ce jour.<br>Touche + pour en planifier une.</p></div

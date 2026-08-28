/* ============================================================
   CFP YAKARÉ SOUKO — Application de gestion
   ============================================================ */

/* ---------- 1. CONFIGURATION FIREBASE ----------
   Remplace les valeurs ci-dessous par celles de TON projet Firebase
   (Console Firebase > Paramètres du projet > Tes applications > SDK config).
   ---------------------------------------------------------- */
const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.appspot.com",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
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
  { nom: "Henné & Tatouage", duree: "3 mois", icon: "🎨", tarifInscription: 10000, tarifMensuel: 6000 },
  { nom: "Makeup & Foulard", duree: "3 mois", icon: "💄", tarifInscription: 10000, tarifMensuel: 6000 },
  { nom: "Coiffure / Pose Perruque", duree: "6 mois", icon: "💇🏾‍♀️", tarifInscription: 10000, tarifMensuel: 6500 },
  { nom: "Installation Solaire", duree: "1 an", icon: "🔆", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Plomberie & Sanitaire", duree: "1 an", icon: "🔧", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Carrelage & Pavé", duree: "6 mois", icon: "🧱", tarifInscription: 12000, tarifMensuel: 8000 },
  { nom: "Électricité Bâtiment", duree: "1 an", icon: "💡", tarifInscription: 15000, tarifMensuel: 9000 },
  { nom: "Peinture / Décoration", duree: "6 mois", icon: "🖌️", tarifInscription: 12000, tarifMensuel: 7000 },
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
async function seedFilieresSiVide(){
  if (!firebaseReady) return;
  const snap = await db.collection('filieres').limit(1).get();
  if (snap.empty){
    const batch = db.batch();
    FILIERES_DEFAUT.forEach(f=>{
      const ref = db.collection('filieres').doc();
      batch.set(ref, f);
    });
    await batch.commit();
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
  });
  db.collection('apprenants').orderBy('dateInscription','desc').onSnapshot(snap=>{
    APPRENANTS = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  });
  db.collection('formateurs').onSnapshot(snap=>{
    FORMATEURS = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  });
  db.collection('seances').onSnapshot(snap=>{
    SEANCES = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  });
  db.collection('paiements').orderBy('date','desc').onSnapshot(snap=>{
    PAIEMENTS = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  });
  db.collection('depenses').orderBy('date','desc').onSnapshot(snap=>{
    DEPENSES = snap.docs.map(d=>({id:d.id, ...d.data()}));
    renderAll();
  });
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
        <div class="pmeta">${filiereNom(a.filiereId)} · ${a.telephone||'—'}</div>
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
    <div class="field"><label>Filière</label><select id="fFiliere"><option value="">— Choisir —</option>${filiereOptions}</select></div>
    <div class="field"><label>Date d'inscription</label><input id="fDate" type="date" value="${a?.dateInscription||todayISO()}"></div>
    <div class="field"><label>Tuteur / Contact d'urgence (optionnel)</label><input id="fTuteur" value="${a?.tuteur||''}"></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerApprenant('${id||''}')">Enregistrer</button>
    </div>
    ${a? `<button class="btn btn-danger btn-block" style="margin-top:10px;" onclick="supprimerApprenant('${id}')">Supprimer</button>` : ''}
  `);
}
async function enregistrerApprenant(id){
  const data = {
    prenom: document.getElementById('fPrenom').value.trim(),
    nom: document.getElementById('fNom').value.trim(),
    telephone: document.getElementById('fTel').value.trim(),
    filiereId: document.getElementById('fFiliere').value,
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
    wrap.innerHTML = `<div class="empty"><div class="icon">🗓️</div><p>Aucune séance ce jour.<br>Touche + pour en planifier une.</p></div>`;
    return;
  }
  wrap.innerHTML = list.map(s=>`
    <div class="card" onclick="openModalSeance('${s.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:14px;">${FILIERES.find(f=>f.id===s.filiereId)?.icon||''} ${filiereNom(s.filiereId)}</div>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${formateurNom(s.formateurId)} ${s.salle? '· '+s.salle:''}</div>
        </div>
        <div class="mono" style="font-size:13px;font-weight:600;color:var(--purple-deep);">${s.heureDebut||''}–${s.heureFin||''}</div>
      </div>
    </div>`).join('');
}
function openModalSeance(id=null){
  const s = id ? SEANCES.find(x=>x.id===id) : null;
  const filiereOpts = FILIERES.map(f=>`<option value="${f.id}" ${s?.filiereId===f.id?'selected':''}>${f.icon||''} ${f.nom}</option>`).join('');
  const formOpts = FORMATEURS.map(f=>`<option value="${f.id}" ${s?.formateurId===f.id?'selected':''}>${f.nom}</option>`).join('');
  const jourOpts = JOURS.map(j=>`<option ${s?.jour===j || (!s && j===planningJourActif)?'selected':''}>${j}</option>`).join('');
  openModal(`
    <h2>${s?'Modifier':'Nouvelle'} séance</h2>
    <div class="field"><label>Filière</label><select id="sFiliere">${filiereOpts}</select></div>
    <div class="field"><label>Formateur</label><select id="sFormateur"><option value="">—</option>${formOpts}</select></div>
    <div class="field"><label>Jour</label><select id="sJour">${jourOpts}</select></div>
    <div class="field" style="display:flex;gap:10px;">
      <div style="flex:1;"><label>Début</label><input id="sDebut" type="time" value="${s?.heureDebut||'08:00'}"></div>
      <div style="flex:1;"><label>Fin</label><input id="sFin" type="time" value="${s?.heureFin||'10:00'}"></div>
    </div>
    <div class="field"><label>Salle / atelier (optionnel)</label><input id="sSalle" value="${s?.salle||''}"></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerSeance('${id||''}')">Enregistrer</button>
    </div>
    ${s? `<button class="btn btn-danger btn-block" style="margin-top:10px;" onclick="supprimerSeance('${id}')">Supprimer</button>` : ''}
  `);
}
async function enregistrerSeance(id){
  const data = {
    filiereId: document.getElementById('sFiliere').value,
    formateurId: document.getElementById('sFormateur').value,
    jour: document.getElementById('sJour').value,
    heureDebut: document.getElementById('sDebut').value,
    heureFin: document.getElementById('sFin').value,
    salle: document.getElementById('sSalle').value.trim()
  };
  await saveDoc('seances', data, id||null);
  closeModal();
  showToast("Séance enregistrée");
}
async function supprimerSeance(id){
  if (!confirm("Supprimer cette séance ?")) return;
  await deleteDoc('seances', id);
  closeModal();
  showToast("Séance supprimée");
}

/* ---------- 14. PAIEMENTS ---------- */
function calculerApprenantsEnRetard(){
  // Un apprenant est "en retard" s'il n'a fait aucun paiement depuis 30+ jours après son inscription
  // ou aucun paiement du tout après 15 jours d'inscription.
  const now = new Date();
  return APPRENANTS.filter(a=>{
    const paiementsA = PAIEMENTS.filter(p=>p.apprenantId===a.id);
    const dernier = paiementsA.sort((x,y)=> new Date(y.date) - new Date(x.date))[0];
    const refDate = dernier ? new Date(dernier.date) : new Date(a.dateInscription);
    const jours = (now - refDate) / (1000*3600*24);
    return jours > 30;
  });
}
document.getElementById('searchPaiement').addEventListener('input', renderPaiements);
function renderPaiements(){
  const now = new Date();
  const moisActuel = now.toISOString().slice(0,7);
  const totalMois = PAIEMENTS.filter(p=>p.date && p.date.slice(0,7)===moisActuel).reduce((s,p)=>s+Number(p.montant||0),0);
  document.getElementById('payTotalMonth').textContent = fmtFCFA(totalMois);
  const retards = calculerApprenantsEnRetard();
  document.getElementById('payRetardCount').textContent = retards.length;

  const q = (document.getElementById('searchPaiement').value||'').toLowerCase();
  let list = APPRENANTS.filter(a=>apprenantNomComplet(a).toLowerCase().includes(q));
  const wrap = document.getElementById('paiementsList');
  if (list.length===0){
    wrap.innerHTML = `<div class="empty"><div class="icon">💰</div><p>Aucun apprenant</p></div>`;
    return;
  }
  wrap.innerHTML = list.map(a=>{
    const paiementsA = PAIEMENTS.filter(p=>p.apprenantId===a.id);
    const totalPaye = paiementsA.reduce((s,p)=>s+Number(p.montant||0),0);
    const enRetard = retards.some(x=>x.id===a.id);
    return `<div class="card" style="padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:14px;">${apprenantNomComplet(a)}</div>
          <div style="font-size:11.5px;color:var(--ink-soft);">${filiereNom(a.filiereId)} · Total payé <span class="mono">${fmtFCFA(totalPaye)} F</span></div>
        </div>
        <span class="badge ${enRetard?'warn':'ok'}">${enRetard?'Retard':'À jour'}</span>
      </div>
      <div class="actions" style="margin-top:10px;">
        <button class="btn btn-primary btn-sm" onclick="openModalPaiement('${a.id}')">+ Encaisser</button>
        <button class="btn btn-ghost btn-sm" onclick="voirHistoriquePaiements('${a.id}')">Historique</button>
      </div>
    </div>`;
  }).join('');
}
function openModalPaiement(apprenantIdPreselect=null){
  const options = APPRENANTS.map(a=>`<option value="${a.id}" ${a.id===apprenantIdPreselect?'selected':''}>${apprenantNomComplet(a)}</option>`).join('');
  openModal(`
    <h2>Enregistrer un paiement</h2>
    <div class="field"><label>Apprenant</label><select id="pApprenant"><option value="">— Choisir —</option>${options}</select></div>
    <div class="field"><label>Type</label>
      <select id="pType">
        <option value="Inscription">Frais d'inscription</option>
        <option value="Mensualité">Mensualité</option>
        <option value="Autre">Autre</option>
      </select>
    </div>
    <div class="field"><label>Montant (FCFA)</label><input id="pMontant" type="number"></div>
    <div class="field"><label>Date</label><input id="pDate" type="date" value="${todayISO()}"></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerPaiement()">Encaisser</button>
    </div>
  `);
}
async function enregistrerPaiement(){
  const apprenantId = document.getElementById('pApprenant').value;
  const montant = Number(document.getElementById('pMontant').value);
  if (!apprenantId || !montant){ showToast("Choisis l'apprenant et le montant"); return; }
  const data = {
    apprenantId,
    type: document.getElementById('pType').value,
    montant,
    date: document.getElementById('pDate').value || todayISO(),
    mode: "Cash"
  };
  await saveDoc('paiements', data);
  closeModal();
  showToast(`Paiement de ${fmtFCFA(montant)} F encaissé ✅`);
}
function voirHistoriquePaiements(apprenantId){
  const a = APPRENANTS.find(x=>x.id===apprenantId);
  const paiementsA = PAIEMENTS.filter(p=>p.apprenantId===apprenantId).sort((x,y)=>new Date(y.date)-new Date(x.date));
  openModal(`
    <h2>Historique — ${apprenantNomComplet(a)}</h2>
    ${paiementsA.length===0 ? `<div class="empty"><p>Aucun paiement enregistré</p></div>` :
      paiementsA.map(p=>`
        <div class="person-row" style="cursor:default;">
          <div class="person-info">
            <div class="pname">${p.type} <span class="mono">${fmtFCFA(p.montant)} F</span></div>
            <div class="pmeta">${p.date}</div>
          </div>
        </div>`).join('')
    }
  `);
}

/* ---------- 15. LIVRE DE COMPTE ---------- */
let livreFiltreActif = 'tout';
document.querySelectorAll('[data-livre-filter]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-livre-filter]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    livreFiltreActif = btn.dataset.livreFilter;
    renderLivre();
  });
});
function getEcritures(){
  const entrees = PAIEMENTS.map(p=>({
    id: 'p-'+p.id, date: p.date, montant: Number(p.montant||0), sens:'entree',
    libelle: `${p.type} — ${apprenantNomComplet(APPRENANTS.find(a=>a.id===p.apprenantId)||{})}`
  }));
  const sorties = DEPENSES.map(d=>({
    id: 'd-'+d.id, date: d.date, montant: Number(d.montant||0), sens:'sortie',
    libelle: `${d.categorie} — ${d.libelle}`
  }));
  return [...entrees, ...sorties].sort((a,b)=> new Date(b.date) - new Date(a.date));
}
function renderLivre(){
  const ecritures = getEcritures();
  const totalEntrees = ecritures.filter(e=>e.sens==='entree').reduce((s,e)=>s+e.montant,0);
  const totalSorties = ecritures.filter(e=>e.sens==='sortie').reduce((s,e)=>s+e.montant,0);
  document.getElementById('livreEntrees').textContent = fmtFCFA(totalEntrees);
  document.getElementById('livreSorties').textContent = fmtFCFA(totalSorties);
  document.getElementById('livreSolde').textContent = fmtFCFA(totalEntrees - totalSorties);

  let filtered = ecritures;
  if (livreFiltreActif !== 'tout') filtered = ecritures.filter(e=>e.sens===livreFiltreActif);

  const wrap = document.getElementById('livreList');
  if (filtered.length===0){
    wrap.innerHTML = `<div class="empty"><div class="icon">📒</div><p>Aucune écriture</p></div>`;
    return;
  }
  wrap.innerHTML = filtered.map(e=>`
    <div class="person-row" style="cursor:default;">
      <div class="avatar" style="background:${e.sens==='entree'?'var(--success)':'var(--danger)'};">${e.sens==='entree'?'↓':'↑'}</div>
      <div class="person-info">
        <div class="pname">${e.libelle}</div>
        <div class="pmeta">${e.date}</div>
      </div>
      <div class="mono" style="font-weight:600;color:${e.sens==='entree'?'var(--success)':'var(--danger)'};">
        ${e.sens==='entree'?'+':'-'}${fmtFCFA(e.montant)} F
      </div>
    </div>`).join('');
}
function openModalDepense(){
  openModal(`
    <h2>Nouvelle dépense</h2>
    <div class="field"><label>Catégorie</label>
      <select id="dCategorie">
        <option>Salaire formateur</option>
        <option>Achat matériel</option>
        <option>Loyer / charges</option>
        <option>Entretien</option>
        <option>Autre</option>
      </select>
    </div>
    <div class="field"><label>Description</label><input id="dLibelle" placeholder="Ex: Salaire août — Fatoumata"></div>
    <div class="field"><label>Montant (FCFA)</label><input id="dMontant" type="number"></div>
    <div class="field"><label>Date</label><input id="dDate" type="date" value="${todayISO()}"></div>
    <div class="modal-actions">
      <button class="btn btn-primary btn-block" onclick="enregistrerDepense()">Enregistrer la sortie</button>
    </div>
  `);
}
async function enregistrerDepense(){
  const montant = Number(document.getElementById('dMontant').value);
  const libelle = document.getElementById('dLibelle').value.trim();
  if (!montant || !libelle){ showToast("Remplis la description et le montant"); return; }
  const data = {
    categorie: document.getElementById('dCategorie').value,
    libelle,
    montant,
    date: document.getElementById('dDate').value || todayISO()
  };
  await saveDoc('depenses', data);
  closeModal();
  showToast("Dépense enregistrée");
}

/* ---------- 16. ATTESTATIONS ---------- */
function renderCertSelect(){
  const sel = document.getElementById('certApprenantSelect');
  const current = sel.value;
  sel.innerHTML = `<option value="">Choisir un apprenant...</option>` +
    APPRENANTS.map(a=>`<option value="${a.id}">${apprenantNomComplet(a)} — ${filiereNom(a.filiereId)}</option>`).join('');
  sel.value = current;
}
function genererAttestation(){
  const id = document.getElementById('certApprenantSelect').value;
  if (!id){ showToast("Choisis un apprenant"); return; }
  const a = APPRENANTS.find(x=>x.id===id);
  const f = FILIERES.find(x=>x.id===a.filiereId);
  const dateJour = new Date().toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'});
  document.getElementById('certPreviewWrap').innerHTML = `
    <div class="cert" id="certToPrint">
      <div class="cert-seal">CFP<br>YSK</div>
      <h2>Attestation de Formation</h2>
      <div class="cert-sub">Centre de Formation Professionnelle Yakaré Souko · Koutiala Lafiala</div>
      <div class="cert-body">Le Centre atteste que</div>
      <div class="cert-name">${apprenantNomComplet(a)}</div>
      <div class="cert-body">
        a suivi avec assiduité la formation en<br>
        <span class="cert-metier">${f? f.icon+' '+f.nom : '—'}</span><br>
        d'une durée de ${f?.duree || '—'}.
      </div>
      <div class="cert-footer">
        <div>Fait à Koutiala, le ${dateJour}</div>
        <div>Le Directeur</div>
      </div>
    </div>
    <button class="btn btn-outline btn-block no-print" style="margin-top:14px;" onclick="imprimerAttestation()">🖨️ Imprimer / Enregistrer en PDF</button>
  `;
}
function imprimerAttestation(){
  document.getElementById('tab-attestations').classList.add('printing');
  window.print();
  setTimeout(()=>document.getElementById('tab-attestations').classList.remove('printing'), 500);
}

/* ---------- 17. INIT ---------- */
window.addEventListener('DOMContentLoaded', async ()=>{
  await seedFilieresSiVide();
  ecouterCollections();
  updateFab();
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});

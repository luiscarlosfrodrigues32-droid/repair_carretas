import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, getDocs, updateDoc, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPj71cNYLGWlE6RV5LSCex-2TtZtm9nEs",
  authDomain: "recuperacao-carreta.firebaseapp.com",
  projectId: "recuperacao-carreta",
  storageBucket: "recuperacao-carreta.firebasestorage.app",
  messagingSenderId: "15350144088",
  appId: "1:15350144088:web:e7dad5b527742867213e2d",
  measurementId: "G-PZ7G84EWF9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentCompressor = 'F1GO';
let unsubscribe = null;
let editMode = { active: false, id: null };

const textFields = ['f-ra-dataInicio', 'f-ra-dataTermino', 'f-ra-carreta', 'f-ra-os', 'f-ra-executante', 'f-ra-observacao'];

window.toggleOutrosEspecificar = () => {
  const chkOutros = document.getElementById('chk-outros');
  const inputEspecificar = document.getElementById('f-ra-outros-especificar');
  if(chkOutros.checked) {
    inputEspecificar.classList.remove('d-none');
  } else {
    inputEspecificar.classList.add('d-none');
    inputEspecificar.value = "";
  }
};

window.toggleMaterialQty = (chkId, qtyId) => {
  const chk = document.getElementById(chkId);
  const qtyInput = document.getElementById(qtyId);
  if(chk.checked) {
    qtyInput.classList.remove('d-none');
  } else {
    qtyInput.classList.add('d-none');
    qtyInput.value = "";
  }
  if(chkId === 'mat-outros') {
    const espInput = document.getElementById('f-ra-mat-outros-especificar');
    if(chk.checked) espInput.classList.remove('d-none');
    else { espInput.classList.add('d-none'); espInput.value = ""; }
  }
};

window.switchTab = (id, label) => {
  currentCompressor = id;
  document.getElementById('current-tab-label').innerText = label;
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.classList.remove('active');
    if(btn.innerText === label) btn.classList.add('active');
  });
  cancelEdit();
  initSync();
};

// --- AUTENTICAÇÃO ---
document.getElementById('btn-login').addEventListener('click', () => {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  signInWithEmailAndPassword(auth, email, pass).catch(err => alert("Falha no login: " + err.message));
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-content').style.display = 'block';
    document.getElementById('user-display').innerText = user.email;
    initSync();
  } else {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('app-content').style.display = 'none';
  }
});

// --- SINCRONISMO EM TEMPO REAL ---
function initSync() {
  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, "registros_carretas"),
    where("compressorId", "==", currentCompressor)
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = "";

    const registros = [];
    snapshot.forEach(docSnap => {
      registros.push({ id: docSnap.id, ...docSnap.data() });
    });
    registros.sort((a, b) => b.timestamp - a.timestamp);

    registros.forEach(data => {
      const row = document.createElement('tr');
      const dataJson = encodeURIComponent(JSON.stringify(data));

      let servicosHTML = "";
      if (Array.isArray(data.servicos)) {
        data.servicos.forEach(s => {
          servicosHTML += `<span class="badge-service">${s}</span>`;
        });
      }

      let materiaisHTML = "";
      if (Array.isArray(data.materiais)) {
        data.materiais.forEach(m => {
          materiaisHTML += `<span class="badge-material">${m}</span>`;
        });
      }

      row.innerHTML = `
        <td>${formatDateBR(data.dataInicio)}</td>
        <td>${formatDateBR(data.dataTermino)}</td>
        <td><strong>${data.carreta}</strong></td>
        <td>${data.os || ""}</td>
        <td>${data.executante}</td>
        <td>${servicosHTML}</td>
        <td>${materiaisHTML || '<span class="text-muted small">Nenhum</span>'}</td>
        <td class="truncate" title="${data.observacao}">${data.observacao}</td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-secondary btn-sm" onclick="printItem('${dataJson}')" title="Imprimir Resumo">Imprimir</button>
            <button class="btn btn-primary btn-sm" onclick="prepareEdit('${data.id}', '${dataJson}')">Editar</button>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteItem('${data.id}')">Excluir</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }, (error) => {
    console.error("Erro no Firestore: ", error);
  });
}

// --- IMPRIMIR ITEM ESPECÍFICO ---
window.printItem = (dataJson) => {
  const data = JSON.parse(decodeURIComponent(dataJson));

  const printWindow = window.open('', '_blank', 'height=600,width=800');
  printWindow.document.write(`
    <html>
      <head>
        <title>Comprovante de Registro - Carreta ${data.carreta || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
          h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .info-group { margin-bottom: 15px; font-size: 16px; }
          .info-group strong { display: inline-block; width: 160px; color: #555; }
          .footer { margin-top: 40px; font-size: 12px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
      </head>
      <body>
        <h2>Relatório de Manutenção - Carretas: ${currentCompressor}</h2>
        <div class="info-group"><strong>Data de Término:</strong> ${formatDateBR(data.dataTermino)}</div>
        <div class="info-group"><strong>Carreta:</strong> ${data.carreta || ''}</div>
        <div class="info-group"><strong>O.S.:</strong> ${data.os || ''}</div>
        <div class="info-group"><strong>Executante:</strong> ${data.executante || ''}</div>
        <div class="footer">Impresso em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// --- SALVAR / ATUALIZAR ---
window.saveData = async () => {
  let payload = {
    timestamp: Date.now(),
    compressorId: currentCompressor
  };

  let hasError = false;

  textFields.forEach(id => {
    const el = document.getElementById(id);
    const val = el.value.trim();
    if(!val && id !== 'f-ra-observacao') {
      el.classList.add('is-invalid');
      hasError = true;
    } else {
      el.classList.remove('is-invalid');
      const key = id.replace('f-ra-', '');
      payload[key] = val;
    }
  });

  // Itens Verificados
  let servicosSelecionados = [];
  document.querySelectorAll('.chk-servico:checked').forEach(chk => {
    if(chk.value === "Outros") {
      const textOutros = document.getElementById('f-ra-outros-especificar').value.trim();
      if(textOutros) servicosSelecionados.push(`Outros: ${textOutros}`);
      else servicosSelecionados.push("Outros");
    } else {
      servicosSelecionados.push(chk.value);
    }
  });

  if(servicosSelecionados.length === 0) {
    alert("Por favor, marque pelo menos um Item a Ser Verificado!");
    return;
  }
  payload['servicos'] = servicosSelecionados;

  // Materiais Utilizados
  let materiaisSelecionados = [];
  const mapping = [
    { chk: 'mat-ossinho', qty: 'qty-ossinho', name: 'Ossinho' },
    { chk: 'mat-ossao', qty: 'qty-ossao', name: 'Ossão' },
    { chk: 'mat-rod_p', qty: 'qty-rod_p', name: 'Rodízio Pequeno' },
    { chk: 'mat-rod_g', qty: 'qty-rod_g', name: 'Rodízio Grande' },
    { chk: 'mat-mancal', qty: 'qty-mancal', name: 'Mancal de Plástico' },
    { chk: 'mat-lateral_r', qty: 'qty-lateral_r', name: 'Lateral reforçada' },
    { chk: 'mat-lateral_f', qty: 'qty-lateral_f', name: 'Lateral flágil' },
    { chk: 'mat-guia_e', qty: 'qty-guia_e', name: 'Guia esquerdo' },
    { chk: 'mat-guia_d', qty: 'qty-guia_d', name: 'Guia direito' },
    { chk: 'mat-polia', qty: 'qty-polia', name: 'Polia flap' },
    { chk: 'mat-m_art', qty: 'qty-m_art', name: 'Mancal articulações' },
    { chk: 'mat-engrenagem', qty: 'qty-engrenagem', name: 'Engrenagem branca' },
    { chk: 'mat-esteira', qty: 'qty-esteira', name: 'Esteira' },
    { chk: 'mat-outros', qty: 'qty-outros', name: 'Outros' }
  ];

  mapping.forEach(item => {
    const chkEl = document.getElementById(item.chk);
    if(chkEl && chkEl.checked) {
      const qtyVal = document.getElementById(item.qty).value.trim();
      let nomeMaterial = item.name;
      if(item.chk === 'mat-outros') {
        const espMat = document.getElementById('f-ra-mat-outros-especificar').value.trim();
        if(espMat) nomeMaterial = espMat;
      }
      if(qtyVal) {
        materiaisSelecionados.push(`${nomeMaterial} (Qtd: ${qtyVal})`);
      } else {
        materiaisSelecionados.push(nomeMaterial);
      }
    }
  });
  payload['materiais'] = materiaisSelecionados;

  if(hasError) return alert("Preencha os campos obrigatórios.");

  try {
    if(editMode.active) {
      await updateDoc(doc(db, "registros_carretas", editMode.id), payload);
      alert("Registro atualizado!");
      cancelEdit();
    } else {
      await addDoc(collection(db, "registros_carretas"), payload);
      textFields.forEach(id => { if(id !== 'f-ra-dataInicio' && id !== 'f-ra-dataTermino') document.getElementById(id).value = "" });
      resetCheckboxes();
      alert("Salvo com sucesso!");
    }
  } catch (e) { alert("Erro: " + e.message); }
};

// --- FUNÇÕES AUXILIARES ---
window.prepareEdit = (id, dataJson) => {
  const data = JSON.parse(decodeURIComponent(dataJson));
  editMode = { active: true, id: id };

  resetCheckboxes();

  textFields.forEach(id => {
    const key = id.replace('f-ra-', '');
    document.getElementById(id).value = data[key] || "";
    document.getElementById(id).classList.add('editing-mode');
  });

  // Carregar Serviços
  if (Array.isArray(data.servicos)) {
    data.servicos.forEach(s => {
      if(s.startsWith("Outros:")) {
        document.getElementById('chk-outros').checked = true;
        const inputEspecificar = document.getElementById('f-ra-outros-especificar');
        inputEspecificar.classList.remove('d-none');
        inputEspecificar.value = s.replace("Outros: ", "");
      } else {
        const chk = Array.from(document.querySelectorAll('.chk-servico')).find(c => c.value === s);
        if(chk) chk.checked = true;
      }
    });
  }

  // Carregar Materiais
  if (Array.isArray(data.materiais)) {
    data.materiais.forEach(m => {
      let nomeMat = m;
      let qtdMat = "";
      const match = m.match(/(.*) \(Qtd: (.*?)\)/);
      if (match) {
        nomeMat = match[1];
        qtdMat = match[2];
      }

      const mappingMap = {
        'Ossinho': { chk: 'mat-ossinho', qty: 'qty-ossinho' },
        'Ossão': { chk: 'mat-ossao', qty: 'qty-ossao' },
        'Rodízio Pequeno': { chk: 'mat-rod_p', qty: 'qty-rod_p' },
        'Rodízio Grande': { chk: 'mat-rod_g', qty: 'qty-rod_g' },
        'Mancal de Plástico': { chk: 'mat-mancal', qty: 'qty-mancal' },
        'Lateral reforçada': { chk: 'mat-lateral_r', qty: 'qty-lateral_r' },
        'Lateral flágil': { chk: 'mat-lateral_f', qty: 'qty-lateral_f' },
        'Guia esquerdo': { chk: 'mat-guia_e', qty: 'qty-guia_e' },
        'Guia direito': { chk: 'mat-guia_d', qty: 'qty-guia_d' },
        'Polia flap': { chk: 'mat-polia', qty: 'qty-polia' },
        'Mancal articulações': { chk: 'mat-m_art', qty: 'qty-m_art' },
        'Engrenagem branca': { chk: 'mat-engrenagem', qty: 'qty-engrenagem' },
        'Esteira': { chk: 'mat-esteira', qty: 'qty-esteira' }
      };

      if (mappingMap[nomeMat]) {
        const cfg = mappingMap[nomeMat];
        document.getElementById(cfg.chk).checked = true;
        const qInput = document.getElementById(cfg.qty);
        qInput.classList.remove('d-none');
        qInput.value = qtdMat;
      } else {
        document.getElementById('mat-outros').checked = true;
        document.getElementById('qty-outros').classList.remove('d-none');
        document.getElementById('qty-outros').value = qtdMat;
        const espInput = document.getElementById('f-ra-mat-outros-especificar');
        espInput.classList.remove('d-none');
        espInput.value = nomeMat;
      }
    });
  }

  document.getElementById('btn-save').innerText = "Atualizar Registro";
  document.getElementById('btn-cancel-edit').classList.remove('d-none');
};

window.cancelEdit = () => {
  editMode = { active: false, id: null };
  textFields.forEach(id => {
    document.getElementById(id).value = "";
    document.getElementById(id).classList.remove('editing-mode', 'is-invalid');
  });
  resetCheckboxes();
  document.getElementById('f-ra-dataInicio').value = getToday();
  document.getElementById('f-ra-dataTermino').value = getToday();
  document.getElementById('btn-save').innerText = "Salvar Registro";
  document.getElementById('btn-cancel-edit').classList.add('d-none');
};

function resetCheckboxes() {
  document.querySelectorAll('.chk-servico').forEach(c => c.checked = false);
  const inputEspecificar = document.getElementById('f-ra-outros-especificar');
  inputEspecificar.classList.add('d-none');
  inputEspecificar.value = "";

  document.querySelectorAll('.chk-material').forEach(c => c.checked = false);
  ['qty-ossinho', 'qty-ossao', 'qty-rod_p', 'qty-rod_g', 'qty-mancal', 'qty-lateral_r', 'qty-lateral_f', 'qty-guia_e', 'qty-guia_d', 'qty-polia', 'qty-m_art', 'qty-engrenagem', 'qty-esteira', 'qty-outros', 'f-ra-mat-outros-especificar'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      el.classList.add('d-none');
      el.value = "";
    }
  });
}

window.deleteItem = async (id) => {
  if(confirm("Deseja excluir este registro?")) {
    await deleteDoc(doc(db, "registros_carretas", id));
  }
};

window.searchTable = () => {
  const val = document.getElementById('search-input').value.toLowerCase();
  document.querySelectorAll('#table-body tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(val) ? "" : "none";
  });
};

window.exportCSV = async () => {
  const q = query(collection(db, "registros_carretas"), where("compressorId", "==", currentCompressor));
  const snap = await getDocs(q);
  let csv = "\uFEFFData Início;Data Término;Carreta;O.S;Executante;Itens Verificados;Materiais Utilizados;Observação\n";
  snap.forEach(d => {
    const v = d.data();
    const servs = Array.isArray(v.servicos) ? v.servicos.join(', ') : (v.servico || "");
    const mats = Array.isArray(v.materiais) ? v.materiais.join(', ') : (v.materiais || "");
    csv += `${v.dataInicio};${v.dataTermino};${v.carreta};${v.os || ""};${v.executante};"${servs}";"${mats}";"${v.observacao}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Relatorio_Carretas_${currentCompressor}.csv`;
  link.click();
};

function formatDateBR(dateStr) {
  if(!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

document.getElementById('f-ra-dataInicio').value = getToday();
document.getElementById('f-ra-dataTermino').value = getToday();
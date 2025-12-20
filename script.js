// ========================================
// Prescription App (multi-উপদেশ + disease-based suggestions)
// CSV REMOVED. Medicines now load from meds-data.js (global medsData: [{brand, form}, ...])
// ========================================

// Local storage keys
const STORAGE_KEY = 'prescriptions';
const DRAFT_KEY = 'draftPrescription';

// Shorthands
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

let nextId = Date.now();

/* ----------------------------------------
   MEDS DATA (from meds-data.js)
----------------------------------------- */
// Safety: allow the app to run even if meds-data.js isn't present
function ensureMedsData() {
  if (!Array.isArray(window.medsData)) {
    console.warn('medsData not found. Create meds-data.js that defines: const medsData = [{ brand, form }, ...];');
    window.medsData = [];
  }
  // Normalize & build quick index
  window._medsIndex = (window.medsData || []).map((m, i) => ({
    i,
    brand: String(m.brand || '').trim(),
    form: String(m.form || '').trim(),
    label: `${String(m.brand || '').trim()} - ${String(m.form || '').trim()}`
  }));
}

/* ----------------------------------------
   Boot
----------------------------------------- */
function init() {
  ensureMedsData();

  const dateEl = $('#date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  addDiseaseEntry();
  // create first উপদেশ box
  addAdviceRow();

  loadDraft();
  setupEventListeners();
  initSectionsMenu();
  initHistoryDropdowns();
  loadDiseaseOptions();

  // Provisional Diagnosis: dynamic rows from the Examination select
  const examSelect = $('#examinationSelect');
  if (examSelect) {
    examSelect.addEventListener('change', (e) => {
      const label = e.target.value;
      if (!label) return;

      // Prevent duplicates
      if ([...document.querySelectorAll('.prov-diag')].some(i => i.dataset.label === label)) {
        e.target.value = '';
        return;
      }

      const container = $('#provisionalDiagnosisContainer');
      if (!container) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'diag-row';

      const inputLabel = document.createElement('label');
      inputLabel.textContent = label;

      const inputBox = document.createElement('input');
      inputBox.type = 'text';
      inputBox.className = 'input prov-diag';
      inputBox.dataset.label = label;

      wrapper.appendChild(inputLabel);
      wrapper.appendChild(inputBox);
      container.appendChild(wrapper);

      e.target.value = '';
    });
  }
}

/* ----------------------------------------
   Event listeners
----------------------------------------- */
function setupEventListeners() {
  $('#btn-portal')?.addEventListener('click', () => (location.href = 'index.html'));
  $('#btn-save')?.addEventListener('click', () => savePrescription(false));
  $('#btn-save-print')?.addEventListener('click', () => savePrescription(true));
  $('#btn-clear')?.addEventListener('click', clearForm);
  $('#btn-add-disease')?.addEventListener('click', () => addDiseaseEntry());
  $('#btn-add-med')?.addEventListener('click', () => addMedRow());
  $('#btn-add-test')?.addEventListener('click', () => addTestRow());
  $('#btn-add-advice')?.addEventListener('click', () => addAdviceRow());

  // ✅ bind peek once, and stop propagation so the global click handler doesn’t instantly close it
  const btnPeek = $('#btn-peek');
  if (btnPeek) {
    btnPeek.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePeek();
    });
  }

  // Inputs that affect suggestions
  $('#patientName')?.addEventListener('input', () => {
    updateSuggestions();              // meds suggestions
    updateTestSuggestionsByDisease(); // test suggestions
    refreshOpenAdvicePanels();        // refresh any open উপদেশ suggestion panels
  });

  // Close peek when clicking outside (safe null-guards + contains check)
  document.addEventListener('click', (e) => {
    const pop = $('#peek-pop');
    const btn = $('#btn-peek');
    if (!pop || !btn) return;
    if (pop.classList.contains('show') && !pop.contains(e.target) && !btn.contains(e.target)) {
      hidePeek();
    }
  });

  // ✅ Close any open উপদেশ suggestion when clicking outside its row
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.advice-row .suggest.dx.show').forEach(p => {
      const row = p.closest('.advice-row');
      const inside = row && row.contains(e.target);
      if (!inside) p.classList.remove('show');
    });
  });
}

/* ----------------------------------------
   Disease entries
----------------------------------------- */
function addDiseaseEntry(name = '', days = '') {
  const container = $('#diseases-container');
  if (!container) return;

  const entry = document.createElement('div');
  entry.className = 'disease-entry';
  entry.innerHTML = `
    <div class="disease-input-group">
      <label>Disease Name</label>
      <input type="text" class="disease-name" placeholder="e.g., Hypertension" value="${escapeHtml(name)}" list="diseaseList">
    </div>
    <div class="disease-input-group">
      <label>Days Suffering</label>
      <input type="number" class="disease-days" placeholder="7" min="0" value="${days}" style="width:100px;">
    </div>
    <button type="button" class="icon-btn" title="Remove disease">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>`;

  container.appendChild(entry);

  entry.querySelector('.icon-btn')?.addEventListener('click', () => removeDiseaseEntry(entry));

  const onChange = () => {
    updateSuggestions();
    updateTestSuggestionsByDisease();
    refreshOpenAdvicePanels();
  };

  entry.querySelector('.disease-name')?.addEventListener('input', onChange);
  entry.querySelector('.disease-days')?.addEventListener('input', onChange);

  updateSuggestions();
}

function removeDiseaseEntry(entryEl) {
  entryEl.remove();
  updateSuggestions();
  updateTestSuggestionsByDisease();
  refreshOpenAdvicePanels();
}

function getDiseases() {
  return $$('.disease-entry')
    .map(entry => {
      const name = entry.querySelector('.disease-name')?.value.trim() || '';
      const days = parseInt(entry.querySelector('.disease-days')?.value) || 0;
      return name ? { name, days } : null;
    })
    .filter(Boolean);
}

/* ----------------------------------------
   Multi উপদেশ (Advice) inputs
----------------------------------------- */
let activeAdviceInput = null;

function addAdviceRow(value = '') {
  const cont = document.getElementById('advice-container');
  if (!cont) return;

  const row = document.createElement('div');
  row.className = 'advice-row';
  row.style.marginBottom = '10px';

  row.innerHTML = `
    <div style="display:grid; gap:6px;">
      <div style="display:flex; gap:8px; align-items:center;">
        <input type="text" class="advice-input" placeholder="উপদেশ লিখুন…" value="${escapeHtml(value)}" style="flex:1;">
        <button type="button" class="btn mini btn-advice-suggest" title="Suggest from history">Suggest</button>
        <button type="button" class="icon-btn btn-advice-remove" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="suggest dx"></div>
    </div>
  `;

  cont.appendChild(row);

  const input = row.querySelector('.advice-input');
  const btnSuggest = row.querySelector('.btn-advice-suggest');
  const btnRemove = row.querySelector('.btn-advice-remove');
  const panel = row.querySelector('.suggest.dx');

  input.addEventListener('focus', () => (activeAdviceInput = input));
  input.addEventListener('input', () => {
    // live-filter by what's typed in this box
    updateAdviceSuggestionsForPanel(panel);
  });

  btnSuggest.addEventListener('click', (e) => {
    e.stopPropagation();
    activeAdviceInput = input;
    toggleAdviceSuggest(panel);
  });

  btnRemove.addEventListener('click', () => {
    row.remove();
  });

  // Optionally auto-open suggestions for the newly added box:
  // toggleAdviceSuggest(panel);
}

function showAdviceSuggest(panel) {
  updateAdviceSuggestionsForPanel(panel);
  if (panel && !panel.classList.contains('show') && panel.children.length) {
    panel.classList.add('show');
  }
}
function hideAdviceSuggest(panel) {
  if (panel) panel.classList.remove('show');
}
function toggleAdviceSuggest(panel) {
  if (!panel) return;
  panel.classList.contains('show') ? hideAdviceSuggest(panel) : showAdviceSuggest(panel);
}

function refreshOpenAdvicePanels() {
  document.querySelectorAll('.advice-row .suggest.dx.show').forEach(panel => {
    updateAdviceSuggestionsForPanel(panel);
  });
}

function updateAdviceSuggestionsForPanel(panel) {
  if (!panel) return;
  panel.classList.remove('show');
  panel.innerHTML = '';

  // diseases come solely from the current form (not patient-specific)
  const diseases = getDiseases().map(d => d.name.trim()).filter(Boolean);
  if (!diseases.length) return;

  const all = loadAll();
  if (!all.length) return;

  const { singles, combos } = buildDiseaseCombos(diseases);
  const typing = (activeAdviceInput?.value || '').trim().toLowerCase();

  // Single-disease buckets
  singles.forEach(([one]) => {
    const matches = all.filter(p =>
      (p.diseases || []).some(d => (d.name || '').toLowerCase() === one.toLowerCase())
    );
    const top = summarizeDiagnoses(matches, 12); // uses p.diagnosis across history
    const filtered = typing ? top.filter(t => t.text.toLowerCase().includes(typing)) : top;

    if (filtered.length) {
      const opts = filtered.map(item => ({
        value: item.text,
        text: item.text,
        subtext: ` (used ${item.count}×)`,
      }));
      const dd = makeSuggestDropdown({
        label: `উপদেশ (for “${one}”)`,
        placeholder: 'Pick…',
        options: opts,
        onChoose: v => {
          if (activeAdviceInput) activeAdviceInput.value = v;
          showToast('উপদেশ যোগ হয়েছে');
        },
      });
      panel.appendChild(dd);
    }
  });

  // Combo buckets
  combos.forEach(arr => {
    const label = arr.join(' + ');
    const matches = all.filter(p => {
      const ds = (p.diseases || []).map(x => (x.name || '').toLowerCase());
      return arr.every(d => ds.includes(d.toLowerCase()));
    });
    const top = summarizeDiagnoses(matches, 12);
    const filtered = typing ? top.filter(t => t.text.toLowerCase().includes(typing)) : top;

    if (filtered.length) {
      const opts = filtered.map(item => ({
        value: item.text,
        text: item.text,
        subtext: ` (used ${item.count}×)`,
      }));
      const dd = makeSuggestDropdown({
        label: `উপদেশ (combo: ${label})`,
        placeholder: 'Pick…',
        options: opts,
        onChoose: v => {
          if (activeAdviceInput) activeAdviceInput.value = v;
          showToast('উপদেশ যোগ হয়েছে');
        },
      });
      panel.appendChild(dd);
    }
  });

  if (panel.children.length) panel.classList.add('show');
}

/* ----------------------------------------
   Medications (CSV logic removed)
   Autocomplete from medsData [{brand, form}]
----------------------------------------- */
function addMedRow(name = '', dosage = '', freq = '', duration = '') {
  const tbody = $('#meds-tbody');
  if (!tbody) return;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>
      <div class="auto-wrap" style="position:relative;">
        <input type="text" class="med-name" placeholder="Brand - Form" value="${escapeHtml(name)}" autocomplete="off" aria-autocomplete="list" aria-expanded="false">
        <div class="med-suggest" role="listbox" style="position:absolute;left:0;right:0;z-index:20;background:var(--card, #fff);border:1px solid var(--border,#dcdcdc);display:none;max-height:240px;overflow:auto;border-top:none"></div>
      </div>
    </td>
    <td><input type="text" class="med-dosage" placeholder="e.g., 500mg or 1 tab" value="${escapeHtml(dosage)}"></td>
    <td><input type="text" class="med-freq" placeholder="e.g., 1+1+1 / After food" value="${escapeHtml(freq)}"></td>
    <td><input type="text" class="med-duration" placeholder="e.g., 7 days" value="${escapeHtml(duration)}" style="min-width:160px;"></td>
    <td>
      <button type="button" class="icon-btn" title="Remove medication">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </td>`;

  row.querySelector('.icon-btn')?.addEventListener('click', () => removeMedRow(row));
  tbody.appendChild(row);

  // 🔌 attach autocomplete to this row's medicine input (using medsData)
  wireMedAutocomplete(row);
}

function removeMedRow(row) {
  row.remove();
}

/* ---------- Autocomplete core (medsData) ---------- */
function wireMedAutocomplete(row) {
  const input = row.querySelector('.med-name');
  const _hostPanel = row.querySelector('.med-suggest'); // ignore in-row panel (kept for semantics)
  if (!input) return;

  // Floating panel attached to <body>
  const panel = document.createElement('div');
  panel.className = 'med-suggest';
  panel.setAttribute('role','listbox');
  panel.style.cssText = [
'position:fixed',
  'left:0',
  'top:0',
  'z-index:9999',
  'display:none',
  'max-height:280px',
  'overflow:auto',
  'background:#fff',                     // ✅ white background
  'color:#000',                          // ✅ black text
  'border:1px solid rgba(0,0,0,.2)',     // ✅ subtle gray border
  'border-top:none',
  'box-shadow:0 6px 20px rgba(0,0,0,.2)',
  'border-radius:10px'
].join(';');

  document.body.appendChild(panel);

  let activeIndex = -1;
  let items = [];
  let open = false;

  const positionPanel = () => {
    const r = input.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top  = (r.bottom + 4) + 'px';
    panel.style.width = r.width + 'px';
  };

  const openPanel = () => {
    if (panel.children.length === 0) return;
    positionPanel();
    panel.style.display = 'block';
    input.setAttribute('aria-expanded','true');
    open = true;
  };

  const closePanel = () => {
    panel.style.display = 'none';
    input.setAttribute('aria-expanded','false');
    panel.innerHTML = '';
    activeIndex = -1;
    open = false;
  };

  const commit = (label) => {
    input.value = label;
    closePanel();
    row.querySelector('.med-dosage')?.focus();
  };

  const setActive = (idx) => {
    const children = Array.from(panel.children);
    children.forEach(c => c.style.background = '');
    activeIndex = idx;
    if (idx >= 0 && children[idx]) {
      children[idx].style.background = 'color-mix(in oklab, var(--accent) 16%, transparent)';
      children[idx].scrollIntoView({ block: 'nearest' });
    }
  };

  const render = (list) => {
    panel.innerHTML = '';
    if (!list.length) { closePanel(); return; }
    list.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.role = 'option';
      btn.className = 'menu-item';
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:8px 10px;background:none;border:none;cursor:pointer';
      btn.textContent = it.label;
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); commit(it.label); });
      btn.addEventListener('mouseenter', () => setActive(idx));
      panel.appendChild(btn);
    });
    openPanel();
  };

  const doFilter = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { closePanel(); return; }
    items = window._medsIndex
      .filter(m =>
        m.brand.toLowerCase().includes(q) ||
        m.form.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q)
      )
      .slice(0, 50);
    render(items);
  };

  input.addEventListener('input', doFilter);
  input.addEventListener('focus', doFilter);

  input.addEventListener('keydown', (e) => {
    const count = panel.children.length;
    if (!count) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(count - 1, activeIndex + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, activeIndex - 1)); }
    else if (e.key === 'Enter')   { if (activeIndex >= 0 && items[activeIndex]) { e.preventDefault(); commit(items[activeIndex].label); } }
    else if (e.key === 'Escape')  { closePanel(); }
  });

  // close on outside click
  document.addEventListener('click', (ev) => {
    if (open && !panel.contains(ev.target) && !row.contains(ev.target)) closePanel();
  });

  // keep it anchored while scrolling / resizing
  ['scroll','resize'].forEach(evt => window.addEventListener(evt, () => { if (open) positionPanel(); }, { passive:true }));
}

/* ----------------------------------------
   Tests
----------------------------------------- */
function addTestRow(name = '', notes = '') {
  const tbody = $('#tests-tbody');
  if (!tbody) return;

  const row = document.createElement('tr');
  row.innerHTML = `
    <td><input type="text" placeholder="Test name" value="${escapeHtml(name)}"></td>
    <td><input type="text" placeholder="Instructions or notes" value="${escapeHtml(notes)}"></td>
    <td>
      <button type="button" class="icon-btn" title="Remove test">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </td>`;

  row.querySelector('.icon-btn')?.addEventListener('click', () => removeTestRow(row));
  tbody.appendChild(row);
}

function removeTestRow(row) {
  row.remove();
}

/* ----------------------------------------
   Collect + Save
----------------------------------------- */
function collectFormData() {
  const diseases = getDiseases();
  const followUpSel = ($('#followUp')?.value || '').trim();
  const followUpCustom = ($('#customFollowUp')?.value || '').trim();
  const followUpDays = followUpCustom || followUpSel || '';

  const meds = $$('#meds-tbody tr')
    .map(row => {
      const [name, dosage, freq, duration] = $$('input', row);
      return {
        name: (name?.value || '').trim(),
        dosage: (dosage?.value || '').trim(),
        freq: (freq?.value || '').trim(),
        duration: (duration?.value || '').trim(),
      };
    })
    .filter(m => m.name);

  const tests = $$('#tests-tbody tr')
    .map(row => {
      const [name, notes] = $$('input', row);
      return {
        name: (name?.value || '').trim(),
        notes: (notes?.value || '').trim(),
      };
    })
    .filter(t => t.name);

  return {
    id: nextId++,
    patientName: $('#patientName')?.value.trim() || '',
    age: $('#age')?.value.trim() || '',
    sex: $('#sex')?.value || '',
    date: $('#date')?.value || '',
    diseases,
    // Save all উপদেশ boxes joined into the legacy 'diagnosis' field for backward compatibility
    diagnosis: $$('.advice-input').map(i => (i.value || '').trim()).filter(Boolean).join('; '),
    meds,
    tests,
    notes: $('#notes')?.value.trim() || '',
    histories: getHistoriesFromForm(),
    printOptions: getSelectedSectionFlags(),
    bp: $('#bp')?.value.trim() || '',
    weight: $('#weight')?.value.trim() || '',
    followUpDays,
    createdAt: new Date().toISOString(),
    provisionalDiagnosis: getProvisionalDiagnosis(),
  };
}

function savePrescription(andPrint) {
  const data = collectFormData();

  if (!data.patientName) {
    alert('Patient name is required');
    $('#patientName')?.focus();
    return;
  }
  if (!data.diseases.length) {
    alert('At least one disease is required');
    return;
  }

  const all = loadAll();
  all.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  localStorage.removeItem(DRAFT_KEY);
  showToast('Prescription saved!');

  if (andPrint) {
    setTimeout(() => {
      localStorage.setItem('printPrescription', JSON.stringify(data));
      location.href = 'print-prescription.html';
    }, 500);
  }
}

/* ----------------------------------------
   Clear + Draft load
----------------------------------------- */
function clearForm() {
  if (!confirm('Clear all form data?')) return;

  $('#prescriptionForm')?.reset();
  const dateEl = $('#date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  $('#diseases-container') && ($('#diseases-container').innerHTML = '');
  $('#meds-tbody') && ($('#meds-tbody').innerHTML = '');
  $('#tests-tbody') && ($('#tests-tbody').innerHTML = '');
  if ($('#bp')) $('#bp').value = '';
  if ($('#weight')) $('#weight').value = '';

  // reset advice boxes
  const ac = document.getElementById('advice-container');
  if (ac) ac.innerHTML = '';
  addAdviceRow();

  addDiseaseEntry();
  setHistoriesToForm({});
  setSelectedSectionFlags({});
  hideSuggestions();
  updateTestSuggestionsByDisease();
  localStorage.removeItem(DRAFT_KEY);
}

function loadDraft() {
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) return;
    const data = JSON.parse(draft);

    // Basic fields
    if ($('#patientName')) $('#patientName').value = data.patientName || '';
    if ($('#age'))         $('#age').value         = data.age || '';
    if ($('#sex'))         $('#sex').value         = data.sex || '';
    if ($('#date'))        $('#date').value        = data.date || '';
    if ($('#notes'))       $('#notes').value       = data.notes || '';
    if ($('#bp'))          $('#bp').value          = data.bp || '';
    if ($('#weight'))      $('#weight').value      = data.weight || '';

    // Follow-up preset vs custom
    const presets = ['3','5','7','10','14'];
    const val = (data.followUpDays || '').toString().trim();
    if (presets.includes(val)) {
      if ($('#followUp'))       $('#followUp').value = val;
      if ($('#customFollowUp')) $('#customFollowUp').value = '';
    } else {
      if ($('#followUp'))       $('#followUp').value = '';
      if ($('#customFollowUp')) $('#customFollowUp').value = val;
    }

    // Histories + section flags
    setHistoriesToForm(data.histories || {});
    setSelectedSectionFlags(data.printOptions || {});

    // Diseases
    const dc = $('#diseases-container');
    if (dc) dc.innerHTML = '';
    if (Array.isArray(data.diseases) && data.diseases.length) {
      data.diseases.forEach(d => addDiseaseEntry(d.name, d.days));
    } else {
      addDiseaseEntry();
    }

    // Meds / Tests
    if (Array.isArray(data.meds)) {
      data.meds.forEach(m => addMedRow(m.name, m.dosage, m.freq, m.duration));
    }
    if (Array.isArray(data.tests)) {
      data.tests.forEach(t => addTestRow(t.name, t.notes));
    }

    // উপদেশ boxes (stored in legacy 'diagnosis' as semicolon list)
    const ac = document.getElementById('advice-container');
    if (ac) ac.innerHTML = '';
    const dxRaw = (data.diagnosis || '').trim();
    if (dxRaw) {
      dxRaw.split(';').map(s => s.trim()).filter(Boolean).forEach(v => addAdviceRow(v));
    } else {
      addAdviceRow();
    }

    // 🔁 Rebuild "Add Examination Findings" (provisional) dynamic inputs
    const provWrap = document.getElementById('provisionalDiagnosisContainer');
    if (provWrap) provWrap.innerHTML = '';
    setProvisionalDiagnosis(data.provisionalDiagnosis || '');

    // Cleanup + refresh suggestion UIs
    localStorage.removeItem(DRAFT_KEY);
    showToast('Draft loaded');
    updateSuggestions();
    updateTestSuggestionsByDisease();
    refreshOpenAdvicePanels?.();
  } catch (e) {
    console.warn('Failed to load draft:', e);
  }
}

/* ----------------------------------------
   Local storage utils
----------------------------------------- */
function loadAll() {
  try {
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/* ----------------------------------------
   Datalist for known diseases
----------------------------------------- */
function loadDiseaseOptions() {
  const all = loadAll();
  const diseases = new Set();
  all.forEach(p => {
    if (Array.isArray(p.diseases)) {
      p.diseases.forEach(d => { if (d.name) diseases.add(d.name.trim()); });
    } else if (p.disease) {
      diseases.add(p.disease.trim()); // legacy
    }
  });
  const datalist = $('#diseaseList') || createDatalist();
  datalist.innerHTML = [...diseases].sort().map(d => `<option value="${escapeHtml(d)}">`).join('');
}
function createDatalist() {
  const dl = document.createElement('datalist');
  dl.id = 'diseaseList';
  document.body.appendChild(dl);
  return dl;
}

/* ----------------------------------------
   Peek panel
----------------------------------------- */
function showPeek() {
  const all = loadAll();
  const name = ($('#patientName')?.value || '').trim().toLowerCase();
  if (!name || !all.length) return;

  const matches = all.filter(p => (p.patientName || '').toLowerCase().includes(name)).slice(0, 5);
  if (!matches.length) return;

  const list = $('#peek-list');
  const pop = $('#peek-pop');
  const btn = $('#btn-peek');
  if (!list || !pop || !btn) return;

  list.innerHTML = matches
    .map(p => {
      const ds = p.diseases || (p.disease ? [{ name: p.disease, days: 0 }] : []);
      return `
        <div class="peek-card">
          <strong>${escapeHtml(p.patientName)} • ${new Date(p.date || p.createdAt).toLocaleDateString()}</strong>
          ${renderDiseases(ds)}
          ${p.diagnosis ? `<div class="muted">Dx: ${escapeHtml(p.diagnosis)}</div>` : ''}
          ${renderMedPills(p.meds || [])}
        </div>`;
    })
    .join('');

  pop.classList.add('show');
  const rect = btn.getBoundingClientRect();
  pop.style.left = `${rect.left}px`;
  pop.style.top = `${rect.bottom + 8}px`;
}
function hidePeek() {
  $('#peek-pop')?.classList.remove('show');
}
function togglePeek() {
  const pop = $('#peek-pop');
  if (!pop) return;
  pop.classList.contains('show') ? hidePeek() : showPeek();
}

/* ----------------------------------------
   Suggestion dropdown factory
----------------------------------------- */
function makeSuggestDropdown({ label, placeholder = '— Select —', options = [], onChoose }) {
  const wrap = document.createElement('div');
  wrap.className = 'suggest show';
  wrap.innerHTML = `
    <div class="head"><span>${escapeHtml(label)}</span></div>
    <div><select class="mini" style="width:100%">
      <option value="">${escapeHtml(placeholder)}</option>
    </select></div>`;
  const sel = wrap.querySelector('select');

  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.text + (opt.subtext ? ` ${opt.subtext}` : '');
    sel.appendChild(o);
  });

  sel.addEventListener('change', () => {
    if (!sel.value) return;
    onChoose?.(sel.value, sel);
    sel.value = '';
  });

  return wrap;
}

/* ----------------------------------------
   Suggestions (Meds / Tests) using past data
----------------------------------------- */
function updateSuggestions() {
  const names = getDiseases().map(d => d.name.trim()).filter(Boolean);
  if (!names.length) return;

  const all = loadAll();
  if (!Array.isArray(all) || !all.length) return;

  const lowerNames = names.map(n => n.toLowerCase());

  $$('.disease-entry').forEach((entry, idx) => {
    entry.querySelectorAll('.suggest').forEach(el => el.remove());
    const thisName = entry.querySelector('.disease-name')?.value.trim();
    if (!thisName) return;

    // Per-disease med suggestions
    const single = summarizeMeds(
      all.filter(p => (p.diseases || []).some(d => (d.name || '').toLowerCase() === thisName.toLowerCase())),
      10
    );
    if (single.length) {
      const opts = single.map(m => ({
        value: JSON.stringify(m),
        text: `${m.name} ${m.dosage || ''}`.trim(),
        subtext: `(used ${m.count}×)`,
      }));
      const dd = makeSuggestDropdown({
        label: `Suggestions for “${thisName}”`,
        placeholder: 'Add medicine…',
        options: opts,
        onChoose: v => {
          const med = JSON.parse(v);
          addMedRow(med.name, med.dosage, med.freq, med.duration);
          showToast(`Added: ${med.name}`);
        },
      });
      entry.appendChild(dd);
    }

    // Combo suggestions (cumulative up to this index)
    if (idx > 0) {
      const comboSlice = lowerNames.slice(0, idx + 1);
      const comboMeds = summarizeMeds(
        all.filter(p => {
          const ds = (p.diseases || []).map(x => (x.name || '').toLowerCase());
          return comboSlice.every(d => ds.includes(d));
        }),
        10
      );
      if (comboMeds.length) {
        const opts = comboMeds.map(m => ({
          value: JSON.stringify(m),
          text: `${m.name} ${m.dosage || ''}`.trim(),
          subtext: `(used ${m.count}×)`,
        }));
        const dd = makeSuggestDropdown({
          label: `Combo: ${names.slice(0, idx + 1).join(' + ')}`,
          placeholder: 'Add combo-based medicine…',
          options: opts,
          onChoose: v => {
            const med = JSON.parse(v);
            addMedRow(med.name, med.dosage, med.freq, med.duration);
            showToast(`Added: ${med.name}`);
          },
        });
        entry.appendChild(dd);
      }
    }
  });
}

function summarizeMeds(prescriptions, limit = 6) {
  const map = new Map();
  prescriptions.forEach(p => {
    const ds = (p.diseases || []).map(d => (d.name || '').toLowerCase());
    (p.meds || []).forEach(m => {
      const key = (m.name || '').toLowerCase().trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { ...m, count: 0, forDiseases: new Set() });
      }
      const entry = map.get(key);
      entry.count++;
      ds.forEach(d => entry.forDiseases.add(d));
    });
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function updateTestSuggestionsByDisease() {
  const entries = $$('.disease-entry');
  const all = loadAll();
  if (!Array.isArray(all) || !all.length) return;

  const names = getDiseases().map(d => d.name.trim()).filter(Boolean);
  const lowerNames = names.map(n => n.toLowerCase());

  entries.forEach((entry, idx) => {
    entry.querySelectorAll('.suggest.test-suggest').forEach(el => el.remove());
    const thisName = entry.querySelector('.disease-name')?.value.trim();
    if (!thisName) return;

    // single disease tests
    const singleTests = summarizeTests(
      all.filter(p => (p.diseases || []).some(d => (d.name || '').toLowerCase() === thisName.toLowerCase())),
      10
    );
    if (singleTests.length) {
      const opts = singleTests.map(t => ({
        value: JSON.stringify(t),
        text: t.name,
        subtext: t.notes ? `(${t.notes})` : '',
      }));
      const dd = makeSuggestDropdown({
        label: `Test suggestions for “${thisName}”`,
        placeholder: 'Add test…',
        options: opts,
        onChoose: v => {
          const t = JSON.parse(v);
          addTestRow(t.name, t.notes || '');
          showToast(`Added test: ${t.name}`);
        },
      });
      dd.classList.add('test-suggest');
      entry.appendChild(dd);
    }

    // combo tests
    if (idx > 0) {
      const comboSlice = lowerNames.slice(0, idx + 1);
      const comboTests = summarizeTests(
        all.filter(p => {
          const ds = (p.diseases || []).map(x => (x.name || '').toLowerCase());
          return comboSlice.every(d => ds.includes(d));
        }),
        10
      );

      if (comboTests.length) {
        const opts = comboTests.map(t => ({
          value: JSON.stringify(t),
          text: t.name,
          subtext: t.notes ? `(${t.notes})` : '',
        }));
        const dd = makeSuggestDropdown({
          label: `Combo tests: ${names.slice(0, idx + 1).join(' + ')}`,
          placeholder: 'Add combo-based test…',
          options: opts,
          onChoose: v => {
            const t = JSON.parse(v);
            addTestRow(t.name, t.notes || '');
            showToast(`Added test: ${t.name}`);
          },
        });
        dd.classList.add('test-suggest');
        entry.appendChild(dd);
      }
    }
  });
}

function summarizeTests(prescriptions, limit = 6) {
  const map = new Map();
  const notesMap = new Map();
  prescriptions.forEach(p => {
    (p.tests || []).forEach(t => {
      const name = (t.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name, count: 0, notes: '' });
        notesMap.set(key, new Map());
      }
      const agg = map.get(key);
      agg.count++;
      const nm = notesMap.get(key);
      const note = (t.notes || '').trim();
      if (note) nm.set(note, (nm.get(note) || 0) + 1);
    });
  });
  map.forEach((agg, key) => {
    const nm = notesMap.get(key);
    if (nm && nm.size) {
      agg.notes = Array.from(nm.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/* ----------------------------------------
   Diagnosis (উপদেশ) aggregation helpers
----------------------------------------- */
function buildDiseaseCombos(names) {
  const clean = names.map(s => s.trim()).filter(Boolean);
  const singles = clean.map(n => [n]);
  const combos = [];
  for (let i = 1; i < clean.length; i++) combos.push(clean.slice(0, i + 1));
  return { singles, combos };
}

function summarizeDiagnoses(prescriptions, limit = 6) {
  const map = new Map();
  prescriptions.forEach(p => {
    const dx = (p.diagnosis || '').trim();
    if (!dx) return;
    // allow semicolon-separated multi-উপদেশ in history
    dx.split(';').map(s => s.trim()).filter(Boolean).forEach(one => {
      const key = one.toLowerCase();
      map.set(key, map.has(key) ? { text: one, count: map.get(key).count + 1 } : { text: one, count: 1 });
    });
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/* ----------------------------------------
   Sections & Histories
----------------------------------------- */
const SECTION_KEYS = [
  { key: 'pastIllness', label: 'Past Illness' },
  { key: 'birthHistory', label: 'Birth History' },
  { key: 'feedingHistory', label: 'Feeding History' },
  { key: 'developmentHistory', label: 'Development History' },
  { key: 'treatmentHistory', label: 'Treatment History' },
  { key: 'familyHistory', label: 'Family History' },
];

function initSectionsMenu() {
  const menu = $('#menu-sections');
  if (!menu) return;
  menu.innerHTML = `
    <div class="hint">Select which sections to include in the prescription/print.</div>
    ${SECTION_KEYS.map(s => `
      <div class="row" data-key="${s.key}">
        <input type="checkbox" id="sec-${s.key}">
        <label for="sec-${s.key}" style="cursor:pointer">${s.label}</label>
      </div>`).join('')}
  `;

  $('#btn-sections')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== $('#btn-sections')) {
      menu.classList.remove('show');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.classList.remove('show');
  });

  SECTION_KEYS.forEach(s => {
    const cb = $(`#sec-${s.key}`);
    cb?.addEventListener('change', () => {
      const card = $(`#opt-${s.key}`);
      if (card) {
        card.style.boxShadow = cb.checked
          ? 'inset 0 0 0 2px color-mix(in oklab,var(--accent) 45%, transparent)'
          : '';
      }
    });
  });
}

function getSelectedSectionFlags() {
  const flags = {};
  SECTION_KEYS.forEach(s => {
    flags[s.key] = !!$(`#sec-${s.key}`)?.checked;
  });
  return flags;
}

function setSelectedSectionFlags(flags = {}) {
  SECTION_KEYS.forEach(s => {
    const cb = $(`#sec-${s.key}`);
    if (cb) {
      cb.checked = !!flags[s.key];
      const card = $(`#opt-${s.key}`);
      if (card) {
        card.style.boxShadow = cb.checked
          ? 'inset 0 0 0 2px color-mix(in oklab,var(--accent) 45%, transparent)'
          : '';
      }
    }
  });
}

/* ----------------------------------------
   Histories
----------------------------------------- */
function getHistoriesFromForm() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  return {
    pastIllness: v('pastIllness'),
    birthHistory: v('birthHistory'),
    feedingHistory: v('feedingHistory'),
    developmentHistory: v('developmentHistory'),
    treatmentHistory: v('treatmentHistory'),
    familyHistory: v('familyHistory'),
  };
}
function setHistoriesToForm(hist = {}) {
  SECTION_KEYS.forEach(s => {
    const ta = document.getElementById(s.key);
    if (ta && hist[s.key]) ta.value = hist[s.key];
  });
}

const HISTORY_PRESETS = {
  pastIllness: ['Hypertension', 'Diabetes Mellitus', 'Asthma', 'COPD', 'Tuberculosis (treated)', 'Ischemic Heart Disease', 'CKD', 'Hypothyroidism', 'Hyperthyroidism', 'Peptic Ulcer Disease', 'Hepatitis B', 'Hepatitis C'],
  birthHistory: ['Term', 'Preterm', 'Normal vaginal delivery', 'Cesarean section', 'Birth asphyxia', 'NICU admission', 'Jaundice', 'Low birth weight'],
  feedingHistory: ['Exclusive breastfeeding', 'Mixed feeding', 'Formula fed', 'Weaning started at 6 months', 'Picky eater', 'Adequate diet'],
  developmentHistory: ['Milestones appropriate for age', 'Speech delay', 'Motor delay', 'Learning difficulty', 'Behavioral concerns'],
  treatmentHistory: ['No long-term medications', 'On antihypertensives', 'On insulin', 'Previous surgery', 'Repeated hospitalizations'],
  familyHistory: ['Hypertension', 'Diabetes', 'Asthma', 'Thyroid disease', 'Heart disease', 'Stroke', 'Cancer'],
};

function bindHistorySelect(key) {
  const sel = $(`#sel-${key}`);
  const ta = $(`#${key}`);
  if (!sel || !ta) return;

  sel.innerHTML = '';
  (HISTORY_PRESETS[key] || []).forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    const chosen = Array.from(sel.selectedOptions).map(o => o.value);
    const free = ta.value
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !chosen.includes(s) && !(HISTORY_PRESETS[key] || []).includes(s));
    ta.value = [...chosen, ...free].join('; ');
  });

  ta.addEventListener('input', () => {
    const parts = ta.value.split(';').map(s => s.trim()).filter(Boolean);
    Array.from(sel.options).forEach(opt => {
      opt.selected = parts.includes(opt.value);
    });
  });
}

function initHistoryDropdowns() {
  SECTION_KEYS.forEach(s => bindHistorySelect(s.key));
}

/* ----------------------------------------
   Render helpers & utilities
----------------------------------------- */
function renderDiseases(diseases) {
  if (!diseases?.length) return '';
  return (
    '<div>' +
    diseases
      .map(d => `<span class="pill">${escapeHtml(d.name || d)}${d.days ? ` (${d.days}d)` : ''}</span>`)
      .join('') +
    '</div>'
  );
}

function renderMedPills(meds) {
  if (!meds?.length) return '<div class="muted">No medicines</div>';
  return (
    '<div>' +
    meds.slice(0, 4).map(m => `<span class="pill">${escapeHtml(m.name)}</span>`).join('') +
    (meds.length > 4 ? ` <span class="pill">+${meds.length - 4} more</span>` : '') +
    '</div>'
  );
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function showToast(message) {
  const text = $('#toast-text');
  const toast = $('#toast');
  if (!text || !toast) return;
  text.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

/* ----------------------------------------
   Provisional diagnosis (serialize / rebuild)
----------------------------------------- */
function getProvisionalDiagnosis() {
  return [...document.querySelectorAll('.prov-diag')]
    .map(input => {
      const label = input.dataset.label;
      const value = (input.value || '').trim();
      return value ? `${label}: ${value}` : null;
    })
    .filter(Boolean)
    .join('; ');
}

function setProvisionalDiagnosis(data) {
  const diagMap = {};
  (data || '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(item => {
      const [label, ...rest] = item.split(':');
      if (!label) return;
      diagMap[label.trim()] = rest.join(':').trim();
    });

  const select = $('#examinationSelect');
  if (!select) return;

  Object.entries(diagMap).forEach(([label, value]) => {
    // trigger add of a new input
    select.value = label;
    select.dispatchEvent(new Event('change'));
    // fill the just-added input
    const addedInput = [...document.querySelectorAll('.prov-diag')].find(i => i.dataset.label === label);
    if (addedInput) addedInput.value = value;
  });
}

/* ----------------------------------------
   Wire up init (ensures listeners attach)
----------------------------------------- */
document.addEventListener('DOMContentLoaded', init);

/* ----------------------------------------
   Small helper to hide all suggestion UIs if needed
----------------------------------------- */
function hideSuggestions() {
  $$('.suggest').forEach(el => el.classList.remove('show'));
}

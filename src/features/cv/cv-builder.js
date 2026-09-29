'use strict';

/* ============================================================
   CV BUILDER V1
   Private, browser-only draft. No API/Supabase persistence.
   ============================================================ */

const CV_STORAGE_PREFIX = 'mypsych_cv_draft_v1_';
const CV_EXPIRY_MS = 24 * 60 * 60 * 1000;
let cvInitialized = false;
let cvSaveTimer = null;
let cvExpiryTimer = null;

const CV_REPEATERS = {
  work: { container: 'cvWorkList', key: 'work', addLabel: 'pengalaman kerja', fields: [
    ['company','Perusahaan','Contoh: RS / PT / Klinik'], ['position','Posisi','Contoh: Staff Administrasi'], ['location','Lokasi','Kabupaten/Kota'], ['start','Mulai','YYYY-MM'], ['end','Selesai','YYYY-MM atau Sekarang'], ['description','Pencapaian / tanggung jawab','Satu poin per baris']
  ]},
  internship: { container: 'cvInternshipList', key: 'internship', addLabel: 'pengalaman magang', fields: [
    ['company','Institusi / tempat magang','Nama instansi'], ['position','Posisi / unit','Contoh: Rekam Medis'], ['location','Lokasi','Kabupaten/Kota'], ['start','Mulai','YYYY-MM'], ['end','Selesai','YYYY-MM'], ['description','Tugas / hasil','Satu poin per baris']
  ]},
  organization: { container: 'cvOrganizationList', key: 'organization', addLabel: 'organisasi', fields: [
    ['name','Organisasi','Nama organisasi'], ['role','Jabatan / peran','Contoh: Koordinator'], ['period','Periode','2024–2025'], ['description','Kontribusi','Satu poin per baris']
  ]},
  project: { container: 'cvProjectList', key: 'project', addLabel: 'project', fields: [
    ['name','Nama project','Nama project'], ['role','Peran','Contoh: Developer / Ketua Tim'], ['period','Periode','2025'], ['link','Link project','https://...'], ['description','Ringkasan / hasil','Satu poin per baris']
  ]},
  publication: { container: 'cvPublicationList', key: 'publication', addLabel: 'publikasi', fields: [
    ['title','Judul publikasi','Judul artikel / jurnal'], ['publisher','Penerbit / jurnal','Nama media / jurnal'], ['year','Tahun','2025'], ['link','Link','https://...']
  ]},
  achievement: { container: 'cvAchievementList', key: 'achievement', addLabel: 'prestasi', fields: [
    ['name','Prestasi','Nama pencapaian'], ['issuer','Penyelenggara','Nama institusi'], ['year','Tahun','2025'], ['description','Detail','Opsional']
  ]},
  education: { container: 'cvEducationList', key: 'education', addLabel: 'pendidikan', fields: [
    ['institution','Institusi','Universitas / sekolah'], ['degree','Jenjang / gelar','D3 / S1 / SMA'], ['field','Program studi','Contoh: Rekam Medis'], ['location','Lokasi','Kabupaten/Kota'], ['start','Mulai','2022'], ['end','Selesai','2025'], ['description','Prestasi / kegiatan relevan','Opsional']
  ]},
  training: { container: 'cvTrainingList', key: 'training', addLabel: 'pelatihan / sertifikasi', fields: [
    ['name','Nama pelatihan / sertifikasi','Nama credential'], ['provider','Penyelenggara','Lembaga'], ['year','Tahun','2025'], ['credential','Nomor / credential','Opsional'], ['link','Link verifikasi','https://...']
  ]},
};

function cvStorageKey_() {
  const userId = state.session?.user_id || state.session?.username || 'local';
  return `${CV_STORAGE_PREFIX}${userId}`;
}

function cvDefaultData_() {
  return {
    version: 1,
    lastActivityAt: Date.now(),
    template: 'ats',
    fullName: '',
    targetRole: '',
    address: '',
    phone: '',
    email: '',
    linkedin: '',
    currentActivity: '',
    summary: '',
    skills: '',
    photo: '',
    work: [],
    internship: [],
    organization: [],
    project: [],
    publication: [],
    achievement: [],
    education: [{ institution:'', degree:'', field:'', location:'', start:'', end:'', description:'' }],
    training: [],
  };
}

function cvLoad_() {
  try {
    const data = JSON.parse(localStorage.getItem(cvStorageKey_()) || 'null');
    if (!data || data.version !== 1) return cvDefaultData_();
    if (!data.lastActivityAt || Date.now() - data.lastActivityAt >= CV_EXPIRY_MS) {
      localStorage.removeItem(cvStorageKey_());
      return cvDefaultData_();
    }
    return { ...cvDefaultData_(), ...data };
  } catch {
    return cvDefaultData_();
  }
}

let cvData = cvDefaultData_();

function cvSave_(touch = true) {
  if (touch) cvData.lastActivityAt = Date.now();
  try {
    localStorage.setItem(cvStorageKey_(), JSON.stringify(cvData));
    updateCvExpiry_();
    $('cvSaveStatus') && ($('cvSaveStatus').textContent = `Tersimpan lokal · ${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`);
  } catch (error) {
    toast('Draft CV tidak bisa disimpan di browser ini.', 'warning');
  }
}

function cvDebouncedSave_() {
  clearTimeout(cvSaveTimer);
  cvSaveTimer = setTimeout(() => cvSave_(true), 350);
}

function updateCvExpiry_() {
  clearInterval(cvExpiryTimer);
  const badge = $('cvExpiryBadge');
  if (!badge) return;

  const tick = () => {
    const remaining = Math.max(0, CV_EXPIRY_MS - (Date.now() - (cvData.lastActivityAt || Date.now())));
    if (remaining <= 0) {
      cvExpire_();
      return;
    }
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    badge.textContent = `Draft hangus dalam ${hours}j ${String(minutes).padStart(2,'0')}m`;
  };

  tick();
  cvExpiryTimer = setInterval(tick, 60000);
}

function cvExpire_() {
  clearInterval(cvExpiryTimer);
  localStorage.removeItem(cvStorageKey_());
  cvData = cvDefaultData_();
  renderCvForm_();
  renderCvPreview_();
  toast('Draft CV 24 jam telah hangus dan dihapus dari perangkat ini.', 'info', 5000);
}

function cvEscape_(value = '') {
  return String(value)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function cvLines_(value = '') {
  return String(value).split(/
+/).map(v => v.trim()).filter(Boolean);
}

function cvText_(value='') {
  return cvEscape_(String(value || '').trim());
}

function cvFormValue_(name) {
  return $('cvForm')?.elements?.[name]?.value || '';
}

function cvSyncSimpleFields_() {
  ['fullName','targetRole','address','phone','email','linkedin','currentActivity','summary','skills'].forEach((name) => {
    cvData[name] = cvFormValue_(name);
  });
  cvData.template = $('cvTemplateSelect')?.value || cvData.template;
}

function cvAddItem_(type, item = null) {
  const config = CV_REPEATERS[type];
  if (!config) return;
  cvData[type].push(item || Object.fromEntries(config.fields.map(([key]) => [key, ''])));
  renderCvRepeater_(type);
  cvBindDynamicInputs_();
  cvSave_(true);
}

function cvRemoveItem_(type, index) {
  cvData[type].splice(index, 1);
  renderCvRepeater_(type);
  cvBindDynamicInputs_();
  cvSave_(true);
  renderCvPreview_();
}

function renderCvRepeater_(type) {
  const config = CV_REPEATERS[type];
  const root = $(config.container);
  if (!root) return;

  root.innerHTML = cvData[type].map((item,index) => {
    const controls = config.fields.map(([key,label,placeholder],fieldIndex) => {
      const multiline = key === 'description';
      const full = multiline || key === 'link';
      const value = cvEscape_(item[key] || '');
      return multiline
        ? `<label class="cv-repeat-field cv-field-full">${label}<textarea data-cv-type="${type}" data-cv-index="${index}" data-cv-key="${key}" rows="4" placeholder="${placeholder}">${value}</textarea></label>`
        : `<label class="cv-repeat-field ${full ? 'cv-field-full' : ''}">${label}<input data-cv-type="${type}" data-cv-index="${index}" data-cv-key="${key}" value="${value}" placeholder="${placeholder}"></label>`;
    }).join('');

    return `<div class="cv-repeat-card">
      <div class="cv-repeat-head"><strong>${config.addLabel} ${index + 1}</strong><button type="button" class="cv-remove-btn" data-cv-remove="${type}" data-cv-index="${index}">Hapus</button></div>
      <div class="cv-repeat-grid">${controls}</div>
    </div>`;
  }).join('') || `<div class="cv-repeat-empty">Belum ada data. Tambahkan bila diperlukan.</div>`;
}

function renderCvForm_() {
  const form = $('cvForm');
  if (!form) return;

  ['fullName','targetRole','address','phone','email','linkedin','currentActivity','summary','skills'].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = cvData[name] || '';
  });

  if ($('cvTemplateSelect')) $('cvTemplateSelect').value = cvData.template || 'ats';

  Object.keys(CV_REPEATERS).forEach(renderCvRepeater_);
  updateCvPhotoPreview_();
  updateCvExpiry_();
}

function cvBuildSummaryOutline_() {
  const education = cvData.education.find(item => item.institution || item.field || item.degree) || {};
  const role = cvData.targetRole || '[bidang/posisi yang dituju]';
  const educationText = [education.degree, education.field, education.institution].filter(Boolean).join(' ');
  const current = cvData.currentActivity || '[kesibukan saat ini]';
  const skills = cvData.skills ? cvData.skills.split(',')[0].trim() : '[keahlian utama]';
  return `Lulusan ${educationText || '[pendidikan terakhir]'} dengan pengalaman dan kegiatan yang mendukung bidang ${role}. Saat ini ${current}. Memiliki kekuatan pada ${skills} dan tertarik mengembangkan karier di bidang ${role}. Berkomitmen untuk terus belajar, berkontribusi, dan berkembang di lingkungan kerja profesional.`;
}

function renderCvPreview_() {
  const root = $('cvPreview');
  if (!root) return;

  const template = cvData.template || 'ats';
  root.className = `cv-paper cv-template-${template}`;
  if ($('cvPreviewTemplateLabel')) $('cvPreviewTemplateLabel').textContent =
    template === 'ats' ? 'ATS Clean' : template === 'academic' ? 'Classic Academic · Harvard-inspired' : 'Formal · dengan foto';

  const contact = [cvData.address,cvData.phone,cvData.email,cvData.linkedin].filter(Boolean).map(cvText_).join('  ·  ');
  const photo = cvData.photo ? `<img class="cv-paper-photo" src="${cvData.photo}" alt="Foto CV">` : '';

  const section = (title, html) => html ? `<section class="cv-paper-section"><h2>${title}</h2>${html}</section>` : '';
  const bullets = (lines) => lines.length ? `<ul>${lines.map(line=>`<li>${cvText_(line)}</li>`).join('')}</ul>` : '';

  const work = cvData.work.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.position)}</strong><span>${cvText_([x.start,x.end].filter(Boolean).join(' – '))}</span></div><div class="cv-entry-sub">${cvText_(x.company)}${x.location ? ' · '+cvText_(x.location):''}</div>${bullets(cvLines_(x.description))}</div>`).join('');

  const internship = cvData.internship.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.position)}</strong><span>${cvText_([x.start,x.end].filter(Boolean).join(' – '))}</span></div><div class="cv-entry-sub">${cvText_(x.company)}${x.location ? ' · '+cvText_(x.location):''}</div>${bullets(cvLines_(x.description))}</div>`).join('');

  const organization = cvData.organization.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.role)}</strong><span>${cvText_(x.period)}</span></div><div class="cv-entry-sub">${cvText_(x.name)}</div>${bullets(cvLines_(x.description))}</div>`).join('');

  const projects = cvData.project.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.name)}</strong><span>${cvText_(x.period)}</span></div><div class="cv-entry-sub">${cvText_(x.role)}${x.link ? ' · '+cvText_(x.link):''}</div>${bullets(cvLines_(x.description))}</div>`).join('');

  const publications = cvData.publication.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><strong>${cvText_(x.title)}</strong><div class="cv-entry-sub">${cvText_([x.publisher,x.year].filter(Boolean).join(' · '))}</div>${x.link ? `<div class="cv-entry-link">${cvText_(x.link)}</div>` : ''}</div>`).join('');

  const achievements = cvData.achievement.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.name)}</strong><span>${cvText_(x.year)}</span></div><div class="cv-entry-sub">${cvText_(x.issuer)}</div>${x.description ? '<p>'+cvText_(x.description)+'</p>':''}</div>`).join('');

  const education = cvData.education.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_([x.degree,x.field].filter(Boolean).join(' · '))}</strong><span>${cvText_([x.start,x.end].filter(Boolean).join(' – '))}</span></div><div class="cv-entry-sub">${cvText_(x.institution)}${x.location ? ' · '+cvText_(x.location):''}</div>${x.description ? '<p>'+cvText_(x.description)+'</p>':''}</div>`).join('');

  const training = cvData.training.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.name)}</strong><span>${cvText_(x.year)}</span></div><div class="cv-entry-sub">${cvText_([x.provider,x.credential].filter(Boolean).join(' · '))}</div>${x.link ? `<div class="cv-entry-link">${cvText_(x.link)}</div>` : ''}</div>`).join('');

  const summary = cvData.summary || cvBuildSummaryOutline_();

  root.innerHTML = `
    <div class="cv-paper-header">
      ${template === 'formal-photo' && photo ? photo : ''}
      <div class="cv-paper-identity">
        <h1>${cvText_(cvData.fullName || 'Nama Lengkap')}</h1>
        ${cvData.targetRole ? `<p class="cv-paper-role">${cvText_(cvData.targetRole)}</p>` : ''}
        <p class="cv-paper-contact">${contact || 'Kabupaten/Kota · WhatsApp · Email · LinkedIn'}</p>
      </div>
    </div>
    ${section('Profil', `<p>${cvText_(summary)}</p>`)}
    ${cvData.skills ? section('Keahlian', `<p class="cv-skill-line">${cvText_(cvData.skills)}</p>`) : ''}
    ${section('Pengalaman Kerja',work)}
    ${section('Pengalaman Magang',internship)}
    ${section('Organisasi',organization)}
    ${section('Project / Portofolio',projects)}
    ${section('Publikasi',publications)}
    ${section('Prestasi',achievements)}
    ${section('Pendidikan',education)}
    ${section('Pelatihan & Sertifikasi',training)}
  `;
}

function updateCvPhotoPreview_() {
  const root = $('cvPhotoPreview');
  if (!root) return;
  root.innerHTML = cvData.photo ? `<img src="${cvData.photo}" alt="Foto profil CV">` : 'FOTO';
}

async function cvProcessPhoto_(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('Ukuran foto maksimal 2 MB.', 'warning');
    return;
  }

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await new Promise((resolve,reject)=>{ image.onload=resolve; image.onerror=reject; });

    const width = 800;
    const height = 1067;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const scale = Math.max(width / image.width, height / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const x = (width - drawW) / 2;
    const y = (height - drawH) / 2;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(image,x,y,drawW,drawH);

    cvData.photo = canvas.toDataURL('image/jpeg',0.82);
    updateCvPhotoPreview_();
    cvSave_(true);
    renderCvPreview_();
  } finally {
    URL.revokeObjectURL(source);
  }
}

function cvBindDynamicInputs_() {
  document.querySelectorAll('[data-cv-type]').forEach((input) => {
    if (input.dataset.cvBound === '1') return;
    input.dataset.cvBound = '1';
    input.addEventListener('input', () => {
      const type = input.dataset.cvType;
      const index = Number(input.dataset.cvIndex);
      const key = input.dataset.cvKey;
      cvData[type][index][key] = input.value;
      cvDebouncedSave_();
      renderCvPreview_();
    });
  });

  document.querySelectorAll('[data-cv-remove]').forEach((button) => {
    if (button.dataset.cvBound === '1') return;
    button.dataset.cvBound = '1';
    button.addEventListener('click', () => cvRemoveItem_(button.dataset.cvRemove, Number(button.dataset.cvIndex)));
  });
}

function bindCvOnce_() {
  if (cvInitialized) return;
  cvInitialized = true;

  $('cvForm')?.addEventListener('input', (event) => {
    if (event.target.matches('[name]')) {
      cvSyncSimpleFields_();
      cvDebouncedSave_();
      renderCvPreview_();
    }
  });

  $('cvTemplateSelect')?.addEventListener('change', () => {
    cvData.template = $('cvTemplateSelect').value;
    cvSave_(true);
    renderCvPreview_();
  });

  document.querySelectorAll('[data-cv-add]').forEach((button) => {
    button.addEventListener('click', () => cvAddItem_(button.dataset.cvAdd));
  });

  $('cvSummaryOutlineBtn')?.addEventListener('click', () => {
    cvSyncSimpleFields_();
    $('cvSummary').value = cvBuildSummaryOutline_();
    cvData.summary = $('cvSummary').value;
    cvSave_(true);
    renderCvPreview_();
  });

  $('cvPrintBtn')?.addEventListener('click', () => {
    cvSyncSimpleFields_();
    cvSave_(true);
    renderCvPreview_();
    window.print();
  });

  $('cvPrintBtnBottom')?.addEventListener('click', () => $('cvPrintBtn')?.click());

  $('cvPhotoInput')?.addEventListener('change', (event) => cvProcessPhoto_(event.target.files?.[0]));

  $('cvPhotoRemoveBtn')?.addEventListener('click', () => {
    cvData.photo = '';
    if ($('cvPhotoInput')) $('cvPhotoInput').value = '';
    cvSave_(true);
    updateCvPhotoPreview_();
    renderCvPreview_();
  });

  $('cvExportBtn')?.addEventListener('click', () => {
    cvSyncSimpleFields_();
    cvSave_(true);
    const blob = new Blob([JSON.stringify(cvData,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MyPsych-CV-${(cvData.fullName || 'draft').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('cvImportBtn')?.addEventListener('click', () => $('cvImportInput')?.click());

  $('cvImportInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (imported?.version !== 1) throw new Error('Format CV tidak dikenali.');
      cvData = { ...cvDefaultData_(), ...imported, lastActivityAt: Date.now() };
      cvSave_(true);
      renderCvForm_();
      renderCvPreview_();
      toast('Draft CV berhasil diimpor.', 'success');
    } catch (error) {
      toast(error.message || 'File JSON tidak valid.', 'warning');
    } finally {
      event.target.value = '';
    }
  });

  window.addEventListener('beforeunload', () => {
    cvSyncSimpleFields_();
    cvSave_(false);
  });
}

function initCvBuilder() {
  if (!state.session) return;
  cvData = cvLoad_();
  bindCvOnce_();
  renderCvForm_();
  cvBindDynamicInputs_();
  renderCvPreview_();
}

window.MyPsychCv = { init: initCvBuilder };

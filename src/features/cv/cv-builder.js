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
  work: { container: 'cvWorkList', key: 'work', addLabel: 'pengalaman kerja', ongoingKey: 'ongoing', ongoingLabel: 'Saya masih disini', fields: [
    ['company','Perusahaan','Contoh: RS / PT / Klinik'], ['position','Posisi','Contoh: Staff Administrasi'], ['location','Lokasi','Kabupaten/Kota'], ['start','Mulai','DD-MM-YYYY'], ['end','Selesai','DD-MM-YYYY'], ['description','Pencapaian / tanggung jawab','Satu poin per baris']
  ]},
  internship: { container: 'cvInternshipList', key: 'internship', addLabel: 'pengalaman magang', ongoingKey: 'ongoing', ongoingLabel: 'Saya masih disini', fields: [
    ['company','Institusi / tempat magang','Nama instansi'], ['position','Posisi / unit','Contoh: Rekam Medis'], ['location','Lokasi','Kabupaten/Kota'], ['start','Mulai','DD-MM-YYYY'], ['end','Selesai','DD-MM-YYYY'], ['description','Tugas / hasil','Satu poin per baris']
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
  education: { container: 'cvEducationList', key: 'education', addLabel: 'pendidikan', ongoingKey: 'ongoing', ongoingLabel: 'Saya masih aktif', fields: [
    ['institution','Institusi','Universitas / sekolah'], ['degree','Jenjang / gelar','D3 / S1 / SMA'], ['field','Program studi','Contoh: Rekam Medis'], ['location','Lokasi','Kabupaten/Kota'], ['start','Mulai','DD-MM-YYYY'], ['end','Selesai','DD-MM-YYYY'], ['description','Prestasi / kegiatan relevan','Opsional']
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
    autoFormat: true,
    fullName: '',
    targetRole: '',
    address: '',
    phone: '',
    email: '',
    linkedin: '',
    summary: '',
    skills: '',
    photo: '',
    work: [],
    internship: [],
    organization: [],
    project: [],
    publication: [],
    achievement: [],
    education: [{ institution:'', degree:'', field:'', location:'', start:'', end:'', ongoing:false, description:'' }],
    training: [],
  };
}

function cvNormalizeDateValue_(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}\/\d{2}$/.test(raw)) return raw.replace('/', '-') + '-01';
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('-');
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  }

  return raw;
}

function cvFormatDate_(value = '') {
  const normalized = cvNormalizeDateValue_(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || '').trim();

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function cvPeriodEnd_(item, type) {
  const config = CV_REPEATERS[type];
  if (config?.ongoingKey && item?.[config.ongoingKey]) {
    return config.ongoingLabel === 'Saya masih aktif' ? 'Masih aktif' : 'Sekarang';
  }
  return cvFormatDate_(item?.end);
}

function cvNormalizeData_(input = {}) {
  const base = cvDefaultData_();
  const data = { ...base, ...input };

  delete data.currentActivity;
  data.autoFormat = data.autoFormat !== false;

  const textFields = ['fullName','targetRole','address','phone','email','linkedin','summary','skills','photo','template'];
  textFields.forEach((key) => {
    if (typeof data[key] !== 'string') data[key] = key === 'template' ? 'ats' : '';
  });

  Object.keys(CV_REPEATERS).forEach((type) => {
    const config = CV_REPEATERS[type];
    if (!Array.isArray(data[type])) data[type] = [];
    data[type] = data[type]
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const clean = {};
        config.fields.forEach(([key]) => {
          clean[key] = typeof item[key] === 'string' ? item[key] : '';
        });

        if (config.ongoingKey) {
          clean[config.ongoingKey] = item[config.ongoingKey] === true || item[config.ongoingKey] === 'true';
        }

        ['start','end'].forEach((key) => {
          if (clean[key]) clean[key] = cvNormalizeDateValue_(clean[key]);
        });

        return clean;
      });
  });

  if (!data.education.length) {
    data.education = [{ institution:'', degree:'', field:'', location:'', start:'', end:'', ongoing:false, description:'' }];
  }

  return data;
}

function cvLoad_() {
  try {
    const data = JSON.parse(localStorage.getItem(cvStorageKey_()) || 'null');
    if (!data || data.version !== 1) return cvDefaultData_();
    if (!data.lastActivityAt || Date.now() - data.lastActivityAt >= CV_EXPIRY_MS) {
      localStorage.removeItem(cvStorageKey_());
      return cvDefaultData_();
    }
    return cvNormalizeData_(data);
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
  return String(value).split(/\n+/).map(v => v.trim()).filter(Boolean);
}

function cvText_(value='') {
  return cvEscape_(String(value || '').trim());
}

function cvFormValue_(name) {
  return $('cvForm')?.elements?.[name]?.value || '';
}

function cvSyncSimpleFields_() {
  ['fullName','targetRole','address','phone','email','linkedin','summary','skills'].forEach((name) => {
    cvData[name] = cvFormValue_(name);
  });
  cvData.template = $('cvTemplateSelect')?.value || cvData.template;
}

function cvAddItem_(type, item = null) {
  const config = CV_REPEATERS[type];
  if (!config) return;
  cvData[type].push(item || Object.fromEntries(config.fields.map(([key]) => [key, ''])));
  renderCvRepeater_(type);
  cvSave_(true);
}

function cvRemoveItem_(type, index) {
  cvData[type].splice(index, 1);
  renderCvRepeater_(type);
  cvSave_(true);
  renderCvPreview_();
}

function cvInputType_(key) {
  if (key === 'start' || key === 'end') return 'month';
  if (key === 'link') return 'url';
  if (key === 'year') return 'number';
  return 'text';
}

function cvInputAttributes_(key) {
  if (key === 'start' || key === 'end') {
    return 'type="date"';
  }
  if (key === 'link') {
    return 'type="url" inputmode="url"';
  }
  if (key === 'year') {
    return 'type="number" min="1900" max="2100" inputmode="numeric"';
  }
  return 'type="text"';
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
      const disabled = key === 'end' && config.ongoingKey && item[config.ongoingKey] ? 'disabled' : '';
      return multiline
        ? `<label class="cv-repeat-field cv-field-full">${label}<textarea data-cv-type="${type}" data-cv-index="${index}" data-cv-key="${key}" rows="4" placeholder="${placeholder}">${value}</textarea></label>`
        : `<label class="cv-repeat-field ${full ? 'cv-field-full' : ''}">${label}<input ${cvInputAttributes_(key)} data-cv-type="${type}" data-cv-index="${index}" data-cv-key="${key}" value="${value}" placeholder="${placeholder}" aria-label="${label} (${key === 'start' || key === 'end' ? 'DD-MM-YYYY' : placeholder})" ${disabled}></label>`;
    }).join('');

    const ongoingControl = config.ongoingKey
      ? `<label class="cv-ongoing-toggle"><input type="checkbox" data-cv-ongoing-type="${type}" data-cv-index="${index}" ${item[config.ongoingKey] ? 'checked' : ''}><span>${config.ongoingLabel}</span></label>`
      : '';

    return `<div class="cv-repeat-card">
      <div class="cv-repeat-head"><strong>${config.addLabel} ${index + 1}</strong><button type="button" class="cv-remove-btn" data-cv-remove="${type}" data-cv-index="${index}">Hapus</button></div>
      <div class="cv-repeat-grid">${controls}</div>
      ${ongoingControl}
    </div>`;
  }).join('') || `<div class="cv-repeat-empty">Belum ada data. Tambahkan bila diperlukan.</div>`;
}

function renderCvForm_() {
  const form = $('cvForm');
  if (!form) return;

  ['fullName','targetRole','address','phone','email','linkedin','summary','skills'].forEach((name) => {
    if (form.elements[name]) form.elements[name].value = cvData[name] || '';
  });

  if ($('cvTemplateSelect')) $('cvTemplateSelect').value = cvData.template || 'ats';
  if ($('cvAutoFormatToggle')) $('cvAutoFormatToggle').checked = cvData.autoFormat !== false;

  Object.keys(CV_REPEATERS).forEach(renderCvRepeater_);
  updateCvPhotoPreview_();
  updateCvExpiry_();
}

function cvBuildSummaryOutline_() {
  const education = cvData.education.find(item => item.institution || item.field || item.degree) || {};
  const role = cvData.targetRole || '[bidang/posisi yang dituju]';
  const educationText = [education.degree, education.field, education.institution].filter(Boolean).join(' ');
  const experience = cvData.work.find(item => item.position || item.company);
  const internship = cvData.internship.find(item => item.position || item.company);
  const skills = cvData.skills ? cvData.skills.split(',')[0].trim() : '[keahlian utama]';
  const experienceText = experience
    ? ` memiliki pengalaman sebagai ${experience.position || 'profesional'} di ${experience.company || 'sebuah organisasi'}`
    : internship
      ? ` memiliki pengalaman magang sebagai ${internship.position || 'peserta magang'} di ${internship.company || 'sebuah organisasi'}`
      : '';
  return `Lulusan ${educationText || '[pendidikan terakhir]'}${experienceText} dengan keahlian pada ${skills}. Tertarik mengembangkan karier di bidang ${role} dan siap terus belajar, berkontribusi, serta berkembang di lingkungan kerja profesional.`;
}

function cvAutoFormatEnabled_() {
  return cvData.autoFormat !== false;
}

function cvParseStructuredText_(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return { type: 'empty', items: [] };

  const lines = raw.split(/\r?\n/);
  const nonEmpty = lines.map(line => line.trim()).filter(Boolean);

  const orderedMarker = /^\s*(\d+)[.)](?:\s+(.*))?$/;
  const bulletMarker = /^\s*[-•*](?:\s+(.*))?$/;

  const hasOrdered = nonEmpty.some(line => orderedMarker.test(line));
  const hasBullet = nonEmpty.some(line => bulletMarker.test(line));

  if (cvAutoFormatEnabled_() && hasOrdered && !hasBullet) {
    const items = [];
    let current = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(orderedMarker);

      if (match) {
        current = {
          marker: `${match[1]}.`,
          lines: [],
        };
        if (match[2]) current.lines.push(match[2].trim());
        items.push(current);
        return;
      }

      if (trimmed && current) {
        current.lines.push(trimmed);
      }
    });

    if (items.length) {
      return {
        type: 'ordered',
        items: items.map(item => ({
          marker: item.marker,
          text: item.lines.join(' '),
        })),
      };
    }
  }

  if (cvAutoFormatEnabled_() && hasBullet && !hasOrdered) {
    const items = [];
    let current = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(bulletMarker);

      if (match) {
        current = { marker: '•', lines: [] };
        if (match[1]) current.lines.push(match[1].trim());
        items.push(current);
        return;
      }

      if (trimmed && current) {
        current.lines.push(trimmed);
      }
    });

    if (items.length) {
      return {
        type: 'unordered',
        items: items.map(item => ({
          marker: item.marker,
          text: item.lines.join(' '),
        })),
      };
    }
  }

  return {
    type: 'paragraph',
    text: raw,
  };
}

function cvRichHtml_(value = '') {
  const parsed = cvParseStructuredText_(value);
  if (parsed.type === 'empty') return '';

  if (parsed.type === 'ordered' || parsed.type === 'unordered') {
    return `<div class="cv-rich-list cv-rich-${parsed.type}">${parsed.items.map(item =>
      `<div class="cv-rich-list-item"><span class="cv-rich-marker">${cvText_(item.marker)}</span><div class="cv-rich-list-content">${cvText_(item.text)}</div></div>`
    ).join('')}</div>`;
  }

  return `<p class="cv-rich-paragraph">${cvText_(parsed.text).replace(/\r?\n/g, '<br>')}</p>`;
}

function renderCvPreview_() {
  const root = $('cvPreview');
  if (!root) return;

  cvData = cvNormalizeData_(cvData);
  const template = cvData.template || 'ats';
  root.className = `cv-paper cv-template-${template}`;
  if ($('cvPreviewTemplateLabel')) $('cvPreviewTemplateLabel').textContent =
    template === 'ats' ? 'ATS Clean' : template === 'academic' ? 'Classic Academic · Harvard-inspired' : 'Formal · dengan foto';

  const contact = [cvData.address,cvData.phone,cvData.email,cvData.linkedin].filter(Boolean).map(cvText_).join('  ·  ');
  const photo = cvData.photo ? `<img class="cv-paper-photo" src="${cvData.photo}" alt="Foto CV">` : '';

  const section = (title, html) => html ? `<section class="cv-paper-section"><h2>${title}</h2>${html}</section>` : '';
  const rich = (value) => cvRichHtml_(value);

  const work = cvData.work.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.position)}</strong><span>${cvText_([x.start,x.end].filter(Boolean).join(' – '))}</span></div><div class="cv-entry-sub">${cvText_(x.company)}${x.location ? ' · '+cvText_(x.location):''}</div>${rich(x.description)}</div>`).join('');

  const internship = cvData.internship.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.position)}</strong><span>${cvText_([x.start,x.end].filter(Boolean).join(' – '))}</span></div><div class="cv-entry-sub">${cvText_(x.company)}${x.location ? ' · '+cvText_(x.location):''}</div>${rich(x.description)}</div>`).join('');

  const organization = cvData.organization.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.role)}</strong><span>${cvText_(x.period)}</span></div><div class="cv-entry-sub">${cvText_(x.name)}</div>${rich(x.description)}</div>`).join('');

  const projects = cvData.project.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.name)}</strong><span>${cvText_(x.period)}</span></div><div class="cv-entry-sub">${cvText_(x.role)}${x.link ? ' · '+cvText_(x.link):''}</div>${rich(x.description)}</div>`).join('');

  const publications = cvData.publication.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><strong>${cvText_(x.title)}</strong><div class="cv-entry-sub">${cvText_([x.publisher,x.year].filter(Boolean).join(' · '))}</div>${x.link ? `<div class="cv-entry-link">${cvText_(x.link)}</div>` : ''}</div>`).join('');

  const achievements = cvData.achievement.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_(x.name)}</strong><span>${cvText_(x.year)}</span></div><div class="cv-entry-sub">${cvText_(x.issuer)}</div>${x.description ? rich(x.description):''}</div>`).join('');

  const education = cvData.education.filter(x=>Object.values(x).some(Boolean)).map(x =>
    `<div class="cv-entry"><div class="cv-entry-head"><strong>${cvText_([x.degree,x.field].filter(Boolean).join(' · '))}</strong><span>${cvText_([x.start,x.end].filter(Boolean).join(' – '))}</span></div><div class="cv-entry-sub">${cvText_(x.institution)}${x.location ? ' · '+cvText_(x.location):''}</div>${x.description ? rich(x.description):''}</div>`).join('');

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
    ${section('Profil', rich(summary))}
    ${cvData.skills ? section('Keahlian', rich(cvData.skills)) : ''}
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


function cvBuildAndPreview_() {
  cvSyncSimpleFields_();

  if (!cvData.summary.trim()) {
    cvData.summary = cvBuildSummaryOutline_();
    const summaryInput = $('cvSummary');
    if (summaryInput) summaryInput.value = cvData.summary;
  }

  cvSave_(true);
  renderCvPreview_();

  const preview = $('cvPreview');
  preview?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('CV berhasil dibuat. Periksa preview lalu simpan sebagai PDF.', 'success', 4200);
}

function cvHandleStructuredEnter_(event) {
  if (!cvAutoFormatEnabled_() || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;

  const start = target.selectionStart;
  const lineStart = target.value.lastIndexOf('\n', start - 1) + 1;
  const currentLine = target.value.slice(lineStart, start);
  const numberMatch = currentLine.match(/^(\s*)(\d+)[.)]\s*(.*)$/);
  const bulletMatch = currentLine.match(/^(\s*)([-•*])\s*(.*)$/);

  if (numberMatch) {
    event.preventDefault();
    const indent = numberMatch[1];
    const number = Number(numberMatch[2]);
    const content = numberMatch[3].trim();
    if (!content) {
      if (number === 1) {
        target.setRangeText('\n' + indent + '2. ', start, start, 'end');
      } else {
        target.setRangeText('\n', start, start, 'end');
      }
    } else {
      target.setRangeText('\n' + indent + String(number + 1) + '. ', start, start, 'end');
    }
  } else if (bulletMatch) {
    event.preventDefault();
    const indent = bulletMatch[1];
    const marker = bulletMatch[2];
    const content = bulletMatch[3].trim();
    target.setRangeText('\n' + indent + marker + (content ? ' ' : ' '), start, start, 'end');
  } else {
    return;
  }

  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function cvPreparePrint_() {
  cvSyncSimpleFields_();
  cvSave_(true);
  renderCvPreview_();

  const previousTitle = document.title;
  document.title = '';

  const restoreTitle = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  window.addEventListener('afterprint', restoreTitle, { once: true });
  window.print();
}


function bindCvOnce_() {
  if (cvInitialized) return;

  const root = $('cvView');
  const form = $('cvForm');
  if (!root || !form) return;

  form.addEventListener('keydown', cvHandleStructuredEnter_);

  form.addEventListener('input', (event) => {
    const target = event.target;

    if (target.matches('[data-cv-type]')) {
      const type = target.dataset.cvType;
      const index = Number(target.dataset.cvIndex);
      const key = target.dataset.cvKey;
      if (cvData[type]?.[index]) {
        cvData[type][index][key] = (key === 'start' || key === 'end') ? cvNormalizeDateValue_(target.value) : target.value;
        cvDebouncedSave_();
        renderCvPreview_();
      }
      return;
    }

    if (target.matches('[name]')) {
      cvSyncSimpleFields_();
      cvDebouncedSave_();
      renderCvPreview_();
    }
  });

  form.addEventListener('change', (event) => {
    const ongoing = event.target.closest('[data-cv-ongoing-type]');
    if (ongoing) {
      const type = ongoing.dataset.cvOngoingType;
      const index = Number(ongoing.dataset.cvIndex);
      const config = CV_REPEATERS[type];
      if (!config || !cvData[type]?.[index]) return;

      cvData[type][index][config.ongoingKey] = ongoing.checked;
      if (ongoing.checked) cvData[type][index].end = '';

      renderCvRepeater_(type);
      renderCvPreview_();
      cvSave_(true);
      return;
    }

    if (event.target.matches('input[type="date"]')) {
      const target = event.target;
      const type = target.dataset.cvType;
      const index = Number(target.dataset.cvIndex);
      const key = target.dataset.cvKey;
      if (type && cvData[type]?.[index] && (key === 'start' || key === 'end')) {
        cvData[type][index][key] = cvNormalizeDateValue_(target.value);
        cvDebouncedSave_();
        renderCvPreview_();
      }
    }
  });

  root.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-cv-add]');
    if (addButton) {
      event.preventDefault();
      cvAddItem_(addButton.dataset.cvAdd);
      return;
    }

    const removeButton = event.target.closest('[data-cv-remove]');
    if (removeButton) {
      event.preventDefault();
      cvRemoveItem_(removeButton.dataset.cvRemove, Number(removeButton.dataset.cvIndex));
      return;
    }

    if (event.target.closest('#cvSummaryOutlineBtn')) {
      cvSyncSimpleFields_();
      const summary = cvBuildSummaryOutline_();
      $('cvSummary').value = summary;
      cvData.summary = summary;
      cvSave_(true);
      renderCvPreview_();
      toast('Kerangka ringkasan dibuat. Kamu masih bisa mengeditnya.', 'success');
      return;
    }

    if (event.target.closest('#cvBuildBtn, #cvBuildBtnBottom')) {
      event.preventDefault();
      cvBuildAndPreview_();
      return;
    }

    if (event.target.closest('#cvPrintBtn, #cvPrintBtnBottom')) {
      event.preventDefault();
      cvPreparePrint_();
      return;
    }

    if (event.target.closest('#cvExportBtn')) {
      event.preventDefault();
      cvSyncSimpleFields_();
      cvSave_(true);
      const blob = new Blob([JSON.stringify(cvData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `MyPsych-CV-${(cvData.fullName || 'draft').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast('Backup CV berhasil diekspor.', 'success');
      return;
    }

    if (event.target.closest('#cvImportBtn')) {
      event.preventDefault();
      $('cvImportInput')?.click();
    }

    if (event.target.closest('#cvPhotoRemoveBtn')) {
      event.preventDefault();
      cvData.photo = '';
      if ($('cvPhotoInput')) $('cvPhotoInput').value = '';
      cvSave_(true);
      updateCvPhotoPreview_();
      renderCvPreview_();
      toast('Foto dihapus.', 'info');
    }
  });

  $('cvAutoFormatToggle')?.addEventListener('change', (event) => {
    cvData.autoFormat = event.target.checked;
    cvSave_(true);
    renderCvPreview_();
  });

  $('cvTemplateSelect')?.addEventListener('change', () => {
    cvData.template = $('cvTemplateSelect').value;
    cvSave_(true);
    renderCvPreview_();
  });

  $('cvPhotoInput')?.addEventListener('change', (event) => {
    cvProcessPhoto_(event.target.files?.[0]);
  });

  $('cvImportInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());
      if (imported?.version !== 1) throw new Error('Format CV tidak dikenali.');

      cvData = cvNormalizeData_(imported);
      cvData.lastActivityAt = Date.now();
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

  cvInitialized = true;
}


function initCvBuilder() {
  if (!state.session) return;
  bindCvOnce_();
  cvData = cvLoad_();
  renderCvForm_();
  renderCvPreview_();
  updateCvExpiry_();
}


window.MyPsychCv = { init: initCvBuilder };

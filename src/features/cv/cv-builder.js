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
    education: [{ institution:'', degree:'', field:'', location:'', start:'', end:'', description:'' }],
    training: [],
  };
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
    if (!Array.isArray(data[type])) data[type] = [];
    data[type] = data[type]
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const clean = {};
        CV_REPEATERS[type].fields.forEach(([key]) => {
          clean[key] = typeof item[key] === 'string' ? item[key] : '';
        });
        return clean;
      });
  });

  if (!data.education.length) {
    data.education = [{ institution:'', degree:'', field:'', location:'', start:'', end:'', description:'' }];
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
    return 'type="month"';
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
      return multiline
        ? `<label class="cv-repeat-field cv-field-full">${label}<textarea data-cv-type="${type}" data-cv-index="${index}" data-cv-key="${key}" rows="4" placeholder="${placeholder}">${value}</textarea></label>`
        : `<label class="cv-repeat-field ${full ? 'cv-field-full' : ''}">${label}<input ${cvInputAttributes_(key)} data-cv-type="${type}" data-cv-index="${index}" data-cv-key="${key}" value="${value}" placeholder="${placeholder}"></label>`;
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

function cvRichHtml_(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const rawLines = raw.split(/\r?\n/);
  const nonEmptyRawLines = rawLines.map(line => line.trim()).filter(Boolean);

  if (!cvAutoFormatEnabled_()) {
    return `<p class="cv-rich-paragraph">${cvText_(raw).replace(/\r?\n/g, '<br>')}</p>`;
  }

  const numbered = nonEmptyRawLines.length > 1 &&
    nonEmptyRawLines.every(line => /^\d+[.)]\s+/.test(line));

  if (numbered) {
    return `<div class="cv-rich-list cv-rich-ordered">${nonEmptyRawLines.map(line => {
      const match = line.match(/^(\d+)[.)]\s+(.*)$/);
      const marker = match ? `${match[1]}.` : '';
      const content = match ? match[2] : line;
      return `<div class="cv-rich-list-item"><span class="cv-rich-marker">${cvText_(marker)}</span><div class="cv-rich-list-content">${cvText_(content)}</div></div>`;
    }).join('')}</div>`;
  }

  const bulleted = nonEmptyRawLines.length > 1 &&
    nonEmptyRawLines.every(line => /^[-•*]\s+/.test(line));

  if (bulleted) {
    return `<div class="cv-rich-list cv-rich-unordered">${nonEmptyRawLines.map(line => {
      const content = line.replace(/^[-•*]\s+/, '');
      return `<div class="cv-rich-list-item"><span class="cv-rich-marker">•</span><div class="cv-rich-list-content">${cvText_(content)}</div></div>`;
    }).join('')}</div>`;
  }

  if (/\r?\n\s*\r?\n/.test(raw)) {
    return raw.split(/\r?\n\s*\r?\n/).map(part => {
      const content = part.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join(' ');
      return content ? `<p class="cv-rich-paragraph">${cvText_(content)}</p>` : '';
    }).join('');
  }

  return `<p class="cv-rich-paragraph">${nonEmptyRawLines.map(line => cvText_(line)).join('<br>')}</p>`;
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

function cvPdfSafeText_(value = '') {
  return String(value || '')
    .replace(/[–—]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '?');
}

function cvPdfWrap_(value = '', maxChars = 88) {
  const text = cvPdfSafeText_(value).replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? line + ' ' + word : word;
    if (next.length <= maxChars) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function cvPdfTextCommand_(text, x, y, size, color) {
  const rgb = color || '0.10 0.15 0.22 rg';
  return [
    rgb,
    'BT',
    '/F1 ' + size + ' Tf',
    '1 0 0 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Tm',
    '(' + pdfEscape(text) + ') Tj',
    'ET'
  ].join('\n');
}

function cvCreatePdfBytes_(pages) {
  const pageRefs = [];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  pages.forEach((content) => {
    const pageRef = objects.length + 1;
    const contentRef = pageRef + 1;
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + contentRef + ' 0 R >>',
      '<< /Length ' + asciiBytes(content).length + ' >>\nstream\n' + content + '\nendstream'
    );
    pageRefs.push(pageRef);
  });

  objects[1] = '<< /Type /Pages /Kids [' + pageRefs.map((ref) => ref + ' 0 R').join(' ') + '] /Count ' + pageRefs.length + ' >>';

  const parts = [asciiBytes('%PDF-1.4\n')];
  const offsets = [0];
  let offset = parts[0].length;

  objects.forEach((object, index) => {
    const ref = index + 1;
    const bytes = asciiBytes(ref + ' 0 obj\n' + object + '\nendobj\n');
    offsets[ref] = offset;
    parts.push(bytes);
    offset += bytes.length;
  });

  const xrefOffset = offset;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF';
  parts.push(asciiBytes(xref));
  return concatBytes(parts);
}

function cvBuildPdfPages_() {
  const sections = [];
  if (cvData.summary.trim()) sections.push(['PROFIL', cvData.summary]);
  if (cvData.skills.trim()) sections.push(['KEAHLIAN', cvData.skills]);

  const addEntries = (title, list, mapper) => {
    const items = list.filter((item) => Object.values(item).some(Boolean)).map(mapper).filter(Boolean);
    if (items.length) sections.push([title, items.join('\n\n')]);
  };

  addEntries('PENGALAMAN KERJA', cvData.work, (item) =>
    [item.position, item.company, [item.start, item.end].filter(Boolean).join(' - '), item.description].filter(Boolean).join('\n')
  );
  addEntries('PENGALAMAN MAGANG', cvData.internship, (item) =>
    [item.position, item.company, [item.start, item.end].filter(Boolean).join(' - '), item.description].filter(Boolean).join('\n')
  );
  addEntries('ORGANISASI', cvData.organization, (item) =>
    [item.role, item.name, item.period, item.description].filter(Boolean).join('\n')
  );
  addEntries('PROJECT / PORTOFOLIO', cvData.project, (item) =>
    [item.name, item.role, item.period, item.description, item.link].filter(Boolean).join('\n')
  );
  addEntries('PUBLIKASI', cvData.publication, (item) =>
    [item.title, item.publisher, item.year, item.link].filter(Boolean).join('\n')
  );
  addEntries('PRESTASI', cvData.achievement, (item) =>
    [item.name, item.issuer, item.year, item.description].filter(Boolean).join('\n')
  );
  addEntries('PENDIDIKAN', cvData.education, (item) =>
    [[item.degree, item.field].filter(Boolean).join(' - '), item.institution, item.location, [item.start, item.end].filter(Boolean).join(' - '), item.description].filter(Boolean).join('\n')
  );
  addEntries('PELATIHAN & SERTIFIKASI', cvData.training, (item) =>
    [item.name, item.provider, item.year, item.credential, item.link].filter(Boolean).join('\n')
  );

  const pages = [];
  let commands = [];
  let y = 790;
  const left = 54;
  const bottom = 48;
  const lineGap = 13;

  const newPage = () => {
    if (commands.length) pages.push(commands.join('\n'));
    commands = [];
    y = 790;
  };

  const ensure = (height = lineGap) => {
    if (y - height < bottom) newPage();
  };

  const pushText = (text, size = 9, gap = lineGap, color = '0.10 0.15 0.22 rg') => {
    ensure(gap);
    commands.push(cvPdfTextCommand_(text, left, y, size, color));
    y -= gap;
  };

  const pushWrapped = (text, size = 9, gap = lineGap) => {
    cvPdfWrap_(text).forEach((line) => pushText(line, size, gap));
  };

  const pushRich = (text) => {
    const raw = String(text || '').trim();
    raw.split(/\r?\n/).forEach((line) => {
      const clean = line.trim();
      if (!clean) {
        y -= 5;
        return;
      }

      const numbered = cvAutoFormatEnabled_() && clean.match(/^(\d+)[.)]\s+(.*)$/);
      const bulleted = cvAutoFormatEnabled_() && clean.match(/^[-•*]\s+(.*)$/);

      if (numbered || bulleted) {
        const marker = numbered ? numbered[1] + '.' : '-';
        const content = numbered ? numbered[2] : bulleted[1];
        ensure(12);
        commands.push(cvPdfTextCommand_(marker, left, y, 9));
        const contentLeft = left + 20;
        const wrapped = cvPdfWrap_(content, 82);
        wrapped.forEach((wrappedLine, index) => {
          ensure(12);
          commands.push(cvPdfTextCommand_(wrappedLine, contentLeft, y, 9));
          y -= 12;
        });
      } else {
        pushWrapped(clean, 9, 12);
      }
    });
  };


  pushText(cvData.fullName || 'Nama Lengkap', 20, 24, '0.08 0.35 0.60 rg');
  if (cvData.targetRole) pushText(cvData.targetRole, 11, 16);
  const contact = [cvData.address, cvData.phone, cvData.email, cvData.linkedin].filter(Boolean).join(' | ');
  if (contact) pushWrapped(contact, 8, 12);
  y -= 6;

  sections.forEach(([title, body]) => {
    if (!body || !String(body).trim()) return;
    ensure(40);
    pushText(title, 10, 15, '0.08 0.35 0.60 rg');
    commands.push('0.08 0.35 0.60 RG');
    commands.push('54 ' + (y + 5).toFixed(2) + ' m 541 ' + (y + 5).toFixed(2) + ' l S');
    y -= 3;
    pushRich(body);
    y -= 6;
  });

  if (commands.length) pages.push(commands.join('\n'));
  return pages;
}

function cvDownloadPdf_() {
  try {
    cvSyncSimpleFields_();
    cvSave_(true);
    renderCvPreview_();
    const pages = cvBuildPdfPages_();
    const bytes = cvCreatePdfBytes_(pages);
    const safeName = (cvData.fullName || 'MyPsych').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    const filename = 'CV-' + (safeName || 'MyPsych') + '.pdf';
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('PDF berhasil dibuat: ' + filename, 'success', 4200);
  } catch (error) {
    console.error('[MyPsych CV] PDF generation failed:', error);
    toast('PDF gagal dibuat. Periksa data CV lalu coba lagi.', 'warning', 5000);
  }
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
        cvData[type][index][key] = target.value;
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
      cvDownloadPdf_();
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

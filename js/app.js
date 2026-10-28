/* UI: rendering, live search, filters, forms and dialogs */
(() => {
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  const els = {
    list: $('#contactList'),
    empty: $('#emptyState'),
    emptyTitle: $('#emptyTitle'),
    emptyText: $('#emptyText'),
    groupList: $('#groupList'),
    search: $('#searchInput'),
    sort: $('#sortSelect'),
    viewTitle: $('#viewTitle'),
    resultCount: $('#resultCount'),
    formModal: $('#formModal'),
    form: $('#contactForm'),
    formTitle: $('#formTitle'),
    avatarPreview: $('#avatarPreview'),
    notesCount: $('#notesCount'),
    viewModal: $('#viewModal'),
    details: $('#detailsContent'),
    confirmModal: $('#confirmModal'),
    importFile: $('#importFile'),
    toasts: $('#toasts'),
    sidebar: $('#sidebar'),
    overlay: $('#sidebarOverlay')
  };

  const GROUP_ICONS = { Family: 'fa-house-chimney', Friends: 'fa-face-smile', Work: 'fa-briefcase', Other: 'fa-tag' };

  const state = {
    filter: 'all',          // 'all', 'favorites' or a group name
    query: '',
    sort: 'name-asc',
    view: 'grid',
    editingId: null,        // null = adding a new contact
    avatarSeed: 0
  };

  // ---------- helpers ----------
  const escapeHTML = str =>
    String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const fullName = c => `${c.firstName} ${c.lastName}`.trim();
  const digits = str => str.replace(/\D/g, '');
  const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const terms = () => state.query.toLowerCase().split(/\s+/).filter(Boolean);

  // Wraps search matches in <mark>, escaping everything else
  function highlight(text) {
    const words = terms();
    if (!text || !words.length) return escapeHTML(text || '');
    const pattern = new RegExp(`(${words.map(escapeRegex).join('|')})`, 'gi');
    return text
      .split(pattern)
      .map((part, i) => (i % 2 ? `<mark>${escapeHTML(part)}</mark>` : escapeHTML(part)))
      .join('');
  }

  function avatarHTML(contact, size = '') {
    const { style, html } = Avatar.render(contact);
    return `<div class="avatar ${size}" style="${style}" aria-hidden="true">${html}</div>`;
  }

  function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
    const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString(undefined, opts);
  }

  function birthdayInfo(iso) {
    if (!iso) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const born = new Date(iso + 'T00:00:00');
    const next = new Date(today.getFullYear(), born.getMonth(), born.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    const days = Math.round((next - today) / 86400000);
    const age = next.getFullYear() - born.getFullYear();
    if (days === 0) return `🎉 Turns ${age} today!`;
    return `Turns ${age} in ${days} day${days === 1 ? '' : 's'}`;
  }

  // ---------- search, filter, sort ----------
  function matches(contact) {
    const words = terms();
    if (!words.length) return true;
    const haystack = [
      fullName(contact), contact.phone, contact.email, contact.company,
      contact.jobTitle, contact.address, contact.group, contact.notes
    ].join(' ').toLowerCase();
    const phoneDigits = digits(contact.phone);
    // every word typed must appear somewhere in the contact
    return words.every(w => haystack.includes(w) || (digits(w).length >= 3 && phoneDigits.includes(digits(w))));
  }

  const sorters = {
    'name-asc': (a, b) => fullName(a).localeCompare(fullName(b)),
    'name-desc': (a, b) => fullName(b).localeCompare(fullName(a)),
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    company: (a, b) => (a.company || '￿').localeCompare(b.company || '￿') || fullName(a).localeCompare(fullName(b))
  };

  function visibleContacts() {
    return Store.all()
      .filter(c => state.filter === 'all' || (state.filter === 'favorites' ? c.favorite : c.group === state.filter))
      .filter(matches)
      .sort(sorters[state.sort]);
  }

  // ---------- rendering ----------
  function renderGroups() {
    const contacts = Store.all();
    const count = key =>
      key === 'all' ? contacts.length
        : key === 'favorites' ? contacts.filter(c => c.favorite).length
        : contacts.filter(c => c.group === key).length;

    const items = [
      { key: 'all', label: 'All Contacts', icon: 'fa-address-book' },
      { key: 'favorites', label: 'Favorites', icon: 'fa-star' },
      ...Store.GROUPS.map(g => ({ key: g, label: g, icon: GROUP_ICONS[g] }))
    ];

    els.groupList.innerHTML = items.map(item => `
      <li>
        <button class="group-btn ${state.filter === item.key ? 'active' : ''}" data-filter="${item.key}">
          <i class="fa-solid ${item.icon}"></i><span>${item.label}</span><em>${count(item.key)}</em>
        </button>
      </li>`).join('');
  }

  function renderStats() {
    const contacts = Store.all();
    const month = new Date().getMonth();
    $('#statTotal').textContent = contacts.length;
    $('#statFav').textContent = contacts.filter(c => c.favorite).length;
    $('#statWork').textContent = contacts.filter(c => c.group === 'Work').length;
    $('#statBirthday').textContent = contacts.filter(c => c.birthday && new Date(c.birthday + 'T00:00:00').getMonth() === month).length;
  }

  function cardHTML(c) {
    const role = [c.jobTitle, c.company].filter(Boolean).join(' · ');
    return `
      <article class="card" data-id="${c.id}" tabindex="0" aria-label="${escapeHTML(fullName(c))}">
        <button class="fav-btn ${c.favorite ? 'on' : ''}" data-action="favorite" aria-label="${c.favorite ? 'Remove from' : 'Add to'} favorites" aria-pressed="${c.favorite}">
          <i class="fa-${c.favorite ? 'solid' : 'regular'} fa-star"></i>
        </button>
        ${avatarHTML(c)}
        <div class="card-main">
          <h3>${highlight(fullName(c))}</h3>
          <p class="role">${role ? highlight(role) : '&nbsp;'}</p>
        </div>
        <ul class="card-info">
          <li><i class="fa-solid fa-phone"></i><span>${highlight(c.phone) || '<span class="muted">No phone</span>'}</span></li>
          <li><i class="fa-solid fa-envelope"></i><span>${highlight(c.email) || '<span class="muted">No email</span>'}</span></li>
        </ul>
        <span class="badge badge-${c.group.toLowerCase()}"><i class="fa-solid ${GROUP_ICONS[c.group]}"></i> ${c.group}</span>
        <div class="card-actions">
          ${c.phone ? `<a class="icon-btn" href="tel:${escapeHTML(c.phone.replace(/[^\d+]/g, ''))}" aria-label="Call"><i class="fa-solid fa-phone"></i></a>` : ''}
          ${c.email ? `<a class="icon-btn" href="mailto:${escapeHTML(c.email)}" aria-label="Email"><i class="fa-solid fa-envelope"></i></a>` : ''}
          <button class="icon-btn" data-action="edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn danger" data-action="delete" aria-label="Delete"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </article>`;
  }

  function render() {
    const list = visibleContacts();
    const total = Store.all().length;

    els.list.className = `contacts ${state.view}`;
    els.list.innerHTML = list.map(cardHTML).join('');

    const title = state.filter === 'all' ? 'All Contacts' : state.filter === 'favorites' ? 'Favorites' : state.filter;
    els.viewTitle.textContent = title;
    els.resultCount.textContent = state.query
      ? `${list.length} result${list.length === 1 ? '' : 's'} for “${state.query}”`
      : `${list.length} contact${list.length === 1 ? '' : 's'}`;

    els.empty.hidden = list.length > 0;
    if (!list.length) {
      if (!total) {
        els.emptyTitle.textContent = 'No contacts yet';
        els.emptyText.textContent = 'Add your first contact or import a JSON file.';
      } else if (state.query) {
        els.emptyTitle.textContent = 'No matches found';
        els.emptyText.textContent = 'Try a different name, number or email.';
      } else {
        els.emptyTitle.textContent = `No contacts in ${title}`;
        els.emptyText.textContent = 'Add one, or pick another group.';
      }
    }

    renderGroups();
    renderStats();
  }

  // ---------- toasts ----------
  function toast(message, type = 'success', action) {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${escapeHTML(message)}</span>`;
    if (action) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.addEventListener('click', () => { action.onClick(); dismiss(); });
      el.appendChild(btn);
    }
    els.toasts.appendChild(el);
    const dismiss = () => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 300);
    };
    setTimeout(dismiss, action ? 6000 : 3500);
  }

  // ---------- confirm dialog (returns a Promise) ----------
  function confirmDialog({ icon, tone = 'danger', title, text, buttons }) {
    $('#confirmIcon').className = `confirm-icon ${tone}`;
    $('#confirmIcon').innerHTML = `<i class="fa-solid ${icon}"></i>`;
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmActions').innerHTML = buttons
      .map(b => `<button class="btn ${b.cls}" value="${b.value}">${b.label}</button>`)
      .join('');

    return new Promise(resolve => {
      const modal = els.confirmModal;
      const onClick = e => {
        const btn = e.target.closest('button');
        if (btn) modal.close(btn.value);
      };
      modal.addEventListener('click', onClick);
      modal.addEventListener('close', () => {
        modal.removeEventListener('click', onClick);
        resolve(modal.returnValue || 'cancel');
      }, { once: true });
      modal.returnValue = '';
      modal.showModal();
    });
  }

  // ---------- form: add / edit ----------
  const field = name => els.form.elements[name];

  function formData() {
    return {
      firstName: field('firstName').value,
      lastName: field('lastName').value,
      phone: field('phone').value,
      email: field('email').value,
      company: field('company').value,
      jobTitle: field('jobTitle').value,
      group: field('group').value,
      birthday: field('birthday').value,
      address: field('address').value,
      notes: field('notes').value,
      favorite: field('favorite').checked,
      avatarStyle: field('avatarStyle').value,
      avatarSeed: state.avatarSeed
    };
  }

  function updatePreview() {
    const data = formData();
    Avatar.paint(els.avatarPreview, { ...data, firstName: data.firstName || '?' });
  }

  function setError(name, message) {
    const input = field(name);
    const error = $(`#${name}-error`);
    input.classList.toggle('invalid', Boolean(message));
    input.setAttribute('aria-invalid', Boolean(message));
    if (message) input.setAttribute('aria-describedby', `${name}-error`);
    else input.removeAttribute('aria-describedby');
    error.textContent = message || '';
    return !message;
  }

  const validators = {
    firstName: v => (!v.trim() ? 'First name is required.'
      : !/^[\p{L}][\p{L} .'-]*$/u.test(v.trim()) ? 'Use letters only.' : ''),
    lastName: v => (v.trim() && !/^[\p{L}][\p{L} .'-]*$/u.test(v.trim()) ? 'Use letters only.' : ''),
    phone: v => {
      if (!v.trim()) return 'Phone number is required.';
      if (!/^\+?[\d\s\-()]+$/.test(v.trim())) return 'Only digits, spaces, +, - and ( ) are allowed.';
      const count = digits(v).length;
      return count < 7 || count > 15 ? 'Phone number should have 7–15 digits.' : '';
    },
    email: v => (v.trim() && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? 'Enter a valid email address.' : ''),
    birthday: v => (v && new Date(v + 'T00:00:00') > new Date() ? 'Birthday cannot be in the future.' : '')
  };

  function validate(name) {
    return setError(name, validators[name](field(name).value));
  }

  function validateAll() {
    const results = Object.keys(validators).map(validate);
    if (results.every(Boolean)) {
      // Check for an existing contact with the same phone / email
      const data = formData();
      const dup = Store.findDuplicate({ phone: data.phone, email: data.email.trim().toLowerCase() },
        Store.all().filter(c => c.id !== state.editingId));
      if (dup) {
        const sameEmail = data.email && dup.email === data.email.trim().toLowerCase();
        setError(sameEmail ? 'email' : 'phone', `Already saved for ${fullName(dup)}.`);
        return false;
      }
      return true;
    }
    return false;
  }

  function openForm(id = null) {
    const contact = id ? Store.get(id) : null;
    state.editingId = contact ? contact.id : null;
    state.avatarSeed = contact ? contact.avatarSeed : 0;

    els.form.reset();
    Object.keys(validators).forEach(name => setError(name, ''));
    els.formTitle.textContent = contact ? 'Edit Contact' : 'New Contact';
    $('#saveBtn').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> ${contact ? 'Save Changes' : 'Save Contact'}`;

    if (contact) {
      ['firstName', 'lastName', 'phone', 'email', 'company', 'jobTitle', 'group', 'birthday', 'address', 'notes']
        .forEach(name => { field(name).value = contact[name]; });
      field('favorite').checked = contact.favorite;
      field('avatarStyle').value = contact.avatarStyle;
    } else if (Store.GROUPS.includes(state.filter)) {
      field('group').value = state.filter;    // pre-select the group being viewed
    } else if (state.filter === 'favorites') {
      field('favorite').checked = true;
    }

    els.notesCount.textContent = field('notes').value.length;
    updatePreview();
    els.viewModal.close();
    els.formModal.showModal();
    field('firstName').focus();
  }

  els.form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateAll()) {
      els.form.querySelector('.invalid')?.focus();
      return;
    }
    const data = formData();
    if (state.editingId) {
      const updated = Store.update(state.editingId, data);
      toast(`${fullName(updated)} updated`);
    } else {
      const added = Store.add(data);
      toast(`${fullName(added)} added to contacts`);
    }
    els.formModal.close();
    render();
  });

  // Validate a field as the user leaves it, re-check while fixing it
  els.form.addEventListener('focusout', e => {
    if (validators[e.target.name] && e.target.value) validate(e.target.name);
  });
  els.form.addEventListener('input', e => {
    const { name } = e.target;
    if (validators[name] && e.target.classList.contains('invalid')) validate(name);
    if (name === 'notes') els.notesCount.textContent = e.target.value.length;
    if (['firstName', 'lastName', 'avatarStyle'].includes(name)) updatePreview();
  });
  $('#shuffleAvatar').addEventListener('click', () => {
    state.avatarSeed = (state.avatarSeed + 1 + Math.floor(Math.random() * 1000)) % 100000;
    updatePreview();
  });

  // ---------- details view ----------
  function openDetails(id) {
    const c = Store.get(id);
    if (!c) return;
    const role = [c.jobTitle, c.company].filter(Boolean).join(' at ');
    const rows = [
      ['fa-phone', 'Phone', c.phone && `<a href="tel:${escapeHTML(c.phone.replace(/[^\d+]/g, ''))}">${escapeHTML(c.phone)}</a>`, c.phone],
      ['fa-envelope', 'Email', c.email && `<a href="mailto:${escapeHTML(c.email)}">${escapeHTML(c.email)}</a>`, c.email],
      ['fa-location-dot', 'Address', c.address && escapeHTML(c.address)],
      ['fa-cake-candles', 'Birthday', c.birthday && `${formatDate(c.birthday, { day: 'numeric', month: 'long', year: 'numeric' })}<small>${birthdayInfo(c.birthday)}</small>`],
      ['fa-note-sticky', 'Notes', c.notes && escapeHTML(c.notes)]
    ].filter(row => row[2]);

    els.details.innerHTML = `
      <header class="details-head">
        <button class="icon-btn close" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        ${avatarHTML(c, 'avatar-xl')}
        <h2 id="viewName">${escapeHTML(fullName(c))} ${c.favorite ? '<i class="fa-solid fa-star star"></i>' : ''}</h2>
        ${role ? `<p class="role">${escapeHTML(role)}</p>` : ''}
        <span class="badge badge-${c.group.toLowerCase()}"><i class="fa-solid ${GROUP_ICONS[c.group]}"></i> ${c.group}</span>
      </header>
      <ul class="details-list">
        ${rows.map(([icon, label, value, copy]) => `
          <li>
            <i class="fa-solid ${icon}"></i>
            <div><span>${label}</span><p>${value}</p></div>
            ${copy ? `<button class="icon-btn" data-copy="${escapeHTML(copy)}" aria-label="Copy ${label.toLowerCase()}"><i class="fa-regular fa-copy"></i></button>` : ''}
          </li>`).join('') || '<li class="muted">No extra details saved.</li>'}
      </ul>
      <p class="meta">Added ${formatDate(c.createdAt)}${c.updatedAt !== c.createdAt ? ` · Edited ${formatDate(c.updatedAt)}` : ''}</p>
      <footer class="modal-foot">
        <button class="btn btn-ghost danger" data-action="delete" data-id="${c.id}"><i class="fa-solid fa-trash-can"></i> Delete</button>
        <button class="btn btn-primary" data-action="edit" data-id="${c.id}"><i class="fa-solid fa-pen"></i> Edit</button>
      </footer>`;

    if (!els.viewModal.open) els.viewModal.showModal();
  }

  els.details.addEventListener('click', async e => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        toast('Copied to clipboard', 'info');
      } catch {
        toast('Could not copy', 'error');
      }
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit') openForm(btn.dataset.id);
    if (btn.dataset.action === 'delete') deleteContact(btn.dataset.id);
  });

  // ---------- delete with undo ----------
  async function deleteContact(id) {
    const c = Store.get(id);
    if (!c) return;
    const answer = await confirmDialog({
      icon: 'fa-trash-can',
      title: 'Delete contact?',
      text: `${fullName(c)} will be removed from your contacts.`,
      buttons: [
        { label: 'Cancel', cls: 'btn-ghost', value: 'cancel' },
        { label: 'Delete', cls: 'btn-danger', value: 'delete' }
      ]
    });
    if (answer !== 'delete') return;
    const removed = Store.remove(id);
    els.viewModal.close();
    render();
    toast(`${fullName(c)} deleted`, 'info', {
      label: 'Undo',
      onClick: () => { Store.restore(removed); render(); toast(`${fullName(c)} restored`); }
    });
  }

  // ---------- list interactions (event delegation) ----------
  els.list.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.target.closest('a')) return;        // let tel: / mailto: links work
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id = card.dataset.id;

    if (action === 'favorite') {
      const c = Store.update(id, { favorite: !Store.get(id).favorite });
      render();
      toast(c.favorite ? `${fullName(c)} added to favorites` : `${fullName(c)} removed from favorites`, 'info');
    } else if (action === 'edit') {
      openForm(id);
    } else if (action === 'delete') {
      deleteContact(id);
    } else {
      openDetails(id);
    }
  });

  els.list.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('card')) openDetails(e.target.dataset.id);
  });

  els.groupList.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    closeSidebar();
    render();
  });

  // Live search: results update on every keystroke
  els.search.addEventListener('input', () => {
    state.query = els.search.value.trim();
    render();
  });

  els.sort.addEventListener('change', () => {
    state.sort = els.sort.value;
    savePrefs();
    render();
  });

  $$('[data-view]').forEach(btn => btn.addEventListener('click', () => {
    state.view = btn.dataset.view;
    $$('[data-view]').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', b === btn);
    });
    savePrefs();
    render();
  }));

  $('#addBtn').addEventListener('click', () => { closeSidebar(); openForm(); });
  $('#emptyAddBtn').addEventListener('click', () => openForm());

  // Close buttons and clicking the dark backdrop close any dialog
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  });

  // ---------- export ----------
  $('#exportBtn').addEventListener('click', () => {
    const count = Store.all().length;
    if (!count) {
      toast('There are no contacts to export', 'error');
      return;
    }
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    closeSidebar();
    toast(`Exported ${count} contact${count === 1 ? '' : 's'}`);
  });

  // ---------- import ----------
  $('#importBtn').addEventListener('click', () => els.importFile.click());

  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files[0];
    els.importFile.value = '';               // allow picking the same file again
    if (!file) return;
    closeSidebar();

    if (file.size > 2 * 1024 * 1024) {
      toast('File is too large (max 2 MB)', 'error');
      return;
    }

    let result;
    try {
      result = Store.parseImport(JSON.parse(await file.text()));
    } catch (err) {
      toast(err instanceof SyntaxError ? 'This file is not valid JSON' : err.message, 'error');
      return;
    }
    if (!result.valid.length) {
      toast('No valid contacts found (each needs a first name and a phone or email)', 'error');
      return;
    }

    const skippedNote = result.invalid ? ` ${result.invalid} invalid record(s) will be skipped.` : '';
    const mode = await confirmDialog({
      icon: 'fa-file-import',
      tone: 'info',
      title: `Import ${result.valid.length} contact${result.valid.length === 1 ? '' : 's'}?`,
      text: `Merge adds new contacts and skips duplicates. Replace removes your current contacts first.${skippedNote}`,
      buttons: [
        { label: 'Cancel', cls: 'btn-ghost', value: 'cancel' },
        { label: 'Replace all', cls: 'btn-danger', value: 'replace' },
        { label: 'Merge', cls: 'btn-primary', value: 'merge' }
      ]
    });
    if (mode === 'cancel') return;

    const { added, skipped } = Store.applyImport(result.valid, mode);
    state.filter = 'all';
    render();
    toast(`Imported ${added} contact${added === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}`);
  });

  // ---------- theme, sidebar, shortcuts ----------
  const PREFS = 'contacthub.prefs';
  function savePrefs() {
    try {
      localStorage.setItem(PREFS, JSON.stringify({
        theme: document.documentElement.dataset.theme, sort: state.sort, view: state.view
      }));
    } catch { /* storage unavailable – preferences just won't persist */ }
  }

  function loadPrefs() {
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { /* ignore */ }
    const dark = prefs.theme ? prefs.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(dark ? 'dark' : 'light');
    if (sorters[prefs.sort]) state.sort = els.sort.value = prefs.sort;
    if (prefs.view === 'list') $('[data-view="list"]').click();
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('#themeBtn').innerHTML = `<i class="fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}"></i>`;
  }

  $('#themeBtn').addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    savePrefs();
  });

  function closeSidebar() {
    els.sidebar.classList.remove('open');
    els.overlay.classList.remove('show');
  }
  $('#menuBtn').addEventListener('click', () => {
    els.sidebar.classList.add('open');
    els.overlay.classList.add('show');
  });
  els.overlay.addEventListener('click', closeSidebar);

  // "/" focuses search, Esc clears it, "N" opens a new contact form
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      els.search.focus();
    } else if (e.key === 'Escape' && document.activeElement === els.search) {
      els.search.value = '';
      state.query = '';
      render();
    } else if (e.key.toLowerCase() === 'n' && !typing && !e.ctrlKey && !e.metaKey) {
      openForm();
    }
  });

  loadPrefs();
  render();
})();

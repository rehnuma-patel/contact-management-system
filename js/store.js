/* Data layer: keeps the contacts array, saves it to localStorage
   and handles create / read / update / delete and JSON import. */
const Store = (() => {
  const KEY = 'contacthub.contacts';
  const GROUPS = ['Family', 'Friends', 'Work', 'Other'];
  const STYLES = ['initials', 'pattern', 'emoji'];

  const SAMPLE = [
    { firstName: 'Aisha', lastName: 'Khan', phone: '+91 98200 11223', email: 'aisha.khan@example.com', company: 'Nimbus Labs', jobTitle: 'UI Designer', group: 'Work', favorite: true, birthday: '1998-03-14', address: 'Bandra West, Mumbai', notes: 'Met at the design meetup.' },
    { firstName: 'Rahul', lastName: 'Mehta', phone: '+91 99300 44556', email: 'rahul.m@example.com', company: 'Brightpath', jobTitle: 'Backend Developer', group: 'Work', avatarStyle: 'pattern' },
    { firstName: 'Sara', lastName: 'Patel', phone: '+91 97000 77889', email: 'sara.patel@example.com', group: 'Family', favorite: true, birthday: '2001-11-02', avatarStyle: 'emoji' },
    { firstName: 'Daniel', lastName: 'Fernandes', phone: '+91 98111 22334', email: 'daniel.f@example.com', group: 'Friends', address: 'Panaji, Goa' },
    { firstName: 'Meera', lastName: 'Iyer', phone: '+91 90040 55667', email: 'meera.iyer@example.com', company: 'Clearwave', jobTitle: 'Product Manager', group: 'Work' },
    { firstName: 'Zoya', lastName: 'Shaikh', phone: '+91 93210 88990', group: 'Friends', birthday: '1999-07-21', avatarStyle: 'pattern' }
  ];

  let contacts = [];

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  const clean = value => (typeof value === 'string' ? value.trim() : '');

  /* Makes sure a contact object has every field with a valid value.
     Used for both the form and imported data. */
  function normalize(raw, keepId = true) {
    const now = new Date().toISOString();
    return {
      id: keepId && clean(raw.id) ? clean(raw.id) : uid(),
      firstName: clean(raw.firstName).slice(0, 40),
      lastName: clean(raw.lastName).slice(0, 40),
      phone: clean(raw.phone).slice(0, 20),
      email: clean(raw.email).toLowerCase().slice(0, 80),
      company: clean(raw.company).slice(0, 60),
      jobTitle: clean(raw.jobTitle).slice(0, 60),
      address: clean(raw.address).slice(0, 120),
      birthday: /^\d{4}-\d{2}-\d{2}$/.test(clean(raw.birthday)) ? clean(raw.birthday) : '',
      notes: clean(raw.notes).slice(0, 300),
      group: GROUPS.includes(raw.group) ? raw.group : 'Other',
      favorite: Boolean(raw.favorite),
      avatarStyle: STYLES.includes(raw.avatarStyle) ? raw.avatarStyle : 'initials',
      avatarSeed: Number.isInteger(raw.avatarSeed) ? raw.avatarSeed : 0,
      createdAt: isNaN(Date.parse(raw.createdAt)) ? now : raw.createdAt,
      updatedAt: isNaN(Date.parse(raw.updatedAt)) ? now : raw.updatedAt
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(contacts));
    } catch (err) {
      console.warn('Could not save contacts', err);
    }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(saved)) {
        contacts = saved.map(c => normalize(c));
        return;
      }
    } catch (err) {
      console.warn('Saved data was unreadable, loading samples', err);
    }
    // First visit: start with some example contacts, a few days apart
    contacts = SAMPLE.map((c, i) => {
      const date = new Date(Date.now() - (SAMPLE.length - i) * 86400000).toISOString();
      return normalize({ ...c, createdAt: date, updatedAt: date }, false);
    });
    save();
  }

  // ----- CRUD -----
  const all = () => [...contacts];
  const get = id => contacts.find(c => c.id === id);

  function add(data) {
    const contact = normalize(data, false);
    contacts.push(contact);
    save();
    return contact;
  }

  function update(id, data) {
    const index = contacts.findIndex(c => c.id === id);
    if (index === -1) return null;
    const old = contacts[index];
    contacts[index] = normalize({ ...old, ...data, id, createdAt: old.createdAt, updatedAt: new Date().toISOString() });
    save();
    return contacts[index];
  }

  function remove(id) {
    const index = contacts.findIndex(c => c.id === id);
    if (index === -1) return null;
    const [removed] = contacts.splice(index, 1);
    save();
    return { contact: removed, index };
  }

  // Put a deleted contact back where it was (used by "Undo")
  function restore({ contact, index }) {
    contacts.splice(Math.min(index, contacts.length), 0, contact);
    save();
  }

  // Two contacts are duplicates if they share an email or phone number
  const digits = phone => phone.replace(/\D/g, '');
  function findDuplicate(contact, list = contacts) {
    return list.find(c =>
      (contact.email && c.email === contact.email) ||
      (digits(contact.phone).length >= 6 && digits(c.phone) === digits(contact.phone))
    );
  }

  /* Reads parsed JSON (an array, or { contacts: [...] }) and returns
     { valid, invalid } without changing the stored data yet. */
  function parseImport(data) {
    const list = Array.isArray(data) ? data : data && Array.isArray(data.contacts) ? data.contacts : null;
    if (!list) throw new Error('File must contain an array of contacts.');

    const valid = list
      .filter(item => item && typeof item === 'object')
      .map(item => normalize(item, false))
      .filter(c => c.firstName && (c.phone || c.email));

    return { valid, invalid: list.length - valid.length };
  }

  // mode "merge" skips duplicates, mode "replace" overwrites everything
  function applyImport(valid, mode) {
    if (mode === 'replace') {
      contacts = valid;
      save();
      return { added: valid.length, skipped: 0 };
    }
    const fresh = [];
    valid.forEach(c => {
      if (!findDuplicate(c) && !findDuplicate(c, fresh)) fresh.push(c);
    });
    contacts.push(...fresh);
    save();
    return { added: fresh.length, skipped: valid.length - fresh.length };
  }

  function exportJSON() {
    return JSON.stringify(
      { app: 'ContactHub', version: 1, exportedAt: new Date().toISOString(), count: contacts.length, contacts },
      null, 2
    );
  }

  load();

  return { GROUPS, all, get, add, update, remove, restore, findDuplicate, parseImport, applyImport, exportJSON };
})();

/* Avatar generator
   Builds a unique avatar for each contact from its name and a "seed".
   The same name + seed always gives the same avatar. */
const Avatar = (() => {
  const EMOJIS = ['🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐙', '🦉', '🐧', '🐳', '🦄', '🐝', '🌵', '🌻', '🍀', '🚀', '🎧', '🎨'];

  // Turn any text into a number (simple string hash)
  function hash(text) {
    return [...text].reduce((h, ch) => (Math.imul(31, h) + ch.charCodeAt(0)) | 0, 7) >>> 0;
  }

  function initials(first = '', last = '') {
    const letters = [first, last]
      .map(part => part.trim().charAt(0))
      .filter(Boolean)
      .join('')
      .toUpperCase();
    return letters || '?';
  }

  // Two colours that look good together
  function colors(key) {
    const hue = hash(key) % 360;
    return [`hsl(${hue} 70% 58%)`, `hsl(${(hue + 40) % 360} 75% 48%)`];
  }

  // 5x5 symmetric pattern (like GitHub identicons)
  function patternSVG(key, color) {
    const h = hash(key + '#pattern');
    let cells = '';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if ((h >> (row * 3 + col)) & 1) {
          cells += `<rect x="${col}" y="${row}" width="1" height="1"/>`;
          if (col < 2) cells += `<rect x="${4 - col}" y="${row}" width="1" height="1"/>`;
        }
      }
    }
    return `<svg viewBox="-0.5 -0.5 6 6" aria-hidden="true" fill="${color}">${cells}</svg>`;
  }

  /* Returns { style, html } for a contact.
     style  → inline CSS for the background
     html   → inner content (letters, SVG or emoji) */
  function render(contact) {
    const key = `${contact.firstName} ${contact.lastName}|${contact.avatarSeed || 0}`;
    const [c1, c2] = colors(key);

    if (contact.avatarStyle === 'pattern') {
      return { style: 'background:#fff', html: patternSVG(key, c2) };
    }
    if (contact.avatarStyle === 'emoji') {
      return { style: `background:linear-gradient(135deg, ${c1}, ${c2})`, html: `<span class="emoji">${EMOJIS[hash(key) % EMOJIS.length]}</span>` };
    }
    return {
      style: `background:linear-gradient(135deg, ${c1}, ${c2})`,
      // initials come from user input, so escape them before using innerHTML
      html: initials(contact.firstName, contact.lastName)
        .replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)
    };
  }

  function paint(el, contact) {
    const { style, html } = render(contact);
    el.setAttribute('style', style);
    el.innerHTML = html;
  }

  return { render, paint, initials };
})();

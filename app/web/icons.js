// M3-style icon set — self-hosted inline SVG, not the Material Symbols
// webfont/CDN. The app loads zero external resources (system fonts only,
// see tokens.css) and ships with no build step; a font-CDN icon set would
// break both. These are hand-drawn to match Material Symbols Outlined's
// silhouette (24dp grid, stroke-based, round caps/joins) rather than an
// exact path export — same technique the disclosure chevron already used
// before this file existed, just named and shared instead of one-off.
//
// Usage: iconSVG('chat', 'my-class') -> a <svg class="tau-icon my-class">
// string, safe to drop into .innerHTML alongside text nodes.

const ICONS = {
  // A teacher's note reads as a message, not correspondence — chat_bubble's
  // shape (a tail, not an envelope) says "someone said something here"
  // rather than "mail arrived," which fits an in-app note better.
  chat:
    '<rect x="3.5" y="4.5" width="17" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M8 15.5 6.8 19 11 15.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  expandMore:
    '<path d="M5 8.5 12 15l7-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  close:
    '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  description:
    '<path d="M6.5 3.5h7l4 4v12.5a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M9 12.5h6M9 16h6M9 9h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  arrowForward:
    '<path d="M4 12h15M13.5 5.5 20 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  // ── Menu vocabulary ──────────────────────────────────────────────────────
  // Added when the object action menus landed. The header's "+ Add" picker
  // used emoji (📄 👤 🗂) while this file existed unused beside it — two icon
  // systems in two menus that are meant to read as one. These replace the
  // emoji there as well, so both menus draw from the same set.
  moreHoriz:
    '<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/>'
    + '<circle cx="12" cy="12" r="1.6" fill="currentColor"/>'
    + '<circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>',
  personAdd:
    '<circle cx="10" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M3.5 19.5c0-3.3 2.9-5.5 6.5-5.5 1 0 1.9.2 2.7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M17.5 14v6M14.5 17h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  folder:
    '<path d="M3.5 6.5a1 1 0 0 1 1-1h4.2l1.8 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  edit:
    '<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M13.5 7.5l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  archive:
    '<rect x="3.5" y="4.5" width="17" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M5 8.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M10 12.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  trash:
    '<path d="M4.5 6.5h15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M9 6.5V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M6.5 6.5 7.4 19a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1l.9-12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  copy:
    '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M15.5 5.5H6a1.5 1.5 0 0 0-1.5 1.5v9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  swap:
    '<path d="M4 8.5h13M13.5 5 17 8.5 13.5 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M20 15.5H7M10.5 12 7 15.5 10.5 19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  plusCircle:
    '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/>'
    + '<path d="M12 8.5v7M8.5 12h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  checklist:
    '<path d="M10 6.5h9M10 12h9M10 17.5h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M4.5 6.2 6 7.7l2.5-2.8M4.5 11.7 6 13.2l2.5-2.8M4.5 17.2 6 18.7l2.5-2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
};

function iconSVG(name, className = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="tau-icon${className ? ` ${className}` : ''}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;
}

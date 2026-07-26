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
  checklist:
    '<path d="M10 6.5h9M10 12h9M10 17.5h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    + '<path d="M4.5 6.2 6 7.7l2.5-2.8M4.5 11.7 6 13.2l2.5-2.8M4.5 17.2 6 18.7l2.5-2.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
};

function iconSVG(name, className = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="tau-icon${className ? ` ${className}` : ''}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;
}

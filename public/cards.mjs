// Vector cards: sharp at every size. Faces are drawn here, the table decides how they move.
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const RED = '#c8173a', INK = '#1b1320', PAPER = '#fdf8ee';
const paths = {
 heart:'M0 19C-5 14-20 5-20-7C-20-22-5-24 0-13C5-24 20-22 20-7C20 5 5 14 0 19Z',
 diamond:'M0-24 17 0 0 24-17 0Z',
 spade:'M0-24C5-17 20-6 20 4C20 17 7 20 2 10L6 24H-6L-2 10C-7 20-20 17-20 4C-20-6-5-17 0-24Z',
 club:'M0-23C13-23 15-8 6-3C21-10 27 12 12 17C7 19 3 15 2 11L6 24H-6L-2 11C-3 15-7 19-12 17C-27 12-21-10-6-3C-15-8-13-23 0-23Z'
};
const suitKey = c => ({'♥':'heart','♦':'diamond','♠':'spade','♣':'club'}[c.symbol] || 'spade');
const pip = (key,x,y,scale=1,rotate=0) => `<path d="${paths[key]}" transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})"/>`;
const layouts={
 2:[[120,88],[120,248]],
 3:[[120,88],[120,168],[120,248]],
 4:[[80,92],[160,92],[80,244],[160,244]],
 5:[[80,92],[160,92],[120,168],[80,244],[160,244]],
 6:[[80,92],[160,92],[80,168],[160,168],[80,244],[160,244]],
 7:[[80,92],[160,92],[120,130],[80,168],[160,168],[80,244],[160,244]],
 8:[[80,86],[160,86],[120,127],[80,168],[160,168],[120,209],[80,250],[160,250]],
 9:[[80,82],[160,82],[80,140],[160,140],[120,168],[80,196],[160,196],[80,254],[160,254]],
 10:[[80,82],[160,82],[120,111],[80,140],[160,140],[80,196],[160,196],[120,225],[80,254],[160,254]]
};

function frontSVG(c){
 const key=suitKey(c),color=c.color==='red'?RED:INK;
 let center;
 if(c.rank==='A')center=pip(key,120,160,2.6)+`<text x="120" y="262" text-anchor="middle" font-family="'Bagel Fat One',sans-serif" font-size="15" opacity=".85">le purple</text>`;
 else if(layouts[c.rank])center=layouts[c.rank].map(([x,y])=>pip(key,x,y,.78,y>168?180:0)).join('');
 else center=`<rect x="56" y="62" width="128" height="212" rx="14" fill="${color}" fill-opacity=".07" stroke="${color}" stroke-opacity=".35" stroke-width="1.5"/><rect x="64" y="70" width="112" height="196" rx="9" fill="none" stroke="${color}" stroke-opacity=".2"/>${pip(key,120,104,.7)}<text x="120" y="222" text-anchor="middle" font-family="'Bagel Fat One',sans-serif" font-size="104">${escape(c.rank)}</text>${pip(key,120,246,.45,180)}`;
 const corner=`<text x="28" y="44" text-anchor="middle" font-size="34" font-weight="700" font-family="Rubik,sans-serif" letter-spacing="-1">${escape(c.rank)}</text>${pip(key,28,66,.42)}`;
 return `<svg viewBox="0 0 240 336" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="238" height="334" rx="18" fill="${PAPER}" stroke="#e2d8c6" stroke-width="2"/><g fill="${color}">${corner}<g transform="translate(240 336) rotate(180)">${corner}</g>${center}</g></svg>`;
}

// The mark: a red card and a black card. Where they overlap, it turns purple.
export function logoMark(cls='logo-mark'){
 return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><defs><clipPath id="lm-red"><rect x="5" y="9" width="22" height="31" rx="4" transform="rotate(-12 16 24.5)"/></clipPath></defs><rect x="5" y="9" width="22" height="31" rx="4" transform="rotate(-12 16 24.5)" fill="#ff3b55"/><rect x="20" y="7" width="22" height="31" rx="4" transform="rotate(11 31 22.5)" fill="#1b1320" stroke="#fdf8ee" stroke-width="1.6"/><g clip-path="url(#lm-red)"><rect x="20" y="7" width="22" height="31" rx="4" transform="rotate(11 31 22.5)" fill="#a64dff"/></g></svg>`;
}

export function backSVG(){
 return `<svg viewBox="0 0 240 336" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><pattern id="pp-lattice" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="20" height="20" fill="#4a148f"/><rect x="0" y="0" width="10" height="10" fill="#5a1fae"/><circle cx="15" cy="15" r="1.6" fill="#c9a6ff" fill-opacity=".55"/></pattern></defs><rect x="1" y="1" width="238" height="334" rx="18" fill="#fdf8ee"/><rect x="11" y="11" width="218" height="314" rx="11" fill="url(#pp-lattice)"/><rect x="11" y="11" width="218" height="314" rx="11" fill="none" stroke="#2a0b55" stroke-width="2"/><circle cx="120" cy="168" r="50" fill="#fdf8ee"/><circle cx="120" cy="168" r="44" fill="none" stroke="#4a148f" stroke-width="1.5" stroke-dasharray="3 4"/><g transform="translate(91 139) scale(1.2)"><rect x="5" y="9" width="22" height="31" rx="4" transform="rotate(-12 16 24.5)" fill="#ff3b55"/><rect x="20" y="7" width="22" height="31" rx="4" transform="rotate(11 31 22.5)" fill="#1b1320"/></g></svg>`;
}
export function cardBack(extra=''){return `<div class="playing-card card-back ${extra}" role="img" aria-label="Carte face cachée">${backSVG()}</div>`;}
export function card(c,animated=false,extra=''){return `<div class="playing-card card-slot ${animated?'flip-in':''} ${extra}" role="img" aria-label="${escape(c.rank)} de ${escape(c.suit)}, ${c.color==='red'?'rouge':'noir'}"><div class="card-flipper"><div class="card-face card-reverse">${backSVG()}</div><div class="card-face card-front">${frontSVG(c)}</div></div></div>`;}

export function icon(name){
 const p={
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
  share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 2h8"/>',
  sound:'<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 5 6m0-6-5 6"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h10"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.9"/><path d="M12 17.2v.1"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5Z"/>',
  dice:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  door:'<path d="M14 3h5v18h-5M10 17l5-5-5-5M15 12H3"/>',
  flag:'<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  fullscreen:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  heart:'<path d="M12 20s-7-4.4-9-8.7C1.6 8 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.4 3.5 4 6.8-2 4.3-9 8.7-9 8.7Z"/>',
 };
 return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.help}</svg>`;
}

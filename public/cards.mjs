// Vector cards stay sharp at every size; the table controls their overlapping layout.
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 heart:'M0 19C-5 14-20 5-20-7C-20-22-5-24 0-13C5-24 20-22 20-7C20 5 5 14 0 19Z',
 diamond:'M0-24 17 0 0 24-17 0Z',
 spade:'M0-24C5-17 20-6 20 4C20 17 7 20 2 10L6 24H-6L-2 10C-7 20-20 17-20 4C-20-6-5-17 0-24Z',
 club:'M0-23C13-23 15-8 6-3C21-10 27 12 12 17C7 19 3 15 2 11L6 24H-6L-2 11C-3 15-7 19-12 17C-27 12-21-10-6-3C-15-8-13-23 0-23Z'
};
const suitKey = c => ({'♥':'heart','♦':'diamond','♠':'spade','♣':'club'}[c.symbol] || 'spade');
const pip = (key,x,y,scale=1,rotate=0) => `<path d="${paths[key]}" transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})"/>`;
const layouts={
 2:[[120,91],[120,245]],
 3:[[120,88],[120,168],[120,248]],
 4:[[78,91],[162,91],[78,245],[162,245]],
 5:[[78,91],[162,91],[120,168],[78,245],[162,245]],
 6:[[78,91],[162,91],[78,168],[162,168],[78,245],[162,245]],
 7:[[78,91],[162,91],[120,130],[78,168],[162,168],[78,245],[162,245]],
 8:[[78,84],[162,84],[120,125],[78,168],[162,168],[120,211],[78,252],[162,252]],
 9:[[78,81],[162,81],[78,139],[162,139],[120,168],[78,197],[162,197],[78,255],[162,255]],
 10:[[78,81],[162,81],[120,110],[78,139],[162,139],[78,197],[162,197],[120,226],[78,255],[162,255]]
};
function frontSVG(c){
 const key=suitKey(c),color=c.color==='red'?'#b5334d':'#29252d';
 let center='';
 if(c.rank==='A')center=pip(key,120,159,2.2)+`<text x="120" y="239" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="9" letter-spacing="3">LE PURPLE</text>`;
 else if(layouts[c.rank])center=layouts[c.rank].map(([x,y])=>pip(key,x,y,.73,y>168?180:0)).join('');
 else center=`<rect x="63" y="65" width="114" height="206" rx="55" fill="none" stroke="${color}" stroke-opacity=".2"/><path d="M77 116 94 126 120 92 146 126 163 116 149 149H91Z" fill="${color}" opacity=".14"/>${pip(key,120,162,1.3)}<text x="120" y="238" text-anchor="middle" font-size="35" font-family="Georgia,serif">${escape(c.rank)}</text>`;
 const corner=`<text x="27" y="39" text-anchor="middle" font-size="29" font-weight="700" font-family="Arial,sans-serif">${escape(c.rank)}</text>${pip(key,27,58,.39)}`;
 return `<svg viewBox="0 0 240 336" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x=".75" y=".75" width="238.5" height="334.5" rx="17" fill="#fffdf8" stroke="#e4dfd6" stroke-width="1.5"/><g fill="${color}">${corner}<g transform="translate(240 336) rotate(180)">${corner}</g>${center}</g></svg>`;
}
export function backSVG(){return `<svg viewBox="0 0 240 336" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="238" height="334" rx="17" fill="#624684" stroke="#c2aed4" stroke-width="2"/><rect x="13" y="13" width="214" height="310" rx="9" fill="none" stroke="#c2aed4" stroke-width="1"/><g fill="#fffdf8"><text x="120" y="49" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="600" letter-spacing="3">LE PURPLE</text><text x="120" y="299" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" letter-spacing="2">52 CARTES</text></g><g transform="translate(64 99) scale(2.7)" fill="none"><rect x="5" y="4" width="24" height="33" rx="4" stroke="#fffdf8" stroke-width="1.1"/><rect x="12" y="10" width="24" height="33" rx="4" fill="#fffdf8"/><path d="M21 32V20h4a3 3 0 0 1 0 6h-4" stroke="#624684" stroke-width="2.2" stroke-linecap="round"/></g><path d="M92 74h56M92 267h56" stroke="#c2aed4" stroke-width="1"/></svg>`;}
export function cardBack(){return `<div class="playing-card card-back" role="img" aria-label="Carte face cachée">${backSVG()}</div>`;}
export function card(c,animated=false){return `<div class="playing-card card-slot ${animated?'flip-in':''}" role="img" aria-label="${escape(c.rank)} de ${escape(c.suit)}, ${c.color==='red'?'rouge':'noir'}"><div class="card-flipper"><div class="card-face card-reverse">${backSVG()}</div><div class="card-face card-front">${frontSVG(c)}</div></div></div>`;}
export function icon(name){const paths={arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',check:'<path d="m5 12 4 4L19 6"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',trophy:'<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 2h8"/>',sound:'<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 5 6m0-6-5 6"/>'};return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.spark}</svg>`;}

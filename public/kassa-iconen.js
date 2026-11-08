/* Kassa: kleuren en iconen voor de tegels (gedeeld door de app en /kassa) */
var KASSA_KLEUREN={rood:["#c0161f","#fdecec"],oranje:["#d4570e","#fff0e5"],goud:["#b07a12","#fff6e0"],groen:["#1a7f45","#e8f6ee"],blauw:["#1f5fbf","#e9f1fd"],paars:["#6b3fb5","#f1ebfb"],roze:["#c2367a","#fdebf3"],bruin:["#7a4b2a","#f6eee7"],grijs:["#55585e","#f0f1f2"],zwart:["#1a1b1e","#e9e9ea"]};
var KASSA_ICONEN={
 ticket:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
 bier:'<path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M16 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M6 8a3 3 0 0 1 3-4 3 3 0 0 1 5 1 2.5 2.5 0 0 1 2 3"/><path d="M9.5 12v6M12.5 12v6"/>',
 frisdrank:'<path d="M8 7h8l-1 14H9z"/><path d="M12 7l1-4h3"/><path d="M8.5 12h7"/>',
 koffie:'<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c-1 1.2 1 2 0 3.2M12 3c-1 1.2 1 2 0 3.2"/>',
 wijn:'<path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0z"/><path d="M12 12.5V20M8.5 21h7"/>',
 water:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
 frietjes:'<path d="M6 11h12l-1.5 10h-9z"/><path d="M8 11 7 4M10.5 11V3.5M13.5 11V3.5M16 11l1-7"/>',
 hotdog:'<path d="M4 13a3 3 0 0 1 3-3h10a3 3 0 0 1 0 6H7a3 3 0 0 1-3-3z"/><path d="M5 13c2-1.5 3 1.5 5 0s3 1.5 5 0 3 1.5 4 0"/>',
 pannenkoek:'<ellipse cx="12" cy="13" rx="9" ry="4"/><path d="M3 13v2c0 2.2 4 4 9 4s9-1.8 9-4v-2"/><path d="M9 11.5c1.5-.6 4.5-.6 6 0"/>',
 taart:'<path d="M4 20h16v-7H4z"/><path d="M4 16c2 1.5 4-1 6 0s4 1.5 6 0 3-1 4 0"/><path d="M8 13V9M12 13V9M16 13V9"/><path d="M8 6.5c0-1 .8-1.5 0-2.5M12 6.5c0-1 .8-1.5 0-2.5M16 6.5c0-1 .8-1.5 0-2.5"/>',
 ijs:'<path d="M8 10a4 4 0 0 1 8 0z"/><path d="M8 10l4 11 4-11"/>',
 snoep:'<circle cx="12" cy="12" r="4"/><path d="M8.5 10 4 7v10l4.5-3M15.5 10 20 7v10l-4.5-3"/>',
 ballon:'<path d="M12 3a5 5 0 0 1 5 5c0 4-3 7-5 7s-5-3-5-7a5 5 0 0 1 5-5z"/><path d="M12 15l-1 2h2zM12 17c0 2-2 2-2 4"/>',
 cadeau:'<path d="M4 11h16v10H4zM2.5 7.5h19V11h-19zM12 7.5V21"/><path d="M12 7.5C10.5 4 7 3.5 7 5.8 7 7.5 12 7.5 12 7.5zM12 7.5c1.5-3.5 5-4 5-1.7 0 1.7-5 1.7-5 1.7z"/>',
 munt:'<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5a3 3 0 1 0 0 5M8 11h5M8 13h5"/>',
 ster:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 tombola:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
 tshirt:'<path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>'};
function kassaIcoon(k,kl){var p=KASSA_ICONEN[k];return p?'<svg viewBox="0 0 24 24" aria-hidden="true" style="width:30px;height:30px;fill:none;stroke:'+(kl||"currentColor")+';stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round">'+p+'</svg>':""}

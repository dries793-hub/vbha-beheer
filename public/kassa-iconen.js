/* Kassa: kleuren en iconen voor de tegels (gedeeld door de app en /kassa) */
var KASSA_KLEUREN={rood:["#c0161f","#fdecec"],oranje:["#d4570e","#fff0e5"],goud:["#b07a12","#fff6e0"],groen:["#1a7f45","#e8f6ee"],blauw:["#1f5fbf","#e9f1fd"],paars:["#6b3fb5","#f1ebfb"],roze:["#c2367a","#fdebf3"],bruin:["#7a4b2a","#f6eee7"],grijs:["#55585e","#f0f1f2"],zwart:["#1a1b1e","#e9e9ea"]};
var KASSA_ICONEN={
 /* drank */
 bier:'<path d="M6 9h10v10.5A1.5 1.5 0 0 1 14.5 21h-7A1.5 1.5 0 0 1 6 19.5z"/><path d="M16 11h1.6a2.4 2.4 0 0 1 2.4 2.4v1.7a2.4 2.4 0 0 1-2.4 2.4H16"/><path d="M5.5 9.2a2.6 2.6 0 0 1 1.7-4.3 3.2 3.2 0 0 1 5.6-.9 2.6 2.6 0 0 1 3.7 2.4 1.8 1.8 0 0 1-.6 2.8"/><path d="M9 13v5M12.5 13v5"/>',
 pils:'<path d="M7 3h10l-1.6 16.4a1.8 1.8 0 0 1-1.8 1.6h-3.2a1.8 1.8 0 0 1-1.8-1.6z"/><path d="M7.3 6.5h9.4"/><path d="M10.5 10.5v.01M13 13v.01M11 15.5v.01"/>',
 tripel:'<path d="M7 3.5h10c0 4.5-1.5 7.5-5 8-3.5-.5-5-3.5-5-8z"/><path d="M12 11.5V19M8.5 20.5h7"/><path d="M7.4 6.5h9.2"/>',
 frisdrank:'<path d="M7.5 5h9v14.5a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8.5 5V3.5h7V5"/><path d="M7.5 9h9M7.5 16h9"/><path d="M10.5 12.5h3"/>',
 cola:'<path d="M9.5 3h5v2.5c0 1 1.5 1.8 1.5 4V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9.5c0-2.2 1.5-3 1.5-4z"/><path d="M8 13h8M8 16.5h8"/>',
 water:'<path d="M10 3h4v2.2c2 .8 3 2.3 3 4.3V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9.5c0-2 1-3.5 3-4.3z"/><path d="M7 12c1.7-1 3.3 1 5 0s3.3 1 5 0"/>',
 wijn:'<path d="M7.5 3h9l-.4 5.5A4.1 4.1 0 0 1 12 12.4 4.1 4.1 0 0 1 7.9 8.5z"/><path d="M8 7h8"/><path d="M12 12.4V20M8.5 21h7"/>',
 cava:'<path d="M9.5 3h5l-.6 7.3A1.9 1.9 0 0 1 12 12a1.9 1.9 0 0 1-1.9-1.7z"/><path d="M12 12v8M9 21h6"/><path d="M11.2 6.5v.01M12.8 8.5v.01"/>',
 cocktail:'<path d="M4 4h16l-8 8z"/><path d="M12 12v8M8.5 21h7"/><path d="M15 2.5 13 8"/><circle cx="17.5" cy="6.5" r="2"/>',
 jenever:'<path d="M8 6h8l-1 12.5a1.6 1.6 0 0 1-1.6 1.5h-2.8A1.6 1.6 0 0 1 9 18.5z"/><path d="M8.3 10h7.4"/><path d="M10 3.5h4"/>',
 koffie:'<path d="M4 9h12v5.5A5.5 5.5 0 0 1 10.5 20h-1A5.5 5.5 0 0 1 4 14.5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M3 21h14"/><path d="M8 3.2c-.9 1 .9 1.8 0 3M12 3.2c-.9 1 .9 1.8 0 3"/>',
 thee:'<path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M10.5 9V5.5"/><rect x="9" y="3" width="3" height="2.6" rx=".5"/>',
 chocomelk:'<path d="M5 8h12l-1 11.2a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8z"/><path d="M5.4 12h11.2"/><path d="M9 4.5c-.8.9.8 1.6 0 2.6M13 4.5c-.8.9.8 1.6 0 2.6"/><path d="M17 10.5h1a2 2 0 0 1 0 4h-1.3"/>',
 /* eten */
 frietjes:'<path d="M5.5 11h13l-2 10h-9z"/><path d="M8 11 7 4.5M10.5 11 10 3.5M13.5 11 14 3.5M16 11l1-6.5"/><path d="M9 15.5c1.8 1 4.2 1 6 0"/>',
 hamburger:'<path d="M4 11a8 6 0 0 1 16 0z"/><path d="M3.5 14h17"/><path d="M4.5 14c1.2 1.5 2.5-.6 3.8.6s2.5-1.1 3.7 0 2.5-1.1 3.7 0 2.5-.6 3.8-.6"/><path d="M4.5 17.5h15a1.5 1.5 0 0 1-1.5 2.5H6a1.5 1.5 0 0 1-1.5-2.5z"/><path d="M9 8v.01M12 7v.01M15 8v.01"/>',
 hotdog:'<path d="M3.5 13.5a3 3 0 0 1 3-3h11a3 3 0 0 1 0 6h-11a3 3 0 0 1-3-3z"/><path d="M2.5 12.5a3.5 3.5 0 0 1 3.5-3.5h12a3.5 3.5 0 0 1 3.5 3.5"/><path d="M6 13.5c1.5-1 3 1 4.5 0s3 1 4.5 0 2.5 1 3 0"/>',
 worst:'<path d="M5.5 16.5c-2-2-2-5 0-7l4-4a4.9 4.9 0 0 1 7 7l-4 4c-2 2-5 2-7 0z"/><path d="M4.5 18.5 3 20M19.5 5.5 21 4"/><path d="M9 10.5l1.5 1.5M12 8.5l1.5 1.5M11 13.5l1.5 1.5"/>',
 broodje:'<path d="M3 13c0-4 4-6.5 9-6.5s9 2.5 9 6.5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3.5 16.5h17l-1.2 2.3a2 2 0 0 1-1.8 1.2h-11a2 2 0 0 1-1.8-1.2z"/><path d="M8 9.5l1.5 1.5M12 8.5l1.5 1.5M16 9.5 17 11"/>',
 croque:'<path d="M4 8.5a3.5 3.5 0 0 1 3.5-3.5h9A3.5 3.5 0 0 1 20 8.5c0 1-.6 1.7-1.5 2V19a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8.5c-.9-.3-1.5-1-1.5-2z"/><path d="M5.5 14h13"/><path d="M8 16.8c1.3.8 2.7-.8 4 0s2.7-.8 4 0"/>',
 soep:'<path d="M3 11h18a9 9 0 0 1-9 8 9 9 0 0 1-9-8z"/><path d="M8 21h8"/><path d="M9 3.5c-1 1.1 1 2 0 3.2M13 3.5c-1 1.1 1 2 0 3.2"/><path d="M17 9 21 4"/>',
 pizza:'<path d="M12 21 3.5 6.5A16 16 0 0 1 20.5 6.5z"/><path d="M5.3 9.5a13 13 0 0 1 13.4 0"/><circle cx="10" cy="12.5" r="1.2"/><circle cx="14" cy="11.5" r="1"/><circle cx="12.2" cy="16" r="1"/>',
 chips:'<path d="M6 3h12l-1 2.5v13L18 21H6l1-2.5v-13z"/><path d="M9.5 10.5c1-1.2 3.5-1.2 4.5.2-.5 2-3.6 2.5-4.5-.2z"/><path d="M7 6.5h10M7 17h10"/>',
 popcorn:'<path d="M6 10h12l-2 11H8z"/><path d="M9.5 10 10.5 21M14.5 10 13.5 21"/><path d="M6.5 10a2.3 2.3 0 0 1 1-4.3 2.6 2.6 0 0 1 4.5-1.6 2.6 2.6 0 0 1 4.5 1.6 2.3 2.3 0 0 1 1 4.3"/>',
 pannenkoek:'<ellipse cx="12" cy="11" rx="8.5" ry="3.5"/><path d="M3.5 11v2.5c0 2 3.8 3.5 8.5 3.5s8.5-1.5 8.5-3.5V11"/><path d="M3.5 14c0 2 3.8 3.5 8.5 3.5s8.5-1.5 8.5-3.5v2.5c0 2-3.8 3.5-8.5 3.5s-8.5-1.5-8.5-3.5z"/><path d="M10 9.5h4"/>',
 wafel:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
 taart:'<path d="M4 20h16v-7.5H4z"/><path d="M4 16c2 1.4 4-1 6 0s4 1.4 6 0 3-1 4 0"/><path d="M8 12.5V9M12 12.5V9M16 12.5V9"/><path d="M8 6.5c0-1 .8-1.5 0-2.5M12 6.5c0-1 .8-1.5 0-2.5M16 6.5c0-1 .8-1.5 0-2.5"/>',
 ijs:'<path d="M8 10.5a4 4 0 0 1 8 0"/><path d="M7.5 10.5h9L12 21z"/><path d="M10 13.5l3 3M12.5 12.5l1.5 1.5"/>',
 snoep:'<circle cx="12" cy="12" r="4"/><path d="M8.5 10 4 7v10l4.5-3M15.5 10 20 7v10l-4.5-3"/><path d="M10.5 10.5c1 1 2 2 3 3"/>',
 /* overige */
 ticket:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
 drankkaart:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 9.5h18"/><circle cx="7.5" cy="14.5" r="1.3"/><circle cx="12" cy="14.5" r="1.3"/><circle cx="16.5" cy="14.5" r="1.3"/>',
 munt:'<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5a3 3 0 1 0 0 5M8 11h5M8 13h5"/>',
 tombola:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
 cadeau:'<path d="M4 11h16v10H4zM2.5 7.5h19V11h-19zM12 7.5V21"/><path d="M12 7.5C10.5 4 7 3.5 7 5.8 7 7.5 12 7.5 12 7.5zM12 7.5c1.5-3.5 5-4 5-1.7 0 1.7-5 1.7-5 1.7z"/>',
 ballon:'<path d="M12 3a5 5 0 0 1 5 5c0 4-3 7-5 7s-5-3-5-7a5 5 0 0 1 5-5z"/><path d="M12 15l-1 2h2zM12 17c0 2-2 2-2 4"/>',
 tshirt:'<path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
 ster:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'};
function kassaIcoon(k,kl){var p=KASSA_ICONEN[k];return p?'<svg viewBox="0 0 24 24" aria-hidden="true" style="width:30px;height:30px;fill:none;stroke:'+(kl||"currentColor")+';stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round">'+p+'</svg>':""}

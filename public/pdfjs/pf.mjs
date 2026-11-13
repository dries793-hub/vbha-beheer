// Promise.withResolvers aanvullen voor oudere Safari/iOS (< 17.4), daarna de gewone pdf.js-worker
if (!Promise.withResolvers) Promise.withResolvers = function () { let a, b; const p = new this((r, j) => { a = r; b = j; }); return { promise: p, resolve: a, reject: b }; };

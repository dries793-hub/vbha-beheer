// Aanvullingen voor Safari/iOS: Promise.withResolvers (< 17.4) en "for await" over een ReadableStream (Safari kent dat niet)
if (!Promise.withResolvers) Promise.withResolvers = function () { let a, b; const p = new this((r, j) => { a = r; b = j; }); return { promise: p, resolve: a, reject: b }; };
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype.values = function ({ preventCancel = false } = {}) {
    const reader = this.getReader();
    return { async next() { try { const r = await reader.read(); if (r.done) reader.releaseLock(); return r; } catch (e) { reader.releaseLock(); throw e; } },
      async return(v) { if (!preventCancel) { const c = reader.cancel(v); reader.releaseLock(); await c; } else reader.releaseLock(); return { done: true, value: v }; },
      [Symbol.asyncIterator]() { return this; } };
  };
  ReadableStream.prototype[Symbol.asyncIterator] = ReadableStream.prototype.values;
}

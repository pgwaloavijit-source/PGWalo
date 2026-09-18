const B = 'http://127.0.0.1:8787';
const phone = `86${String(Date.now()).slice(-8)}`.slice(0, 10);
// staff login via x-user-role dev header is disabled in prod env; use a real staff flow: reuse e2e staff? Just check the error via owner token from a fresh signup is not enough (owner only).
// Instead: probe the update SQL directly through a raw run
console.log('probe skip');

/**
 * Escape-hatch proof: exercises the mail provider adapter against a stub
 * Resend API. No real credentials and no mail are involved — this asserts the
 * switching, failover and probing logic itself.
 *
 *   npx tsx scripts/test-email-provider.ts
 */
import http from 'node:http';
import {
  activeProvider,
  fallbackProvider,
  failoverReady,
  isFailoverWorthy,
  probeProvider,
  sendViaProvider,
} from '../src/worker/email/provider';

const results: { name: string; passed: boolean; detail?: string }[] = [];

function check(name: string, passed: boolean, detail?: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓' : '✗'} ${name}${!passed && detail ? `  → ${detail}` : ''}`);
}

const MSG = {
  to: 'resident@example.test',
  subject: 'Test',
  html: '<p>hi</p>',
  text: 'hi',
};

// ---- stub Resend API ------------------------------------------------------
let sendStatus = 200;
let sendBody: Record<string, unknown> = { id: 'msg_stub_1' };
let domainStatus = 'verified';
let domainName = 'pgwalo.com';
let sendCount = 0;
let lastAuthHeader: string | undefined;

const server = http.createServer((req, res) => {
  lastAuthHeader = req.headers.authorization as string | undefined;
  if (req.method === 'POST' && req.url === '/emails') {
    sendCount += 1;
    res.writeHead(sendStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sendBody));
    return;
  }
  if (req.method === 'GET' && req.url === '/domains') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ name: domainName, status: domainStatus }] }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{}');
});

async function main() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const resendEnv = {
    RESEND_API_KEY: 're_test_key',
    RESEND_BASE_URL: baseUrl,
    EMAIL_FROM: 'noreply@pgwalo.com',
  } as any;

  const cloudflareEnv = {
    EMAIL: { send: async () => ({ messageId: 'cf_stub_1' }) },
    EMAIL_FROM: 'noreply@pgwalo.com',
  } as any;

  // ---- 1. provider precedence --------------------------------------------
  check('with nothing configured the sender is "none"', activeProvider({} as any) === 'none');
  check('resend is detected from its api key', activeProvider(resendEnv) === 'resend');
  check('the cloudflare binding takes precedence when both are present',
    activeProvider({ ...resendEnv, ...cloudflareEnv } as any) === 'cloudflare');
  check('an explicit EMAIL_PROVIDER override wins over the binding',
    activeProvider({ ...resendEnv, ...cloudflareEnv, EMAIL_PROVIDER: 'resend' } as any) === 'resend',
    activeProvider({ ...resendEnv, ...cloudflareEnv, EMAIL_PROVIDER: 'resend' } as any));
  check('an explicit "none" forces simulation',
    activeProvider({ ...resendEnv, EMAIL_PROVIDER: 'none' } as any) === 'none');

  // ---- 2. failover wiring ------------------------------------------------
  const both = { ...resendEnv, ...cloudflareEnv, EMAIL_PROVIDER: 'cloudflare' } as any;
  check('fallback defaults to the other configured sender', fallbackProvider(both) === 'resend');
  check('failover is reported ready only when the fallback has credentials', failoverReady(both) === true);
  check('failover is not ready with a single sender', failoverReady(resendEnv) === false);
  check('explicit EMAIL_FALLBACK_PROVIDER is honoured',
    fallbackProvider({ ...both, EMAIL_FALLBACK_PROVIDER: 'cloudflare' } as any) === 'cloudflare');

  // ---- 3. error classification -------------------------------------------
  check('quota errors are failover-worthy', isFailoverWorthy('daily limit exceeded'));
  check('429 is failover-worthy', isFailoverWorthy('rate limited', 429));
  check('401 is failover-worthy', isFailoverWorthy('unauthorized', 401));
  check('a bad recipient address is not failover-worthy',
    !isFailoverWorthy('invalid to address', 422));

  // ---- 4. real HTTP send through the stub --------------------------------
  const direct = await sendViaProvider(resendEnv, MSG);
  check('resend send succeeds against the API and returns the message id',
    direct.ok && direct.provider === 'resend' && direct.id === 'msg_stub_1',
    JSON.stringify(direct));
  check('the api key is sent as a bearer token', lastAuthHeader === 'Bearer re_test_key', String(lastAuthHeader));

  // ---- 5. automatic failover on quota exhaustion -------------------------
  const quotaEnv = {
    ...resendEnv,
    EMAIL_PROVIDER: 'cloudflare',
    EMAIL_FALLBACK_PROVIDER: 'resend',
    EMAIL: {
      send: async () => {
        throw new Error('daily sending limit exceeded for this account');
      },
    },
  } as any;
  sendStatus = 200;
  sendBody = { id: 'msg_failover_1' };
  sendCount = 0;
  const failedOver = await sendViaProvider(quotaEnv, MSG);
  check('a quota failure on the primary is delivered by the fallback',
    failedOver.ok && failedOver.provider === 'resend' && failedOver.failedOver === true,
    JSON.stringify(failedOver));
  check('the primary failure is preserved for the audit log',
    String(failedOver.primaryError || '').includes('cloudflare'), String(failedOver.primaryError));
  check('the fallback actually received the message', sendCount === 1, `sends=${sendCount}`);

  // ---- 6. no pointless failover for a content error ----------------------
  const contentEnv = {
    ...quotaEnv,
    EMAIL: { send: async () => { throw new Error('invalid recipient address'); } },
  } as any;
  sendCount = 0;
  const noFailover = await sendViaProvider(contentEnv, MSG);
  check('a content error does not burn the fallback sender', !noFailover.ok && sendCount === 0, `sends=${sendCount}`);

  // ---- 7. readiness probing ---------------------------------------------
  domainStatus = 'verified';
  const readyProbe = await probeProvider(resendEnv, 'resend');
  check('probe reports a verified sending domain as ready',
    readyProbe.ready && /verified/.test(readyProbe.detail), readyProbe.detail);

  domainStatus = 'pending';
  const pendingProbe = await probeProvider(resendEnv, 'resend');
  check('probe blocks a domain that has not finished verifying',
    !pendingProbe.ready && /pending/.test(pendingProbe.detail), pendingProbe.detail);

  domainStatus = 'verified';
  domainName = 'someone-else.com';
  const wrongDomainProbe = await probeProvider(resendEnv, 'resend');
  check('probe blocks when the sender domain is not in the account',
    !wrongDomainProbe.ready && /not added/.test(wrongDomainProbe.detail), wrongDomainProbe.detail);

  domainName = 'pgwalo.com';
  check('probe reports cloudflare as unready without the binding',
    (await probeProvider({} as any, 'cloudflare')).ready === false);
  check('probe reports cloudflare as ready with the binding',
    (await probeProvider(cloudflareEnv, 'cloudflare')).ready === true);

  // ---- 8. simulated mode stays inert -------------------------------------
  const simulated = await sendViaProvider({} as any, MSG);
  check('with no sender configured, sending simulates instead of failing',
    simulated.ok && simulated.simulated === true, JSON.stringify(simulated));

  server.close();

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(` - ${f.name}${f.detail ? ` :: ${f.detail}` : ''}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  server.close();
  process.exit(1);
});

/**
 * Live API check against a running server (http://localhost:4000).
 * Run with: node scripts/api-check.js
 */
const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;

function ok(cond, label) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}`);
  }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function main() {
  const r = Date.now();
  const email = `ada${r}@nova.dev`;
  const email2 = `alan${r}@nova.dev`;

  console.log('Auth');
  const reg = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Ada', email, password: 'secret123' },
  });
  ok(reg.status === 201 && !!reg.data.token, 'register owner');
  const owner = reg.data.token;

  const reg2 = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Alan', email: email2, password: 'secret123' },
  });
  ok(reg2.status === 201, 'register member');
  const memberToken = reg2.data.token;

  const dup = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Dup', email, password: 'secret123' },
  });
  ok(dup.status === 409, 'duplicate email rejected (409)');

  const login = await call('/auth/login', {
    method: 'POST',
    body: { email, password: 'secret123' },
  });
  ok(login.status === 200 && !!login.data.token, 'login');

  const bad = await call('/auth/login', {
    method: 'POST',
    body: { email, password: 'nope' },
  });
  ok(bad.status === 401, 'wrong password rejected (401)');

  const me = await call('/auth/me', { token: owner });
  ok(me.status === 200 && me.data.user.email === email, 'GET /me');

  const noauth = await call('/projects');
  ok(noauth.status === 401, 'projects require auth (401)');

  console.log('Robustness');
  const badId = await call('/projects/not-a-valid-id', { token: owner });
  ok(badId.status === 404, 'malformed ObjectId returns 404 (no crash)');

  console.log('Projects');
  const created = await call('/projects', {
    method: 'POST',
    token: owner,
    body: { name: 'Apollo', description: 'Ship the lander' },
  });
  ok(created.status === 201 && !!created.data.id, 'create project');
  const pid = created.data.id;
  ok(created.data.progress === 0, 'new project progress = 0%');

  const list = await call('/projects', { token: owner });
  ok(list.status === 200 && list.data.some((p) => p.id === pid), 'list projects');

  console.log('Members');
  const add = await call(`/projects/${pid}/members`, {
    method: 'POST',
    token: owner,
    body: { email: email2 },
  });
  ok(add.status === 201 && add.data.length === 2, 'add member by email');
  const alanId = add.data.find((m) => m.email === email2).id;

  const addUnknown = await call(`/projects/${pid}/members`, {
    method: 'POST',
    token: owner,
    body: { email: 'ghost@nowhere.dev' },
  });
  ok(addUnknown.status === 404, 'adding unknown email rejected (404)');

  console.log('Tasks');
  const t1 = await call(`/projects/${pid}/tasks`, {
    method: 'POST',
    token: owner,
    body: { title: 'Design hull', priority: 'high', assignee: alanId },
  });
  ok(
    t1.status === 201 && t1.data.assignee && t1.data.assignee.email === email2,
    'create task with assignee'
  );

  const t2 = await call(`/projects/${pid}/tasks`, {
    method: 'POST',
    token: owner,
    body: { title: 'Flight software' },
  });
  ok(t2.status === 201, 'create second task');

  const mv = await call(`/tasks/${t1.data.id}`, {
    method: 'PUT',
    token: owner,
    body: { status: 'done' },
  });
  ok(mv.status === 200 && mv.data.status === 'done', 'move task to done');

  const detail = await call(`/projects/${pid}`, { token: owner });
  ok(detail.data.progress === 50, 'progress = 50% (1 of 2 done)');

  const del = await call(`/tasks/${t2.data.id}`, {
    method: 'DELETE',
    token: owner,
  });
  ok(del.status === 200, 'delete task');

  const detail2 = await call(`/projects/${pid}`, { token: owner });
  ok(detail2.data.progress === 100, 'progress = 100% after deleting open task');

  console.log('Authorization');
  const forbidden = await call(`/projects/${pid}`, {
    method: 'DELETE',
    token: memberToken,
  });
  ok(forbidden.status === 403, 'non-owner cannot delete project (403)');

  console.log('Cleanup');
  const delP = await call(`/projects/${pid}`, {
    method: 'DELETE',
    token: owner,
  });
  ok(delP.status === 200 && delP.data.ok, 'owner deletes project');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('CHECK ERROR:', e);
  process.exit(1);
});

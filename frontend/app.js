const API = '/api';

const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-button');

function showPage(pageId) {
  pages.forEach((page) => page.classList.toggle('active', page.id === pageId));
  navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.page === pageId);
  });
  if (pageId === 'tasks') loadTasks();
  if (pageId === 'security') loadSecurity();
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.page));
});

async function getJSON(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function loadHealth() {
  const output = document.getElementById('healthOut');
  try {
    const result = await getJSON('/health');
    output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    output.textContent = `Could not reach API: ${error}`;
  }
}

async function loadTasks() {
  const list = document.getElementById('tasksList');
  try {
    const result = await getJSON('/tasks');
    if (!result.ok) throw new Error(`API returned HTTP ${result.status}`);
    list.replaceChildren();
    if (!result.data.length) {
      const item = document.createElement('li');
      item.textContent = 'No tasks yet. Add your first task above.';
      list.append(item);
      return;
    }
    result.data.forEach((task) => {
      const item = document.createElement('li');
      const title = document.createElement('span');
      title.textContent = task.title;
      const state = document.createElement('small');
      state.textContent = task.done ? 'Done' : 'Open';
      item.append(title, state);
      list.append(item);
    });
  } catch (error) {
    list.textContent = `Could not load tasks: ${error}`;
  }
}

document.getElementById('addForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('titleInput');
  const message = document.getElementById('formMessage');
  const title = input.value.trim();
  if (!title) return;

  try {
    const result = await getJSON('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!result.ok) throw new Error(result.data.error || `HTTP ${result.status}`);
    input.value = '';
    message.textContent = 'Task added.';
    await loadTasks();
  } catch (error) {
    message.textContent = `Could not add task: ${error}`;
  }
});

function setCheck(id, passed, detail = '') {
  const item = document.getElementById(id);
  const status = item.querySelector('.status');
  item.classList.toggle('pass', Boolean(passed));
  item.classList.toggle('fail', !passed);
  status.textContent = passed ? 'PASS' : `FAIL${detail ? ` — ${detail}` : ''}`;
}

async function loadSecurity() {
  const raw = document.getElementById('secRaw');
  try {
    const [health, info] = await Promise.all([
      getJSON('/health'),
      getJSON('/security/info'),
    ]);
    raw.textContent = JSON.stringify({ health, security: info }, null, 2);
    setCheck('sec-health', health.ok && health.status === 200);
    if (!info.ok) throw new Error(`Security endpoint returned HTTP ${info.status}`);

    const data = info.data;
    setCheck('sec-nonroot', data.uid !== 0, `uid=${data.uid}`);
    setCheck('sec-rofs', data.readonly === true);
    const noNewPrivileges = data.caps && data.caps.NoNewPrivs === '1';
    setCheck('sec-nnp', noNewPrivileges, `NoNewPrivs=${data.caps?.NoNewPrivs}`);
  } catch (error) {
    raw.textContent = `Could not complete security checks: ${error}`;
    setCheck('sec-health', false);
    setCheck('sec-nonroot', false, 'no data');
    setCheck('sec-rofs', false, 'no data');
    setCheck('sec-nnp', false, 'no data');
  }
}

document.getElementById('refreshHealth').addEventListener('click', loadHealth);
document.getElementById('refreshTasks').addEventListener('click', loadTasks);
document.getElementById('refreshSecurity').addEventListener('click', loadSecurity);

window.addEventListener('DOMContentLoaded', () => {
  loadHealth();
  loadTasks();
  loadSecurity();
});

import { api, getToken, TOKEN_KEY } from './api.js';
import { toast } from './ui.js';
let me = null;
const modal = document.getElementById('authModal');
export const currentUser = () => me;
export function openAuth() { if (!modal.open) modal.showModal(); document.getElementById('authErr').textContent = ''; document.getElementById(document.getElementById('loginForm').hidden ? 'regUser' : 'loginId').focus(); }
function update() {
  document.getElementById('authState').textContent = me ? `@${me.username}` : '';
  document.getElementById('authBtn').textContent = me ? 'Sign out' : 'Sign in ↗';
}
export async function initAuth(onChange) {
  document.getElementById('authBtn').onclick = () => {
    if (!getToken()) return openAuth();
    localStorage.removeItem(TOKEN_KEY); me = null; update(); onChange(); toast('Signed out');
  };
  document.getElementById('authClose').onclick = () => modal.close();
  modal.addEventListener('click', event => { if (event.target === modal) { const box = modal.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close(); } });
  function tab(login) {
    for (const [id, selected] of [['tabLogin', login], ['tabRegister', !login]]) { const el = document.getElementById(id); el.classList.toggle('active', selected); el.setAttribute('aria-selected', selected); el.tabIndex = selected ? 0 : -1; }
    document.getElementById('loginForm').hidden = !login;
    document.getElementById('registerForm').hidden = login;
    document.getElementById('authTitle').textContent = login ? 'Welcome back.' : 'Your discoveries, together.';
    document.getElementById('authErr').textContent = '';
  }
  tab(true);
  document.getElementById('tabLogin').onclick = () => tab(true);
  document.getElementById('tabRegister').onclick = () => tab(false);
  modal.querySelector('[role=tablist]').onkeydown = event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); const login = document.getElementById('loginForm').hidden; tab(login); document.getElementById(login ? 'tabLogin' : 'tabRegister').focus(); } };
  for (const login of [true, false]) {
    const form = document.getElementById(login ? 'loginForm' : 'registerForm');
    form.onsubmit = async event => {
      event.preventDefault(); const button = form.querySelector('button'); button.disabled = true; document.getElementById('authErr').textContent = '';
      const body = login ? { usernameOrEmail: document.getElementById('loginId').value.trim(), password: document.getElementById('loginPw').value } : { username: document.getElementById('regUser').value.trim(), email: document.getElementById('regEmail').value.trim(), password: document.getElementById('regPw').value };
      try { const result = await api(`/api/auth/${login ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(body) }); localStorage.setItem(TOKEN_KEY, result.token); me = result.user; form.reset(); modal.close(); update(); onChange(); toast(`Welcome, ${me.username}`); }
      catch (error) { document.getElementById('authErr').textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  window.addEventListener('session-expired', () => { me = null; update(); });
  if (getToken()) { try { me = (await api('/api/auth/me')).user; } catch (error) { if (error.status !== 401) toast(error.message, true); } }
  update();
}

'use strict';
/* CoreChat frontend.
   Uses your Java backend (/api/...) when it is reachable; otherwise falls back to a
   built-in localStorage backend so the app works standalone (open two tabs to chat). */

const BOT = 'SphereAI';
const ADMINS = ['admin', 'alokrana'];
const GRADIENTS = ['#6366f1,#a855f7', '#3b82f6,#06b6d4', '#10b981,#059669', '#f59e0b,#d97706', '#ec4899,#8b5cf6', '#14b8a6,#3b82f6'];

let authMode = 'login', currentUser = null, activeChatUser = null, allUsers = [];
let pollTimer = null, fastTimer = null, soundEnabled = true, lastSig = null, audioCtx = null;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gradient = n => { let h = 0; for (const c of n) h = c.charCodeAt(0) + ((h << 5) - h); return `linear-gradient(135deg,${GRADIENTS[Math.abs(h) % GRADIENTS.length]})`; };
const isAdmin = u => ADMINS.includes(String(u).toLowerCase());

/* ---------- Local backend (localStorage) ---------- */
const DB_KEY = 'corechat_db';
const loadDb = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || { users: [], messages: [] }; } catch { return { users: [], messages: [] }; } };
const saveDb = d => { try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch { } };
const hash = s => { let h = 5381; for (const c of s) h = (h * 33) ^ c.charCodeAt(0); return (h >>> 0).toString(36); };
const pushMsg = (d, sender, receiver, content) => d.messages.push({ sender, receiver, content, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

function botReply(t) {
    t = t.toLowerCase();
    if (/\b(hi|hello|hey)\b/.test(t)) return 'Hey there! 👋 I\'m SphereAI. Ask me about Java, CoreChat, or just say hi.';
    if (t.includes('java')) return 'Java tip: prefer try-with-resources for sockets and streams, and use a thread pool instead of one thread per client. ☕';
    if (t.includes('thread')) return 'Threads: use ExecutorService for fixed pools, and guard shared state with synchronized or ConcurrentHashMap.';
    if (t.includes('socket') || t.includes('server')) return 'A simple Java server: ServerSocket.accept() in a loop, handing each Socket to a worker from a thread pool.';
    if (t.includes('who') || t.includes('name')) return 'I\'m @SphereAI, the built-in assistant of CoreChat. 🤖';
    if (t.includes('thank')) return 'Anytime! 🚀';
    return 'Interesting! I\'m a small built-in bot, so I know best about Java, threads and sockets. Try asking about one of those.';
}

const local = {
    register(_, { username, password }) {
        const d = loadDb();
        if (username.length < 3) return { error: 'Username must be at least 3 characters.' };
        if (password.length < 4) return { error: 'Password must be at least 4 characters.' };
        if (username === BOT.toLowerCase() || d.users.some(u => u.username === username)) return { error: 'That username is already taken.' };
        d.users.push({ username, pw: hash(password) }); saveDb(d);
        return { success: true, message: 'Account created. Welcome!' };
    },
    login(_, { username, password }) {
        const u = loadDb().users.find(x => x.username === username);
        return u && u.pw === hash(password) ? { success: true, message: 'Welcome back!' } : { error: 'Invalid username or password.' };
    },
    users: ({ current }) => loadDb().users.filter(u => u.username !== current).map(u => ({ username: u.username })),
    messages: ({ user1, user2 }) => loadDb().messages.filter(m => (m.sender === user1 && m.receiver === user2) || (m.sender === user2 && m.receiver === user1)),
    send(_, { sender, receiver, content }) {
        const d = loadDb(); pushMsg(d, sender, receiver, content); saveDb(d);
        if (receiver === BOT) setTimeout(() => { const d2 = loadDb(); pushMsg(d2, BOT, sender, botReply(content)); saveDb(d2); }, 900);
        return { success: true };
    },
    'admin/check': ({ user }) => ({ isAdmin: isAdmin(user) }),
    'admin/stats'({ admin }) {
        if (!isAdmin(admin)) return { error: 'Forbidden.' };
        const d = loadDb();
        return { success: true, totalUsers: d.users.length, totalMessages: d.messages.length, users: d.users.map(u => ({ username: u.username })) };
    },
    'admin/delete-user'(_, { admin, target }) {
        if (!isAdmin(admin) || isAdmin(target)) return { error: 'Not allowed.' };
        const d = loadDb();
        d.users = d.users.filter(u => u.username !== target);
        d.messages = d.messages.filter(m => m.sender !== target && m.receiver !== target);
        saveDb(d); return { success: true, message: `@${target} was deleted.` };
    },
    'admin/warning'(_, { admin, target, warning }) {
        if (!isAdmin(admin)) return { error: 'Not allowed.' };
        const d = loadDb(); pushMsg(d, admin, target, '⚠️ Official notice: ' + warning); saveDb(d);
        return { success: true, message: `Notice sent to @${target}.` };
    }
};

/* ---------- API layer: real backend if present, else local ---------- */
let remote;
async function useRemote() {
    if (remote !== undefined) return remote;
    try {
        const r = await fetch('/api/users?current=_', { cache: 'no-store' });
        remote = r.ok && (r.headers.get('content-type') || '').includes('json');
    } catch { remote = false; }
    return remote;
}

async function api(route, params, body) {
    if (await useRemote()) {
        const qs = params ? '?' + new URLSearchParams(params) : '';
        const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
        const res = await fetch('/api/' + route + qs, opts);
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data)) return data;
        return res.ok ? { success: true, ...data } : { ...data, success: false };
    }
    return local[route](params, body);
}

/* ---------- Small UI helpers ---------- */
function togglePasswordVisibility() {
    const p = $('password'), icon = $('eye-icon'), show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    icon.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function playChime(isSend = true) {
    if (!soundEnabled) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), t = audioCtx.currentTime;
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(isSend ? 620 : 780, t);
        osc.frequency.exponentialRampToValueAtTime(isSend ? 920 : 560, t + 0.12);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        osc.start(t); osc.stop(t + 0.14);
    } catch { /* audio unavailable */ }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    $('sound-toggle-btn').innerHTML = soundEnabled ? '🔔 <span>Audio On</span>' : '🔕 <span>Muted</span>';
}

function insertEmoji(e) { const i = $('message-input'); i.value += e; i.focus(); }

/* ---------- Auth ---------- */
function switchAuthTab(mode) {
    authMode = mode;
    $('tab-login').classList.toggle('active', mode === 'login');
    $('tab-register').classList.toggle('active', mode === 'register');
    $('auth-submit-btn').querySelector('span').textContent = mode === 'login' ? 'Sign In to Account' : 'Create New Account';
    $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('auth-alert').className = 'alert-box hidden';
}

function showAlert(msg, type) { const a = $('auth-alert'); a.textContent = msg; a.className = `alert-box ${type}`; }

async function handleAuthSubmit(event) {
    event.preventDefault();
    const username = $('username').value.trim().toLowerCase(), password = $('password').value;
    if (!username || !password) return showAlert('Please enter both username and password.', 'error');
    const btn = $('auth-submit-btn'); btn.disabled = true;
    try {
        const data = await api(authMode === 'login' ? 'login' : 'register', null, { username, password });
        if (data.success) {
            currentUser = username;
            sessionStorage.setItem('cc_user', username);
            showAlert(data.message || 'Success!', 'success');
            setTimeout(initChatView, 350);
        } else showAlert(data.error || data.message || 'Authentication failed.', 'error');
    } catch (err) {
        console.error(err); showAlert('Could not reach the server.', 'error');
    } finally { btn.disabled = false; }
}

function initChatView() {
    $('auth-view').classList.add('hidden');
    $('chat-view').classList.remove('hidden');
    $('current-user-name').textContent = '@' + currentUser;
    const av = $('current-user-avatar');
    av.textContent = currentUser.charAt(0).toUpperCase();
    av.style.background = gradient(currentUser);
    loadUsers(); checkAdminStatus();
}

function stopTimers() { clearInterval(pollTimer); clearInterval(fastTimer); pollTimer = fastTimer = null; }

function logout() {
    stopTimers();
    currentUser = activeChatUser = null; allUsers = []; lastSig = null;
    sessionStorage.removeItem('cc_user');
    document.querySelector('.app-frame').classList.remove('in-chat');
    $('active-chat-wrapper').classList.add('hidden');
    $('no-chat-selected').classList.remove('hidden');
    $('admin-panel-btn').classList.add('hidden');
    $('admin-modal').classList.add('hidden');
    $('username').value = ''; $('password').value = '';
    $('auth-alert').className = 'alert-box hidden';
    $('chat-view').classList.add('hidden');
    $('auth-view').classList.remove('hidden');
}

/* ---------- Users ---------- */
async function loadUsers() {
    try {
        const users = await api('users', { current: currentUser });
        allUsers = Array.isArray(users) ? users : [];
        filterUsers();
    } catch (err) { console.error('Failed to load users:', err); }
}

function renderUsersList(users) {
    const list = $('users-list');
    list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', `
        <div class="user-card-item ai-bot-card ${activeChatUser === BOT ? 'active' : ''}" data-user="${BOT}">
            <div class="avatar ai-avatar">🤖</div>
            <div class="user-card-meta">
                <div class="user-row-top"><span class="user-item-username">@${BOT} <span class="ai-badge">AI BOT</span></span><span class="user-item-timestamp">24/7</span></div>
                <div class="user-row-bottom"><span class="user-item-snippet">⚡ Instant answers &amp; Java help</span></div>
            </div>
        </div>`);
    const real = users.filter(u => u.username.toLowerCase() !== BOT.toLowerCase());
    if (!real.length) {
        list.insertAdjacentHTML('beforeend', `<div class="empty-note">No other friends yet.<br>Chat with <b>@${BOT}</b> above or invite someone to register.</div>`);
    }
    real.forEach(u => list.insertAdjacentHTML('beforeend', `
        <div class="user-card-item ${activeChatUser === u.username ? 'active' : ''}" data-user="${esc(u.username)}">
            <div class="avatar" style="background:${gradient(u.username)}">${esc(u.username.charAt(0))}</div>
            <div class="user-card-meta">
                <div class="user-row-top"><span class="user-item-username">@${esc(u.username)}</span><span class="user-item-timestamp">Active</span></div>
                <div class="user-row-bottom"><span class="user-item-snippet">Tap to open chat</span></div>
            </div>
        </div>`));
}

function filterUsers() {
    const q = $('search-input').value.trim().toLowerCase();
    renderUsersList(allUsers.filter(u => u.username.toLowerCase().includes(q)));
}

/* ---------- Chat ---------- */
function selectUser(username) {
    activeChatUser = username; lastSig = null;
    document.querySelector('.app-frame').classList.add('in-chat');
    $('no-chat-selected').classList.add('hidden');
    $('active-chat-wrapper').classList.remove('hidden');

    const av = $('active-chat-avatar'), name = $('active-chat-username');
    if (username === BOT) {
        name.innerHTML = `@${BOT} <span class="ai-badge">AI BOT</span>`;
        av.textContent = '🤖'; av.style.background = 'linear-gradient(135deg,#8b5cf6,#3b82f6)';
    } else {
        name.textContent = '@' + username;
        av.textContent = username.charAt(0).toUpperCase(); av.style.background = gradient(username);
    }
    filterUsers();
    $('messages-container').innerHTML = '';
    loadMessages();
    clearInterval(pollTimer);
    pollTimer = setInterval(loadMessages, 1500);
    if (window.matchMedia('(min-width: 769px)').matches) $('message-input').focus();
}

function backToSidebar() {
    document.querySelector('.app-frame').classList.remove('in-chat');
    activeChatUser = null; lastSig = null;
    $('no-chat-selected').classList.remove('hidden');
    $('active-chat-wrapper').classList.add('hidden');
    stopTimers(); filterUsers();
}

async function loadMessages() {
    if (!currentUser || !activeChatUser) return;
    const peer = activeChatUser;
    try {
        const msgs = await api('messages', { user1: currentUser, user2: peer });
        if (peer !== activeChatUser || !Array.isArray(msgs)) return;
        const last = msgs[msgs.length - 1];
        const sig = msgs.length + '|' + (last ? last.sender + last.content : '');
        if (sig === lastSig) return;
        const incoming = lastSig !== null && last && last.sender.toLowerCase() !== currentUser;
        const prevCount = lastSig === null ? msgs.length : parseInt(lastSig, 10);
        lastSig = sig;
        renderMessages(msgs, prevCount);
        if (incoming && msgs.length > prevCount) playChime(false);
    } catch (err) { console.error('Failed to load messages:', err); }
}

function renderMessages(msgs, prevCount = 0) {
    const box = $('messages-container');
    box.innerHTML = '';
    if (!msgs.length) {
        box.innerHTML = `<div class="no-msgs">No messages yet. Say hello to @${esc(activeChatUser)}! 👋</div>`;
        return;
    }
    box.insertAdjacentHTML('beforeend', '<div class="date-divider"><span class="date-badge">TODAY</span></div>');
    msgs.forEach((m, i) => {
        const sent = m.sender.toLowerCase() === currentUser;
        box.insertAdjacentHTML('beforeend', `
            <div class="message-bubble ${sent ? 'sent' : 'received'} ${i >= prevCount ? 'fresh' : ''}">
                ${sent ? '' : `<div class="bubble-sender">@${esc(m.sender)}</div>`}
                <div class="bubble-text">${esc(m.content)}</div>
                <div class="bubble-footer"><span>${esc(m.timestamp || 'Now')}</span>${sent ? '<span class="double-ticks">✓✓</span>' : ''}</div>
            </div>`);
    });
    const last = msgs[msgs.length - 1];
    if (activeChatUser === BOT && last.sender.toLowerCase() === currentUser) {
        box.insertAdjacentHTML('beforeend', `
            <div class="message-bubble received ai-typing-bubble" id="ai-typing-indicator">
                <div class="bubble-sender">@${BOT}</div>
                <div class="typing-dots-wrap"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-text">thinking...</span></div>
            </div>`);
    }
    box.scrollTop = box.scrollHeight;
}

function fastPollForBot() {
    clearInterval(fastTimer);
    let n = 0;
    fastTimer = setInterval(async () => {
        await loadMessages();
        if (++n >= 16 || !$('ai-typing-indicator')) { clearInterval(fastTimer); fastTimer = null; }
    }, 500);
}

async function handleSendMessage(event) {
    event.preventDefault();
    const input = $('message-input'), content = input.value.trim();
    if (!content || !activeChatUser) return;
    input.value = '';
    playChime(true);
    try {
        const r = await api('send', null, { sender: currentUser, receiver: activeChatUser, content });
        if (r && r.success === false) return;
        await loadMessages();
        if (activeChatUser === BOT) fastPollForBot();
    } catch (err) { console.error('Error sending message:', err); }
}

/* ---------- Admin console ---------- */
async function checkAdminStatus() {
    try {
        const d = await api('admin/check', { user: currentUser });
        $('admin-panel-btn').classList.toggle('hidden', !d.isAdmin);
        $('current-user-name').textContent = '@' + currentUser + (d.isAdmin ? ' 👑' : '');
    } catch (err) { console.error('Admin check failed:', err); }
}

function openAdminModal() { $('admin-modal').classList.remove('hidden'); loadAdminDashboard(); }
function closeAdminModal() { $('admin-modal').classList.add('hidden'); $('admin-feedback').classList.add('hidden'); }
function handleModalBackdropClick(e) { if (e.target.id === 'admin-modal') closeAdminModal(); }

async function loadAdminDashboard() {
    try {
        const d = await api('admin/stats', { admin: currentUser });
        if (!d.success) return;
        $('stat-total-users').textContent = d.totalUsers;
        $('stat-total-messages').textContent = d.totalMessages;
        renderAdminUserRows(d.users || []);
    } catch (err) { console.error('Failed to load admin dashboard:', err); }
}

function renderAdminUserRows(users) {
    const box = $('admin-users-table');
    box.innerHTML = '';
    if (!users.length) { box.innerHTML = '<div class="empty-note">No users found</div>'; return; }
    users.forEach(u => {
        const admin = isAdmin(u.username), n = esc(u.username);
        box.insertAdjacentHTML('beforeend', `
            <div class="admin-user-row">
                <div class="admin-user-info">
                    <div class="avatar" style="background:${gradient(u.username)}">${esc(u.username.charAt(0))}</div>
                    <span class="admin-user-name">@${n} ${admin ? '👑' : ''}</span>
                </div>
                <div class="admin-actions-cell">${admin ? '<span class="protected-tag">Protected</span>' : `
                    <button class="btn-admin-act btn-warn" data-act="warn" data-user="${n}">⚠️ Warn</button>
                    <button class="btn-admin-act btn-delete" data-act="delete" data-user="${n}">🗑️ Delete</button>`}
                </div>
            </div>`);
    });
}

function showAdminFeedback(msg) {
    const el = $('admin-feedback');
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(showAdminFeedback.t);
    showAdminFeedback.t = setTimeout(() => el.classList.add('hidden'), 4000);
}

async function deleteUserByAdmin(target) {
    if (!confirm(`Permanently delete @${target} and their chat history?`)) return;
    try {
        const d = await api('admin/delete-user', null, { admin: currentUser, target });
        showAdminFeedback(d.message || d.error || 'Done.');
        if (d.success) {
            loadAdminDashboard(); loadUsers();
            if (activeChatUser === target) backToSidebar();
        }
    } catch { showAdminFeedback('Failed to delete user.'); }
}

async function sendWarningByAdmin(target) {
    const warning = prompt(`Official notice for @${target}:`, 'Please follow community rules and keep conversations respectful.');
    if (!warning || !warning.trim()) return;
    try {
        const d = await api('admin/warning', null, { admin: currentUser, target, warning: warning.trim() });
        showAdminFeedback(d.message || d.error || 'Done.');
    } catch { showAdminFeedback('Failed to send notice.'); }
}

/* ---------- Wiring ---------- */
document.addEventListener('click', e => {
    const card = e.target.closest('#users-list .user-card-item');
    if (card) return selectUser(card.dataset.user);
    const btn = e.target.closest('#admin-users-table [data-act]');
    if (btn) (btn.dataset.act === 'warn' ? sendWarningByAdmin : deleteUserByAdmin)(btn.dataset.user);
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('admin-modal').classList.contains('hidden')) closeAdminModal(); });

document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadMessages(); if (currentUser) loadUsers(); } });

window.addEventListener('DOMContentLoaded', () => {
    const saved = sessionStorage.getItem('cc_user');
    if (saved) { currentUser = saved; initChatView(); }
    setInterval(() => { if (currentUser && !document.hidden) loadUsers(); }, 10000);
});

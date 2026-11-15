import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// No build tooling is required: the browser loads the Supabase JavaScript SDK from a CDN.
const $ = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat('zh-TW').format(value);
const MEALS = [
  { id: 'breakfast', label: '早餐', english: 'BREAKFAST', emoji: '☀️' },
  { id: 'lunch', label: '午餐', english: 'LUNCH', emoji: '🍱' },
  { id: 'dinner', label: '晚餐', english: 'DINNER', emoji: '🌙' },
  { id: 'snack', label: '點心／其他', english: 'SNACKS', emoji: '🍪' },
];
const state = {
  client: null,
  user: null,
  authMode: 'login',
  recovery: new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery',
  selectedDate: today(),
  dailyGoal: 2000,
  weekEntries: [],
  todayEntries: [],
  editingId: null,
  loadId: 0,
};
let toastTimer;

function today() { return localDate(new Date()); }
function localDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function shiftDate(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
function formatDate(dateString, options = { month: 'long', day: 'numeric', weekday: 'long' }) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Intl.DateTimeFormat('zh-TW', options).format(new Date(year, month - 1, day, 12));
}
function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function toast(message, isError = false) {
  clearTimeout(toastTimer);
  const el = $('toast');
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}
function niceError(error) {
  const message = error?.message || '發生未知錯誤。';
  if (/invalid login credentials/i.test(message)) return '登入失敗，請確認信箱與密碼。';
  if (/email not confirmed/i.test(message)) return '請先點擊信箱中的驗證連結。';
  if (/user already registered/i.test(message)) return '這個信箱已註冊，請直接登入。';
  if (/email rate limit exceeded|over_email_send_rate_limit/i.test(message)) return '郵件寄送過於頻繁，請稍後再試。';
  if (/email address not authorized|email_address_not_authorized/i.test(message)) return '此信箱無法使用 Supabase 預設寄信服務。請改用專案團隊信箱測試，或先設定 SMTP。';
  if (/password should be at least/i.test(message)) return '密碼長度不足。';
  if (/failed to fetch|networkerror/i.test(message)) return '網路連線失敗，請檢查網路或 Supabase 專案狀態。';
  return message;
}
function busy(button, value) {
  if (value) {
    button.dataset.originalText = button.textContent;
    button.textContent = '處理中…';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || '完成';
    button.disabled = false;
  }
}
function showScreen(name) {
  for (const screen of ['config', 'auth', 'dashboard']) {
    $(`${screen}-screen`).classList.toggle('hidden', screen !== name);
  }
}
function showAuthSection(section) {
  $('auth-main-view').classList.toggle('hidden', section !== 'main');
  $('auth-forgot-view').classList.toggle('hidden', section !== 'forgot');
  $('auth-recovery-view').classList.toggle('hidden', section !== 'recovery');
  showScreen('auth');
}
function setAuthMode(mode) {
  state.authMode = mode;
  $('tab-login').classList.toggle('active', mode === 'login');
  $('tab-signup').classList.toggle('active', mode === 'signup');
  $('tab-login').setAttribute('aria-selected', String(mode === 'login'));
  $('tab-signup').setAttribute('aria-selected', String(mode === 'signup'));
  $('auth-heading').textContent = mode === 'login' ? '歡迎回來！' : '一起開始記錄吧！';
  $('auth-subtitle').textContent = mode === 'login' ? '登入你的帳號，接著記下今天的飲食吧。' : '只要一個電子郵件，就能開啟自己的飲食日誌。';
  $('auth-submit').textContent = mode === 'login' ? '登入 →' : '建立帳號 →';
  $('auth-password').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  $('password-confirm-wrap').classList.toggle('hidden', mode !== 'signup');
  $('auth-password-confirm').required = mode === 'signup';
  $('forgot-link').classList.toggle('hidden', mode !== 'login');
  showAuthSection('main');
}

async function submitAuth(event) {
  event.preventDefault();
  const email = $('auth-email').value.trim();
  const password = $('auth-password').value;
  if (state.authMode === 'signup' && password !== $('auth-password-confirm').value) {
    toast('兩次輸入的密碼不一致。', true);
    return;
  }
  const button = $('auth-submit');
  busy(button, true);
  try {
    if (state.authMode === 'signup') {
      const { data, error } = await state.client.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
      if (data.session) {
        toast('帳號建立成功，已登入！');
      } else {
        setAuthMode('login');
        toast('註冊完成！請至信箱點擊驗證連結，再回來登入。');
      }
    } else {
      const { error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast('登入成功，歡迎回來！');
    }
  } catch (error) {
    toast(niceError(error), true);
  } finally {
    busy(button, false);
    $('auth-submit').textContent = state.authMode === 'login' ? '登入 →' : '建立帳號 →';
  }
}
async function submitForgot(event) {
  event.preventDefault();
  const button = $('forgot-submit');
  busy(button, true);
  try {
    const { error } = await state.client.auth.resetPasswordForEmail($('forgot-email').value.trim(), {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    toast('若信箱已註冊，將收到密碼重設郵件。請查看收件匣。');
    setAuthMode('login');
  } catch (error) {
    toast(niceError(error), true);
  } finally {
    busy(button, false);
  }
}
async function submitRecovery(event) {
  event.preventDefault();
  if ($('new-password').value !== $('new-password-confirm').value) {
    toast('兩次輸入的密碼不一致。', true);
    return;
  }
  const button = $('recovery-submit');
  busy(button, true);
  try {
    const { error } = await state.client.auth.updateUser({ password: $('new-password').value });
    if (error) throw error;
    state.recovery = false;
    window.history.replaceState(null, '', window.location.pathname);
    toast('密碼更新成功！');
    if (state.user) {
      showScreen('dashboard');
      await loadDashboard();
    } else {
      setAuthMode('login');
    }
  } catch (error) {
    toast(niceError(error), true);
  } finally {
    busy(button, false);
  }
}
async function handleAuthChange(event, session) {
  // The auth callback itself never awaits Supabase calls; see the deferred caller below.
  if (event === 'PASSWORD_RECOVERY') state.recovery = true;
  if (!session?.user) {
    state.loadId += 1;
    state.user = null;
    state.weekEntries = [];
    state.todayEntries = [];
    if (state.recovery) {
      showAuthSection('recovery');
    } else {
      setAuthMode('login');
    }
    return;
  }
  const isDifferentUser = state.user?.id !== session.user.id;
  state.user = session.user;
  if (state.recovery) {
    showAuthSection('recovery');
    return;
  }
  showScreen('dashboard');
  $('side-email').textContent = session.user.email || '';
  $('topbar-user').textContent = session.user.email || '';
  if (isDifferentUser) {
    state.selectedDate = today();
    state.dailyGoal = 2000;
  }
  if (event !== 'TOKEN_REFRESHED' && event !== 'USER_UPDATED') await loadDashboard();
}

async function loadDashboard() {
  if (!state.user) return;
  const currentLoad = ++state.loadId;
  const date = state.selectedDate;
  const userId = state.user.id;
  const start = shiftDate(date, -6);
  updateDateControls();
  $('data-loading').classList.remove('hidden');
  try {
    const [entryResult, settingsResult] = await Promise.all([
      state.client.from('food_entries')
        .select('id, entry_date, meal_type, food_name, serving, calories, protein_g, carbs_g, fat_g, notes, created_at')
        .eq('user_id', userId).gte('entry_date', start).lte('entry_date', date)
        .order('created_at', { ascending: true }),
      state.client.from('user_settings')
        .select('daily_calorie_goal').eq('user_id', userId).maybeSingle(),
    ]);
    if (entryResult.error) throw entryResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (currentLoad !== state.loadId || userId !== state.user?.id) return;
    state.weekEntries = entryResult.data || [];
    state.todayEntries = state.weekEntries.filter((entry) => entry.entry_date === date);
    state.dailyGoal = settingsResult.data?.daily_calorie_goal ?? 2000;
    renderDashboard();
  } catch (error) {
    if (currentLoad === state.loadId) toast(`無法讀取紀錄：${niceError(error)}。請確認已執行 schema.sql。`, true);
  } finally {
    if (currentLoad === state.loadId) $('data-loading').classList.add('hidden');
  }
}
function updateDateControls() {
  $('selected-date-label').textContent = formatDate(state.selectedDate);
  $('day-picker').value = state.selectedDate;
  $('day-picker').max = today();
  $('day-next').disabled = state.selectedDate >= today();
  $('day-today').disabled = state.selectedDate === today();
}
function selectDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) {
    toast('請選擇今天或更早的日期。', true);
    updateDateControls();
    return;
  }
  state.selectedDate = date;
  void loadDashboard();
}
function sum(entries, column) { return entries.reduce((total, entry) => total + (Number(entry[column]) || 0), 0); }
function renderDashboard() {
  const calories = sum(state.todayEntries, 'calories');
  const goal = state.dailyGoal;
  const percent = Math.round(calories / goal * 100);
  $('calories-total').textContent = number(calories);
  $('goal-display').textContent = number(goal);
  $('chart-goal-text').textContent = number(goal);
  $('progress-number').textContent = `${percent}%`;
  $('calorie-ring').style.background = `conic-gradient(#5b9c74 0% ${Math.min(100, percent)}%, #e9f1e9 ${Math.min(100, percent)}% 100%)`;
  $('calorie-ring').setAttribute('aria-valuenow', String(Math.min(100, percent)));
  $('calorie-ring').setAttribute('aria-valuetext', `已完成每日目標的 ${percent}%`);
  $('remaining-badge').classList.toggle('over', calories > goal);
  $('remaining-badge').textContent = calories > goal
    ? `超過設定目標 ${number(calories - goal)} kcal`
    : `距離設定目標 ${number(goal - calories)} kcal`;
  $('protein-total').textContent = sum(state.todayEntries, 'protein_g').toFixed(1);
  $('carb-total').textContent = sum(state.todayEntries, 'carbs_g').toFixed(1);
  $('fat-total').textContent = sum(state.todayEntries, 'fat_g').toFixed(1);
  renderMeals();
  renderChart();
}
function renderMeals() {
  $('meal-sections').innerHTML = MEALS.map((meal) => {
    const items = state.todayEntries.filter((entry) => entry.meal_type === meal.id);
    const total = sum(items, 'calories');
    const rows = items.length ? items.map((entry) => {
      const servingAndNotes = [entry.serving, entry.notes].filter(Boolean).map(safeText).join(' · ');
      return `<div class="meal-item">
        <div class="meal-item-main"><strong>${safeText(entry.food_name)}</strong><p>${servingAndNotes || '沒有額外備註'}</p></div>
        <div class="meal-item-right"><div class="meal-kcal">${number(entry.calories)} <small>kcal</small></div>
        <button class="meal-action" type="button" data-edit="${safeText(entry.id)}" aria-label="編輯 ${safeText(entry.food_name)}">編輯</button>
        <button class="meal-action delete" type="button" data-delete="${safeText(entry.id)}" aria-label="刪除 ${safeText(entry.food_name)}">刪除</button></div>
      </div>`;
    }).join('') : '<div class="meal-empty">還沒有紀錄，點選「新增紀錄」開始 ✦</div>';
    return `<div class="meal-section"><div class="meal-header"><div class="meal-header-left"><span class="meal-emoji">${meal.emoji}</span><strong>${meal.label}</strong><small>${meal.english}</small></div><span class="meal-header-total"><strong>${number(total)}</strong> kcal</span></div><div class="meal-list">${rows}</div></div>`;
  }).join('');
}
function renderChart() {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(state.selectedDate, i - 6));
  const totals = days.map((date) => sum(state.weekEntries.filter((item) => item.entry_date === date), 'calories'));
  const high = Math.max(state.dailyGoal, ...totals, 1);
  const markerBottom = 41 + (116 * state.dailyGoal / high);
  const markup = days.map((day, i) => {
    const calories = totals[i];
    const isSelected = day === state.selectedDate;
    const isOver = calories > state.dailyGoal;
    const height = calories ? Math.max(5, Math.round(calories / high * 116)) : 4;
    return `<div class="chart-col ${isSelected ? 'today' : ''} ${isOver ? 'over-goal' : ''}" title="${safeText(day)}：${number(calories)} kcal">
      <span class="chart-value">${calories ? number(calories) : '0'}</span>
      <div class="chart-track"><span class="chart-bar" style="height:${height}px"></span></div>
      <span class="chart-day">${formatDate(day, { month: 'numeric', day: 'numeric' })}</span>
    </div>`;
  }).join('');
  $('weekly-chart').innerHTML = `<div class="goal-marker" style="bottom:${markerBottom}px" aria-hidden="true"></div>${markup}`;
  $('weekly-chart').setAttribute('aria-label', `近七天熱量：${days.map((day, i) => `${day} ${totals[i]} 大卡`).join('，')}。每日目標 ${state.dailyGoal} 大卡。`);
}

function openEntry(entry = null) {
  state.editingId = entry?.id || null;
  $('entry-dialog-title').textContent = entry ? '編輯飲食紀錄' : '記錄一餐';
  $('entry-save-button').textContent = entry ? '儲存修改 →' : '儲存飲食紀錄 →';
  $('entry-form').reset();
  $('entry-date').max = today();
  $('entry-date').value = entry?.entry_date || state.selectedDate;
  $('entry-name').value = entry?.food_name || '';
  $('entry-serving').value = entry?.serving || '';
  $('entry-meal').value = entry?.meal_type || 'breakfast';
  $('entry-calories').value = entry?.calories ?? '';
  $('entry-protein').value = entry?.protein_g ?? '';
  $('entry-carbs').value = entry?.carbs_g ?? '';
  $('entry-fat').value = entry?.fat_g ?? '';
  $('entry-notes').value = entry?.notes || '';
  $('entry-dialog').showModal();
  $('entry-name').focus();
}
async function submitEntry(event) {
  event.preventDefault();
  if (!state.user) return;
  const form = $('entry-form');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const entryDate = String(data.get('entry_date'));
  if (entryDate > today()) {
    toast('無法記錄未來日期。', true);
    return;
  }
  const payload = {
    food_name: String(data.get('food_name')).trim(),
    entry_date: entryDate,
    meal_type: String(data.get('meal_type')),
    serving: String(data.get('serving')).trim(),
    calories: Number(data.get('calories')),
    protein_g: Number(data.get('protein_g') || 0),
    carbs_g: Number(data.get('carbs_g') || 0),
    fat_g: Number(data.get('fat_g') || 0),
    notes: String(data.get('notes')).trim(),
  };
  if (!payload.food_name || !Number.isInteger(payload.calories)) {
    toast('請填寫食物名稱與正確的整數熱量。', true);
    return;
  }
  const button = $('entry-save-button');
  busy(button, true);
  try {
    if (state.editingId) {
      const { data: updated, error } = await state.client.from('food_entries')
        .update(payload).eq('user_id', state.user.id).eq('id', state.editingId)
        .select('id').single();
      if (error) throw error;
      if (!updated) throw new Error('找不到要編輯的紀錄。');
    } else {
      const { error } = await state.client.from('food_entries')
        .insert({ ...payload, user_id: state.user.id });
      if (error) throw error;
    }
    $('entry-dialog').close();
    state.editingId = null;
    if (state.selectedDate !== entryDate) state.selectedDate = entryDate;
    await loadDashboard();
    toast('紀錄已安全儲存並同步至雲端！');
  } catch (error) {
    toast(`儲存失敗：${niceError(error)}`, true);
  } finally {
    busy(button, false);
  }
}
async function deleteEntry(id) {
  const entry = state.todayEntries.find((item) => item.id === id);
  if (!entry || !state.user) return;
  if (!window.confirm(`確定要刪除「${entry.food_name}」嗎？這個操作無法復原。`)) return;
  try {
    const { error } = await state.client.from('food_entries')
      .delete().eq('user_id', state.user.id).eq('id', entry.id);
    if (error) throw error;
    await loadDashboard();
    toast('已刪除這筆紀錄。');
  } catch (error) {
    toast(`刪除失敗：${niceError(error)}`, true);
  }
}
function openSettings() {
  $('settings-goal').value = state.dailyGoal;
  $('settings-dialog').showModal();
}
async function submitSettings(event) {
  event.preventDefault();
  if (!state.user) return;
  const goal = Number($('settings-goal').value);
  if (!Number.isInteger(goal) || goal < 500 || goal > 10000) {
    toast('請輸入 500 至 10,000 之間的整數。', true);
    return;
  }
  const button = $('settings-save-button');
  busy(button, true);
  try {
    const { error } = await state.client.from('user_settings')
      .upsert({ user_id: state.user.id, daily_calorie_goal: goal }, { onConflict: 'user_id' });
    if (error) throw error;
    state.dailyGoal = goal;
    $('settings-dialog').close();
    renderDashboard();
    toast('每日熱量目標已更新！');
  } catch (error) {
    toast(`更新目標失敗：${niceError(error)}`, true);
  } finally {
    busy(button, false);
  }
}
function bindEvents() {
  $('auth-form').addEventListener('submit', submitAuth);
  $('forgot-form').addEventListener('submit', submitForgot);
  $('recovery-form').addEventListener('submit', submitRecovery);
  $('tab-login').addEventListener('click', () => setAuthMode('login'));
  $('tab-signup').addEventListener('click', () => setAuthMode('signup'));
  $('forgot-link').addEventListener('click', () => showAuthSection('forgot'));
  $('back-login').addEventListener('click', () => setAuthMode('login'));
  $('signout-button').addEventListener('click', async () => {
    try {
      const { error } = await state.client.auth.signOut();
      if (error) throw error;
      toast('已安全登出。');
    } catch (error) { toast(niceError(error), true); }
  });
  $('day-prev').addEventListener('click', () => selectDate(shiftDate(state.selectedDate, -1)));
  $('day-next').addEventListener('click', () => selectDate(shiftDate(state.selectedDate, 1)));
  $('day-today').addEventListener('click', () => selectDate(today()));
  $('day-picker').addEventListener('change', (event) => selectDate(event.target.value));
  $('add-top-button').addEventListener('click', () => openEntry());
  $('add-meal-button').addEventListener('click', () => openEntry());
  $('goal-shortcut').addEventListener('click', openSettings);
  $('settings-side').addEventListener('click', openSettings);
  $('entry-form').addEventListener('submit', submitEntry);
  $('settings-form').addEventListener('submit', submitSettings);
  $('meal-sections').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    const remove = event.target.closest('[data-delete]');
    if (edit) {
      const entry = state.todayEntries.find((item) => item.id === edit.dataset.edit);
      if (entry) openEntry(entry);
    }
    if (remove) void deleteEntry(remove.dataset.delete);
  });
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {
    $(button.dataset.close).close();
  }));
  document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.user && !state.recovery && !$('dashboard-screen').classList.contains('hidden')) {
      void loadDashboard();
    }
  });
}
async function start() {
  bindEvents();
  updateDateControls();
  const isValidConfig = /^https:\/\/[^/]+\.supabase\.co\/?$/.test(SUPABASE_URL)
    && typeof SUPABASE_PUBLISHABLE_KEY === 'string'
    && SUPABASE_PUBLISHABLE_KEY.length > 20
    && !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_')
    && !SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_');
  if (!isValidConfig) {
    showScreen('config');
    return;
  }
  showScreen('auth');
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    state.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    // Defer API work outside onAuthStateChange to avoid deadlocks.
    state.client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => { void handleAuthChange(event, session); }, 0);
    });
  } catch (error) {
    showScreen('config');
    $('config-title').textContent = '無法載入 Supabase';
    toast('Supabase SDK 載入失敗，請確認網路連線及設定。', true);
    console.error('Initialization failed', error);
  }
}
void start();
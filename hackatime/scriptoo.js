// standalone.js - make the plugin UI a working web app
// WARNING: exposing API key in client JS is insecure for public pages.
// This is useful for testing or private pages only.

let isTracking = false;
let heartbeatInterval = null;
let lastHeartbeat = 0;
let lastActivityFile = null;
const RATE_LIMIT_MS = 120000; // 2 minutes for non-write events
const HEARTBEAT_INTERVAL = 120000; // 2 minutes periodic send

const currentSettings = { apiKey: '', serverUrl: 'https://hackatime.hackclub.com' };

window.onload = () => {
  // load stored settings
  const savedKey = localStorage.getItem('hackatime-api-key') || '';
  const savedUrl = localStorage.getItem('hackatime-server-url') || 'https://hackatime.hackclub.com';
  currentSettings.apiKey = savedKey;
  currentSettings.serverUrl = savedUrl;
  document.getElementById('apiKey').value = savedKey;
  document.getElementById('serverUrl').value = savedUrl;

  document.getElementById('apiKey').addEventListener('input', validateApiKey);
  document.getElementById('serverUrl').addEventListener('input', validateServerUrl);

  validateForm();

  // light activity detector (mouse/keyboard) to trigger heartbeats
  const activityHandler = throttle(() => {
    if (isTracking) {
      sendActivity('User active (mousemove/keydown)', 'designing', false).catch(err => {
        console.error(err);
        updateActivity('Error: ' + err.message, 'error');
      });
    }
  }, 30000); // 30s client-side debounce

  window.addEventListener('mousemove', activityHandler);
  window.addEventListener('keydown', activityHandler);
};

function validateApiKey() {
  const input = document.getElementById('apiKey');
  const value = input.value.trim();
  if (!value) {
    setFieldState('apiKey', 'invalid', 'API key is required');
    return false;
  } else if (value.length < 10) {
    setFieldState('apiKey', 'invalid', "This doesn't look like a valid API key");
    return false;
  } else {
    setFieldState('apiKey', 'valid', 'Looks good');
    return true;
  }
}

function validateServerUrl() {
  const input = document.getElementById('serverUrl');
  const value = input.value.trim();
  if (!value) {
    setFieldState('serverUrl', 'invalid', 'Server URL is required');
    return false;
  }
  try {
    new URL(value);
    setFieldState('serverUrl', 'valid', 'Valid URL');
    return true;
  } catch {
    setFieldState('serverUrl', 'invalid', 'Invalid URL format');
    return false;
  }
}

function validateForm() {
  return validateApiKey() && validateServerUrl();
}

function setFieldState(fieldId, state, message = '') {
  const input = document.getElementById(fieldId);
  const help = document.getElementById(fieldId + 'Help');
  input.classList.remove('valid', 'invalid');
  if (state === 'valid') {
    input.classList.add('valid');
    help.textContent = message || help.textContent;
    help.className = 'field-success';
  } else if (state === 'invalid') {
    input.classList.add('invalid');
    help.textContent = message;
    help.className = 'field-error';
  } else {
    help.className = 'field-help';
  }
}

function setButtonLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  if (loading) btn.innerHTML = `<span class="spinner"></span>${text}`;
  else btn.textContent = text;
}

function showNotification(message, type) {
  const notification = document.getElementById('notification');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.display = 'block';
  setTimeout(() => notification.style.display = 'none', 4000);
}

function updateTrackingUI(tracking) {
  const card = document.getElementById('statusCard');
  const label = document.getElementById('statusLabel');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');

  if (tracking) {
    card.className = 'status-card tracking';
    label.className = 'status-label active';
    label.innerHTML = '<span class="status-dot active" id="statusDot"></span>Tracking active';
    startBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  } else {
    card.className = 'status-card';
    label.className = 'status-label';
    label.innerHTML = '<span class="status-dot" id="statusDot"></span>Not tracking';
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
  }
}

function updateActivity(message, category) {
  const activity = document.getElementById('activityText');
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let prefix = '';
  if (category === 'building') prefix = 'editing';
  else if (category === 'debugging') prefix = 'navigating';
  else if (category === 'designing') prefix = 'active';
  else prefix = 'activity';
  activity.textContent = `${timestamp} - ${prefix}: ${message}`;
}

async function testConnection() {
  if (!validateForm()) { showNotification('Please fix the errors above', 'error'); return; }
  const settings = {
    apiKey: document.getElementById('apiKey').value.trim(),
    serverUrl: document.getElementById('serverUrl').value.trim()
  };
  setButtonLoading('testBtn', true, 'Testing...');
  try {
    await saveSettings(settings);
    // test payload
    const testPayload = {
      entity: 'web-connection-test',
      type: 'app',
      category: 'debugging',
      time: Date.now() / 1000,
      is_write: false,
      language: 'Web',
      project: 'Connection Test'
    };
    const resp = await sendHeartbeat(testPayload, settings);
    if (resp.ok) {
      showNotification('Connection successful!', 'success');
      setFieldState('apiKey', 'valid');
      setFieldState('serverUrl', 'valid');
    } else {
      const text = await resp.text();
      showNotification(`Server error: ${resp.status} ${resp.statusText} ${text}`, 'error');
    }
  } catch (err) {
    showNotification('Connection failed: ' + (err.message || err), 'error');
  } finally {
    setButtonLoading('testBtn', false, 'Test Connection');
  }
}

async function saveSettings(settings) {
  const s = settings || {
    apiKey: document.getElementById('apiKey').value.trim(),
    serverUrl: document.getElementById('serverUrl').value.trim()
  };
  localStorage.setItem('hackatime-api-key', s.apiKey);
  localStorage.setItem('hackatime-server-url', s.serverUrl);
  currentSettings.apiKey = s.apiKey;
  currentSettings.serverUrl = s.serverUrl;
  showNotification('Settings saved', 'success');
}

async function startTracking() {
  if (!validateForm()) { showNotification('Please configure your settings first', 'error'); return; }
  setButtonLoading('startBtn', true, 'Starting...');
  const settings = {
    apiKey: document.getElementById('apiKey').value.trim(),
    serverUrl: document.getElementById('serverUrl').value.trim()
  };
  await saveSettings(settings);
  isTracking = true;
  updateTrackingUI(true);
  showNotification('Tracking started!', 'success');

  // send initial activity
  sendActivity('Started tracking (web)', 'debugging', true).catch(err => {
    console.error(err);
    updateActivity('Error: ' + err.message, 'error');
  });

  // periodic heartbeats
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (isTracking) sendActivity('Periodic activity', 'designing', false).catch(console.error);
  }, HEARTBEAT_INTERVAL);
  setButtonLoading('startBtn', false, 'Start Tracking');
}

function stopTracking() {
  if (!isTracking) return;
  isTracking = false;
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  updateTrackingUI(false);
  showNotification('Tracking stopped', 'info');
}

async function sendActivity(description, category, isWrite) {
  if (!isTracking && !isWrite) return;
  const now = Date.now();
  const currentFile = document.title || 'Web Project';
  if (lastActivityFile === currentFile && (now - lastHeartbeat) < RATE_LIMIT_MS && !isWrite) return;

  const payload = {
    entity: currentFile,
    type: 'file',
    category,
    time: now / 1000,
    is_write: !!isWrite,
    language: 'Web',
    project: extractProjectName(currentFile),
    branch: 'web'
  };

  try {
    const resp = await sendHeartbeat(payload, currentSettings);
    if (resp.ok) {
      lastHeartbeat = now;
      lastActivityFile = currentFile;
      updateActivity(description, category);
    } else {
      const text = await resp.text();
      throw new Error(`${resp.status} ${resp.statusText} ${text}`);
    }
  } catch (err) {
    console.error('Failed to send heartbeat:', err);
    updateActivity('Error: ' + (err.message || err), 'error');
    throw err;
  }
}

async function sendHeartbeat(payload, settings) {
  const url = `${settings.serverUrl.replace(/\/$/, '')}/api/hackatime/v1/heartbeats`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const opts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
      'User-Agent': 'Hackatime-Web/1.0.0'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  };

  try {
    const resp = await fetch(url, opts);
    clearTimeout(timeoutId);
    return resp;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('Request timeout - check connection or CORS');
    throw err;
  }
}

function extractProjectName(fileName) {
  return fileName.replace(/\.(html|htm|txt)$/i, '').replace(/[_-]/g, ' ').trim() || 'Web Project';
}

// throttle helper
function throttle(fn, wait) {
  let last = 0;
  let timer = null;
  return function(...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn.apply(this, args);
      }, wait - (now - last));
    }
  };
}

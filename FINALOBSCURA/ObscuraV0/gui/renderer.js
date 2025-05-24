// Renderer process for Obscura GUI
const form = document.getElementById('toggles-form');
const saveBtn = document.getElementById('save-btn');
const statusDiv = document.getElementById('status');

const TOGGLE_LABELS = {
  canvas: 'Canvas',
  webgl: 'WebGL',
  fonts: 'Fonts',
  navigator: 'Navigator',
  plugins: 'Plugins',
  proxy: 'Proxy',
  userAgent: 'User Agent',
  puppets: 'Puppets',
  headless: 'Headless'
};

async function loadToggles() {
  const config = await window.obscuraAPI.getProtectionConfig();
  const toggles = config.protectionToggles || {};
  form.innerHTML = '';
  Object.entries(TOGGLE_LABELS).forEach(([key, label]) => {
    const checked = toggles[key] === true;
    const item = document.createElement('div');
    item.className = 'toggle-item';
    item.innerHTML = `
      <label for="${key}">${label}</label>
      <input type="checkbox" id="${key}" name="${key}" ${checked ? 'checked' : ''}>
    `;
    form.appendChild(item);
  });
}

saveBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const newToggles = {};
  Object.keys(TOGGLE_LABELS).forEach(key => {
    newToggles[key] = document.getElementById(key).checked;
  });
  await window.obscuraAPI.setProtectionConfig({ protectionToggles: newToggles });
  statusDiv.textContent = 'Toggles saved!';
  setTimeout(() => { statusDiv.textContent = ''; }, 1500);
});

window.addEventListener('DOMContentLoaded', loadToggles);

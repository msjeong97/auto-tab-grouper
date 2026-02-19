// Auto Tab Grouper - Options Page

const globalToggle = document.getElementById('globalToggle');
const ruleForm = document.getElementById('ruleForm');
const domainInput = document.getElementById('domainInput');
const groupNameInput = document.getElementById('groupNameInput');
const colorSelect = document.getElementById('colorSelect');
const submitBtn = document.getElementById('submitBtn');
const rulesList = document.getElementById('rulesList');
const emptyState = document.getElementById('emptyState');
const statusMessage = document.getElementById('statusMessage');

const COLOR_MAP = {
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#e8710a',
  grey: '#5f6368'
};

let editingRuleId = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const { isEnabled = true, rules = [] } = await chrome.storage.sync.get(['isEnabled', 'rules']);
  globalToggle.checked = isEnabled;
  renderRules(rules);

  globalToggle.addEventListener('change', handleToggleChange);
  ruleForm.addEventListener('submit', handleFormSubmit);
}

async function handleToggleChange() {
  await chrome.storage.sync.set({ isEnabled: globalToggle.checked });
  showStatus(globalToggle.checked ? 'Auto grouping enabled' : 'Auto grouping disabled');
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const host = domainInput.value.trim().toLowerCase();
  const groupName = groupNameInput.value.trim();
  const color = colorSelect.value;

  if (!host || !groupName) return;

  let cleanHost = host;
  try {
    if (host.includes('://')) {
      cleanHost = new URL(host).hostname;
    }
  } catch {
    // Use raw input if URL parsing fails
  }

  const { rules = [] } = await chrome.storage.sync.get(['rules']);
  const duplicate = rules.find(r => r.host === cleanHost && r.id !== editingRuleId);
  if (duplicate) {
    showStatus(`A rule for "${cleanHost}" already exists.`, true);
    return;
  }

  let updatedRules;

  if (editingRuleId) {
    updatedRules = rules.map(r => {
      if (r.id === editingRuleId) {
        return { ...r, host: cleanHost, groupName, color };
      }
      return r;
    });
  } else {
    const newRule = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      host: cleanHost,
      groupName,
      color
    };
    updatedRules = [...rules, newRule];
  }

  await chrome.storage.sync.set({ rules: updatedRules });

  const wasEditing = editingRuleId !== null;
  resetForm();
  renderRules(updatedRules);
  showStatus(wasEditing ? 'Rule updated' : 'Rule added');
}

async function deleteRule(ruleId) {
  const { rules = [] } = await chrome.storage.sync.get(['rules']);
  const updatedRules = rules.filter(r => r.id !== ruleId);
  await chrome.storage.sync.set({ rules: updatedRules });
  renderRules(updatedRules);
  showStatus('Rule deleted');

  if (editingRuleId === ruleId) {
    resetForm();
  }
}

function editRule(rule) {
  editingRuleId = rule.id;
  domainInput.value = rule.host;
  groupNameInput.value = rule.groupName;
  colorSelect.value = rule.color;
  submitBtn.textContent = 'Update Rule';
  domainInput.focus();
}

function resetForm() {
  ruleForm.reset();
  submitBtn.textContent = 'Add Rule';
  editingRuleId = null;
}

function renderRules(rules) {
  rulesList.innerHTML = '';

  if (rules.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  const sorted = [...rules].sort((a, b) => {
    const nameCompare = a.groupName.localeCompare(b.groupName);
    if (nameCompare !== 0) return nameCompare;
    return a.color.localeCompare(b.color);
  });

  let lastKey = null;

  sorted.forEach(rule => {
    const key = `${rule.groupName}::${rule.color}`;

    if (key !== lastKey) {
      const header = document.createElement('div');
      header.className = 'rule-group-header';

      const colorDot = document.createElement('span');
      colorDot.className = 'color-dot';
      colorDot.style.backgroundColor = COLOR_MAP[rule.color] || COLOR_MAP.grey;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = rule.groupName;

      header.appendChild(colorDot);
      header.appendChild(nameSpan);
      rulesList.appendChild(header);

      lastKey = key;
    }

    const ruleEl = document.createElement('div');
    ruleEl.className = 'rule-item';

    const info = document.createElement('div');
    info.className = 'rule-info';

    const hostSpan = document.createElement('span');
    hostSpan.className = 'rule-host';
    hostSpan.textContent = rule.host;

    info.appendChild(hostSpan);

    const actions = document.createElement('div');
    actions.className = 'rule-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editRule(rule));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteRule(rule.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    ruleEl.appendChild(info);
    ruleEl.appendChild(actions);

    rulesList.appendChild(ruleEl);
  });
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${isError ? 'error' : 'success'} visible`;

  setTimeout(() => {
    statusMessage.className = 'status-message';
  }, 2500);
}

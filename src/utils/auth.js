export const ROLES = {
  SUPER_ADMIN: 'super_admin', // مدير النظام (أنت)
  ADMIN: 'admin',             // مسؤول الامتحانات
};

export const DEFAULT_ACCOUNTS = [
  {
    username: 'admin',
    name: 'مدير النظام (رئيس لجنة الامتحانات)',
    role: ROLES.SUPER_ADMIN,
    password: '123456',
    badge: 'مدير النظام (أعلى صلاحية)'
  },
  {
    username: 'admin2',
    name: 'مسؤول إدخال وجدولة الامتحانات',
    role: ROLES.ADMIN,
    password: '123456',
    badge: 'مسؤول الامتحانات'
  }
];

export function getStoredAccounts() {
  try {
    const raw = localStorage.getItem('qou_system_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading accounts:', e);
  }
  return DEFAULT_ACCOUNTS;
}

export function saveStoredAccounts(accounts) {
  if (accounts) {
    localStorage.setItem('qou_system_accounts', JSON.stringify(accounts));
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('qou_current_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading auth:', e);
  }
  // Default to Super Admin on first open
  const accounts = getStoredAccounts();
  return accounts[0] || DEFAULT_ACCOUNTS[0];
}

export function saveStoredUser(user) {
  if (user) {
    localStorage.setItem('qou_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('qou_current_user');
  }
}

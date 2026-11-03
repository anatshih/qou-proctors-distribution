export const ROLES = {
  SUPER_ADMIN: 'super_admin', // مدير النظام (وهو أنا)
  ADMIN: 'admin',             // مسؤول الامتحانات
};

export const DEFAULT_ACCOUNTS = [
  {
    username: 'director',
    name: 'مدير النظام (رئيس لجنة الامتحانات)',
    role: ROLES.SUPER_ADMIN,
    password: '123',
    badge: 'مدير النظام (أعلى صلاحية)'
  },
  {
    username: 'admin',
    name: 'مسؤول إدخال وجدولة الامتحانات',
    role: ROLES.ADMIN,
    password: '123',
    badge: 'مسؤول الامتحانات'
  }
];

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('qou_current_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading auth:', e);
  }
  // Default to Super Admin on first open for convenience
  return DEFAULT_ACCOUNTS[0];
}

export function saveStoredUser(user) {
  if (user) {
    localStorage.setItem('qou_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('qou_current_user');
  }
}

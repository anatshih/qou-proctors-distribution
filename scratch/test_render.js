// scratch/test_render.js
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App.jsx';

// Mock localStorage and sessionStorage
const storageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
};

global.localStorage = storageMock();
global.sessionStorage = storageMock();
global.window = {
  print: () => {},
  confirm: () => true,
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  location: { reload: () => {} }
};

// 1. Simulate logged in user
global.sessionStorage.setItem('qou_session_user', JSON.stringify({
  username: 'admin',
  name: 'أ. أحمد النتشة',
  role: 'SUPER_ADMIN',
  badge: 'مدير النظام (كامل الصلاحيات)'
}));

// Test 1: Render in ProjectsHub (no active project)
try {
  console.log('Test 1: Rendering App in ProjectsHub...');
  const html1 = renderToString(React.createElement(App));
  console.log('✓ Test 1 Success! HTML length:', html1.length);
} catch (err) {
  console.error('❌ Test 1 Failed:', err);
}

// Test 2: Set active project and render inside project
try {
  console.log('\nTest 2: Setting active project and rendering App inside project...');
  global.sessionStorage.setItem('qou_active_proj_id', 'proj_1261_midterm_default');
  const html2 = renderToString(React.createElement(App));
  console.log('✓ Test 2 Success! HTML length:', html2.length);
} catch (err) {
  console.error('❌ Test 2 Failed:', err);
}

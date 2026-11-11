// test hooks are exposed on window only when the address has ?debug
export const DEBUG = typeof window !== 'undefined' && /[?&]debug/.test(window.location.search);

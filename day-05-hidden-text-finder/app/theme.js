// Applies the saved theme before the first paint (kept in a file: the page's security policy allows no inline script).
try {
  var t = localStorage.getItem('htf:theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage may be off */ }

/* Sistema I+D — Ajustes del usuario */
'use strict';

/* ================= AJUSTES ================= */
var elDarkMode = document.getElementById('set-darkmode');
var elNotif = document.getElementById('set-notif');
var elAutosave = document.getElementById('set-autosave');
var elLang = document.getElementById('set-lang');
var settings = load('sid10_settings', {notif:true, autosave:true, lang:'es'});
function applySettingsToUI(){
  elDarkMode.checked = currentTheme === 'dark';
  elNotif.checked = settings.notif;
  elAutosave.checked = settings.autosave;
  elLang.value = settings.lang;
}
elDarkMode.addEventListener('change', function(){
  currentTheme = elDarkMode.checked ? 'dark' : 'light';
  applyTheme(currentTheme);
  save('sid10_theme', currentTheme);
  toast(currentTheme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
});
document.getElementById('set-save').addEventListener('click', function(){
  settings = { notif: elNotif.checked, autosave: elAutosave.checked, lang: elLang.value };
  save('sid10_settings', settings);
  toast('Cambios guardados correctamente');
});

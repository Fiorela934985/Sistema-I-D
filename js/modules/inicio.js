/* Sistema I+D — Inicio: saludo, KPIs del día y semana de roturas. Los accesos a cada sección son los
   siete pasos del flujo del ensayo (js/modules/flujo.js). */
'use strict';

var hookInicioOriginal = PANEL_HOOKS.inicio;
PANEL_HOOKS.inicio = function(){
  renderUsuarioShell();
  hookInicioOriginal();
  renderInicioSemana();
};

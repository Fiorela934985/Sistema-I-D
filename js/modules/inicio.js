/* Sistema I+D — Inicio: saludo, KPIs del día y semana de roturas.
   El Inicio "Mi semana" completo (Mis pendientes, poza, calendario semanal, actividades) llega en la Fase 6. */
'use strict';

var hookInicioOriginal = PANEL_HOOKS.inicio;
PANEL_HOOKS.inicio = function(){
  renderUsuarioShell();
  hookInicioOriginal();
  renderInicioSemana();
};

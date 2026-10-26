# Sistema I+D · Laboratorio I+D (I+D Nexus)

Aplicación web para la gestión de calidad del Laboratorio I+D: proyectos y su expediente, cálculo de diseños de mezcla (formato D-CC-F-148), roturas según NTP 339.034, resultados, Reporte RR, dashboard de KPIs, base histórica, predicción y asistente.

**Sitio publicado:** https://fiorela934985.github.io/Sistema-I-D/

Es una aplicación **100 % estática** (HTML + CSS + JavaScript, sin servidor). Los datos se guardan en el navegador (`localStorage` y, para las fotos, `IndexedDB`).

## Secciones

| Grupo | Sección | Qué hace |
|---|---|---|
| General | **Inicio** | Accesos rápidos según el rol, KPIs del día, semana de roturas, actividad reciente y favoritos |
| | **Dashboard y KPIs** | Avance por proyecto, KPIs de calidad (resistencia a 28 d, cumplimiento de f'c, dispersión, roturas al día), gráficos en vivo, reporte PDF/Excel |
| Operación | **Proyectos** | Tarjetas con avance, **expediente** del proyecto (resumen por iteración, resultados, comparativo entre iteraciones, evidencias, reportes RR, historial) y **radar** de seguimiento |
| | **Diseños** | Calculadora de dosificación, histórico, resultados de ensayo, informe con gráficas, etiquetas, duplicar |
| | **Roturas** | Pendientes (con vencidas), registro de elaboración, registro de cargas con evidencia y tipo de fractura, formato de roturas |
| | **Calendario de roturas** | Vista mensual y semanal; registrar la carga desde el día |
| | **Registro** | Componentes (cemento, adición, agua, pigmento, piedra, arena, aditivo) y proyectos/iteraciones |
| Resultados | **Reporte RR** | Estudios comparativos con visor (zoom − +), gráficos y exportación a Excel |
| | **Archivador** | Diseños completados por proyecto |
| | **Base histórica** | Dataset réplica × edad unido a los parámetros del diseño; Excel, CSV para Colab/XGBoost, respaldo y restauración |
| Inteligencia | **Predicción** | Modelo entrenado con la base histórica real (gradient boosting y ridge, validados dejando un diseño afuera; se activa el más preciso), simulador de diseños nuevos, curva de madurez con prueba retrospectiva y seguimiento de cada predicción contra el resultado real |
| | **Asistente I+D** | Agente con Claude (`claude-opus-5-5`) que responde consultando los datos con 14 herramientas; sin clave o sin internet usa el motor local |
| Administración | **Usuarios y roles** | Alta/edición de usuarios y matriz de funciones por rol (editable) |
| | **Historial** | Quién hizo qué y cuándo, con filtros y exportación |
| | **Ajustes** | Modo oscuro, notificaciones, cambio de contraseña |

## Roles

| Rol | Puede |
|---|---|
| **Administrador** | Todo, incluidos usuarios, permisos y respaldo/restauración |
| **Jefatura** | Ver todo (reportes, métricas, expedientes, predicción, historial), editar proyectos y Reporte RR, exportar. No registra ensayos |
| **Técnico** | Calcular y registrar diseños, roturas, resultados y evidencias; Reporte RR. No elimina ni administra |

El administrador puede ajustar las funciones de Jefatura y Técnico desde **Usuarios y roles**.

Usuario inicial: `FSANTOS` (Administrador). Cambiá su contraseña desde **Ajustes** después del primer ingreso.

## Estructura

```
index.html                      Maquetación: barra lateral, paneles y modales
css/styles.css                  Estilos base de los componentes
css/tema.css                    Tema celeste + verde (claro/oscuro) y estructura con barra lateral
css/modulos.css                 Estilos de los módulos (proyectos, calendario, predicción, asistente…)
js/core/
  utils.js                      Almacenamiento, formato, fechas, modales, exportación
  auth.js                       Usuarios, roles, permisos y sesión (contraseñas con SHA-256 + sal)
  historial.js                  Registro de movimientos (auditoría)
  ml.js                         Modelos de predicción, validación y seguimiento de predicciones
  icons.js                      Íconos e imágenes institucionales
  shell.js                      Tema, pantalla de carga y navegación
  analitica.js                  Métricas compartidas por proyecto/diseño y base histórica
js/modules/                     Una entidad o sección por archivo:
  catalogos, proyectos, componentes, evidencias, roturas, disenos/*, archivador, reporte-rr,
  proyectos-panel, calendario, etiquetas, base-historica, prediccion, asistente, usuarios,
  historial-panel, dashboard, ajustes, inicio
js/data/seed.js                 Datos de muestra y diseños reales (se siembran una sola vez)
js/data/reparaciones.js         Correcciones de integridad que se aplican al iniciar
js/main.js                      Arranque, inicio y cierre de sesión
data/disenos-reales.js          Diseños reales importados (R-15 a R-34)
assets/                         Logos, ícono y guía de tipos de fractura
sw.js, manifest.webmanifest     App instalable y uso sin conexión
.github/workflows/deploy.yml    Publicación automática en GitHub Pages
```

## Ejecutar en local

```bash
npm start          # http://localhost:8080
npm run check      # revisa la sintaxis de todos los scripts
```

## Despliegue

Cada `push` a `main` publica el sitio en GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Importante

- **Los datos viven en cada navegador.** Cada equipo tiene su propia información y los usuarios/roles son locales a ese navegador. Descargá respaldos desde *Base histórica*. Para que todo el equipo comparta la misma base y los permisos sean seguros, el siguiente paso es conectar un backend (por ejemplo Supabase o Firebase).
- **Predicción:** el error que muestra el panel *Modelo y precisión* se mide prediciendo cada diseño con un modelo que no lo vio (validación dejando un diseño afuera). Los diseños de demostración no se usan para entrenar.
- **Agente con IA:** se configura en *Ajustes → Asistente con IA* con una clave de la API de Anthropic (solo administración). La clave queda en ese navegador y las consultas, con los datos que el agente lee, se envían a Anthropic. Cada consulta tiene costo según el uso.

# Sistema I+D · ERP de proyectos del Laboratorio I+D

ERP de proyectos para el Laboratorio I+D (NEW I+D - SSCC): proyectos con sus ensayos, diseños de mezcla (D-CC-F-148), estado fresco, roturas según NTP 339.034, Reporte RR, planificación, personal autorizado y calidad según ISO/IEC 17025:2017 como guía de buenas prácticas.

**Sitio publicado:** https://fiorela934985.github.io/Sistema-I-D/

- **Frontend:** HTML + CSS + JavaScript en GitHub Pages.
- **Backend:** Cloudflare Workers + D1 (carpeta `worker/`). Sin servidor configurado, el sistema funciona en **modo local** (datos en el navegador).

## Avance por fases

| Fase | Qué se construye | Estado |
|---|---|---|
| 1 | Login, usuarios, roles, Personal, Ensayos y métodos | **Lista** |
| 2 | Proyectos con su asistente de 4 pasos y sus pestañas | **Lista** |
| 3 | Flujo por diseño (5 pasos), estado fresco, Roturas y etiquetas QR | Pendiente |
| 4 | Formatos, Informes y RR con aprobación | Pendiente |
| 5 | Planificación (Gantt, actividades de la semana) y notificaciones por correo | Pendiente |
| 6 | Inicio "Mi semana" y card de la poza de curado | Pendiente |
| 7 | Calidad (documentos, trabajo no conforme), integración con inventario e Inteligencia | Pendiente |

El esquema de base de datos (`worker/schema.sql`) ya incluye las tablas de todas las fases.

## Menú

| Grupo | Entrada | Estado |
|---|---|---|
| Inicio | Inicio | Actual (Mi semana en la Fase 6) |
| Proyectos | Proyectos | **Fase 2:** lista con filtros y radar de etapas, asistente de 4 pasos y pestañas Resumen · Muestras · Diseños · Ensayos · Informes · Plan de trabajo · Archivo |
| Formatos | Formato de Diseños (D-CC-F-148) · Formato de Estado Fresco · Formato de Roturas I+D · Formato de Cargas y Promediados · Etiquetas | Calculadora, histórico, roturas y RR actuales; tablas unificadas en las fases 3 y 4 |
| Planificación | Plan de trabajo · Asignar actividades · Calendario | Calendario actual; lo demás en la Fase 5 |
| Recursos | Personal | **Fase 1:** fichas y matriz de autorización |
| Calidad | Documentos · Trabajo no conforme · Historial de cambios | Historial con valor anterior, nuevo y motivo; lo demás en la Fase 7 |
| Inteligencia | Indicadores · Base histórica · Predicción · Asistente I+D | Actual |
| Administración | Usuarios y roles · Ensayos y métodos · Ajustes | **Fase 1** |

## Roles

| Acción | Administrador | Líder | Técnico |
|---|---|---|---|
| Configurar usuarios, ensayos, métodos y flujos | Sí | No | No |
| Fichas de personal y autorizaciones de ensayo | Sí | Sí | Solo lectura |
| Crear proyectos y planes de trabajo | Sí | Sí | No |
| Asignar y publicar actividades | Sí | Sí | No |
| Crear diseños y asignarlos | Sí | Sí | Sí |
| Registrar ensayos y roturas | Sí | Sí | Lo asignado y autorizado (Fase 3) |
| Aprobar informes / cerrar trabajos no conformes | Sí | Sí | No (solo reportar) |

Los usuarios con el rol anterior *Jefatura* pasan solos a *Líder*.

## Reglas que ya se cumplen

- **Los estados se calculan:** un diseño está *Abierto* mientras falte algo del checklist de su proyecto (estado fresco, roturas) y *Cerrado* cuando no falta nada; chips de "Falta" y semáforo.
- **Nada se borra:** los usuarios se desactivan; los ensayos y flujos se desactivan; las capacitaciones se anulan; las autorizaciones se revocan. Siempre con motivo.
- **Toda edición pide el motivo** y queda en *Calidad › Historial de cambios* con quién, cuándo, valor anterior y valor nuevo.
- **Con servidor, los permisos se verifican en el servidor** (no en el navegador), las contraseñas usan PBKDF2 y las sesiones vencen a las 12 h.

## Publicar el servidor (Cloudflare Workers + D1)

Requisitos: Node.js 18 o superior y una cuenta de Cloudflare.

1. Abrí una terminal en la carpeta `worker`:
   ```bash
   cd worker
   npx wrangler login
   ```
2. Creá la base de datos:
   ```bash
   npx wrangler d1 create erp-laboratorio-id
   ```
3. Copiá el `database_id` que muestra el comando y pegalo en `worker/wrangler.toml`, en lugar de `REEMPLAZAR_CON_EL_ID_QUE_DA_WRANGLER`.
4. Ejecutá el esquema y los datos iniciales:
   ```bash
   npx wrangler d1 execute erp-laboratorio-id --remote --file=schema.sql
   npx wrangler d1 execute erp-laboratorio-id --remote --file=seed.sql
   ```
5. Publicá el Worker:
   ```bash
   npx wrangler deploy
   ```
   Copiá la URL que muestra (termina en `.workers.dev`).
6. En el sistema, ingresá como administrador → **Ajustes › Servidor** → pegá la URL → **Probar y conectar**.
7. Como el servidor está vacío, el sistema pide crear el primer administrador: escribí tu correo y una contraseña nueva (mínimo 8 caracteres) → **Crear administrador y conectar**.
8. Volvé a ingresar con esa contraseña. Desde **Usuarios y roles** creá a los demás usuarios.

Si el sitio se publica en otro dominio, agregalo en `ORIGENES_PERMITIDOS` de `wrangler.toml` (separado por comas) y repetí el paso 5.

## Estructura

```
index.html                      Maquetación: menú lateral, secciones y ventanas
css/                            Estilos (erp.css: secciones del ERP)
js/core/
  utils.js                      Almacenamiento, formato, fechas, ventanas, exportación
  nube.js                       Conexión con el Worker, sesión y cola de reintentos
  auth.js                       Usuarios, roles (Administrador, Líder, Técnico) y permisos
  historial.js                  Historial de cambios (antes, después, motivo) y ventana de motivo
  laboratorio.js                Ensayos, flujos, tolerancias, poza, personal y autorizaciones
  shell.js, icons.js, analitica.js, ml.js
js/modules/
  navegacion.js                 Menú del prompt maestro, Planificación y atajos de teclado
  proyecto-ficha.js             Ficha del proyecto y estados calculados (Abierto/Cerrado, Falta, semáforo)
  proyectos-panel.js            Lista de proyectos, radar de etapas y pestañas del proyecto
  proyecto-asistente.js         Asistente de Nuevo proyecto (4 pasos)
  personal.js                   Recursos › Personal
  ensayos-metodos.js            Administración › Ensayos y métodos
  usuarios.js, historial-panel.js, ajustes.js
  proyectos, disenos/*, roturas, reporte-rr, calendario, dashboard, prediccion, asistente…
worker/
  src/index.js                  API (Cloudflare Workers)
  schema.sql                    Esquema D1 de todas las fases
  seed.sql                      Ensayos, flujos, tolerancias NTP 339.034, poza 23 ± 2 °C, permisos
  wrangler.toml                 Configuración del Worker
```

## Ejecutar en local

```bash
npm start          # http://localhost:8080
npm run check      # revisa la sintaxis de todos los scripts
```

Cada `push` a `main` publica el sitio en GitHub Pages.

## Otros

- **Predicción:** el error del panel *Modelo y precisión* se mide prediciendo cada diseño con un modelo que no lo vio.
- **Agente con IA:** se configura en *Ajustes → Asistente con IA* con una clave de la API de Anthropic. La clave queda en ese navegador; pasará al servidor en la Fase 7.

# Sistema I+D · Laboratorio I+D (I+D Nexus)

Sistema de gestión del Laboratorio I+D (DINO Trujillo, DINO Pacasmayo y Cementos Pacasmayo). El **proyecto es el eje**: todo diseño, ensayo, consumo, costo y reporte cuelga de un proyecto. Implementa el documento *Requerimientos funcionales — Sistema de Gestión de Laboratorio I+D* (códigos RF-…).

**Sitio publicado:** https://fiorela934985.github.io/Sistema-I-D/

## La secuencia del proceso

El menú, la pantalla de Inicio y el expediente de cada proyecto muestran la misma barra de pasos, con cuántas cosas hay en cada uno y qué está vencido:

| Paso | Sección | Qué pasa | Cómo avanza |
|---|---|---|---|
| 1 | **Proyectos** | Ficha (5.1), plan de trabajo con Gantt, iteraciones, bitácora, documentos (Drive), costos, equipo, reportes | *Planificado* → *En curso* solo, con el primer diseño. Jefatura pausa, completa o cancela (con motivo). |
| 2 | **Diseños** | Calculadora D-CC-F-148, validaciones numéricas, versiones de receta, réplicas R1…R5 | Al registrar, nacen las réplicas **Por elaborar**. |
| 3 | **Elaboración y desmolde** | Programar (técnico + fecha), cuaderno digital D-CC-F-214, etiquetas QR, desmolde 16–32 h, hoja de trabajo | Al guardar el cuaderno: roturas con código ID, etiquetas y egreso de inventario. Réplica: *Programada → Elaborada → Desmoldada*. |
| 4 | **Roturas** | Roturas de hoy con ventana horaria, escaneo de probeta, prensa calibrada, cargas kN/kg, dispersión, no ubicada, formato I+D | Con la última edad, la réplica queda **Completa** y se avisa al analista. |
| 5 | **Revisión** | Bandeja, invalidar con motivo (queda tachado), promedio por nombre unificado, completar, validar (firma JEF) | El diseño pasa a **Completado** y sus resultados se bloquean. |
| 6 | **Reporte RR** | Se arma con los promediados, sin volver a digitar; código RR-NNNNNN | Borrador → **Emitido** → firmas del analista y de Jefatura; correcciones como Rev. 1, 2… |
| 7 | **Archivador** | Diseños completados por proyecto | — |

Recursos que alimentan el proceso: **Inventario y equipos** (productos, lotes FIFO, egresos con proyecto, prensas con calibración vigente, muestras, envíos), **Materiales del diseño** y **Normas y tipos de ensayo** (tolerancias por edad que heredan las roturas).

## Roles (sección 3)

Lo que cada persona ve depende de su **rol**, su **laboratorio** y su **equipo**. Lo que el rol no permite no se muestra (ni menú ni botón). La matriz vive en [shared/permisos.js](shared/permisos.js), un único archivo que sirve tanto al navegador como al futuro servidor.

| Rol | Puestos típicos | Inicio |
|---|---|---|
| ADM Administrador | Sistemas | Usuarios, historial, respaldos, catálogos |
| JEF Jefatura I+D | Subgerente, coordinador, jefe de SSCC | Panel de proyectos, diseños por validar, RR por firmar |
| ANA Analista / Investigador | Analista de I+D | Mis proyectos, diseños por revisar, réplicas por programar |
| TEC Técnico de laboratorio | Técnico de calidad, practicante | Elaborar hoy, Romper hoy, Escanear QR (botones grandes, celular) |
| INV Responsable de inventario | Almacén, encargado de laboratorio o calibración | Stock bajo, lotes por vencer, calibraciones, envíos |
| CON Consulta | Gerencia, calidad, comercial | Proyectos con su reporte (incluye comparativo de costos) y panel, solo lectura |

Un proyecto lo **lidera un equipo** y otros equipos pueden **apoyarlo**. El RR lo firman **el analista y Jefatura**.

**Primer ingreso en un navegador nuevo:** usuario `FSANTOS`, contraseña temporal `Cambiar2026`; el sistema obliga a cambiarla. Las cuentas que ya existían conservan su contraseña.

## Estructura

```
index.html                      Maquetación: menú por pasos, paneles y modales
shared/permisos.js              Roles, matriz de permisos y rol sugerido por puesto (navegador y servidor)
css/                            Tema celeste + verde (claro/oscuro); css/proceso.css: pasos, elaboración, revisión, avisos
js/core/
  utils.js                      Almacenamiento, formato, fechas, diálogos, motivo obligatorio, números y fracciones
  auth.js                       Usuarios, sesión (8 h / 60 min), bloqueo por intentos, permisos y alcance
  catalogos-sistema.js          Catálogos (RF-CAT) y umbrales del sistema (RF-AJU)
  flujo.js                      La secuencia: etapas, estado de cada réplica, barra de pasos
  historial.js, analitica.js, ml.js, shell.js, icons.js
js/modules/
  proyectos.js, proyectos-panel.js, reporte-proyecto.js     Paso 1
  disenos/*                                                  Paso 2
  elaboracion.js, etiquetas.js                               Paso 3
  roturas.js, calendario.js                                  Paso 4
  revision.js                                                Paso 5
  reporte-rr.js                                              Paso 6
  archivador.js                                              Paso 7
  inventario.js, componentes.js, normas.js                   Recursos
  notificaciones.js                                          Campana única y "Requiere atención"
  usuarios.js, ajustes.js, historial-panel.js, dashboard.js, base-historica.js, prediccion.js, asistente.js, agente.js
js/data/seed.js                 Diseños reales (los de demostración ya no se siembran)
```

## Ejecutar en local

```bash
npm start          # http://localhost:8080
npm run check      # revisa la sintaxis de todos los scripts
```

## Despliegue

Cada `push` a `main` publica el sitio en GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Importante

- **Prensa obligatoria para romper:** una rotura solo se registra con una prensa *Habilitada* y con *calibración vigente* (Inventario y equipos → Equipos). Registrá las prensas y su última calibración antes de empezar.
- **Datos por navegador (por ahora):** hasta conectar el servidor (Cloudflare Workers + D1, sección 15), cada navegador guarda su propia copia. Descargá respaldos desde *Base histórica*. Los archivos (documentos, FT, certificados) se guardan en Google Drive y en el sistema queda el enlace.
- **Predicción:** el error del panel *Modelo y precisión* se mide prediciendo cada diseño con un modelo que no lo vio.
- **Agente con IA:** se configura en *Ajustes → Asistente con IA* con una clave de la API de Anthropic.

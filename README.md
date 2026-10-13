# Sistema I+D · Laboratorio I+D

Aplicación web para la gestión de calidad del Laboratorio I+D: diseños de mezcla, registro de roturas (NTP 339.034), resultados de ensayo, informes con gráficas, Reporte RR, archivador y dashboard.

Es una aplicación **100 % estática** (HTML + CSS + JavaScript, sin servidor): los datos se guardan en el navegador (`localStorage` e `IndexedDB` para evidencias).

## Estructura

```
index.html              Maquetación (login, vistas y modales)
css/styles.css          Estilos y temas (claro/oscuro)
js/app.js               Lógica de la aplicación
js/pwa.js               Registro del service worker
data/disenos-reales.js  Diseños reales precargados (se siembran una sola vez)
assets/favicon.svg      Ícono
manifest.webmanifest    Permite instalar la app (PWA)
sw.js                   Service worker: funciona sin conexión tras la primera visita
.github/workflows/      Despliegue automático a GitHub Pages
```

Librerías externas (CDN): SheetJS (Excel), Chart.js (gráficos), jsPDF (PDF), Google Fonts.

## Ejecutar en local

Requiere Node.js:

```bash
npm start
```

Abre `http://localhost:8080`. (También funciona abriendo `index.html` directamente, pero sin modo offline.)

## Despliegue (GitHub Pages)

Cada `push` a `main` publica el sitio automáticamente mediante GitHub Actions.

Configuración única en GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

URL publicada: `https://fiorela934985.github.io/Sistema-I-D/`

## Notas importantes

- **Los datos son locales a cada navegador.** Cada usuario/equipo tiene su propia información; borrar los datos del navegador la elimina. Use las exportaciones (Excel/PDF) como respaldo.
- **El login es solo una barrera visual**: el usuario y la contraseña están en `js/app.js`, por lo que cualquiera que vea el código puede leerlos. No guarde información confidencial sin agregar un backend con autenticación real.

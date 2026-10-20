// Configuración de Croni.
// 1) Crea un "ID de cliente de OAuth" (tipo Aplicación web) en https://console.cloud.google.com/apis/credentials
// 2) Habilita "Google Drive API" en el mismo proyecto.
// 3) En "Orígenes autorizados de JavaScript" agrega la URL donde publiques la app (y http://localhost:8080 para pruebas).
// Este ID de cliente es público por diseño (no es un secreto); no pegues aquí ninguna "clave secreta".
window.CRONI_CONFIG = {
  GOOGLE_CLIENT_ID: '718977239583-r159p1gi6r9btilq0a77jgvambi6fgdq.apps.googleusercontent.com', // ej: 123456-abc.apps.googleusercontent.com
  DRIVE_FOLDER: 'Croni',
  DATA_FILE: 'croni-datos.json'
};

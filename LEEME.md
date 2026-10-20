# Croni

Agenda, cronograma, calendario, tablero, matriz, notas e insights por negocio. App web instalable (PWA) para desktop, tablet y celular. Sin base de datos propia: los datos viven en **tu Google Drive** (carpeta `Croni`, archivo `croni-datos.json`).

## Probar en local
```bash
cd /Users/maria/Documents/Proyectos/croni && python3 -m http.server 8080
```
Abre http://localhost:8080 y usa "Probar sin conectar".

## Conectar con tu Drive (una sola vez)
1. Entra a https://console.cloud.google.com y crea un proyecto.
2. "APIs y servicios" → habilita **Google Drive API**.
3. "Pantalla de consentimiento OAuth": tipo Externo, agrega tu Gmail como usuario de prueba.
4. "Credenciales" → Crear → **ID de cliente de OAuth** → Aplicación web. En "Orígenes autorizados de JavaScript" agrega `http://localhost:8080` y la URL donde publiques la app.
5. Copia el ID de cliente en `config.js` (`GOOGLE_CLIENT_ID`). No es un secreto; nunca pegues una "clave secreta".

La app pide solo el permiso `drive.file`: únicamente ve el archivo que ella misma crea.

## Qué hace
- Vistas: Hoy, Cronograma, Calendario (día/semana/mes), Tablero, Matriz, Notas, Insights, Compartir.
- Avisos previos (10 min / 1 h / 1 día), "en riesgo" / "vencida", posponer, repetición, subtareas, conflictos de horario, resumen diario/semanal, búsqueda y filtro por negocio.
- Sin conexión: guarda local y sincroniza al volver. Si otra persona editó, avisa y pide elegir (no pisa nada solo).
- Compartir: da permiso en Drive (editor / solo lectura) tras confirmación. La bitácora registra quién hizo qué.
- Exportar: respaldo JSON y CSV.

## Pendiente / fase 2
- Notificaciones push con la app cerrada requieren un servicio mínimo de mensajería; hoy los avisos funcionan con la app abierta o instalada.
- Correo Gmail, Google Calendar y WhatsApp.
- Rol administrador y plantillas por negocio.

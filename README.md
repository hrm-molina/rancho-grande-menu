# Menú QR — Rancho Grande

Página web de menú diario con código QR para **Rancho Grande — Comida Casera con Sabor de Campo**.

## Cómo iniciar en local

```bash
npm install
npm start
```

- **Página del cliente (al escanear el QR):** `http://localhost:3000/`
- **Panel de administración diario:** `http://localhost:3000/admin` *(PIN por defecto: `1975`, configurable con `ADMIN_PIN` o desde el panel)*

## Publicar en Vercel (desde GitHub)

1. Sube este repositorio a GitHub.
2. En **Vercel**, haz clic en **Add New → Project** e importa tu repositorio de GitHub.
3. En el proyecto de Vercel, ve a **Storage → Create Database → Blob** y conéctalo al proyecto *(esto crea automáticamente la variable de entorno `BLOB_READ_WRITE_TOKEN` para guardar de forma permanente las fotos del menú diario y la configuración).*
4. Opcional: agrega la variable de entorno `ADMIN_PIN` si quieres definir tu propio PIN inicial.
5. Haz **Redeploy** (si conectaste Blob después del primer deploy) y listo: desde `/admin` podrás subir la foto de cada día y descargar/imprimir el código QR apuntando a tu dominio de Vercel.

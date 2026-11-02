# Synth Glitch

Aplicación móvil hecha con Expo y React Native para capturar fotos y manipularlas como un instrumento visual mediante gestos táctiles y efectos glitch.

## Estado del proyecto

Las fases 0 a 5.1 están implementadas. La fase 6 añade grabación de clips mudos de hasta 5 segundos, reproducción en bucle con efectos y guardado del fotograma actual como JPG; queda pendiente la validación en un iPhone físico. El editor permite combinar capas de aberración cromática, scanlines CRT y datamosh; la pila admite hasta 12 capas por seguridad técnica y mantiene 50 cambios para deshacer o rehacer. No se conserva historial de creaciones dentro de la app.

## Desarrollo

Instala las dependencias y arranca Expo:

```bash
npm install
npm run start
```

Para revisar el código:

```bash
npm run lint
npx tsc --noEmit
```

# SynthVJ

App para iPhone y iPad hecha con Expo y React Native: capturas una foto o un clip y lo tocas como un instrumento visual. Pintas con sellos de glitch, apilas efectos y generadores, los mueves con el dedo, con moduladores o con el micrófono, y exportas a JPG o GIF o los proyectas en modo escenario.

Todo corre en **Expo Go (SDK 58)**, sin código nativo propio.

## Qué hace

- **Captura:** foto con un toque, clip de 1 a 5 s manteniendo el obturador, formatos 9:16, 1:1 y 4:5. También importa de Fotos (videos de hasta 10 s) o crea un proyecto **sin imagen** a partir de un generador.
- **Pincel de sellos:** Datamosh, Chromatic, Pixel, Smear y Borrar, con deshacer por trazo.
- **Efectos globales apilables:** Chromatic, Scanlines, Datamosh, VHS, Pixel, Wave y CRT, con parámetros con nombre y ajuste X/Y arrastrando sobre la imagen.
- **Generadores:** Noise, Barras y Voronoi, como capas con modo de mezcla (screen, multiply, difference, replace) y semilla propia.
- **Modulación:** LFO, ADSR, sample & hold, secuenciador, tempo con tap y **micrófono** (con calibración y golpes que disparan el ADSR).
- **Clips con efectos:** el video se reproduce en bucle con toda la pila de capas.
- **Exportar:** JPG a resolución original (hasta 4096 px), GIF animado de 480 px con progreso y cancelación, y compartir.
- **Recetas `.synthfx`:** comparte o importa la receta de una escena (capas, modulación y semilla, sin la pintura).
- **Modo escenario:** pantalla completa con brillo al máximo, modo bloqueado o interactivo, blackout con dos dedos, resolución dinámica y salida manteniendo la esquina 2 s.
- **Proyectos:** guardado manual con escritura atómica; al salir con cambios, la app pregunta si guardar. Galería para abrir, renombrar, duplicar y eliminar.
- **iPad:** todas las orientaciones, riel de herramientas a la izquierda y panel lateral. **Accesibilidad:** VoiceOver, objetivos de 44 pt y Reducir movimiento.

Pendiente: GIRO (orientación del teléfono), pista gestual, presets de escena, MUTAR y ALEATORIZAR (hito M7).

## Requisitos

- Node.js y npm.
- La app **Expo Go** en un iPhone o iPad con la versión compatible con SDK 58.

## Cómo correrla

```bash
npm install
npx expo start
```

Escanea el código QR con la cámara del iPhone para abrirla en Expo Go. Para instalar paquetes usa siempre `npx expo install <paquete>`, que elige la versión compatible con el SDK.

## Revisar el código

```bash
npx expo lint      # lint
npx tsc --noEmit   # tipos
npm test           # pruebas (Jest)
```

Las pruebas cubren la lógica pura (modulación, render graph, esquema y migraciones, `.synthfx`, deshacer, pincel) y compilan cada shader SkSL con CanvasKit.

## Herramientas de desarrollo

En modo desarrollo (o con `EXPO_PUBLIC_DEV_TOOLS=1 npx expo start --no-dev --minify` para medir rendimiento), la app muestra un HUD de rendimiento y la pantalla **testLab**, con los spikes del SDD (uniforms, API de Skia, pincel, video, micrófono), el banco de capas, los efectos y generadores, y las pruebas de resistencia de 50 ciclos y de 30 min en escenario.

## Estructura

```
src/app/         rutas de Expo Router: Cámara, Editor, Galería
src/ui/          pantallas, paneles y componentes (no conoce Skia)
src/editor/      lienzo, render de la escena, modo escenario
src/engine/      render graph, shaders SkSL, registro de efectos (puro)
src/modulation/  fuentes, rutas, envolvente del micrófono (puro)
src/paint/       motor del pincel de sellos
src/project/     esquema, migraciones, almacenamiento, .synthfx
src/state/       store de la escena, deshacer, casos de uso
src/platform/    adaptadores de Expo: cámara, audio, fotos, pantalla
src/dev/         HUD y testLab (solo desarrollo)
```

Las decisiones de arquitectura están en [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Ramas

- **`main`:** versión estable.
- **`dev`:** desarrollo. Los cambios nuevos se hacen en ramas que salen de `dev` y vuelven a `dev`; `dev` pasa a `main` cuando está probado en el iPhone.

## Licencia

Ver [`LICENSE`](LICENSE).

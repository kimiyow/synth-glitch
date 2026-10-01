# SDD: SynthVJ

**Software Design Document, versión 0.2** Basado en el *Documento de proyecto (versión corregida)*. Plataforma: iPhone físico, Expo Go (Expo SDK 57), sin Mac ni cuenta de desarrollador.

**Cambios respecto a la v0.1:** decisión D6 (SDK 57), método de medición de FPS (RNF-01), prueba de humo en la fase 0, riesgos de entorno (9.1) y tabla de versiones por completar (sección 12).

## 1. Propósito y alcance

Este documento define **qué** debe hacer la app, **cómo** está estructurada y **cómo se verifica** cada requisito. Cubre los Niveles 1 y 2 del proyecto (foto y clip con efecto en tiempo real controlado por un dedo). Todo lo listado en "Fuera de alcance" del documento de proyecto queda excluido.

### 1.1 Decisiones que refinan el documento de proyecto

| # | Decisión | Motivo |
| --- | --- | --- |
| D1 | Para aplicar el shader sobre el clip se usa **`useVideo` de Skia**. `expo-video` solo se usa para reproducir el clip original sin efecto en el historial. | `expo-video` no entrega cuadros como textura a Skia, así que no puede alimentar el shader. |
| D2 | Un **único contrato de uniforms** para los tres shaders (sección 6). | El selector de efecto solo intercambia el código SkSL; el gesto y el render no cambian. |
| D3 | Los parámetros del dedo se guardan como valores normalizados 0-1 y **cada shader los interpreta**. | Evita lógica de mapeo en JS y garantiza que preview y exportación se vean igual. |
| D4 | Solo cámara trasera. | La cámara frontal añade espejo y orientación sin aportar al objetivo. |
| D5 | Un dedo, un par (x, y) compartido. Al cambiar de efecto, se restablecen los valores por defecto de ese efecto. | Comportamiento predecible y sin estado oculto por efecto. |
| D6 | El proyecto usa **Expo SDK 57** (React Native 0.86), con `expo@^57.0.17` como versión mínima. | Es el SDK que soporta Expo Go en el iPhone. Las versiones anteriores a 57.0.17 tenían regresiones de memoria (Hermes V1 con Reanimated/Worklets) y de arranque en desarrollo. |

## 2. Requisitos funcionales

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-01 | La app solicita permisos de cámara y de galería (solo escritura). Si se deniegan, muestra una pantalla explicativa con acceso a Ajustes. | Obligatorio |
| RF-02 | La pantalla principal muestra la vista previa de la cámara trasera, un botón de captura de foto y un modo de grabación de clip. | Obligatorio |
| RF-03 | La grabación de clip dura máximo 5 s y se detiene sola. Duración mínima 1 s. | Obligatorio |
| RF-04 | Tras capturar, la app abre el editor con el medio capturado. Desde el editor se puede descartar y volver a la cámara. | Obligatorio |
| RF-05 | El editor ofrece tres efectos (aberración cromática, scanlines CRT, datamosh), seleccionables con un tap. | Obligatorio |
| RF-06 | Un gesto de un dedo sobre la imagen modifica (x, y) del efecto activo y la imagen se actualiza de forma continua. | Obligatorio |
| RF-07 | Al soltar, los valores se conservan. Un doble tap los restablece a los valores por defecto del efecto. | Obligatorio |
| RF-08 | La barra de herramientas se atenúa mientras el dedo está sobre la imagen y reaparece al soltar. Se muestra una retícula discreta que se oculta tras 1.5 s sin tocar. | Obligatorio |
| RF-09 | Los clips se reproducen en bucle con el efecto aplicado en vivo, controlados con el mismo gesto. | Obligatorio |
| RF-10 | "Guardar" en una foto exporta la imagen con efecto a la resolución original (lado largo máximo 4096 px), la guarda en la galería y la añade al historial. | Obligatorio |
| RF-11 | "Guardar" en un clip exporta el **cuadro actual** con efecto como imagen (misma regla de RF-10) y conserva el clip original sin procesar en el historial. | Obligatorio |
| RF-12 | El historial lista las últimas 30 creaciones (más reciente primero) con miniatura. Al abrir una, muestra la imagen y, si procede, permite ver el clip original. Permite eliminar una creación. | Obligatorio |
| RF-13 | El historial persiste entre cierres de la app. | Obligatorio |

## 3. Requisitos no funcionales

| ID | Requisito | Medición |
| --- | --- | --- |
| RNF-01 | Durante el arrastre, el hilo de UI mantiene ≥ 55 FPS en cada efecto, con preview de 2048 px (lado largo). | Perf Monitor de Expo Go, 10 s de arrastre continuo, promedio de UI FPS. Se mide con `npx expo start --no-dev --minify`, no en modo desarrollo |
| RNF-02 | El hilo de JS no participa en el ciclo gesto → render. | Perf Monitor: JS FPS no se degrada durante el arrastre; revisión de código (sin `useState`/`setState` en callbacks del gesto) |
| RNF-03 | La exportación a resolución completa tarda ≤ 5 s en una foto de 12 MP. | Cronómetro en iPhone de prueba |
| RNF-04 | La imagen exportada es visualmente equivalente al preview con los mismos (x, y). | Comparación manual con 3 valores de control por efecto |
| RNF-05 | Sin cierres inesperados en el flujo captura → editar → guardar repetido 20 veces. | Prueba manual |
| RNF-06 | Todo funciona en Expo Go (SDK 57) sobre iPhone físico, sin código nativo propio. | Verificación en fase 0 y en cada entrega |

## 4. Arquitectura

### 4.1 Vista general

```
expo-camera ──► archivo (foto/clip) ──► Editor
                                          │
   Gesture.Pan (UI thread) ─► SharedValue x,y ─► DerivedValue ─► Uniforms
                                          │                         │
                                          ▼                         ▼
                                  Skia <Canvas> ◄──── <Shader source=SkSL> ◄─ ImageShader (foto | useVideo)
                                          │
                       drawAsImage (offscreen) ─► archivo ─► MediaLibrary + History
```

### 4.2 Estructura de carpetas

```
app/
  _layout.tsx            # Stack, gesture root, permisos
  index.tsx              # Cámara
  editor.tsx             # Editor (recibe uri, tipo, ancho, alto)
  history/index.tsx      # Lista
  history/[id].tsx       # Detalle
src/
  effects/
    chromatic.sksl.ts    # Cada shader exporta su string SkSL
    scanlines.sksl.ts
    datamosh.sksl.ts
    registry.ts          # { id, nombre, source (RuntimeEffect), defaults }
  editor/
    useControlSurface.ts # shared values + gestos
    EffectCanvas.tsx     # Canvas + Shader + retícula
    Toolbar.tsx
    exportImage.ts       # drawAsImage + guardado
  history/
    historyRepo.ts       # CRUD sobre index.json
    types.ts
  state/
    editorStore.ts       # Zustand
  media/
    prepareMedia.ts      # reducción a 2048 px para preview
```

### 4.3 Responsabilidades

| Módulo | Responsabilidad | No debe hacer |
| --- | --- | --- |
| `useControlSurface` | Crear `x`, `y`, `touching`, `reticleOpacity` (shared values) y los gestos Pan + doble Tap | Escribir en estado de React |
| `EffectCanvas` | Dibujar el medio con el shader activo y la retícula dentro del mismo Canvas | Conocer cómo se guarda |
| `registry` | Compilar los tres `RuntimeEffect` una sola vez al cargar el módulo | Compilar en cada render |
| `exportImage` | Renderizar offscreen a resolución completa con los valores actuales (`x.value`, `y.value`) | Usar el Canvas visible |
| `historyRepo` | Leer/escribir `index.json` y los archivos asociados | Acceder a la galería |
| `editorStore` | Guardar efecto seleccionado y medio actual | Guardar x, y |

### 4.4 Gesto y render (regla central)

- `Gesture.Pan().minDistance(0)`: se activa al tocar. En `onBegin`/`onUpdate` (worklet): `x.value = clamp(e.x / ancho, 0, 1)`, `y.value = clamp(1 - e.y / alto, 0, 1)` (arriba = más).
- `Gesture.Tap().numberOfTaps(2)`: en `onEnd`, restablece `x`, `y` a los valores por defecto del efecto activo.
- Ambos se combinan con `Gesture.Simultaneous`. El reset ocurre al levantar el segundo tap, es decir, después del `onBegin` del Pan. Se verifica en la fase 3.
- `uniforms = useDerivedValue(() => ({ resolution, param: [x.value, y.value], time: clock.value / 1000 }))`.
- `touching` anima la opacidad de la barra y de la retícula con `withTiming` (en el hilo de UI).

### 4.5 Pipeline de medios

1. **Foto:** `takePictureAsync` → archivo original. `prepareMedia` genera una copia de preview con lado largo ≤ 2048 px (`expo-image-manipulator`). Se conserva la ruta original para exportar.
2. **Clip:** `recordAsync({ maxDuration: 5 })` → `.mp4`. En el editor se abre con `useVideo(uri, { looping: true })`; `currentFrame` alimenta el `ImageShader`.
3. **Exportación:** `drawAsImage(<mismo árbol Group + Shader>, { width, height })` con el tamaño final (lado largo ≤ 4096), `encodeToBytes(JPEG, 95)`, escritura en `documentDirectory/creations/`, `MediaLibrary.saveToLibraryAsync`.
4. **Cuadro de clip:** el `SkImage` de `currentFrame` en el instante de pulsar Guardar se usa como fuente del `ImageShader` offscreen.

> Los nombres de API de Skia usados en este documento (`drawAsImage`, `useVideo`, `makeImageSnapshot`, `encodeToBytes`) deben confirmarse contra la versión instalada en la prueba de humo de la fase 0.

> El audio no se usa. El clip se graba con `mute` activo; si Expo Go exige el permiso de micrófono para grabar video, se solicita y queda documentado.

## 5. Navegación

| Pantalla | Ruta | Entradas | Salidas |
| --- | --- | --- | --- |
| Cámara | `/` |  | Editor (tras capturar), Historial |
| Editor | `/editor` | `uri`, `type` (`photo`\|`clip`), `width`, `height` | Cámara (descartar o tras guardar), Historial |
| Historial | `/history` |  | Detalle |
| Detalle | `/history/[id]` | `id` | Historial (tras eliminar) |

## 6. Contrato de shaders

### 6.1 Uniformes comunes (los tres efectos)

| Uniform | Tipo | Significado |
| --- | --- | --- |
| `image` | `shader` | Medio de entrada (`ImageShader`, tile mode *clamp*) |
| `resolution` | `float2` | Tamaño en píxeles del área dibujada (preview o salida) |
| `param` | `float2` | (x, y) normalizados 0-1 del dedo |
| `time` | `float` | Segundos desde el inicio; solo lo usa Scanlines |

Reglas: todo desplazamiento se expresa como fracción de `resolution`; el ruido se calcula sobre coordenadas normalizadas. Así el preview y la exportación se ven igual (RNF-04).

### 6.2 Efectos

| Efecto (`id`) | `param.x` | `param.y` | Valor por defecto (x, y) |
| --- | --- | --- | --- |
| `chromatic` | Desplazamiento = `x · 3 %` del ancho | Ángulo = `y · 360°` | (0.30, 0.00) |
| `scanlines` | Líneas por pantalla = `mix(80, 400, x)` | Ruido = `y · 0.35` | (0.40, 0.20) |
| `datamosh` | Alto de franja = `mix(1 %, 15 %, x)` del alto | Desplazamiento máx. = `y · 25 %` del ancho | (0.30, 0.30) |

### 6.3 SkSL de referencia (orientativo, se valida en la fase 2)

```glsl
// chromatic
uniform shader image; uniform float2 resolution; uniform float2 param;
half4 main(float2 xy) {
  float a = param.y * 6.2831853;
  float2 d = float2(cos(a), sin(a)) * (param.x * 0.03 * resolution.x);
  half4 c = image.eval(xy);
  return half4(image.eval(xy + d).r, c.g, image.eval(xy - d).b, c.a);
}

// scanlines
uniform shader image; uniform float2 resolution; uniform float2 param; uniform float time;
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  half4 c = image.eval(xy);
  float s = 0.5 + 0.5 * sin(uv.y * mix(80.0, 400.0, param.x) * 6.2831853);
  float n = hash(floor(uv * 720.0) + floor(time * 30.0)) - 0.5;
  half3 rgb = c.rgb * half(mix(1.0, 0.55, s)) + half(n * param.y * 0.35);
  return half4(saturate(rgb), c.a);
}

// datamosh
uniform shader image; uniform float2 resolution; uniform float2 param;
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float h = mix(0.01, 0.15, param.x) * resolution.y;
  float strip = floor(xy.y / h);
  float off = (hash(float2(strip, 1.0)) - 0.5) * 2.0 * param.y * 0.25 * resolution.x;
  return image.eval(float2(xy.x + off, xy.y));
}
```

## 7. Modelo de datos del historial

Archivos en `documentDirectory/creations/` e índice `index.json`:

```ts
type Creation = {
  id: string;                 // uuid
  kind: 'photo' | 'clip-frame';
  effect: 'chromatic' | 'scanlines' | 'datamosh';
  params: { x: number; y: number };
  createdAt: string;          // ISO 8601
  width: number; height: number;
  imageFile: string;          // JPEG con efecto (nombre de archivo)
  thumbFile: string;          // miniatura (lado largo 400 px)
  clipFile?: string;          // solo clip-frame: .mp4 original sin efecto
};
type HistoryIndex = { version: 1; items: Creation[] }; // más reciente primero, máx. 30
```

Reglas: al superar 30 elementos se eliminan el más antiguo y sus archivos. Escritura del índice **después** de escribir los archivos. Si el índice está corrupto o ausente, se recrea vacío. Si un archivo referenciado no existe, el elemento se omite en la lista.

## 8. Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| Permiso de cámara denegado | Pantalla explicativa + botón a Ajustes (RF-01) |
| Permiso de galería denegado al guardar | Se guarda en el historial interno y se avisa que no se pudo guardar en la galería |
| Falla `takePictureAsync` / `recordAsync` | Mensaje breve y la cámara sigue activa |
| El shader no compila | El editor muestra el medio sin efecto y un aviso; error registrado en consola |
| El clip no se decodifica | Se vuelve a la cámara con aviso |
| Falla la exportación o el almacenamiento está lleno | Aviso con opción de reintentar; no se crea entrada en el historial |

## 9. Estrategia de pruebas

- **Manual en iPhone** (principal): lista de verificación por fase, ejecutada en el dispositivo físico.
- **Rendimiento:** protocolo de RNF-01 por cada efecto y con foto y con clip; se registran resultados en una tabla del repositorio.
- **Unitarias (Jest, `jest-expo`)** solo para lógica pura: `historyRepo` (límite de 30, índice corrupto, orden) y funciones de mapeo/clamp.
- **Prueba de humo (fase 0):** un `Canvas` de Skia dibuja en el iPhone vía Expo Go, y las funciones `drawAsImage`, `useVideo` y `encodeToBytes` existen en la versión instalada. Si algo falla, se resuelve antes de la fase 1.
- **Spikes de validación** (resultado documentado antes de continuar):
  - **S1 (fase 2):** `Shader` con uniforms desde shared values a ≥ 55 FPS en Expo Go; `drawAsImage` a 12 MP en ≤ 5 s.
  - **S2 (fase 6):** `useVideo` con shader en Expo Go. **Plan B si falla:** el clip se reproduce sin efecto y el usuario elige un cuadro (miniatura por tiempo con `expo-video-thumbnails`) sobre el que aplica el efecto como foto.

### 9.1 Riesgos de entorno

| Riesgo | Mitigación |
| --- | --- |
| Expo Go se actualiza a un SDK nuevo y el proyecto deja de abrirse (Expo Go soporta un solo SDK a la vez) | Desactivar las actualizaciones automáticas en el iPhone. Si ocurre, migrar entre fases, nunca a mitad de una |
| Regresiones de Hermes V1 con Reanimated/Worklets en versiones tempranas del SDK 57 | Usar `expo@^57.0.17` como mínimo y ejecutar `npx expo-doctor` en la fase 0 |
| Medir rendimiento en modo desarrollo da resultados pesimistas | Medir siempre con `--no-dev --minify` (RNF-01) |
| Cambios en las APIs de `expo-media-library` y `expo-file-system` entre SDK | Revisar la documentación del SDK instalado en la fase 0 y fijar una sola API |

## 10. Criterios de aceptación

| ID | Criterio | Verifica |
| --- | --- | --- |
| CA-01 | Primera apertura: se piden permisos y, concedidos, aparece la cámara. | RF-01, RF-02 |
| CA-02 | Foto capturada abre el editor con la imagen sin efecto aplicado visible (valores por defecto aplicados). | RF-04, RF-05 |
| CA-03 | Cambiar entre los 3 efectos con un tap restablece sus valores por defecto. | RF-05, D5 |
| CA-04 | Arrastrar el dedo cambia el efecto de forma fluida; promedio ≥ 55 FPS de UI en 10 s por efecto. | RF-06, RNF-01, RNF-02 |
| CA-05 | Al soltar el dedo el efecto se mantiene; doble tap lo restablece. | RF-07 |
| CA-06 | La barra se atenúa al tocar y reaparece al soltar; la retícula se oculta tras 1.5 s. | RF-08 |
| CA-07 | Un clip de 5 s se reproduce en bucle con efecto y responde al dedo. | RF-03, RF-09 |
| CA-08 | Guardar una foto la deja en la galería y en el historial con la resolución esperada (≤ 4096 px lado largo). | RF-10, RNF-03 |
| CA-09 | Guardar desde un clip deja el cuadro con efecto en la galería y el clip original accesible en el historial. | RF-11 |
| CA-10 | El historial muestra máx. 30 elementos, sobrevive a cerrar la app y permite eliminar. | RF-12, RF-13 |
| CA-11 | Preview y exportación coinciden con los mismos (x, y), en los 3 efectos. | RNF-04 |
| CA-12 | 20 ciclos captura → editar → guardar sin cierres. | RNF-05 |

## 11. Trazabilidad con las fases

| Fase | Requisitos que cierra |
| --- | --- |
| 0. Setup | RF-01, RNF-06, prueba de humo de Skia |
| 1. Captura | RF-02, RF-03 (foto), RF-04 |
| 2. Spike de shaders | S1, contrato de uniforms (sección 6.1) |
| 3. Superficie X/Y | RF-06, RF-07, RF-08, RNF-01, RNF-02 |
| 4. Efectos 2 y 3 | RF-05 |
| 5. Guardado e historial | RF-10, RF-12, RF-13, RNF-03, RNF-04 |
| 6. Video Nivel 2 | RF-03 (clip), RF-09, RF-11, S2 |
| 7. Cierre | RNF-05, CA-01 a CA-12 |

## 12. Pendientes para la versión 0.3

- Completar la tabla de versiones al instalar el proyecto (fase 0):

| Paquete | Versión instalada |
| --- | --- |
| `expo` (mínimo 57.0.17) | *por completar* |
| `react-native` | *por completar* |
| `@shopify/react-native-skia` | *por completar* |
| `react-native-reanimated` | *por completar* |
| `react-native-worklets` | *por completar* |
| `react-native-gesture-handler` | *por completar* |
| `expo-camera` | *por completar* |
| `expo-media-library` | *por completar* |
| `expo-file-system` | *por completar* |

- Confirmar qué API de `expo-media-library` y de `expo-file-system` se usa en esa versión.
- Especificar el diseño visual de la barra de herramientas y de la retícula.
- Resultados de S1 y S2 para cerrar las decisiones D1 y el contrato de exportación.
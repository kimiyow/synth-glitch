# SDD: SynthVJ

**Software Design Document, versión 0.4** Basado en el *Documento de proyecto (versión corregida)*. Plataforma: iPhone físico, Expo Go (Expo SDK 57), sin Mac ni cuenta de desarrollador.

**Cambios respecto a la v0.3:** la navegación pasa de `Stack` a **pestañas** (Cámara y Editor, D14) y se **elimina el historial** (D15): lo guardado vive solo en la galería del iPhone. Se retiran RF-12, RF-13 y CA-10, la pantalla de historial, `index.json`, las miniaturas y el clip original conservado; se añaden RF-30 y CA-24. La Fase 5 pasa a "Guardado en galería" y guarda una foto estática (JPG); el GIF se mantiene en la Fase 11.

**Cambios respecto a la v0.2:** se añade el **Nivel 3 (extensiones)**: seis efectos, encadenado A/B, LFO, grabar/repetir gesto, giroscopio, importar de galería, presets, compartir, exportar GIF y pulido visual. Afecta a las decisiones D2, D5 y D7-D13, los requisitos RF-05 a RF-07 y RF-14 a RF-29, RNF-07 a RNF-10, las secciones 4.6, 6.4, 7, 8, 9, 10, 11 y 12, y el calendario (re-planificado en 12 semanas).

## 1. Propósito y alcance

Este documento define **qué** debe hacer la app, **cómo** está estructurada y **cómo se verifica** cada requisito. Cubre los Niveles 1 y 2 (foto y clip con efecto en tiempo real controlado por un dedo) y el Nivel 3 de extensiones, que el equipo decidió tratar como **obligatorio**. Todo lo listado en "Fuera de alcance" del documento de proyecto queda excluido.

### 1.1 Decisiones que refinan el documento de proyecto

| # | Decisión | Motivo |
| --- | --- | --- |
| D1 | Para aplicar el shader sobre el clip se usa **`useVideo` de Skia**. `expo-video` no se usa en el proyecto (sin historial no hay que reproducir el clip original). | `expo-video` no entrega cuadros como textura a Skia, así que no puede alimentar el shader. |
| D2 | Un **único contrato de uniforms** para todos los shaders (sección 6). | El selector de efecto solo intercambia el código SkSL; el gesto y el render no cambian. |
| D3 | Los parámetros del dedo se guardan como valores normalizados 0-1 y **cada shader los interpreta**. | Evita lógica de mapeo en JS y garantiza que preview y exportación se vean igual. |
| D4 | Solo cámara trasera. | La cámara frontal añade espejo y orientación sin aportar al objetivo. |
| D5 | Un dedo. Cada slot (A y B) tiene su propio par (x, y) y el dedo controla solo el **slot activo**. Al cambiar el efecto de un slot, se restablecen los valores por defecto de ese efecto. | Comportamiento predecible y sin estado oculto por efecto. (Sustituye la versión con un único par compartido.) |
| D6 | El proyecto usa **Expo SDK 57** (React Native 0.86), con `expo@^57.0.17` como versión mínima. | Es el SDK que soporta Expo Go en el iPhone. Las versiones anteriores a 57.0.17 tenían regresiones de memoria (Hermes V1 con Reanimated/Worklets) y de arranque en desarrollo. |
| D7 | **Encadenado A→B** con shaders anidados de Skia: la salida del slot A es la entrada del slot B. El slot B es opcional. | Reutiliza el contrato único de uniforms; no requiere pasadas de render intermedias. |
| D8 | Un **selector A/B** (fuera de la imagen) decide qué slot controla el dedo. | Mantiene el control de un solo dedo con dos efectos. |
| D9 | El **giroscopio reemplaza el eje Y** del slot activo: la inclinación adelante/atrás controla Y y el dedo solo X. Se usa `useAnimatedSensor` de Reanimated como opción principal y `expo-sensors` (`DeviceMotion`) como plan B, a validar en el spike S4. | `useAnimatedSensor` lee el sensor en el hilo de UI, coherente con RNF-02. |
| D10 | **Valor efectivo = clamp(base + LFO)**, calculado en el hilo de UI. La *base* proviene del dedo, del giroscopio o de la pista grabada. Una **función pura única** `computeParams(config, t)` se usa tanto en el preview como en la exportación de GIF. | Garantiza que preview, pista grabada y GIF produzcan el mismo resultado. |
| D11 | La superficie de la imagen sigue sin controles. Los ajustes secundarios (LFO, presets, importar) viven en **paneles inferiores** que se abren y cierran fuera del área de gesto. | Permite sliders y listas sin romper el paradigma "la imagen es el controlador". |
| D12 | El **GIF solo se genera desde fotos** (no desde clips): 480 px de lado largo, 12 fps, máx. 4 s, codificado con `gifenc` (JavaScript puro) con progreso y cancelación. | Acota el costo de CPU en el hilo de JS. |
| D13 | El **ícono y el splash** del sistema no se ven en Expo Go (se muestran los de Expo Go). Se configuran en `app.json` y se entregan como assets, y la app incluye una pantalla de bienvenida animada propia. | Sin Mac ni cuenta de desarrollador no hay build propio donde verlos. |
| D14 | La navegación usa **pestañas** (`Tabs` de expo-router): Cámara y Editor. No hay parámetros de ruta: el medio activo vive en `editorStore`. | Reemplaza el `Stack`. El editor depende de un medio activo y no de una pila de pantallas. |
| D15 | **Se elimina el historial.** Todo lo guardado vive solo en la galería del iPhone; los archivos de exportación son temporales. | Simplifica el modelo de datos (sin índice, miniaturas ni sincronización de archivos). |

## 2. Requisitos funcionales

| ID | Requisito | Prioridad |
| --- | --- | --- |
| RF-01 | La app solicita permisos de cámara y de galería (solo escritura). Si se deniegan, muestra una pantalla explicativa con acceso a Ajustes. | Obligatorio |
| RF-02 | La pantalla principal muestra la vista previa de la cámara trasera, un botón de captura de foto y un modo de grabación de clip. | Obligatorio |
| RF-03 | La grabación de clip dura máximo 5 s y se detiene sola. Duración mínima 1 s. | Obligatorio |
| RF-04 | Tras capturar o importar, la app cambia a la pestaña Editor con el medio activo. Desde el editor se puede descartar (limpia el medio y vuelve a la pestaña Cámara). | Obligatorio |
| RF-05 | El editor ofrece seis efectos (aberración cromática, scanlines CRT, datamosh, VHS, pixelado, ondulación), seleccionables con un tap para el slot activo. | Obligatorio |
| RF-06 | Un gesto de un dedo sobre la imagen modifica (x, y) del slot activo y la imagen se actualiza de forma continua. | Obligatorio |
| RF-07 | Al soltar, los valores se conservan. Un doble tap los restablece a los valores por defecto del efecto del slot activo. | Obligatorio |
| RF-08 | La barra de herramientas se atenúa mientras el dedo está sobre la imagen y reaparece al soltar. Se muestra una retícula discreta que se oculta tras 1.5 s sin tocar. | Obligatorio |
| RF-09 | Los clips se reproducen en bucle con el efecto aplicado en vivo, controlados con el mismo gesto. | Obligatorio |
| RF-10 | "Guardar" en una foto exporta la imagen con efecto a la resolución original (lado largo máximo 4096 px), la guarda en la galería. | Obligatorio |
| RF-11 | "Guardar" en un clip exporta el **cuadro actual** con efecto como imagen (misma regla de RF-10) y lo guarda en la galería. El clip original no se conserva. | Obligatorio |
| RF-12 | *Eliminado en la v0.4 (historial).* | — |
| RF-13 | *Eliminado en la v0.4 (historial).* | — |
| RF-14 | Efectos adicionales: VHS, Pixelado y Ondulación (seis en total), con el mapeo de ejes de la sección 6.2. | Obligatorio |
| RF-15 | **Encadenado:** el editor tiene dos slots de efecto, A y B. El slot B es opcional (por defecto "ninguno"). Si está activo, la salida de A es la entrada de B. | Obligatorio |
| RF-16 | **Selector A/B:** un control fuera de la imagen decide qué slot controla el dedo. Cada slot conserva su efecto y su par (x, y). | Obligatorio |
| RF-17 | **LFO:** cada eje (x, y) de cada slot puede tener un LFO con forma (seno, triángulo, cuadrada, aleatoria), velocidad (0.1-8 Hz) y profundidad (0-1), configurable desde un panel de modulación. | Obligatorio |
| RF-18 | El valor efectivo de cada parámetro es `clamp(base + profundidad · onda(t), 0, 1)` con onda en \[-1, 1\], calculado en el hilo de UI. | Obligatorio |
| RF-19 | **Grabar gesto:** un botón graba los valores de control de A y B a 30 Hz, hasta 10 s. Se detiene con el botón o al llegar al máximo. | Obligatorio |
| RF-20 | **Repetir gesto:** la pista grabada se reproduce en bucle. Tocar la imagen detiene la reproducción y devuelve el control al dedo. La pista se puede borrar. | Obligatorio |
| RF-21 | **Giroscopio:** un interruptor activa el control por inclinación. Al activarlo, la orientación actual es el punto neutral; inclinar adelante/atrás (±30°) controla Y del slot activo y el dedo solo controla X. Al desactivarlo, Y conserva su último valor. | Obligatorio |
| RF-22 | **Importar:** desde la pantalla de cámara se puede elegir una foto o un video de la galería. Las fotos (incluida HEIC) se convierten para el editor; los videos de más de 10 s se rechazan con aviso. | Obligatorio |
| RF-23 | **Presets:** guardar la escena actual (slots, efectos, valores, LFO, giroscopio y pista) con nombre; listarlos, aplicarlos con un tap y eliminarlos. Máximo 20 de usuario y 3 de fábrica (no eliminables). | Obligatorio |
| RF-24 | **Compartir:** tras guardar, un botón abre la hoja nativa de compartir con la imagen o el GIF. | Obligatorio |
| RF-25 | **Exportar GIF:** desde una foto con animación (pista grabada o algún LFO activo) se puede guardar un GIF animado de 480 px de lado largo, 12 fps y máximo 4 s (48 cuadros). Si solo hay LFO y no hay pista, dura 3 s. | Obligatorio |
| RF-26 | La exportación del GIF muestra progreso, se puede cancelar y no bloquea la interfaz. Si se cancela o falla, no se guarda nada. | Obligatorio |
| RF-27 | El GIF se guarda en la galería. Los clips no admiten GIF. | Obligatorio |
| RF-28 | **Onboarding:** tres pantallas en el primer arranque (gesto, efectos y modulación), saltables y accesibles después desde un botón de ayuda. | Obligatorio |
| RF-29 | **Identidad visual:** paleta, tipografía e íconos coherentes; pantalla de bienvenida animada dentro de la app; ícono y splash configurados en `app.json` (solo visibles en un build propio, ver D13). | Obligatorio |
| RF-30 | Si no hay medio activo, la pestaña Editor muestra un aviso con acceso a la cámara. Al cambiar de pestaña, la cámara se desmonta, el video se pausa y el giroscopio se detiene. | Obligatorio |

## 3. Requisitos no funcionales

| ID | Requisito | Medición |
| --- | --- | --- |
| RNF-01 | Durante el arrastre, el hilo de UI mantiene ≥ 55 FPS en cada efecto, con preview de 2048 px (lado largo). | Perf Monitor de Expo Go, 10 s de arrastre continuo, promedio de UI FPS. Se mide con `npx expo start --no-dev --minify`, no en modo desarrollo |
| RNF-02 | El hilo de JS no participa en el ciclo gesto → render. | Perf Monitor: JS FPS no se degrada durante el arrastre; revisión de código (sin `useState`/`setState` en callbacks del gesto) |
| RNF-03 | La exportación a resolución completa tarda ≤ 5 s en una foto de 12 MP. | Cronómetro en iPhone de prueba |
| RNF-04 | La imagen exportada es visualmente equivalente al preview con los mismos (x, y). | Comparación manual con 3 valores de control por efecto |
| RNF-05 | Sin cierres inesperados en el flujo captura → editar → guardar repetido 20 veces. | Prueba manual |
| RNF-06 | Todo funciona en Expo Go (SDK 57) sobre iPhone físico, sin código nativo propio. | Verificación en fase 0 y en cada entrega |
| RNF-07 | Con encadenado A+B (peor combinación de costo), un LFO activo y una pista reproduciéndose, el hilo de UI mantiene ≥ 55 FPS. | Perf Monitor, 10 s, `--no-dev --minify` |
| RNF-08 | El control por giroscopio no produce saltos visibles (filtro de suavizado) y el sensor se detiene al desactivarlo o al cambiar de pestaña. | Prueba manual; revisión de código |
| RNF-09 | Un GIF de 36 cuadros a 480 px se genera en ≤ 20 s; la cancelación surte efecto en ≤ 1 s; la interfaz sigue respondiendo. | Cronómetro en iPhone de prueba |
| RNF-10 | Los presets (que incluyen la pista grabada) persisten entre cierres de la app. | Prueba manual |

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
                       drawAsImage (offscreen) ─► archivo ─► MediaLibrary
```

### 4.2 Estructura de carpetas

```
app/
  _layout.tsx            # Raíz: gesture root, permisos, overlay de onboarding
  (tabs)/_layout.tsx     # Tabs: Cámara | Editor
  (tabs)/index.tsx       # Cámara
  (tabs)/editor.tsx      # Editor (lee el medio activo del store)
src/
  effects/
    chromatic.sksl.ts    # Cada shader exporta su string SkSL
    scanlines.sksl.ts
    datamosh.sksl.ts
    vhs.sksl.ts
    pixelate.sksl.ts
    wave.sksl.ts
    registry.ts          # { id, nombre, source (RuntimeEffect), defaults }
  editor/
    useControlSurface.ts # shared values + gestos
    EffectCanvas.tsx     # Canvas + Shader + retícula
    Toolbar.tsx          # Barra principal (A/B, efectos, acciones)
    ModulationPanel.tsx  # LFO por eje y slot
    PresetsPanel.tsx
    exportImage.ts       # drawAsImage + guardado
    exportGif.ts         # fotogramas + gifenc + progreso/cancelación
  modulation/
    computeParams.ts     # función pura: base + LFO + pista → valores efectivos
    lfo.ts               # formas de onda (worklets)
    gyro.ts              # useAnimatedSensor, calibración y suavizado
    gestureTrack.ts      # grabadora y reproductor de pista
  presets/
    presetsRepo.ts       # CRUD sobre presets.json + presets de fábrica
  state/
    editorStore.ts       # Zustand
    types.ts             # SceneConfig, Slot, Preset
  media/
    prepareMedia.ts      # reducción a 2048 px para preview
    importMedia.ts       # expo-image-picker, conversión HEIC, límite de 10 s
  theme/
    tokens.ts            # paleta, tipografía
  onboarding/
    Onboarding.tsx       # overlay de bienvenida (no es una ruta)
```

### 4.3 Responsabilidades

| Módulo | Responsabilidad | No debe hacer |
| --- | --- | --- |
| `useControlSurface` | Crear `xA`, `yA`, `xB`, `yB`, `activeSlot`, `touching`, `reticleOpacity` (shared values) y los gestos Pan + doble Tap, escribiendo en el par del slot activo | Escribir en estado de React |
| `EffectCanvas` | Dibujar el medio con el shader activo y la retícula dentro del mismo Canvas | Conocer cómo se guarda |
| `registry` | Compilar los tres `RuntimeEffect` una sola vez al cargar el módulo | Compilar en cada render |
| `exportImage` | Renderizar offscreen a resolución completa con los valores actuales (`x.value`, `y.value`) | Usar el Canvas visible |
| `editorStore` | Guardar efectos de los slots A/B, slot activo, configuración de LFO, giroscopio activo, pista grabada y medio actual | Guardar x, y |
| `computeParams` | Calcular valores efectivos (base + LFO + pista) como función pura, usada por el preview y por el GIF | Acceder a React o a sensores |
| `gyro` | Leer el sensor, calibrar el neutral, suavizar y escribir la base de Y | Escribir en estado de React |
| `gestureTrack` | Grabar y reproducir la pista a 30 Hz con búfer preasignado | Crecer arreglos en cada cuadro |
| `exportGif` | Generar fotogramas offscreen, codificar con `gifenc`, reportar progreso, cancelar | Bloquear el hilo de JS sin ceder el control entre cuadros |
| `presetsRepo` | Leer/escribir `presets.json` y exponer los 3 presets de fábrica | Acceder a la galería |

### 4.4 Gesto y render (regla central)

- `Gesture.Pan().minDistance(0)`: se activa al tocar. En `onBegin`/`onUpdate` (worklet): `x.value = clamp(e.x / ancho, 0, 1)`, `y.value = clamp(1 - e.y / alto, 0, 1)` (arriba = más).
- `Gesture.Tap().numberOfTaps(2)`: en `onEnd`, restablece `x`, `y` a los valores por defecto del efecto activo.
- Ambos se combinan con `Gesture.Simultaneous`. El reset ocurre al levantar el segundo tap, es decir, después del `onBegin` del Pan. Se verifica en la fase 3.
- `uniforms = useDerivedValue(() => ({ resolution, param: [x.value, y.value], time: clock.value / 1000 }))`.
- `touching` anima la opacidad de la barra y de la retícula con `withTiming` (en el hilo de UI).
- Con las extensiones (4.6), los valores del gesto son la **base** del slot activo; el valor que llega al shader es el valor efectivo.

### 4.5 Pipeline de medios

1. **Foto:** `takePictureAsync` → archivo original. `prepareMedia` genera una copia de preview con lado largo ≤ 2048 px (`expo-image-manipulator`). Se conserva la ruta original para exportar.
2. **Clip:** `recordAsync({ maxDuration: 5 })` → `.mp4`. En el editor se abre con `useVideo(uri, { looping: true })`; `currentFrame` alimenta el `ImageShader`.
3. **Exportación:** `drawAsImage(<mismo árbol Group + Shader>, { width, height })` con el tamaño final (lado largo ≤ 4096), `encodeToBytes(JPEG, 100)` para usar la máxima calidad JPEG disponible, escritura en `cacheDirectory` (archivo temporal), guardado con `expo-media-library` y borrado del temporal.
4. **Cuadro de clip:** el `SkImage` de `currentFrame` en el instante de pulsar Guardar se usa como fuente del `ImageShader` offscreen.

> Los nombres de API de Skia usados en este documento (`drawAsImage`, `useVideo`, `makeImageSnapshot`, `encodeToBytes`) deben confirmarse contra la versión instalada en la prueba de humo de la fase 0.

> El audio no se usa. El clip se graba con `mute` activo; si Expo Go exige el permiso de micrófono para grabar video, se solicita y queda documentado.

### 4.6 Arquitectura de las extensiones (Nivel 3)

**Pipeline de valores (todo en el hilo de UI):**

```
 dedo (X) ───────────┐
 giroscopio (Y) ─────┼─► base[slot]  ─► + profundidad · onda(t)  ─► clamp 0-1 ─► uniform `param` del slot
 pista grabada ──────┘      (xA,yA,xB,yB)        (LFO por eje)
```

Precedencia de la base: pista en reproducción > (dedo para X, giroscopio para Y si está activo). Tocar la imagen detiene la pista. La misma lógica vive en la función pura `computeParams(config, t)`.

**Encadenado.** Shaders anidados: el `ImageShader` es hijo del shader del slot A, y este es hijo del shader del slot B. Cada shader recibe su propio `param`; `resolution` y `time` son comunes. Si el slot B es `null`, solo se dibuja A. El costo se multiplica por el número de muestras de cada efecto (por ejemplo, cromática ∘ VHS = 3 × 2 = 6 evaluaciones por píxel), por eso existe el spike S3.

**Giroscopio.** `useAnimatedSensor` (rotación) → `pitch` → mapeo de ±30° a 0-1 con filtro de paso bajo → base de Y del slot activo. El neutral se calibra al activar y al hacer doble tap. El sensor se detiene al desactivar el modo o al cambiar de pestaña. Si el spike S4 falla, se usa `DeviceMotion` de `expo-sensors` con un callback que escribe en el shared value (sin estado de React).

**Grabadora de gesto.** A 30 Hz, un callback de cuadro escribe `[xA, yA, xB, yB]` en un búfer preasignado (máx. 300 muestras). Al detener la grabación, una sola llamada a JS guarda la pista en el store. La reproducción interpola linealmente entre muestras y se repite en bucle.

**Exportación de GIF.**

1. Fuente de animación: la pista (máx. 4 s) o, sin pista, 3 s de LFO. Sin ninguna de las dos, el botón no aparece.
2. Número de cuadros: `duración · 12 fps` (máx. 48), a 480 px de lado largo.
3. Para cada cuadro `i`: `t = i / 12`, `computeParams(config, t)`, render offscreen con `drawAsImage`, lectura de píxeles RGBA, cuantización a paleta de 256 colores y escritura del cuadro con `gifenc`.
4. Entre cuadros se cede el control al bucle de eventos (progreso y cancelación). Al terminar: archivo temporal en `cacheDirectory`, `MediaLibrary.saveToLibraryAsync` y opción de compartir; el temporal se borra al salir.

**Importar, presets y compartir.** `expo-image-picker` entrega la foto o el video; las fotos pasan siempre por `prepareMedia` (convierte HEIC y reduce a 2048 px). Los presets guardan un `SceneConfig` completo. Compartir usa la hoja nativa con el archivo ya guardado.

**Distribución de la interfaz del editor.** El área de imagen no tiene controles. La barra inferior (se atenúa al tocar) agrupa: selector A/B con efecto de cada slot, grabar/reproducir gesto, giroscopio, modulación (abre panel), presets (abre panel) y guardar (menú: imagen o GIF) con compartir.

## 5. Navegación

Estructura de **pestañas** (`Tabs` de expo-router), no `Stack` (D14).

| Pestaña | Ruta | Contenido |
| --- | --- | --- |
| Cámara | `/` | Vista previa, captura de foto o clip, importar de la galería, botón de ayuda |
| Editor | `/editor` | Edición del medio activo; aviso con acceso a la cámara si no hay medio (RF-30) |

Reglas:

- El medio activo (`uri`, tipo, ancho, alto) vive en `editorStore`; no hay parámetros de ruta.
- Capturar o importar fija el medio y cambia a la pestaña Editor. **Descartar** o **Nueva captura** limpia el medio y vuelve a Cámara. Tras **Guardar**, el editor se mantiene abierto para poder compartir.
- Al desenfocar una pestaña (`useIsFocused`): se desmonta `CameraView`, se pausa el video y se detiene el giroscopio.
- La barra de pestañas es estática y no se atenúa: atenuarla exigiría estado de JS durante el gesto (RNF-02). RF-08 aplica a la barra de herramientas del editor y a la retícula.
- El onboarding es un overlay en el layout raíz, no una ruta.

## 6. Contrato de shaders

### 6.1 Uniformes comunes (los tres efectos)

| Uniform | Tipo | Significado |
| --- | --- | --- |
| `image` | `shader` | Medio de entrada (`ImageShader`, tile mode *clamp*) |
| `resolution` | `float2` | Tamaño en píxeles del área dibujada (preview o salida) |
| `param` | `float2` | (x, y) normalizados 0-1 del dedo |
| `time` | `float` | Segundos desde el inicio; lo usan Scanlines y VHS |

Reglas: todo desplazamiento se expresa como fracción de `resolution`; el ruido se calcula sobre coordenadas normalizadas. Así el preview y la exportación se ven igual (RNF-04).

### 6.2 Efectos

| Efecto (`id`) | `param.x` | `param.y` | Valor por defecto (x, y) |
| --- | --- | --- | --- |
| `chromatic` | Desplazamiento = `x · 3 %` del ancho | Ángulo = `y · 360°` | (0.30, 0.00) |
| `scanlines` | Líneas por pantalla = `mix(80, 400, x)` | Ruido = `y · 0.35` | (0.40, 0.20) |
| `datamosh` | Alto de franja = `mix(1 %, 15 %, x)` del alto | Desplazamiento máx. = `y · 25 %` del ancho | (0.30, 0.30) |
| `vhs` | Jitter horizontal por línea = `x · 3 %` del ancho | Altura y desplazamiento de la banda de *tracking* = `y · 25 %` del alto | (0.30, 0.40) |
| `pixelate` | Tamaño de bloque = `mix(0.5 %, 6 %, x)` del ancho | Niveles de color por canal = `mix(32, 3, y)` (posterizado) | (0.25, 0.00) |
| `wave` | Amplitud = `x · 5 %` del alto | Frecuencia = `mix(1, 20, y)` ondas por pantalla | (0.30, 0.30) |

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

### 6.4 Efectos adicionales (SkSL de referencia, se validan al implementarlos)

```glsl
// vhs
uniform shader image; uniform float2 resolution; uniform float2 param; uniform float time;
float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }
half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float line = floor(uv.y * 240.0);
  float jitter = (hash(float2(line, floor(time * 24.0))) - 0.5) * param.x * 0.03 * resolution.x;
  float band = fract(time * 0.2);
  float inBand = step(band, uv.y) * step(uv.y, band + param.y * 0.25);
  float shift = jitter + inBand * param.y * 0.08 * resolution.x;
  half4 c = image.eval(float2(xy.x + shift, xy.y));
  half r = image.eval(float2(xy.x + shift + 0.004 * resolution.x, xy.y)).r;
  return half4(r, c.g, c.b, c.a);
}

// pixelate
uniform shader image; uniform float2 resolution; uniform float2 param;
half4 main(float2 xy) {
  float block = max(mix(0.005, 0.06, param.x) * resolution.x, 1.0);
  half4 c = image.eval((floor(xy / block) + 0.5) * block);
  half levels = half(mix(32.0, 3.0, param.y));
  return half4(floor(c.rgb * levels + 0.5) / levels, c.a);
}

// wave
uniform shader image; uniform float2 resolution; uniform float2 param;
half4 main(float2 xy) {
  float off = param.x * 0.05 * resolution.y * sin(xy.y / resolution.y * mix(1.0, 20.0, param.y) * 6.2831853);
  return image.eval(float2(xy.x + off, xy.y));
}
```

### 6.5 Encadenado

- Orden fijo: A se aplica primero y B sobre el resultado de A.
- El contrato de uniforms no cambia: cada shader recibe su `param`; `resolution` y `time` son los mismos.
- Las mismas reglas de resolución independiente aplican, de modo que preview y exportación coinciden (CA-23).

## 7. Modelo de datos

No hay historial ni índice de creaciones (D15). Los resultados se guardan en la galería y los archivos de exportación son temporales (`cacheDirectory`). Solo se persisten los presets, en `documentDirectory/presets/presets.json`.

```ts
type EffectId = 'chromatic' | 'scanlines' | 'datamosh' | 'vhs' | 'pixelate' | 'wave';
type LfoShape = 'sine' | 'triangle' | 'square' | 'random';
type LfoConfig = { enabled: boolean; shape: LfoShape; rateHz: number; depth: number }; // rateHz 0.1-8, depth 0-1
type Slot = {
  effect: EffectId;
  params: { x: number; y: number };   // valores base normalizados 0-1
  lfoX: LfoConfig;
  lfoY: LfoConfig;
};
type GestureTrack = {
  durationMs: number;                 // máx. 10 000
  sampleRateHz: 30;
  samples: number[];                  // aplanado: [xA, yA, xB, yB] por muestra
};
type SceneConfig = {
  slotA: Slot;
  slotB: Slot | null;                 // null = sin encadenado
  gyroOnY: boolean;                   // la inclinación controla Y del slot activo
  track: GestureTrack | null;
};
type Preset = { id: string; name: string; builtIn: boolean; config: SceneConfig };
type PresetIndex = { version: 1; items: Preset[] };    // máx. 20 de usuario
type ActiveMedia = { uri: string; type: 'photo' | 'clip'; width: number; height: number }; // solo en memoria (store)
```

Reglas:

- Si `presets.json` está corrupto o ausente, se recrea vacío.
- Los 3 presets de fábrica viven en código y se definen en la fase 8: *Cinta VHS* (A: VHS), *Señal rota* (A: datamosh, B: aberración cromática) y *Mosaico ondulado* (A: ondulación, B: pixelado).
- Los archivos temporales (JPG, GIF) se borran después de guardarlos en la galería o al descartar.

## 8. Manejo de errores

| Situación | Comportamiento |
| --- | --- |
| Permiso de cámara denegado | Pantalla explicativa + botón a Ajustes (RF-01) |
| Permiso de galería denegado al guardar | Aviso con acceso a Ajustes; el editor conserva el resultado para reintentar |
| Falla `takePictureAsync` / `recordAsync` | Mensaje breve y la cámara sigue activa |
| El shader no compila | El editor muestra el medio sin efecto y un aviso; error registrado en consola |
| El clip no se decodifica | Se vuelve a la cámara con aviso |
| Falla la exportación o el almacenamiento está lleno | Aviso con opción de reintentar; no se guarda nada |
| El giroscopio no está disponible o el sensor falla | El interruptor se deshabilita con aviso; el dedo controla ambos ejes |
| Video importado de más de 10 s, o formato no soportado | Se rechaza con mensaje y se vuelve a la cámara |
| Falla la conversión de una foto importada (por ejemplo HEIC) | Aviso y vuelta a la cámara |
| Falla la codificación del GIF o se agota la memoria | Aviso, se libera lo generado, no se guarda nada |
| El usuario cancela el GIF | Se detiene en ≤ 1 s, se borra el archivo parcial |
| `presets.json` corrupto | Se recrea vacío; los presets de fábrica siguen disponibles |

## 9. Estrategia de pruebas

- **Manual en iPhone** (principal): lista de verificación por fase, ejecutada en el dispositivo físico.
- **Rendimiento:** protocolo de RNF-01 por cada efecto y con foto y con clip; se registran resultados en una tabla del repositorio.
- **Unitarias (Jest, `jest-expo`)** solo para lógica pura: `presetsRepo` (límite de 20, archivo corrupto, presets de fábrica), `computeParams` y funciones de mapeo/clamp.
- **Prueba de humo (fase 0):** un `Canvas` de Skia dibuja en el iPhone vía Expo Go, y las funciones `drawAsImage`, `useVideo` y `encodeToBytes` existen en la versión instalada. Si algo falla, se resuelve antes de la fase 1.
- **Spikes de validación** (resultado documentado antes de continuar):
  - **S1 (fase 2):** `Shader` con uniforms desde shared values a ≥ 55 FPS en Expo Go; `drawAsImage` a 12 MP en ≤ 5 s.
  - **S2 (fase 6):** `useVideo` con shader en Expo Go. **Plan B si falla:** el clip se reproduce sin efecto y el usuario elige un cuadro (miniatura por tiempo con `expo-video-thumbnails`) sobre el que aplica el efecto como foto.
  - **S3 (fase 8):** encadenado con shaders anidados en la peor combinación (cromática sobre VHS) a ≥ 55 FPS. **Plan B si falla:** restringir el slot B a efectos de una sola muestra (pixelado, scanlines, ondulación, datamosh).
  - **S4 (fase 10):** `useAnimatedSensor` entrega una rotación estable en Expo Go SDK 57. **Plan B si falla:** `DeviceMotion` de `expo-sensors` con callback a un shared value.
  - **S5 (fase 11):** (a) 36 cuadros a 480 px codificados en ≤ 20 s; (b) iOS reproduce como animación un GIF guardado con `saveToLibraryAsync`; (c) memoria estable. **Plan B:** si (a) falla, bajar a 360 px y 8 fps o usar una paleta global; si (b) falla, el GIF se entrega solo por la hoja de compartir (desde el archivo temporal, por ejemplo guardándolo en Archivos).

### 9.1 Riesgos de entorno

| Riesgo | Mitigación |
| --- | --- |
| Expo Go se actualiza a un SDK nuevo y el proyecto deja de abrirse (Expo Go soporta un solo SDK a la vez) | Desactivar las actualizaciones automáticas en el iPhone. Si ocurre, migrar entre fases, nunca a mitad de una |
| Regresiones de Hermes V1 con Reanimated/Worklets en versiones tempranas del SDK 57 | Usar `expo@^57.0.17` como mínimo y ejecutar `npx expo-doctor` en la fase 0 |
| Medir rendimiento en modo desarrollo da resultados pesimistas | Medir siempre con `--no-dev --minify` (RNF-01) |
| Cambios en las APIs de `expo-media-library` y `expo-file-system` entre SDK | Revisar la documentación del SDK instalado en la fase 0 y fijar una sola API |
| **Calendario ajustado:** las fases 7-12 suman \~7 semanas sobre un plan que ya ocupa \~5 | Puntos de control al final de la semana 5 (Niveles 1-2 cerrados) y de la semana 9 (hasta giroscopio). Si una fase se retrasa, el tiempo se toma de pruebas y pulido, nunca de los Niveles 1-2. *Contingencia propuesta (por aprobar):* si en el control de la semana 9 el spike S5 no está resuelto, el GIF es lo primero que se recorta |
| La codificación del GIF corre en el hilo de JS | Ceder el control entre cuadros, mostrar progreso y permitir cancelar (RF-26) |
| iOS puede no reproducir el GIF animado en Fotos | Spike S5 (b) y plan B con la hoja de compartir |
| Ícono y splash no se ven en Expo Go | D13: pantalla de bienvenida interna y mockup para la presentación |
| La documentación del SDK 58 ya está publicada, por lo que Expo Go puede actualizarse pronto | Mantener desactivadas las actualizaciones automáticas; migrar solo entre fases |
| Recursos activos en segundo plano al cambiar de pestaña (cámara, video, sensor) | `useIsFocused`: desmontar `CameraView`, pausar video y detener el giroscopio al desenfocar la pestaña (RF-30) |

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
| CA-08 | Guardar una foto la deja en la galería con la resolución esperada (≤ 4096 px lado largo). | RF-10, RNF-03 |
| CA-09 | Guardar desde un clip deja el cuadro con efecto en la galería. | RF-11 |
| CA-10 | *Eliminado en la v0.4 (historial).* | — |
| CA-11 | Preview y exportación coinciden con los mismos (x, y), en los 3 efectos. | RNF-04 |
| CA-12 | 20 ciclos captura → editar → guardar sin cierres. | RNF-05 |
| CA-13 | Los seis efectos se pueden seleccionar y controlar con un dedo. | RF-05, RF-14 |
| CA-14 | Con A y B activos, B recibe la salida de A; el selector A/B cambia qué slot responde al dedo y cada uno conserva sus valores; ≥ 55 FPS. | RF-15, RF-16, RNF-07 |
| CA-15 | Un LFO en un eje hace oscilar el parámetro con las cuatro formas; con profundidad 0 no hay cambio. | RF-17, RF-18 |
| CA-16 | Se graba un gesto de 5 s, se reproduce en bucle y tocar la imagen lo detiene. | RF-19, RF-20 |
| CA-17 | Con el giroscopio activo, inclinar cambia Y sin saltos y el dedo solo cambia X; al desactivar, Y conserva su valor. | RF-21, RNF-08 |
| CA-18 | Se importa una foto HEIC y un video ≤ 10 s; un video > 10 s se rechaza con aviso. | RF-22 |
| CA-19 | Se guarda un preset con pista, se cierra la app y al aplicarlo se reproduce la misma configuración. | RF-23, RNF-10 |
| CA-20 | Compartir una imagen y un GIF abre la hoja nativa. | RF-24 |
| CA-21 | El onboarding aparece solo en el primer arranque y se puede reabrir desde ayuda. | RF-28 |
| CA-22 | Una foto con pista de 3 s genera un GIF de 36 cuadros a 480 px en ≤ 20 s; se puede cancelar en ≤ 1 s y se guarda en la galería. | RF-25, RF-26, RF-27, RNF-09 |
| CA-23 | Con encadenado, el export y el preview coinciden con los mismos valores; cada cuadro del GIF equivale al preview en su instante `t`. | RNF-04, D10 |
| CA-24 | Cambiar entre pestañas conserva el medio activo; la cámara no queda activa en la pestaña Editor; el editor sin medio muestra el aviso con acceso a la cámara. | RF-04, RF-30 |

## 11. Trazabilidad con las fases

Calendario re-planificado a **12 semanas** a partir de la semana actual (Semana 1 = Fase 3 en curso). Las fases 0-2 ya están cerradas.

| Fase | Semana | Requisitos que cierra |
| --- | --- | --- |
| 3. Superficie X/Y | 1 | RF-06, RF-07, RF-08, RNF-01, RNF-02 |
| 4. Efectos 2 y 3 | 2 | RF-05 (tres efectos base) |
| 5. Guardado en galería y navegación por pestañas | 3 | RF-04, RF-10, RF-30, RNF-03, RNF-04 |
| 6. Video Nivel 2 | 4-5 | RF-03 (clip), RF-09, RF-11, S2 |
| 7. Efectos adicionales, importar y compartir | 6 | RF-14, RF-22, RF-24 (imagen) |
| 8. Encadenado A/B y presets | 7 | RF-15, RF-16, RF-23, RNF-07, S3 |
| 9. LFO y grabar/repetir gesto | 8 | RF-17, RF-18, RF-19, RF-20 |
| 10. Giroscopio | 9 | RF-21, RNF-08, S4 |
| 11. Exportar GIF | 10-11 | RF-25, RF-26, RF-27, RF-24 (GIF), RNF-09, S5 |
| 12. Pulido, pruebas y presentación | 12 | RF-28, RF-29, RNF-05, RNF-10, CA-01 a CA-24 (CA-10 eliminado) |

Puntos de control: fin de la semana 5 (Niveles 1-2 cerrados) y fin de la semana 9 (extensiones hasta el giroscopio). Las pruebas y el pulido se comprimen para absorber retrasos, según la decisión del equipo.

## 12. Pendientes para la versión 0.5

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
| `expo-image-picker` | *por completar* |
| `expo-sharing` | *por completar* |
| `gifenc` | *por completar* |
| `expo-sensors` (solo si falla S4) | *por completar* |

- Confirmar qué API de `expo-media-library` y de `expo-file-system` se usa en esa versión.
- Confirmar contra los tipos instalados: `useAnimatedSensor` (Reanimated), `readPixels` y `drawAsImage` (Skia), y la API de `gifenc` (`GIFEncoder`, `quantize`, `applyPalette`).
- Definir los valores exactos de los 3 presets de fábrica y el diseño visual de los paneles de modulación y presets.
- Especificar el diseño visual de la barra de herramientas y de la retícula.
- Resultados de S1 y S2 para cerrar las decisiones D1 y el contrato de exportación.
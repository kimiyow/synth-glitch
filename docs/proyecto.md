# SynthVJ: instrumento de síntesis visual móvil

**Documento de proyecto (versión 2, con extensiones del Nivel 3)**

## 1. Descripción del proyecto

Aplicación móvil en React Native (Expo) para iOS que permite capturar una fotografía o un clip corto de video (3-5 s) y aplicarle efectos de glitch analógico: aberración cromática, líneas de escaneo tipo CRT y corrupción de datos (datamosh simulado).

Los efectos se controlan con un gesto táctil de **un dedo** sobre la imagen: el eje X y el eje Y modifican dos parámetros del efecto activo en tiempo real. No hay sliders, botones ni menús superpuestos sobre la imagen; toda la pantalla funciona como un controlador continuo, al estilo de un VJ o de un instrumento de hardware modular.

**Extensiones (Nivel 3).** Sobre ese núcleo, la app suma seis efectos, encadenado de dos efectos (A/B), modulación automática tipo LFO, grabación y repetición del gesto, control por inclinación del teléfono (giroscopio), importación desde la galería, presets, compartir, exportación de GIF animado y un pulido visual. Todas son obligatorias por decisión del equipo.

## 2. Innovación

El paradigma de interacción: en lugar de editar con controles que desconectan al usuario de la imagen, la interfaz desaparece y el dedo se convierte en el control directo del efecto.

## 3. Justificación y complejidad técnica

- **Efectos escritos como shaders propios (SkSL), no filtros del sistema.** Los tres efectos se programan como `RuntimeEffect` de React Native Skia y se ejecutan en GPU. No se usan los filtros prefabricados de iOS ni de librerías de edición: el cálculo de desplazamiento de píxeles y canales de color es código propio.
- **Rendimiento a 60 FPS.** El gesto actualiza *shared values* de Reanimated en el hilo de UI, que alimentan directamente los uniforms del shader. Los valores del dedo nunca pasan por el estado de React.
- **Exportación a resolución completa.** El preview se renderiza a resolución reducida y la exportación se hace offscreen a resolución original.
- **Decisión de alcance.** Los efectos se aplican sobre una imagen congelada o un clip ya grabado, no sobre la cámara en vivo. Esto elimina el procesamiento de video en tiempo real y mantiene la innovación del control X/Y.
- **Capa de modulación en el hilo de UI.** El valor que recibe cada shader es `clamp(base + LFO)`, donde la base viene del dedo, del giroscopio o de una pista grabada. Una función pura compartida entre preview y exportación garantiza que el GIF reproduzca exactamente lo que se ve.
- **Encadenado de shaders.** Dos efectos anidados en la GPU, cuyo costo se multiplica; se valida con un spike de rendimiento.
- **Exportación de GIF sin código nativo.** Fotogramas renderizados offscreen con Skia y codificados en JavaScript puro, con progreso y cancelación para no bloquear la interfaz.

## 4. Entorno y stack tecnológico

**Principio:** desarrollo y pruebas 100 % en iPhone físico. No se usa emulador de Android.

| Capa | Tecnología |
| --- | --- |
| Framework | Expo **SDK 57** (React Native 0.86, `expo@^57.0.17` como mínimo) + TypeScript |
| Ejecución en iPhone | Expo Go durante todo el proyecto (sin Development Build, sin Mac ni cuenta de desarrollador) |
| Navegación | `expo-router` |
| Cámara | `expo-camera` |
| Render de efectos | `@shopify/react-native-skia` (SkSL) |
| Gestos y animación | `react-native-gesture-handler` + `react-native-reanimated` |
| Estado de UI | Zustand (solo efecto seleccionado y modo) |
| Galería | `expo-media-library` |
| Historial | `expo-file-system` (`documentDirectory/creations`) + `index.json` de metadatos |
| Reproducción de video | `useVideo` de Skia para el clip con shader; `expo-video` solo para ver el clip original en el historial |
| Sensor de movimiento | `useAnimatedSensor` de Reanimated (principal); `expo-sensors` como plan B |
| Importar | `expo-image-picker` |
| Compartir | `expo-sharing` |
| Codificación GIF | `gifenc` (JavaScript puro) |
| Presets | `expo-file-system` (`presets.json`) |

**Regla de arquitectura:** `Gesture.Pan` → `useSharedValue` (x, y normalizados 0-1) → `useDerivedValue` → uniforms del shader. Prohibido `useState` para los valores del dedo.

**Versiones:** se fijan en la fase 0. Si Expo Go se actualiza a un SDK nuevo, la migración se hace entre fases, nunca a mitad de una. Se desactivan las actualizaciones automáticas en el iPhone.

## 5. Funciones de la app

1. **Captura de cámara.** Pantalla principal con vista previa y un botón para tomar foto o grabar un clip de 3-5 s.
2. **Selector de efecto.** Seis efectos, cada uno seleccionable con un tap para el slot activo (A o B).
3. **Superficie de control X/Y (un dedo).** Sobre la imagen o clip capturado, arrastrar el dedo modifica dos parámetros del efecto activo en tiempo real.
4. **Guardado y exportación.** Guardar el resultado en la galería como imagen (foto con efecto o frame congelado del clip).
5. **Historial.** Pantalla con las últimas creaciones guardadas dentro de la app.
6. **Encadenado A/B.** Dos slots de efecto; la salida de A entra en B. Un selector A/B decide cuál controla el dedo.
7. **Modulación LFO.** Oscilación automática por eje (seno, triángulo, cuadrada, aleatoria) con velocidad y profundidad.
8. **Grabar y repetir el gesto.** Graba hasta 10 s de movimiento y lo reproduce en bucle.
9. **Giroscopio.** Inclinar el teléfono controla el eje Y del slot activo; el dedo controla X.
10. **Importar de la galería.** Fotos y videos (hasta 10 s) como fuente de edición.
11. **Presets.** Guardar y recuperar configuraciones completas, con 3 presets de fábrica.
12. **Compartir.** Hoja nativa de compartir con la imagen o el GIF.
13. **Exportar GIF.** GIF animado (480 px, 12 fps, máx. 4 s) a partir de una foto con animación.
14. **Pulido visual.** Onboarding de tres pantallas, identidad visual y pantalla de bienvenida animada.

### 5.1 Definición de efectos y mapeo de ejes

| Efecto | Descripción | Eje X | Eje Y |
| --- | --- | --- | --- |
| Aberración cromática / separación RGB | Desplaza los canales R, G y B generando desincronización de color | Magnitud del desplazamiento (0 a \~3 % del ancho) | Ángulo de la dirección del desplazamiento (0°-360°) |
| Scanlines tipo CRT | Líneas horizontales semitransparentes con ruido leve | Densidad de líneas (80-400 por pantalla) | Cantidad de ruido superpuesto (0-1) |
| Datamosh simulado | Corta la imagen en franjas horizontales y desplaza cada una una cantidad distinta | Grosor de las franjas (mayor X = más gruesas) | Amplitud del desplazamiento por franja |
| VHS | Jitter horizontal por línea y banda de *tracking* que recorre la imagen | Intensidad del jitter (0 a \~3 % del ancho) | Altura y desplazamiento de la banda (0 a \~25 % del alto) |
| Pixelado | Mosaico de bloques con posterizado de color | Tamaño del bloque (0.5 % a 6 % del ancho) | Niveles de color por canal (32 a 3) |
| Ondulación | Distorsión sinusoidal horizontal | Amplitud (0 a \~5 % del alto) | Frecuencia (1 a 20 ondas por pantalla) |

### 5.2 Comportamiento del control

- Al tocar y arrastrar, el efecto del **slot activo** se actualiza de forma continua.
- Al soltar, los valores **se conservan** (no vuelven a cero).
- **Doble tap** restablece los valores por defecto del slot activo (y recalibra el giroscopio si está activo).
- Solo se muestra un indicador mínimo (retícula discreta) que se oculta tras un breve periodo sin interacción.
- Control de **un solo dedo**. El multitáctil queda fuera de alcance.
- La superficie de la imagen sigue sin controles. Los ajustes secundarios (LFO, presets) están en paneles inferiores que se abren y cierran fuera del área de gesto.

### 5.3 Modulación y gesto grabado

- **LFO:** por eje y por slot, con forma, velocidad (0.1-8 Hz) y profundidad (0-1). El valor efectivo es `clamp(base + profundidad · onda(t))`.
- **Gesto grabado:** hasta 10 s a 30 Hz, guardando los valores de A y B. Se reproduce en bucle; tocar la imagen detiene la reproducción y devuelve el control al dedo.

### 5.4 Giroscopio

Al activarlo se toma la orientación actual como neutral. Inclinar el teléfono adelante o atrás (±30°) controla el eje Y del slot activo, y el dedo solo controla X. Al desactivarlo, Y conserva su último valor.

### 5.5 Exportar GIF

Solo desde fotos con animación (pista grabada o algún LFO activo). Duración: la de la pista (máx. 4 s) o 3 s si solo hay LFO. Muestra progreso y se puede cancelar. Se guarda en la galería y en el historial.

## 6. Niveles de entrega

| Nivel | Estado | Contenido |
| --- | --- | --- |
| 1 | Obligatorio | Foto → efecto en tiempo real con el dedo → guardar PNG/JPG en galería → historial |
| 2 | Obligatorio | Clip de 3-5 s reproducido en bucle con efecto en vivo controlado con el dedo. Se guarda un **frame congelado** como imagen; el clip original sin procesar queda en el historial |

| 3 | Obligatorio (decisión del equipo) | Extensiones: seis efectos, encadenado A/B, LFO, grabar/repetir gesto, giroscopio, importar, presets, compartir, exportar GIF y pulido visual |

No se exporta video con efecto aplicado; el GIF se genera solo desde fotos.

## 7. Fuera de alcance

- Multitáctil.
- Efectos sobre la cámara en vivo.
- Exportación de video con efecto aplicado (requeriría código nativo y Development Build).
- Audio-reactividad con FFT, sampler tipo MPC, secuenciador por pasos y salida OSC / modo escenario para VJing.
- Modo performance (interfaz oculta para grabar la pantalla), respuesta háptica y reactividad al micrófono.
- Exportar GIF desde clips de video.

## 8. Trabajo futuro

- Efectos sobre la **cámara en vivo**, incluido un efecto de retroalimentación (feedback loop). Requiere `react-native-vision-camera` con frame processors + Skia, es decir, Development Build y código nativo, que no están disponibles en este proyecto. No forma parte del semestre.
- Exportación de video con efecto y las ideas de audio y VJing de la sección 7.

## 9. Plan por fases (12 semanas restantes)

Las fases 0 a 2 están cerradas y la fase 3 está en curso. El calendario se re-planificó a **12 semanas** a partir de la semana actual (Semana 1).

| Fase | Semana | Entregable verificable en iPhone |
| --- | --- | --- |
| 3. Superficie X/Y | 1 | Pan gesture ligado a uniforms; efecto fluido a 60 FPS; doble tap = reset |
| 4. Efectos 2 y 3 | 2 | Scanlines y Datamosh con selector por tap |
| 5. Guardado e historial | 3 | Exportar foto con efecto (offscreen → archivo → galería) y pantalla de historial |
| 6. Video Nivel 2 | 4-5 | Grabar clip, reproducir en bucle con efecto y guardar frame |
| 7. Efectos adicionales, importar y compartir | 6 | VHS, Pixelado y Ondulación; importar de galería; compartir imagen |
| 8. Encadenado A/B y presets | 7 | Slots A y B con selector; guardar y aplicar presets; spike S3 |
| 9. LFO y grabar/repetir gesto | 8 | Panel de modulación; grabar 10 s de gesto y repetirlo en bucle |
| 10. Giroscopio | 9 | Inclinar controla Y del slot activo; spike S4 |
| 11. Exportar GIF | 10-11 | GIF desde foto con pista o LFO; progreso y cancelación; spike S5 |
| 12. Pulido, pruebas y presentación | 12 | Onboarding, identidad visual, pruebas completas y presentación |

**Puntos de control:** fin de la semana 5 (Niveles 1-2 cerrados) y fin de la semana 9 (extensiones hasta el giroscopio). Las pruebas y el pulido se comprimen para absorber retrasos, nunca los Niveles 1-2.

## 10. Riesgos y mitigación

1. **Rendimiento con fotos de alta resolución.** Reducir a \~2048 px en el lado largo para el preview; renderizar a resolución completa solo al exportar.
2. **Exportación a resolución original con Skia offscreen.** Se valida en la fase 5, no al final.
3. **Incompatibilidades de versiones (Expo / Skia / Reanimated).** Versiones fijadas en la fase 0 y sin actualizaciones durante el semestre.
4. **Reproducción de video con shader.** Spike S2 en la fase 6 para validar `useVideo` de Skia en Expo Go. Plan B: elegir un cuadro del clip y aplicarle el efecto como foto.
5. **Calendario ajustado.** Las fases 7-12 suman unas 7 semanas sobre un plan que ya ocupa unas 5. Se vigila con los puntos de control. *Contingencia propuesta (por aprobar):* si en el control de la semana 9 el spike del GIF no está resuelto, el GIF es lo primero que se recorta.
6. **Rendimiento del encadenado.** Dos shaders anidados multiplican las muestras por píxel. Spike S3 en la fase 8; plan B: limitar el slot B a efectos de una sola muestra.
7. **Giroscopio.** Spike S4 en la fase 10; plan B con `expo-sensors`.
8. **GIF.** Codificación en el hilo de JS y reproducción animada en Fotos de iOS no confirmada. Spike S5 en la fase 11; plan B: conservar el GIF en el historial y entregarlo por la hoja de compartir.
9. **Ícono y splash no visibles en Expo Go.** Se configuran en `app.json`, se entregan como assets y se añade una pantalla de bienvenida interna.
10. **Actualización de Expo Go.** La documentación del SDK 58 ya existe; se desactivan las actualizaciones automáticas y se migra solo entre fases.

## 11. Criterios de éxito generales

- Efecto activo a ≥ 55 FPS en el iPhone de prueba durante el arrastre.
- Los tres efectos seleccionables y controlables con un dedo.
- Foto con efecto guardada en galería y visible en el historial.
- Clip reproducido en bucle con efecto y frame guardable.
- Seis efectos disponibles; encadenado A/B funcional a ≥ 55 FPS.
- LFO, grabar/repetir gesto y giroscopio operativos.
- Importar, presets y compartir funcionando.
- GIF generado desde una foto con animación, guardado en galería e historial.

## 12. Restricciones confirmadas

- No se cuenta con Mac con Xcode ni con cuenta de Apple Developer: todo el desarrollo y las pruebas se hacen con Expo Go en iPhone físico.
- Sin build propio, el ícono y el splash configurados en `app.json` no se ven en Expo Go.
- Plazo: 9 a 12 semanas desde la fase 3; el plan se calculó para 12.
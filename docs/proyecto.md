# Glitch X/Y: instrumento de síntesis visual móvil

**Documento de proyecto (versión corregida, previa al SDD)**

## 1. Descripción del proyecto

Aplicación móvil en React Native (Expo) para iOS que permite capturar una fotografía o un clip corto de video (3-5 s) y aplicarle efectos de glitch analógico: aberración cromática, líneas de escaneo tipo CRT y corrupción de datos (datamosh simulado).

Los efectos se controlan con un gesto táctil de **un dedo** sobre la imagen: el eje X y el eje Y modifican dos parámetros del efecto activo en tiempo real. No hay sliders, botones ni menús superpuestos sobre la imagen; toda la pantalla funciona como un controlador continuo, al estilo de un VJ o de un instrumento de hardware modular.

## 2. Innovación

El paradigma de interacción: en lugar de editar con controles que desconectan al usuario de la imagen, la interfaz desaparece y el dedo se convierte en el control directo del efecto.

## 3. Justificación y complejidad técnica

- **Efectos escritos como shaders propios (SkSL), no filtros del sistema.** Los tres efectos se programan como `RuntimeEffect` de React Native Skia y se ejecutan en GPU. No se usan los filtros prefabricados de iOS ni de librerías de edición: el cálculo de desplazamiento de píxeles y canales de color es código propio.
- **Rendimiento a 60 FPS.** El gesto actualiza *shared values* de Reanimated en el hilo de UI, que alimentan directamente los uniforms del shader. Los valores del dedo nunca pasan por el estado de React.
- **Exportación a resolución completa.** El preview se renderiza a resolución reducida y la exportación se hace offscreen a resolución original.
- **Decisión de alcance.** Los efectos se aplican sobre una imagen congelada o un clip ya grabado, no sobre la cámara en vivo. Esto elimina el procesamiento de video en tiempo real y mantiene la innovación del control X/Y.

## 4. Entorno y stack tecnológico

**Principio:** desarrollo y pruebas 100 % en iPhone físico. No se usa emulador de Android.

| Capa | Tecnología |
| --- | --- |
| Framework | Expo (versión estable fijada al iniciar) + TypeScript |
| Ejecución en iPhone | Expo Go durante todo el proyecto (sin Development Build, sin Mac ni cuenta de desarrollador) |
| Navegación | `expo-router` |
| Cámara | `expo-camera` |
| Render de efectos | `@shopify/react-native-skia` (SkSL) |
| Gestos y animación | `react-native-gesture-handler` + `react-native-reanimated` |
| Estado de UI | Zustand (solo efecto seleccionado y modo) |
| Galería | `expo-media-library` |
| Historial | `expo-file-system` (`documentDirectory/creations`) + `index.json` de metadatos |
| Reproducción de video | `expo-video` o `useVideo` de Skia (se decide en el spike de la fase 6) |

**Regla de arquitectura:** `Gesture.Pan` → `useSharedValue` (x, y normalizados 0-1) → `useDerivedValue` → uniforms del shader. Prohibido `useState` para los valores del dedo.

**Versiones:** se fijan en la fase 0 y no se actualizan durante el semestre.

## 5. Funciones de la app

1. **Captura de cámara.** Pantalla principal con vista previa y un botón para tomar foto o grabar un clip de 3-5 s.
2. **Selector de efecto.** Tres efectos, cada uno seleccionable con un tap.
3. **Superficie de control X/Y (un dedo).** Sobre la imagen o clip capturado, arrastrar el dedo modifica dos parámetros del efecto activo en tiempo real.
4. **Guardado y exportación.** Guardar el resultado en la galería como imagen (foto con efecto o frame congelado del clip).
5. **Historial.** Pantalla con las últimas creaciones guardadas dentro de la app.

### 5.1 Definición de efectos y mapeo de ejes

| Efecto | Descripción | Eje X | Eje Y |
| --- | --- | --- | --- |
| Aberración cromática / separación RGB | Desplaza los canales R, G y B generando desincronización de color | Magnitud del desplazamiento (0 a \~3 % del ancho) | Ángulo de la dirección del desplazamiento (0°-360°) |
| Scanlines tipo CRT | Líneas horizontales semitransparentes con ruido leve | Densidad de líneas (80-400 por pantalla) | Cantidad de ruido superpuesto (0-1) |
| Datamosh simulado | Corta la imagen en franjas horizontales y desplaza cada una una cantidad distinta | Grosor de las franjas (mayor X = más gruesas) | Amplitud del desplazamiento por franja |

### 5.2 Comportamiento del control

- Al tocar y arrastrar, el efecto se actualiza de forma continua.
- Al soltar, los valores **se conservan** (no vuelven a cero).
- **Doble tap** restablece los valores por defecto.
- Solo se muestra un indicador mínimo (retícula discreta) que se oculta tras un breve periodo sin interacción.
- Control de **un solo dedo**. El multitáctil queda fuera de alcance.

## 6. Niveles de entrega

| Nivel | Estado | Contenido |
| --- | --- | --- |
| 1 | Obligatorio | Foto → efecto en tiempo real con el dedo → guardar PNG/JPG en galería → historial |
| 2 | Obligatorio | Clip de 3-5 s reproducido en bucle con efecto en vivo controlado con el dedo. Se guarda un **frame congelado** como imagen; el clip original sin procesar queda en el historial |

El proyecto se compone de estos dos niveles. No se exporta video con efecto aplicado.

## 7. Fuera de alcance

- Multitáctil.
- Efectos sobre la cámara en vivo.
- Exportación de video con efecto aplicado (requeriría código nativo y Development Build).
- Audio-reactividad con FFT, sampler tipo MPC, secuenciador por pasos y salida OSC / modo escenario para VJing.

## 8. Trabajo futuro

- Efectos sobre la **cámara en vivo**, incluido un efecto de retroalimentación (feedback loop). Requiere `react-native-vision-camera` con frame processors + Skia, es decir, Development Build y código nativo, que no están disponibles en este proyecto. No forma parte del semestre.
- Exportación de video con efecto y las ideas de audio y VJing de la sección 7.

## 9. Plan por fases (16 semanas)

| Fase | Semanas | Entregable verificable en iPhone |
| --- | --- | --- |
| 0. Setup | 1 | Proyecto Expo + TS corriendo en Expo Go; permisos de cámara y galería funcionando |
| 1. Captura | 2-3 | Pantalla de cámara, tomar foto y mostrarla en un canvas de Skia |
| 2. Spike de shaders | 4-5 | Aberración cromática en SkSL sobre la foto con dos *shared values* fijos; medición de FPS |
| 3. Superficie X/Y | 6-7 | Pan gesture ligado a uniforms; efecto fluido a 60 FPS; doble tap = reset |
| 4. Efectos 2 y 3 | 8-10 | Scanlines y Datamosh con selector por tap |
| 5. Guardado e historial | 11-12 | Exportar foto con efecto (`makeImageSnapshot` → archivo → galería) y pantalla de historial |
| 6. Video Nivel 2 | 13-14 | Grabar clip, reproducir en bucle con efecto y guardar frame |
| 7. Cierre | 15-16 | Pruebas, pulido y presentación |

## 10. Riesgos y mitigación

1. **Rendimiento con fotos de alta resolución.** Reducir a \~2048 px en el lado largo para el preview; renderizar a resolución completa solo al exportar.
2. **Exportación a resolución original con Skia offscreen.** Se valida en la fase 5, no al final.
3. **Incompatibilidades de versiones (Expo / Skia / Reanimated).** Versiones fijadas en la fase 0 y sin actualizaciones durante el semestre.
4. **Reproducción de video con shader.** Spike temprano en la fase 6 para elegir entre `expo-video` y `useVideo` de Skia.

## 11. Criterios de éxito generales

- Efecto activo a ≥ 55 FPS en el iPhone de prueba durante el arrastre.
- Los tres efectos seleccionables y controlables con un dedo.
- Foto con efecto guardada en galería y visible en el historial.
- Clip reproducido en bucle con efecto y frame guardable.

## 12. Restricciones confirmadas

- No se cuenta con Mac con Xcode ni con cuenta de Apple Developer: todo el desarrollo y las pruebas se hacen con Expo Go en iPhone físico.
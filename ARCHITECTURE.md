# Arquitectura de SynthVJ

La fuente de verdad es `docs/sdd v2.md` (SDD v1.0). Este archivo resume lo que una persona o un asistente de IA debe saber antes de tocar el código. Si algo aquí contradice al SDD, manda el SDD.

## Plataforma

- Expo SDK 58, Expo Go como único entorno (ADR-01). Sin código nativo propio ni librerías nativas de terceros.
- Rutas de Expo Router en `src/app/` (lo exige `AGENTS.md`).

## Capas

El código está en capas. Cada capa solo importa de las que están **debajo** de ella en la tabla, nunca de las de arriba.

| Capa | Qué hace | Archivos clave |
| --- | --- | --- |
| `src/app/` | **Rutas.** Cada archivo es una pantalla de Expo Router. Junta UI, lienzo y acciones; casi no tiene lógica propia. | `(tabs)/index` (Cámara), `(tabs)/editor`, `(tabs)/gallery` |
| `src/ui/` | **Interfaz.** Componentes visuales: `kit/` (botones, hojas), `camera/`, `editor/` (paneles y su pila), `gallery/`, tokens de diseño. No dibuja la imagen. | `tokens.ts`, `editor/panels.ts` |
| `src/canvas/` | **Lienzo en vivo.** La vista Skia del editor y del modo escenario: gestos, zoom, pincel en tiempo real, modulación en el hilo de UI. | `EditorCanvas.tsx`, `StageView.tsx` |
| `src/actions/` | **Casos de uso.** Lo que hace el usuario de principio a fin: capturar, exportar JPG/GIF/.synthfx, guardar, salir sin guardar. Coordina estado, render, proyecto y plataforma. | `captureActions`, `exportActions`, `projectActions`, `leaveGuard` |
| `src/state/` | **Estado en memoria.** Stores de Zustand: la escena activa (con deshacer/rehacer) y los ajustes de la app. | `sceneStore.ts`, `activeScene.ts`, `undo.ts` |
| `src/render/` | **Dibujar una escena.** El mismo árbol de Skia sirve para la vista previa, las miniaturas y la exportación fuera de pantalla. | `SceneRenderer.tsx`, `renderPreviews.ts` |
| `src/engine/` | **Motor gráfico (puro).** Shaders SkSL, registro de efectos y generadores, render graph, recorte, costo por capa. | `registry.ts`, `renderGraph.ts` |
| `src/modulation/` | **Modulación (puro).** Fuentes (LFO, ADSR, micrófono…), curvas, tempo, filtro One Euro: convierte tiempo y entradas en valores de parámetros. | `evaluate.ts`, `sources.ts` |
| `src/paint/` | **Pincel.** Interpolación de trazos y raster de sellos sobre la imagen. | `brushEngine.ts` |
| `src/project/` | **Persistencia.** Esquema y migraciones del proyecto, guardado en disco, galería, formato `.synthfx`. | `schema.ts`, `storage.ts` |
| `src/platform/` | **Adaptadores de Expo.** Fotos, selector de medios, micrófono, pantalla, hápticos, archivos de ajustes. | `photos.ts`, `useMicMeter.ts` |
| `src/domain/` | **Contrato de datos (puro).** Los tipos del SDD 6.1: `Scene`, `Layer`, `Route`, `Project`… Todas las capas hablan con estos tipos. No importa nada. | `types.ts` |

Fuera de las capas:

- `src/dev/`: PerfHud, laboratorios de prueba y spikes. Solo en desarrollo.
- `src/legacy/`: código anterior al SDD v2, solo de referencia; se borra al cerrar M10.

### Cómo fluye una edición

```
gesto (canvas) → modulación (modulation) → uniforms del shader (engine) → pantalla
                       ↓ al soltar el gesto
                 store de la escena (state) → guardar / exportar (actions → render, project, platform)
```

### Reglas que comprueba el lint

- `domain`, `engine` y `modulation` son puros: sin React, Expo ni Zustand (Skia sí).
- Nada importa desde `src/legacy/`.
- En el hilo de UI (worklets y callbacks de gestos) no se toca el store ni `setState`.

## Principios clave

1. La imagen es una función pura de `(escena, tiempo, entradas, semilla, resolución)`; preview, JPG y GIF salen del mismo árbol.
2. El camino gesto → modulación → uniforms vive en el hilo de UI; el hilo de JS solo recibe una confirmación por gesto.
3. Edición no destructiva: el original nunca se modifica.
4. Los tipos de la sección 6.1 del SDD son el contrato; no se cambian sin actualizar el SDD.

## Decisiones tomadas en M0

| Fecha | Decisión |
| --- | --- |
| 2026-11-03 | SDK 58 en lugar de 57 (ADR-01 actualizado en el SDD) |
| 2026-11-03 | Rutas en `src/app/(tabs)/` en lugar de `app/(tabs)/` |
| 2026-11-03 | El código anterior se mueve a `src/legacy/` como referencia en lugar de reutilizarse |

## Flujo de trabajo

- Un hito por rama (`feature/v2-mN-...`) y un commit por funcionalidad.
- Plan de archivos e interfaces aprobado antes de programar.
- Antes de cada commit: `npx tsc --noEmit`, `npx expo lint` y `npm test`.

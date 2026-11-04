# Arquitectura de SynthVJ

La fuente de verdad es `docs/sdd v2.md` (SDD v1.0). Este archivo resume lo que una persona o un asistente de IA debe saber antes de tocar el código. Si algo aquí contradice al SDD, manda el SDD.

## Plataforma

- Expo SDK 58, Expo Go como único entorno (ADR-01). Sin código nativo propio ni librerías nativas de terceros.
- Rutas de Expo Router en `src/app/` (lo exige `AGENTS.md`).

## Módulos y reglas de dependencia

```
src/app/        rutas: (tabs)/index (Cámara), (tabs)/editor, (tabs)/gallery
src/ui/         pantallas, paneles, componentes, tokens        (no conoce Skia ni archivos)
src/editor/     vista, gestos, gestor de superposiciones, paneles
src/state/      store de la escena (Zustand), deshacer, tipos
src/engine/     render graph, shaders, registro, layerCost, evaluate   (puro: sin React ni Expo)
src/modulation/ fuentes, rutas, One Euro, tempo                        (puro: sin React ni Expo)
src/paint/      motor del pincel, raster de sellos, interpolación de trazos
src/project/    esquema, migraciones, autoguardado, galería, .synthfx
src/platform/   adaptadores de Expo: cámara, micrófono, sensores, pantalla
src/dev/        perfHud y testLab (solo en desarrollo)
src/legacy/     código anterior al SDD v2, solo como referencia; se borra al cerrar M10
```

- `ui → app → (engine, modulation, project)`.
- `platform` solo lo usan `app` y los adaptadores de `modulation`.
- `engine` y `modulation` no importan React ni módulos de Expo (lo comprueba el lint).
- Nada importa desde `src/legacy/`.

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

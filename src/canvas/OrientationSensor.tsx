import { useEffect } from "react";
import { SensorType, useAnimatedSensor, useFrameCallback, useSharedValue } from "react-native-reanimated";

import { oneEuro, type OneEuroState } from "../modulation/oneEuro";
import { normalize, relativeTilt, type Vec3 } from "../modulation/orientation";
import type { ModBus } from "./modBus";

// lee la gravedad en el hilo de UI y escribe en el bus la inclinación relativa a la posición
// neutral, filtrada con One Euro. Se monta solo mientras alguna capa usa GIRO (ahorra batería).
// La neutral se toma de la primera lectura y cada vez que el bus pide recalibrar
export function OrientationSensor({ bus }: { bus: ModBus }) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: "auto" });
  const neutral = useSharedValue<Vec3 | null>(null);
  const seenCalibration = useSharedValue(-1);
  const fx = useSharedValue<OneEuroState>(null);
  const fy = useSharedValue<OneEuroState>(null);
  const { oriX, oriY, oriAvailable } = bus;

  useEffect(() => {
    oriAvailable.set(gravity.isAvailable ? 1 : 0);
    return () => {
      oriX.set(0);
      oriY.set(0);
    };
  }, [gravity.isAvailable, oriAvailable, oriX, oriY]);

  useFrameCallback((info) => {
    const g = normalize(gravity.sensor.get());
    if (g === null) return;
    const cal = bus.oriCalibrate.get();
    const n0 = neutral.get();
    if (n0 === null || cal !== seenCalibration.get()) {
      neutral.set(g);
      seenCalibration.set(cal);
      fx.set(null);
      fy.set(null);
      bus.oriX.set(0);
      bus.oriY.set(0);
      return;
    }
    const tilt = relativeTilt(n0, g);
    const t = info.timeSinceFirstFrame / 1000;
    const x = oneEuro(fx.get(), tilt.x, t);
    const y = oneEuro(fy.get(), tilt.y, t);
    fx.set(x.state);
    fy.set(y.state);
    bus.oriX.set(x.value);
    bus.oriY.set(y.value);
  });

  return null;
}

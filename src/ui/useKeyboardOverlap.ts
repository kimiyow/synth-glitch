import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, LayoutAnimation, type KeyboardEvent, type View } from "react-native";

// cuánto tapa el teclado a una vista, medido en la ventana. KeyboardAvoidingView usa su posición
// dentro del padre, así que bajo una barra superior se quedaba corto por el alto de esa barra y el
// teclado tapaba el campo. El relleno se anima con la misma curva del teclado
export function useKeyboardOverlap() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const animate = (e: KeyboardEvent) => {
      if (e.duration > 0) LayoutAnimation.configureNext(LayoutAnimation.create(e.duration, LayoutAnimation.Types.keyboard, LayoutAnimation.Properties.scaleY));
    };
    const onFrame = (e: KeyboardEvent) => {
      const top = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => {
        animate(e);
        setOverlap(Math.max(0, Math.round(y + h - top)));
      });
    };
    const onHide = (e: KeyboardEvent) => {
      animate(e);
      setOverlap(0);
    };
    const subs = [
      Keyboard.addListener("keyboardWillShow", onFrame),
      Keyboard.addListener("keyboardWillChangeFrame", onFrame),
      Keyboard.addListener("keyboardWillHide", onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return { ref, overlap };
}

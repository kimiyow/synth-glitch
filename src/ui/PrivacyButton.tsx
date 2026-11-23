import { useState } from "react";

import { IconButton } from "./kit/IconButton";
import { PrivacyNotice } from "./PrivacyNotice";

// acceso permanente al aviso de privacidad (candado en las cabeceras de Cámara, Editor y Galería)
export function PrivacyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="lock.shield" label="Aviso de privacidad" size={36} bare onPress={() => setOpen(true)} />
      {open && <PrivacyNotice onClose={() => setOpen(false)} />}
    </>
  );
}

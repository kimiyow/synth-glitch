import { Redirect } from "expo-router";

import { DEV_TOOLS_ENABLED } from "../dev/devTools";
import { TestLab } from "../dev/TestLab";

export default function TestLabScreen() {
  if (!DEV_TOOLS_ENABLED) {
    return <Redirect href="/" />;
  }
  return <TestLab />;
}

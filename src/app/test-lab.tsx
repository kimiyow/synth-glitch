import { Redirect } from "expo-router";

import { TestLab } from "../dev/TestLab";

export default function TestLabScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <TestLab />;
}

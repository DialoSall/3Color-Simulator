import { BrowserRouter, HashRouter } from "react-router-dom";
import { IS_CRAZYGAMES } from "./platform.js";

export default function PlatformRouter({ children }) {
  return IS_CRAZYGAMES ? <HashRouter>{children}</HashRouter> : <BrowserRouter>{children}</BrowserRouter>;
}

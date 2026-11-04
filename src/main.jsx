import React from "react";
import ReactDOM from "react-dom/client";
import PlatformRouter from "./PlatformRouter.jsx";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import "./App.css";
import { IS_CRAZYGAMES } from "./platform.js";

if (IS_CRAZYGAMES) {
  document.documentElement.dataset.platform = "crazygames";
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PlatformRouter>
      <App />
      {!IS_CRAZYGAMES && <Analytics />}
    </PlatformRouter>
  </React.StrictMode>
);

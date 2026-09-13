import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";

const root = document.querySelector("#app");
if (!root) throw new Error("缺少 #app 挂载点");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

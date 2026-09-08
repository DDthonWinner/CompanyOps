import React from "react";
import ReactDOM from "react-dom/client";
import { ScrollWorld } from "./features/world/ScrollWorld";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ScrollWorld />
  </React.StrictMode>,
);

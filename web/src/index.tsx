/* @refresh reload */
import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";

import { router } from "./router";
import "./index.css";

const root = document.getElementById("root")!;
root.replaceChildren(); // drop the static placeholder from index.html
render(() => <RouterProvider router={router} />, root);

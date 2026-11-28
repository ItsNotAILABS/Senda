import { installSendBuffer } from "@/lib/buffer-polyfill";
import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

installSendBuffer();

export function getRouter() {
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent });
}

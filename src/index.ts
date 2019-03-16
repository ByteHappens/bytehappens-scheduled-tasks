require("module-alias/register");

import { runtimes } from "bytehappens";

import { RuntimeFactory } from "./factories/runtimefactory";

let runtimeFactory = new RuntimeFactory();
runtimeFactory.CreateRuntimeAsync().then(async (runtime: runtimes.core.IRuntime) => {
  if (runtime) {
    await runtime.RunAsync();
  }
});

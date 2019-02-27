require("module-alias/register");

import { runtimes } from "bytehappens";

import { RuntimeFactory } from "./runtimefactory";

let runtimeFactory = new RuntimeFactory();
runtimeFactory.CreateRuntimeAsync().then(async (runtime: runtimes.core.IRuntime) => {
  if (runtime) {
    await runtime.RunAsync();
    //  SCK: REMOVE THIS
    console.log("REMOVE THIS: Checking this is reached");
    //  SCK: Test forcing exit
    process.exit(0);
  }
});

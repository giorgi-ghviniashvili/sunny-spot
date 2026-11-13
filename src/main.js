import { App } from "./app.js";
import { Config } from "./config.js";

new App(Config.fromEnvironment()).start();

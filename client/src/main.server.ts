import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

// context is provided by the SSR engine (Angular 21+) and must be forwarded
const bootstrap = (context?: BootstrapContext) => bootstrapApplication(App, config, context);

export default bootstrap;

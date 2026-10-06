import { started } from './started.ts';

const own = new URL(import.meta.url);
const bundle = new URL(own.pathname.replace(/-loader\.js$/u, '.js'), own);
bundle.search = own.search;
await started();
await import(bundle.href);

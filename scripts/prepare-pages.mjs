import {cp,rm} from 'node:fs/promises';
// Only the generated Pages output folder is replaced.
await rm(new URL('../docs/',import.meta.url),{recursive:true,force:true});
await cp(new URL('../dist/',import.meta.url),new URL('../docs/',import.meta.url),{recursive:true});
console.log('Prepared docs/ for GitHub Pages (main branch).');

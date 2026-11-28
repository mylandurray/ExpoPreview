// Worker entry for older browsers: polyfills first, then pdf.js's legacy worker.
import './pdfPolyfills.js'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'

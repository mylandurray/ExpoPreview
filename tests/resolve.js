// Match Vite's extensionless source imports for Node's built-in test runner.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    return next(`${specifier}.js`, context)
  }
  return next(specifier, context)
}

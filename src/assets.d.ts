// Image imports resolved by Vite to a hashed URL string.
declare module '*.webp' {
  const src: string;
  export default src;
}

// Vite's import.meta.glob (only the eager, default-import form this project uses).
interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options: { eager: true; import: 'default' },
  ): Record<string, T>;
}

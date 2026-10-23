/**
 * Lee una variable de entorno sin los espacios ni saltos de línea de los
 * bordes. Al pegar una clave en el panel de Vercel (o al cargarla por la
 * terminal) es muy fácil que se cuele uno, y el proveedor responde 401 como si
 * la clave fuera inválida. Una variable vacía cuenta como no definida.
 */
export function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

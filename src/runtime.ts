/** True when running on Vercel / other ephemeral serverless. */
export function isServerless(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

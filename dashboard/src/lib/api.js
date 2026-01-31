export const BACKEND = process.env.NEXT_PUBLIC_BACKEND_HTTP;

export async function apiGet(path) {
  const res = await fetch(`${BACKEND}${path}`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

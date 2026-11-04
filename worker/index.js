import { DurableObject } from "cloudflare:workers";

// Keeps the writes inside Cloudflare's free limit however often someone presses
const COOLDOWN_MS = 10_000;

// Stores one number. Who pressed is never kept.
export class Pets extends DurableObject {
  lastPet = 0;

  async count() {
    return (await this.ctx.storage.get("count")) ?? 0;
  }

  async pet() {
    const count = await this.count();
    if (Date.now() - this.lastPet < COOLDOWN_MS) {
      return count;
    }
    this.lastPet = Date.now();
    await this.ctx.storage.put("count", count + 1);
    return count + 1;
  }
}

const page = (count) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Pet Clawd</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-content: center; padding: 16px; box-sizing: border-box;
    text-align: center; font-family: system-ui, sans-serif; background: Canvas; color: CanvasText; }
  .clawd { font-size: 96px; line-height: 1; }
  p { opacity: 0.7; }
</style>
<div class="clawd">🦀</div>
<h1>You petted Clawd!</h1>
<p>Clawd felt that and is telling everyone. That's ${count} pet${count === 1 ? "" : "s"} so far.</p>
<p id="close" hidden>You can close this tab now.</p>
<script>
  // Browsers only allow this for a tab with no history, otherwise the page just stays
  window.close();
  setTimeout(() => { document.getElementById("close").hidden = false; }, 500);
</script>
</html>`;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method !== "GET" || (pathname !== "/pet" && pathname !== "/count")) {
      return new Response("Not found", { status: 404 });
    }
    const pets = env.PETS.get(env.PETS.idFromName("clawd"));
    const headers = { "cache-control": "no-store" };
    if (pathname === "/count") {
      return Response.json({ count: await pets.count() }, { headers });
    }
    return new Response(page(await pets.pet()), { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  },
};

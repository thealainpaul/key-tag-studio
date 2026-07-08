=== BIK Custom Key Tag ===
Contributors: bik-ag
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

WooCommerce integration for the BIK Custom Key Tag designer studio. Self-contained: does not modify themes or other plugins.

== Description ==

Adds:

* Settings under WooCommerce → BIK Custom Key Tag
* Cart add-to-cart from studio redirects / REST
* Design ID + preview on cart, checkout, and orders
* Paid-order notification emails (processing or completed)
* Order admin meta box to download design preview / open studio
* Shortcode `[bik_custom_key_tag_designer]` to embed the studio

== Installation ==

1. Copy the folder `bik-custom-key-tag` into `wp-content/plugins/` on the WordPress site (or zip the folder and use Plugins → Add New → Upload).
2. In WP Admin go to Plugins and activate **BIK Custom Key Tag**.
3. WooCommerce must already be active.
4. Open **WooCommerce → BIK Custom Key Tag** and confirm defaults (emails, studio URL, shared secret). Fill in the WooCommerce product ID after creating the product.

On activation the plugin generates a shared secret (stored in options). Configure the same secret on the Key Tag Studio server when the studio `/api/designs/{id}` endpoint is implemented.

== Owner navigation instructions ==

1. Install / activate
   - Plugins → Activate “BIK Custom Key Tag”.
   - Settings live at WooCommerce → BIK Custom Key Tag.

2. Set product ID after creating the Woo product
   - Create a simple WooCommerce product (e.g. “Design Your Own Key Tag”).
   - Copy its product ID from the product list / edit URL (`post=123`).
   - Paste that ID into WooCommerce → BIK Custom Key Tag → “WooCommerce product ID” → Save.

3. Change notification emails
   - WooCommerce → BIK Custom Key Tag → “Notification emails”.
   - Comma-separated list, e.g. `info@bik-ag.ch, sergio.habegger@gmail.com, bestellungen@bik-ag.ch`.
   - Save settings.

4. Change email trigger (Processing vs Completed)
   - Same settings page → “Email trigger”.
   - Use **processing** (default) for most paid-card flows.
   - Use **completed** only if your shop marks these orders Completed when paid.
   - Save settings.

5. Change product price
   - WooCommerce → Products → edit the Design Your Own product.
   - Set Regular price as usual → Update.
   - (The plugin does not override product pricing.)

6. Find custom design download on an order
   - WooCommerce → Orders → open the order.
   - Right-side meta box **Custom key tag design**: Design ID, thumbnail, Download preview, link to studio admin.

7. Change service years text on the product page
   - Edit the product Description / short description in WooCommerce (normal product editor).
   - The “Service years display” field on the plugin settings page is documentation only (default note: 4).

== Embedding the designer ==

Add this shortcode to any page or product description:

`[bik_custom_key_tag_designer]`

Optional: `[bik_custom_key_tag_designer height="900"]`

The iframe loads: `{studio_base_url}/?lang={en|de|fr|it}&embed=1&cart_return={urlencoded site home}`

Language is detected from WPML, Polylang, or the WordPress locale (fallback `de`).

== Studio redirect / add to cart ==

After the customer finishes a design, the studio should redirect to one of:

* `https://YOUR-SITE/?bik_ckt_design={DESIGN_ID}`
* Legacy: `https://YOUR-SITE/?bik_add_custom_tag=1&design_id={DESIGN_ID}`
* REST (browser): `https://YOUR-SITE/wp-json/bik-ckt/v1/add-to-cart?design_id={DESIGN_ID}`

All of these validate the design ID, optionally GET `{studio}/api/designs/{id}` with the shared secret (`Authorization: Bearer …` and `X-BIK-CKT-Secret`), add the configured product to the cart with `bik_design_id` / `bik_design_preview_url`, and redirect to the cart.

Expected studio stub response shape:

`GET /api/designs/{id}` → JSON with `previewUrl` / `preview_url` / `previewDataUrl` (or nested under `design`).

== iframe / CSP note (studio must allow framing) ==

WordPress cannot force the studio to allow embeds. On the Key Tag Studio host, set headers so `bik-ag.ch` (and staging) may frame the app, for example:

* `Content-Security-Policy: frame-ancestors 'self' https://bik-ag.ch https://www.bik-ag.ch;`
* Avoid `X-Frame-Options: DENY` / `SAMEORIGIN` if those block the shop domain.

Document any CDN/proxy (e.g. Render) so those headers are not stripped.

== Security notes ==

* Settings require `manage_woocommerce`.
* Shared secret is stored in WP options and used only server-side for studio API calls — not exposed in the shortcode / frontend JS.
* Design IDs are sanitized; downloads use capability checks and nonces.
* This plugin only adds hooks/features; it does not rewrite theme files or other plugins.

== Changelog ==

= 1.0.0 =
* Initial release: settings, cart redirect/REST, emails, admin meta box, shortcode.

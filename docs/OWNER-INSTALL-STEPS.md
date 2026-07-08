# Owner: install BIK Custom Key Tag add-on on bik-ag.ch

Cursor cannot always open live wp-admin from here (security popup may never appear). Do these steps in the side browser or your WP session — then tell the agent “add-on is active” so setup continues.

## 1) Upload the add-on (2 minutes)

1. Open: https://bik-ag.ch/wp-admin/plugin-install.php?tab=upload
2. Click **Choose File**
3. Select this zip on this PC:

   `C:\Users\alain\key-tag-studio\wordpress-plugin\bik-custom-key-tag.zip`

4. Click **Install Now** → **Activate**

## 2) Open settings

**WooCommerce → BIK Custom Key Tag**

Leave emails as:
`info@bik-ag.ch, sergio.habegger@gmail.com, bestellungen@bik-ag.ch`

Copy the **Shared secret** shown — you will paste the same value into Render env `BIK_WP_SHARED_SECRET` after studio deploy.

## 3) After studio is deployed on Render

Create product **Design Your Own Key Tag**, price **CHF 100**, put shortcode in description:

`[bik_custom_key_tag_designer]`

Paste product ID into the add-on settings.

Then: Appearance → Menus → under Products add:
- Key Placards (existing)
- Design Your Own
- Business (new info page)

## Do not

- Change checkout theme
- Edit existing placard products
- Touch Contact Form 7 editor (known admin critical error; public Kontakt page works)

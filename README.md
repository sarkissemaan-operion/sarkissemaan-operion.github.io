# OPERION Advisory — website

Static multi-page site (plain HTML/CSS/JS, no build step) for operionadvisory.com.

## Structure

```
index.html        Home
about.html         About / founder
expertise.html     Six capability areas + proof points
services.html      Engagement models + delivery process
insights.html       Perspectives / thought leadership
contact.html       Contact form + direct details
css/style.css      Design system (bold color-block, navy + signal red)
js/main.js         Nav toggle, footer year, contact form handler
assets/            Favicon + place your OPERION_Advisory_Profile.pdf here
CNAME              Custom domain: operionadvisory.com
```

## Deploy on GitHub Pages

1. Create a new GitHub repository (e.g. `operion-site`), or reuse your existing one.
2. Push the contents of this folder to the repo's default branch (`main`):
   ```bash
   cd operion-site
   git init
   git add .
   git commit -m "New OPERION Advisory site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, folder `/ (root)`. Save.
4. Custom domain: the `CNAME` file already contains `operionadvisory.com`. In
   **Settings → Pages → Custom domain**, confirm it shows `operionadvisory.com` and enable
   **Enforce HTTPS** once the certificate is issued.
5. At your domain registrar, point DNS at GitHub Pages (if not already done from the old site):
   - `A` records for the apex domain to GitHub's Pages IPs (185.199.108.153, .109.153, .110.153, .111.153), or
   - a `CNAME` record for `www` → `<your-username>.github.io`.

## Before going live

- **Contact form:** the form in `contact.html` posts to a placeholder Formspree URL
  (`https://formspree.io/f/your-form-id`). Create a free form at
  [formspree.io](https://formspree.io) (or use Netlify Forms if you host there instead)
  and replace the `action` attribute with your real endpoint.
- **PDF profile:** `about.html` and `contact.html` link to
  `assets/OPERION_Advisory_Profile.pdf`. Add your actual profile PDF at that path, or
  remove the link if you don't want to offer a download yet.
- **Favicon:** a simple placeholder `O` mark is included at `assets/favicon.svg`. Swap in
  a real logo mark if you have one.

## Editing content

There's no templating — each page repeats its own header/footer. When you change nav
links or footer text, update all six HTML files. Fonts (Inter, via Google Fonts) and all
colors/spacing live in `css/style.css` under the `:root` variables at the top.

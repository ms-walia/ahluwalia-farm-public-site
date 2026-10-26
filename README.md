# Ahluwalia Farm

Website for Ahluwalia Farm, Amritsar: raw farm honey and cage-free eggs. Static site (HTML, CSS, JS), no build step.

- `index.html`: the main site (scroll animations with GSAP and Lenis)
- `orders.html`: cart, saved addresses and WhatsApp checkout
- `app.js`: cart, test login and delivery quote logic

## Before going live
- Login uses a **test code (123456)**. Connect a real SMS OTP service (Firebase or MSG91).
- Delivery charges in `app.js` are placeholder zone rates. Replace with the courier's real rates.
- Reviews are sample cards. Add real ones in the `scene:reviews` script in `index.html` and set `SHOW_SAMPLES` to `false`.

## Deploy
Static hosting, for example Vercel: import the repo, framework preset **Other**, no build command, output directory `.`.

Template: ONDO by 8B (MIT). See `CREDITS.md` and `LICENSE`.

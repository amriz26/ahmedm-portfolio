# portfolio

Ahmed Mriziq's personal site, live at **https://amriz26.github.io/portfolio/**. A static page (HTML, CSS, vanilla JS) with one idea: the page **detects** what your cursor is on, like a computer-vision model drawing a box around an object. It's a nod to [AirMouse](https://github.com/amriz26/AirMouse).

The hero name is drawn as a cloud of landmark points sampled from the letters and joined like a hand-tracking skeleton. Push them with your cursor or finger, and they spring back into place.

## Run locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Notes

- No build step and no dependencies. Fonts come from Google Fonts.
- Motion is turned off for visitors who set `prefers-reduced-motion`.
- On touch screens, tapping an element frames it.

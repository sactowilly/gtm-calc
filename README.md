# GTM Quote Calculator

A simple USD quote calculator for packaging sales. It calculates landed cost, GTM dollars, and GTM percent, then builds a quote that can be copied or opened in the default email app.

![GTM Quote Calculator](assets/gtm-calc-icon.png)

## Live App

GitHub Pages URL: https://sactowilly.github.io/gtm-calc/

## What It Calculates

- Landed unit cost = unit cost + freight per unit
- GTM$ = `(price - landed unit cost) * qty`
- GTM% = `(price - landed unit cost) / landed unit cost * 100`

All costs, prices, freight, totals, and GTM dollar values are USD.

## Features

- Add item name, qty, unit cost, price, and optional freight.
- Treat freight as either per-item freight or total freight amortized across qty.
- Add and delete quote line items.
- View customer name, quote date, order total, total cost, total GTM$, and line-item details.
- Save the active quote locally in the browser.
- Copy quote text or open it in the default email app.

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server.

```bash
npx serve .
```

## Files

- `index.html` - app markup
- `css/main.css` - responsive styling
- `js/main.js` - calculator, quote state, local save, copy, and email behavior
- `assets/gtm-calc-icon.png` - 1280x640 project image

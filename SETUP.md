# Setting up Plop on GitHub

This puts Plop online at `https://YOUR-NAME.github.io/plop/` and refreshes its products every morning. It's free and takes about 10 minutes. You only do it once.

## What's in this folder

| File | What it does |
|---|---|
| `index.html`, `app.js` | The Plop page |
| `products.js` | The products. Rebuilt automatically every morning, so never edit it by hand |
| `shops.json` | The list of shops Plop reads. Edit this to add or remove shops |
| `scripts/build.cjs` | Reads each shop's product list and writes `products.js` |
| `.github/workflows/refresh.yml` | Tells GitHub to run the refresh every morning |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## 1. Create the repository

1. Sign in at github.com.
2. Click **+** (top right), then **New repository**.
3. Name it `plop`, choose **Public**, and leave everything else unticked.
4. Click **Create repository**.

## 2. Upload the files

The `.github` folder and `.nojekyll` file are hidden on a Mac, so make them visible first:

1. Unzip the folder, then open it in Finder.
2. Press **⌘ Shift .** (Command, Shift, full stop). Hidden files appear greyed out.
3. On the new repository's page, click **uploading an existing file**.
4. Select **everything inside** the folder, including `.github` and `.nojekyll`, and drag it onto the upload area.
5. Click **Commit changes**.

Check that the repository now shows a `.github` folder. If it doesn't, see "If the .github folder didn't upload" below.

## 3. Let the refresh save its work

1. In the repository, go to **Settings**, then **Actions**, then **General**.
2. Under **Workflow permissions**, choose **Read and write permissions**.
3. Click **Save**.

## 4. Turn on the website

1. Go to **Settings**, then **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`, then click **Save**.
4. After a minute or two, the page shows your address: `https://YOUR-NAME.github.io/plop/`.

## 5. Run the first refresh

1. Open the **Actions** tab. If GitHub asks, click to enable workflows.
2. Click **Refresh products**, then **Run workflow**, then the green **Run workflow** button.
3. After 1–2 minutes it shows a green tick. Click into the run, then **Read the shops' product lists**, to see a line per shop, for example `✓ Alpha60: 252 products`.

From now on it runs by itself every morning at about 5–6am Sydney time.

## Adding or removing a shop

1. Open `shops.json` in the repository and click the pencil icon to edit.
2. Copy a line and change the name and address, for example:
   `{ "name": "Bassike", "host": "www.bassike.com" },`
   Every line except the last needs a comma at the end.
3. Click **Commit changes**, then run the refresh from the Actions tab (step 5) to see it straight away.

A shop only works if it's a Shopify store with prices in AUD. To check, open `https://SHOP-ADDRESS/products.json` in a browser. A page starting with `{"products":[` means it's Shopify. The refresh log tells you if a shop's prices aren't in AUD, and skips it.

## If something goes wrong

- **A red cross in Actions:** open the run and read the log. A line starting with ✗ names the shop and the problem. That shop keeps yesterday's products, so the page still works.
- **The refresh stops running:** GitHub pauses scheduled jobs on repositories with no activity for 60 days, and emails you when it does. Re-enable it in the Actions tab.
- **If the .github folder didn't upload:** click **Add file**, then **Create new file**, and type `.github/workflows/refresh.yml` as the name. Paste in the contents of that file from the folder, then click **Commit changes**.

## Good to know

- The repository is public, so anyone can see the code and the shop list. There's nothing personal in it. Each visitor's wishlist stays in their own browser.
- Plop reads each shop's public product list once a day, one page at a time, a second apart. Every product links back to the shop.

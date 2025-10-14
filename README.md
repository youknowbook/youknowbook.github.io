# You-Know-Book

Budapest legjobb könyvklubja, Nikol vezetésével.
Két-havonta találkozunk, másfél órát beszélgetünk.
Pontozunk és jól érezzük magunkat.

## 🚀 Feature-ök

* **Autentikáció**: Email és jelszó belépés, továbbá speciális kulcs a tagoknak.
* **Profil**: Tölts fel profilképet (Supabase Storage), add meg a kedvenc idézeted és 4 kedvenc könyvedet (Google Books API segítségével)!
* **Könyvek**:

  * **Olvasottak**: A már olvasott könyvek listája, értékelése, színezése és rendszerezése.
  * **Várólista**: Bármelyik tag hozzáadhat könyvet, ajánlót is írhat hozzá és tölthet fel borítót (ha nincs a Google Booksban).
* **Főoldal**: A találkozók véglegesítése, szavazási opciók (időpont, könyv), valamint részvétel jelezése, kérdések írása és egyéb interakciók.
* **Tagok**: A tagok kedvenceikkel együtt megtekinthetők, szintjük jelzi, hogy hányszor jöttek el.
* **Statisztika**: Fancy vizualizációk:

  * Térkép a könyvekről
  * Idővonal a könyvekről
  * Az írók nemi megoszlása
  * Az olvasott műfajaink gykorisága
  * Egy kis könyvespolc (Chakra UI render)

## 🛠 Tech dolgok

* **Frontend**: [Vite](https://vitejs.dev/) + [React](https://reactjs.org/) + [Chakra UI](https://chakra-ui.com/docs/components/concepts/overview)
* **Backend**: [Supabase](https://supabase.com/) (Autentikáció, Adatbázis, Tárhely)
* **API-ok**: Google Books API a könyvkereséshez
* **Deploy**: GitHub Pages

## 📦 Hogyan használd?

### 1. Klónozd a repo-t

```bash
git clone https://github.com/<your-username>/you-know-book.git
cd you-know-book
```

### 2. Installáld a dependenciákat

```bash
npm install
```

### 3. egy env.-ven add hozzá a kulcsaidat

Create a `.env.local` file in the project root and add:

```ini
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_BOOKS_API_KEY=your_google_books_api_key
```

### 4. Helyi futtatás

```bash
npm run dev
```

Nyisd meg a [http://localhost:5137](http://localhost:5137) oldalt a böngészőben.

## 📐 Projekt Struktúra

```
you-know-book/
├─ public/            # Statikus elemek
├─ src/
│  ├─ api/            # Supabase hozzáférés
│  ├─ components/     # Néhány újrahasználható komponens (Chakra UI)
│  ├─ context/        # User-ek menedzselése
│  ├─ pages/          # Oldalak (részletek fent)
│  └─ App.jsx
├─ .env.local         # Környezeti változók
├─ vite.config.js     # Vite konfig
└─ package.json
```

## 🚀 Deploy

1. Push GitHub-ra:

   ```bash
   git push origin main
   ```
2. A repo beállításokban **Pages**, a branch-et állítsd `main`-re és a mappát `/`-ra.

Az oldalad helye `https://<your-username>.github.io/you-know-book/`.

## 🤝 Adj hozzá!

1. Forkold a repo-t (minden ágat, kifejezetten a develop-ot)
2. develop-ról branch-elj: `git checkout -b feature/YourFeature`
3. Kommitold a fejlesztést: `git commit -m 'Add YourFeature'`
4. Push a feature branchre: `git push origin feature/YourFeature`
5. Merge-eld a develop-ra
6. Pull request nekem

Kövesd a [Chakra UI segítségét](https://chakra-ui.com/docs/components/concepts/overview) a UI komponensekhez.

## 📝 Licensz

This project is licensed under the MIT License.
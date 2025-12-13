# Quick Start Guide - Overpass Integration

## What Changed

Your game now fetches street data **client-side** from OpenStreetMap's Overpass API instead of using a database. This means:

✅ No server needed for street data  
✅ Works for any location worldwide  
✅ Automatic caching in browser  
✅ Better street grouping (no duplicates)  
✅ POI support (historic sites, museums)  

## How to Run

### 1. Start the React App

```bash
cd client
npm start
```

The app will open at http://localhost:3000

### 2. First Load

- **Wait 10-30 seconds** - The app is fetching streets from Overpass API
- You'll see: "Loading streets from Overpass API..."
- This only happens ONCE - results are cached in localStorage

### 3. Play the Game

- Streets will appear on the map in blue
- You'll be shown a street name
- Click the correct street on the map
- Get points for correct answers!

### 4. Subsequent Loads

- Instant - uses cached data from localStorage
- No wait time!

## What You'll See

```
🔍 Loading streets from Overpass API...
✅ Fetched 156 elements from Overpass
Processing 156 elements for difficulty: tourist
After filtering: 42 unique street names
Selected 20 streets for game
✅ Loaded 20 streets
```

## Area Settings (Currently in Code)

Located in [BackOfYourHand.jsx](client/src/components/BackOfYourHand.jsx):

```javascript
const [center] = useState({ lat: 35.0844, lng: -106.6504 }); // Albuquerque
const [radius] = useState(5000); // 5km radius
const [difficulty] = useState(Difficulty.Tourist); // Major roads only
```

### To Change Location:
1. Open `client/src/components/BackOfYourHand.jsx`
2. Change the `center` coordinates:
   ```javascript
   const [center] = useState({ lat: 40.7128, lng: -74.0060 }); // New York
   ```

### To Change Radius:
```javascript
const [radius] = useState(10000); // 10km radius
```

### To Change Difficulty:
```javascript
import { Difficulty } from '../utils/areaTypes';

const [difficulty] = useState(Difficulty.Resident); // More streets
// Options: Difficulty.Tourist | Difficulty.Resident | Difficulty.TaxiDriver
```

## Difficulty Levels

- **Tourist** - Major roads only (motorway, primary, secondary, trunk)
- **Resident** - Adds tertiary roads and cycleways
- **Taxi Driver** - All roads including residential streets

## Troubleshooting

### "No streets found"
- Increase the radius
- Change difficulty to include more roads (e.g., Difficulty.TaxiDriver)
- Try a different location

### Overpass API Timeout
- The API is experiencing high load
- Wait a minute and refresh
- Try reducing the radius

### Cache Issues
- Open DevTools (F12)
- Go to Application → Local Storage
- Clear items starting with "overpass-response"
- Refresh the page

## Browser Console

Watch the console for detailed logging:
- Streets fetched
- Filtering progress
- Map initialization
- Game events

## Demo Component

To see the demo with interactive controls:

Edit `src/App.js`:
```javascript
import OverpassGameExample from './components/OverpassGameExample';

// Replace <StreetFinderGame /> with:
<OverpassGameExample />
```

This gives you sliders and dropdowns to test different settings!

## Next Steps

### Add UI Controls (Future Enhancement)

Add these state setters to BackOfYourHand.jsx:
```javascript
const [center, setCenter] = useState({ lat: 35.0844, lng: -106.6504 });
const [radius, setRadius] = useState(5000);
const [difficulty, setDifficulty] = useState(Difficulty.Tourist);
```

Then add controls in the UI to let users adjust them!

### Server Still Available

The old server-side approach is still there if needed:
- Database routes still work
- Admin panel still functional
- Can use both approaches side-by-side

## File Structure

```
client/src/
├── components/
│   ├── BackOfYourHand.jsx          ← Main game (now uses Overpass)
│   └── OverpassGameExample.jsx     ← Demo with controls
├── hooks/
│   ├── useStreets.js               ← Old database approach
│   └── useOverpassStreets.js       ← New Overpass approach ✨
└── utils/
    ├── areaTypes.js                ← Constants and enums
    ├── geometryUtils.js            ← Geometry calculations
    ├── exclusions.js               ← Street filtering
    ├── difficultySettings.js       ← Highway filtering
    ├── overpassQuery.js            ← Query builder
    ├── overpassFetcher.js          ← API fetching
    └── streetProcessor.js          ← Street grouping
```

## Key Improvements

### Before (Database)
- ❌ Required server running
- ❌ Limited to pre-loaded cities
- ❌ Could get duplicate streets
- ❌ Manual data imports

### After (Overpass)
- ✅ No server needed
- ✅ Any location worldwide
- ✅ No duplicates (grouped by name)
- ✅ Auto-fetches on demand
- ✅ Includes POIs (monuments, museums)
- ✅ Cached locally

Enjoy your refactored game! 🎮

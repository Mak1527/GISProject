# Burn Severity Analysis – South Korea Wildfire (March–May 2025)

This project analyzes burn severity in the Sancheong & Uiseong region, South Korea, for the March–May 2025 wildfire using Google Earth Engine (GEE) and Sentinel-2 imagery.

## Overview

- **Area of Interest:** Polygon covering part of South Korea (Sancheong & Uiseong).
- **Period Analyzed:** March 15, 2025 to May 15, 2025.
- **Data:** Sentinel-2 Harmonized, Cloud Score+ for cloud masking.

## Main Features

- **Cloud Masking:** Uses Cloud Score+ to mask cloudy pixels.
- **Composites:** Creates pre-fire and post-fire median composites.
- **Visualization:** Provides false color composites to highlight burned areas.
- **Indices:** Calculates NDVI and NBR for before and after the fire.
- **Burn Severity Calculation:** Computes dNBR (difference in Normalized Burn Ratio) to map and classify burn severity based on USGS standards.
- **Histogram:** Plots a histogram of dNBR values within the area.
- **Classification:** Assigns severity classes: Enhanced/Unchanged, Low, Moderate, and High.
- **Legend:** Adds a custom legend to the map for burn severity.
- **Area Statistics:** Calculates area in square kilometers for each severity class.
- **Export:** Prepares exports for all key layers (Before, After, dNBR, Severity, etc.) to Google Drive.

## Burn Severity Classes

| Severity            | dNBR Range        | Color   |
|---------------------|------------------|---------|
| Enhanced/Unchanged  | < 0.0            | Green   |
| Low Severity        | 0.0 – 0.1        | Yellow  |
| Moderate Severity   | 0.1 – 0.25       | Orange  |
| High Severity       | > 0.25           | Red     |

## Usage

1. **Open the Script:**
   - Import `Burn_Severity_SouthKorea.js` into the [GEE Code Editor](https://code.earthengine.google.com/).
2. **Set Area & Dates:**
   - Adjust the `geometry`, `fireStart`, and `fireEnd` if you wish to analyze a different area or time period.
3. **Run the Script:**
   - The script will display various map layers and print burn area statistics.
4. **Export Results:**
   - The script includes `Export.image.toDrive` functions for exporting maps (Before, After, NBR, dNBR, Severity).

## Results

- Interactive map layers for pre-fire and post-fire conditions, NBR, dNBR, and classified burn severity.
- Area statistics by severity class (in km²).
- Exportable maps for further analysis or reporting.

## Requirements

- Google Earth Engine account (free for research/non-commercial use).
- Basic familiarity with the GEE Code Editor.

## Author

Mayur Kumbhar

---

*Feel free to cite or reuse with attribution!*

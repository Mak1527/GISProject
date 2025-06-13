// Define the area of interest

var geometry = 
    /* color: #ffc82d */
    /* shown: false */
    ee.Geometry.Polygon(
        [[[127.8, 35.2],
          [128, 35.2],
          [128, 35.4],
          [127.8, 35.4],
          [127.8, 35.2]]]);



var geometry = geometry;
var fireStart = ee.Date('2025-03-15');
var fireEnd = ee.Date('2025-05-15')

Map.centerObject(geometry, 10);

var s2 = ee.ImageCollection('COPERNICUS/S2_HARMONIZED');


// Apply filters 
var filtered = s2
  .filter(ee.Filter.bounds(geometry))
  .select('B.*');

// Load the Cloud Score+ collection
var csPlus = ee.ImageCollection('GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED');
var csPlusBands = csPlus.first().bandNames();

// We need to add Cloud Score + bands to each Sentinel-2
// image in the collection
// This is done using the linkCollection() function
var filteredS2WithCs = filtered.linkCollection(csPlus, csPlusBands);

// Function to mask pixels with low CS+ QA scores.
function maskLowQA(image) {
  var qaBand = 'cs';
  var clearThreshold = 0.5;
  var mask = image.select(qaBand).gte(clearThreshold);
  return image.updateMask(mask);
}


var filteredMasked = filteredS2WithCs
  .map(maskLowQA);

// Create Before and After composites 
var before = filteredMasked
  .filter(ee.Filter.date(
    fireStart.advance(-2, 'month'), fireStart))
  .median()

var after = filteredMasked
  .filter(ee.Filter.date(
    fireEnd, fireEnd.advance(1, 'month')))
  .median()

// Freshly burnt regions appeat bright in SWIR-bands
// Use a False Color Visualization
var swirVis = {
  min: 0.0,
  max: 3000,
  bands: ['B12', 'B8', 'B4'],
};
Map.addLayer(before.clip(geometry), swirVis, 'Before')
Map.addLayer(after.clip(geometry), swirVis, 'After')

// Write a function to calculate  Normalized Burn Ratio (NBR)
// 'NIR' (B8) and 'SWIR-2' (B12)
// var addNBR = function(image) {
//   var nbr = image.normalizedDifference(['B8', 'B12']).rename(['nbr']);
//   return image.addBands(nbr)
// }

// Calculate NDVI and NBR
var addIndices= function(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('ndvi');
  var nbr  = image.normalizedDifference(['B8', 'B12']).rename('nbr');
  return image.addBands([ndvi, nbr]);
}

var beforeNbr = addIndices(before).select('nbr');
var afterNbr = addIndices(after).select('nbr');

var nbrVis = {min: -0.5, max: 0.5, palette: ['white', 'black']}

Map.addLayer(beforeNbr.clip(geometry), nbrVis, 'Prefire NBR');
Map.addLayer(afterNbr.clip(geometry), nbrVis, 'Postfire NBR');

// Calculate Change in NBR (dNBR)
var change = beforeNbr.subtract(afterNbr)

// // Apply a threshold
// var threshold = 0.3

// // Display Burned Areas
// var burned = change.gt(threshold)
// Map.addLayer(burned.clip(geometry), {min:0, max:1, palette: ['white', 'red']}, 'Burned', false) 

var dnbrPalette = ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'];
// Display the change image

Map.addLayer(change.clip(geometry), {min:-0.5, max: 1, palette: dnbrPalette}, 'Change in NBR')

// We can also classify the change image according to
// burn severity

// United States Geological Survey (USGS) proposed
// a classification table to interpret the burn severity
// We will assign a discrete class value and visualize it
// | Severity     | dNBR Range         | Class |
// |--------------|--------------------|-------|
// | Unburned     | < 0.1              | 0     |
// | Low Severity | >= 0.10 and <0.27  | 1     |
// | Moderate-Low | >= 0.27 and <0.44  | 2     |
// | Moderate-High| >= 0.44 and< 0.66  | 3     |
// | High         | >= 0.66            | 4     |


// For this case study classes are determin using the histogram method
// Histogram for dNBR values
var chart = ui.Chart.image.histogram({
  image: change,
  region: geometry,
  scale: 10,
  minBucketWidth: 0.05
}).setOptions({title: 'dNBR Distribution'});
print(chart);

// Classification of continuous values can be done
// using the .where() function
var severity = change
  .where(change.lt(0.0), 0)                                 // Enhanced/Unchanged
  .where(change.gte(0.0).and(change.lt(0.1)), 1)           // Low Severity
  .where(change.gte(0.1).and(change.lt(0.25)), 2)         // Moderate Severity
  .where(change.gt(0.25), 3)                             // High Severity

var visParam ={
  min: 0, 
  max: 3, 
  palette: ['00FF00','FFFF00', 'FFA500', 'FF0000'] //[(green),(yellow),(orange),(red)]
}

// The resulting image 'severity' is a discrete image with 
// pixel values from 0-3 representing the severity class

// Display the image according to the following color table

// | Severity     | Class | Color   |
// |--------------|-------|---------|
// | Unburned     | 0     | green   |
// | Low Severity | 1     | yellow  |
// | Mod Severity | 2     | organge |
// | High         | 3     | red     |


Map.addLayer(severity.clip(geometry), visParam, 'Burn Severity');


// Calculate area in square meters for each class
var pixelArea = ee.Image.pixelArea();

// Create an image where each pixel has the area if it matches the class
var stats = pixelArea.addBands(severity).reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1, // severity class band
    groupName: 'class'
  }),
  geometry: geometry,  
  scale: 10,      
  maxPixels: 1e12
});

print('Area (sq meters) by class:', stats);

// Convert to square kilometers and print
var classStats = ee.List(stats.get('groups'))
  .map(function(item) {
    var dict = ee.Dictionary(item);
    var classNum = dict.get('class');
    var areaSqKm = ee.Number(dict.get('sum')).divide(1e6);
    return ee.Dictionary({'Class': classNum, 'Area_sq_km': areaSqKm});
  });

print('Area (sq km) by class:', classStats);


// Function to add a legend panel
function addLegend(colors, names, title) {
  var legend = ui.Panel({style: {position: 'bottom-left'}});
  legend.add(ui.Label({value: title, style: {fontWeight: 'bold'}}));
  for (var i = 0; i < colors.length; i++) {
    var colorBox = ui.Label({
      style: {
        backgroundColor: colors[i],
        padding: '8px',
        margin: '0 0 4px 0'
      }
    });
    legend.add(ui.Panel([
      colorBox,
      ui.Label(names[i], {margin: '0 0 4px 6px'})
    ], ui.Panel.Layout.Flow('horizontal')));
  }
  Map.add(legend);
}

// Your classes/colors/names
var legendColors = ['#00FF00', '#FFFF00', '#FFA500', '#FF0000'];
var legendNames = [
  'Enhanced/Unchanged (<0)',
  'Low Severity (0–0.1)',
  'Moderate Severity (0.1–0.25)',
  'High Severity (>0.25)'
];

addLegend(legendColors, legendNames, 'Burn Severity');


// Helper function for exporting images
function exportImage(image, visParams, fileName) {
  Export.image.toDrive({
    image: image.visualize(visParams),
    description: fileName,
    folder: 'gee_layers',
    fileNamePrefix: fileName,
    region: geometry,
    scale: 10,
    maxPixels: 1e13
  });
}

// Export each layer (clip if needed)
exportImage(before.clip(geometry), swirVis, 'Before');
exportImage(after.clip(geometry), swirVis, 'After');
exportImage(beforeNbr.clip(geometry), nbrVis, 'Prefire_NBR');
exportImage(afterNbr.clip(geometry), nbrVis, 'Postfire_NBR');
exportImage(change.clip(geometry), {min: -0.5, max: 1, palette: dnbrPalette}, 'Change_in_NBR');
exportImage(severity.clip(geometry), visParam, 'Burn_Severity');

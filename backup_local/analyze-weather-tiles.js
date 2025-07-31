#!/usr/bin/env node

/**
 * Analyze weather tiles to determine if they contain actual weather data
 * or if they're transparent/empty, which could explain the solid color rectangles
 */

const fs = require('fs');
const PNG = require('pngjs').PNG;

// Helper function to analyze a PNG file
function analyzePNGFile(filepath) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
            .pipe(new PNG())
            .on('parsed', function() {
                const analysis = {
                    width: this.width,
                    height: this.height,
                    totalPixels: this.width * this.height,
                    transparentPixels: 0,
                    opaquePixels: 0,
                    semiTransparentPixels: 0,
                    colorChannels: {
                        red: { min: 255, max: 0, avg: 0 },
                        green: { min: 255, max: 0, avg: 0 },
                        blue: { min: 255, max: 0, avg: 0 },
                        alpha: { min: 255, max: 0, avg: 0 }
                    },
                    hasVisibleContent: false
                };
                
                let redSum = 0, greenSum = 0, blueSum = 0, alphaSum = 0;
                
                // Analyze each pixel
                for (let y = 0; y < this.height; y++) {
                    for (let x = 0; x < this.width; x++) {
                        const idx = (this.width * y + x) << 2;
                        const red = this.data[idx];
                        const green = this.data[idx + 1];
                        const blue = this.data[idx + 2];
                        const alpha = this.data[idx + 3];
                        
                        // Update min/max values
                        analysis.colorChannels.red.min = Math.min(analysis.colorChannels.red.min, red);
                        analysis.colorChannels.red.max = Math.max(analysis.colorChannels.red.max, red);
                        analysis.colorChannels.green.min = Math.min(analysis.colorChannels.green.min, green);
                        analysis.colorChannels.green.max = Math.max(analysis.colorChannels.green.max, green);
                        analysis.colorChannels.blue.min = Math.min(analysis.colorChannels.blue.min, blue);
                        analysis.colorChannels.blue.max = Math.max(analysis.colorChannels.blue.max, blue);
                        analysis.colorChannels.alpha.min = Math.min(analysis.colorChannels.alpha.min, alpha);
                        analysis.colorChannels.alpha.max = Math.max(analysis.colorChannels.alpha.max, alpha);
                        
                        // Sum for averages
                        redSum += red;
                        greenSum += green;
                        blueSum += blue;
                        alphaSum += alpha;
                        
                        // Count transparency levels
                        if (alpha === 0) {
                            analysis.transparentPixels++;
                        } else if (alpha === 255) {
                            analysis.opaquePixels++;
                        } else {
                            analysis.semiTransparentPixels++;
                        }
                        
                        // Check if pixel has visible content (non-transparent and not pure white)
                        if (alpha > 0 && (red !== 255 || green !== 255 || blue !== 255)) {
                            analysis.hasVisibleContent = true;
                        }
                    }
                }
                
                // Calculate averages
                analysis.colorChannels.red.avg = Math.round(redSum / analysis.totalPixels);
                analysis.colorChannels.green.avg = Math.round(greenSum / analysis.totalPixels);
                analysis.colorChannels.blue.avg = Math.round(blueSum / analysis.totalPixels);
                analysis.colorChannels.alpha.avg = Math.round(alphaSum / analysis.totalPixels);
                
                // Calculate percentages
                analysis.transparentPercent = Math.round((analysis.transparentPixels / analysis.totalPixels) * 100);
                analysis.opaquePercent = Math.round((analysis.opaquePixels / analysis.totalPixels) * 100);
                analysis.semiTransparentPercent = Math.round((analysis.semiTransparentPixels / analysis.totalPixels) * 100);
                
                resolve(analysis);
            })
            .on('error', reject);
    });
}

async function analyzeAllTiles() {
    console.log('='.repeat(80));
    console.log('WEATHER TILES ANALYSIS');
    console.log('='.repeat(80));
    console.log('Analyzing downloaded weather tiles to understand transparency and content...\n');
    
    // Get all sample PNG files
    const files = fs.readdirSync('.')
        .filter(file => file.startsWith('sample-') && file.endsWith('.png'))
        .sort();
    
    if (files.length === 0) {
        console.log('❌ No sample tiles found. Run test-weather-tiles.js first.');
        return;
    }
    
    console.log(`Found ${files.length} sample tiles to analyze:\n`);
    
    const results = [];
    
    for (const file of files) {
        try {
            console.log(`Analyzing ${file}...`);
            const analysis = await analyzePNGFile(file);
            analysis.filename = file;
            results.push(analysis);
            
            // Extract layer info from filename
            const parts = file.replace('sample-', '').replace('.png', '').split('-');
            const layer = parts[0];
            const zoom = parts[1];
            
            console.log(`  📊 Layer: ${layer}, Zoom: ${zoom}`);
            console.log(`  🖼️  Dimensions: ${analysis.width}x${analysis.height}`);
            console.log(`  👻 Transparency: ${analysis.transparentPercent}% transparent, ${analysis.opaquePercent}% opaque`);
            console.log(`  🎨 Color Range: R(${analysis.colorChannels.red.min}-${analysis.colorChannels.red.max}), G(${analysis.colorChannels.green.min}-${analysis.colorChannels.green.max}), B(${analysis.colorChannels.blue.min}-${analysis.colorChannels.blue.max})`);
            console.log(`  👁️  Has visible content: ${analysis.hasVisibleContent ? '✅ YES' : '❌ NO'}`);
            console.log('');
            
        } catch (error) {
            console.log(`  ❌ Error analyzing ${file}: ${error.message}`);
        }
    }
    
    // Summary analysis
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY ANALYSIS');
    console.log('='.repeat(80));
    
    const tilesWithContent = results.filter(r => r.hasVisibleContent);
    const tilesWithoutContent = results.filter(r => !r.hasVisibleContent);
    const highlyTransparent = results.filter(r => r.transparentPercent > 90);
    
    console.log(`\n📈 STATISTICS:`);
    console.log(`  Total tiles analyzed: ${results.length}`);
    console.log(`  Tiles with visible content: ${tilesWithContent.length}`);
    console.log(`  Tiles without visible content: ${tilesWithoutContent.length}`);
    console.log(`  Highly transparent tiles (>90%): ${highlyTransparent.length}`);
    
    if (tilesWithContent.length > 0) {
        console.log(`\n✅ TILES WITH VISIBLE CONTENT:`);
        tilesWithContent.forEach(tile => {
            console.log(`  ${tile.filename} (${tile.transparentPercent}% transparent)`);
        });
    }
    
    if (tilesWithoutContent.length > 0) {
        console.log(`\n❌ TILES WITHOUT VISIBLE CONTENT:`);
        tilesWithoutContent.forEach(tile => {
            console.log(`  ${tile.filename} (${tile.transparentPercent}% transparent)`);
        });
    }
    
    // Layer-specific analysis
    console.log(`\n📊 LAYER ANALYSIS:`);
    const layerStats = {};
    results.forEach(result => {
        const layer = result.filename.split('-')[1];
        if (!layerStats[layer]) {
            layerStats[layer] = {
                tiles: [],
                avgTransparency: 0,
                hasAnyContent: false
            };
        }
        layerStats[layer].tiles.push(result);
        layerStats[layer].hasAnyContent = layerStats[layer].hasAnyContent || result.hasVisibleContent;
    });
    
    Object.entries(layerStats).forEach(([layer, stats]) => {
        const avgTransparency = Math.round(
            stats.tiles.reduce((sum, tile) => sum + tile.transparentPercent, 0) / stats.tiles.length
        );
        console.log(`  ${layer.toUpperCase()}: ${stats.tiles.length} tiles, ${avgTransparency}% avg transparency, ${stats.hasAnyContent ? 'HAS' : 'NO'} content`);
    });
    
    // Diagnosis and recommendations
    console.log(`\n🔍 DIAGNOSIS:`);
    
    if (tilesWithoutContent.length === results.length) {
        console.log(`❌ PROBLEM IDENTIFIED: All tiles appear to be empty or fully transparent!`);
        console.log(`   This explains why you see solid color rectangles instead of weather data.`);
        console.log(`   The tiles are likely either:`);
        console.log(`   1. Completely transparent (no weather data in this region)`);
        console.log(`   2. Contain only white/transparent pixels`);
        console.log(`   3. Weather data is present but extremely subtle`);
    } else if (tilesWithContent.length < results.length / 2) {
        console.log(`⚠️  PARTIAL PROBLEM: Most tiles (${tilesWithoutContent.length}/${results.length}) lack visible content`);
        console.log(`   Some layers may have data while others don't for this region/time.`);
    } else {
        console.log(`✅ TILES CONTAIN DATA: Most tiles have visible weather content`);
        console.log(`   The solid color issue might be due to opacity settings or rendering problems.`);
    }
    
    console.log(`\n🛠️  RECOMMENDATIONS:`);
    console.log(`1. Try different geographic coordinates (maybe Hong Kong has no weather data right now)`);
    console.log(`2. Test with different zoom levels (some data may only be available at certain scales)`);
    console.log(`3. Check if the opacity setting is too low in your map component`);
    console.log(`4. Try different weather layers - some may have more visible data than others`);
    console.log(`5. Test with a different time period using OpenWeatherMap 2.0 API`);
    console.log(`6. Verify that the map overlay is being applied correctly in your JavaScript code`);
    
    // Export detailed results
    const reportFile = 'weather-tiles-analysis-report.json';
    fs.writeFileSync(reportFile, JSON.stringify({
        analysis: {
            timestamp: new Date().toISOString(),
            totalTiles: results.length,
            tilesWithContent: tilesWithContent.length,
            tilesWithoutContent: tilesWithoutContent.length,
            highlyTransparent: highlyTransparent.length
        },
        results: results,
        layerStats: layerStats
    }, null, 2));
    
    console.log(`\n📝 Detailed analysis saved to: ${reportFile}`);
}

// Check if pngjs is available
try {
    require('pngjs');
    analyzeAllTiles().catch(console.error);
} catch (error) {
    console.log('❌ pngjs module not found. Installing...');
    console.log('Run: npm install pngjs');
    console.log('Then run this script again.');
    
    // Try to analyze without pngjs using file sizes as a proxy
    console.log('\n📊 BASIC ANALYSIS (without pixel data):');
    const files = fs.readdirSync('.')
        .filter(file => file.startsWith('sample-') && file.endsWith('.png'))
        .sort();
    
    files.forEach(file => {
        const stats = fs.statSync(file);
        const parts = file.replace('sample-', '').replace('.png', '').split('-');
        const layer = parts[0];
        const zoom = parts[1];
        
        console.log(`${file}: ${stats.size} bytes`);
        if (stats.size < 1000) {
            console.log(`  ⚠️  Very small file - likely mostly transparent`);
        } else if (stats.size > 20000) {
            console.log(`  ✅ Large file - likely contains weather data`);
        }
    });
}
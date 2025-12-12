class StreetMerger {
  /**
   * Merge street segments that are close together
   */
 mergeStreetSegments(streets, maxDistanceKm = 0.5) {
  console.log('\n========================================');
  console.log('MERGER CALLED');
  console.log('========================================');
  console.log(`Input: ${streets.length} street segments`);
  console.log(`Max distance: ${maxDistanceKm}km`);
  
  // Check first few streets
  console.log('\nFirst 3 streets:');
  streets.slice(0, 3).forEach(s => {
    console.log(`  ${s.name}: ${s.coordinates.length} coordinates`);
  });
  
  // ... rest of the function
    // Group by street name
    const streetGroups = {};
    streets.forEach(street => {
      const name = street.name;
      if (!streetGroups[name]) {
        streetGroups[name] = [];
      }
      streetGroups[name].push(street);
    });
    
    console.log(`Found ${Object.keys(streetGroups).length} unique street names`);
    
    const mergedStreets = [];
    
    // Process each street name
    for (const [name, segments] of Object.entries(streetGroups)) {
      console.log(`\nProcessing: ${name} (${segments.length} segments)`);
      
      // Build connectivity graph
      const merged = this.connectSegments(segments, maxDistanceKm);
      
      console.log(`  Merged into ${merged.length} connected components`);
      
      // Add each connected component as a separate segment
      merged.forEach((component, idx) => {
        mergedStreets.push({
          name: name,
          coordinates: component.coordinates,
          difficulty: component.difficulty,
          type: component.type,
          city: component.city,
          state: component.state,
          source: component.source
        });
      });
    }
    
    console.log(`\n✅ Final result: ${mergedStreets.length} merged segments`);
    return mergedStreets;
  }
  
  /**
   * Connect segments that are close together
   */
  connectSegments(segments, maxDistanceKm) {
    if (segments.length === 0) return [];
    if (segments.length === 1) return segments;
    
    // Create a list of all segments with their endpoints
    const segmentData = segments.map((seg, idx) => ({
      index: idx,
      segment: seg,
      start: seg.coordinates[0],
      end: seg.coordinates[seg.coordinates.length - 1],
      used: false
    }));
    
    const connectedComponents = [];
    
    // Find connected components using graph traversal
    for (let i = 0; i < segmentData.length; i++) {
      if (segmentData[i].used) continue;
      
      // Start a new connected component
      const component = this.buildComponent(segmentData, i, maxDistanceKm);
      
      if (component.coordinates.length > 0) {
        connectedComponents.push(component);
      }
    }
    
    return connectedComponents;
  }
  
  /**
   * Build a connected component starting from a segment
   */
  buildComponent(segmentData, startIdx, maxDistanceKm) {
    const component = {
      coordinates: [...segmentData[startIdx].segment.coordinates],
      difficulty: segmentData[startIdx].segment.difficulty,
      type: segmentData[startIdx].segment.type,
      city: segmentData[startIdx].segment.city,
      state: segmentData[startIdx].segment.state,
      source: segmentData[startIdx].segment.source
    };
    
    segmentData[startIdx].used = true;
    
    // Keep trying to add connected segments
    let addedSegment = true;
    while (addedSegment) {
      addedSegment = false;
      
      const componentStart = component.coordinates[0];
      const componentEnd = component.coordinates[component.coordinates.length - 1];
      
      // Find the closest unused segment
      let closestIdx = -1;
      let closestDist = Infinity;
      let connectToStart = false;
      let reverseSegment = false;
      
      for (let i = 0; i < segmentData.length; i++) {
        if (segmentData[i].used) continue;
        
        const seg = segmentData[i];
        
        // Check all 4 possible connections
        const d1 = this.distance(componentEnd, seg.start);     // end -> start
        const d2 = this.distance(componentEnd, seg.end);       // end -> end (reverse)
        const d3 = this.distance(componentStart, seg.start);   // start -> start (reverse)
        const d4 = this.distance(componentStart, seg.end);     // start -> end
        
        const minDist = Math.min(d1, d2, d3, d4);
        
        if (minDist < closestDist && minDist <= maxDistanceKm) {
          closestDist = minDist;
          closestIdx = i;
          
          if (minDist === d1) {
            connectToStart = false;
            reverseSegment = false;
          } else if (minDist === d2) {
            connectToStart = false;
            reverseSegment = true;
          } else if (minDist === d3) {
            connectToStart = true;
            reverseSegment = true;
          } else {
            connectToStart = true;
            reverseSegment = false;
          }
        }
      }
      
      // If we found a close segment, add it
      if (closestIdx !== -1) {
        let coords = [...segmentData[closestIdx].segment.coordinates];
        
        if (reverseSegment) {
          coords = coords.reverse();
        }
        
        if (connectToStart) {
          component.coordinates = [...coords, ...component.coordinates];
        } else {
          component.coordinates = [...component.coordinates, ...coords];
        }
        
        segmentData[closestIdx].used = true;
        addedSegment = true;
      }
    }
    
    return component;
  }
  
  /**
   * Calculate distance between two points in km
   */
  distance(point1, point2) {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
}

module.exports = new StreetMerger();
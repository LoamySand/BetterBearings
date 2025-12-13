/**
 * Street name exclusions - generic/unwanted names
 */
export const exclusions = [
  { name: "alley" },
  { name: "buses and taxis" },
  { name: "drive thru" },
  { name: "escalator" },
  { name: "treppe tiefgarage" }, // Stairs to underground parking
  { name: "tunnel entrance street" },
  { name: "zugang steig" }, // Entranceway/access climb
  { name: /^unnamed/i },
  { name: /^private/i },
  { name: /^service/i },
  { name: "parking" },
  { name: "driveway" },
  { name: "access road" },
  { name: "fire road" }
];

/**
 * Check if a street should be excluded
 */
export function shouldExcludeStreet(element, exclusionList = exclusions) {
  const name = element.tags.name?.toLowerCase();
  if (!name) return true;
  
  return exclusionList.some(exclusion => {
    if (exclusion.highways && 
        !exclusion.highways.includes(element.tags.highway)) {
      return false;
    }
    
    if (exclusion.name instanceof RegExp) {
      return exclusion.name.test(name);
    }
    return exclusion.name === name;
  });
}

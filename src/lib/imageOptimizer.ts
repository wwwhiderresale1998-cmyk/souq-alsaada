/**
 * Image optimization utilities for weak internet connections
 */

/**
 * Optimizes Unsplash and other dynamic image URLs by requesting next-gen formats (WebP),
 * responsive sizes (width tailored to standard cards), and lower compression ratios.
 */
export function optimizeImageUrl(url: string, width = 400): string {
  if (!url) return "";
  
  if (url.includes("unsplash.com")) {
    let optimized = url;
    
    // Set format to WebP for smaller size and high quality
    if (optimized.includes("auto=format")) {
      optimized = optimized.replace("auto=format", "fm=webp");
    } else if (!optimized.includes("fm=")) {
      optimized += "&fm=webp";
    }
    
    // Set quality to 60 (excellent compression-to-quality ratio for mobile)
    if (optimized.includes("q=")) {
      optimized = optimized.replace(/q=\d+/, "q=60");
    } else {
      optimized += "&q=60";
    }
    
    // Set custom responsive width to avoid loading unnecessarily massive images
    if (optimized.includes("w=")) {
      optimized = optimized.replace(/w=\d+/, `w=${width}`);
    } else {
      optimized += `&w=${width}`;
    }
    
    return optimized;
  }
  
  return url;
}

/**
 * Generates an ultra-lightweight Low Quality Image Placeholder (LQIP).
 * For Unsplash images, this requests a tiny 16px blurred image of < 1KB.
 * For non-Unsplash images, it returns a subtle modern colored SVG payload.
 */
export function getLqipImageUrl(url: string): string {
  if (!url) return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%231e222d'></svg>";
  
  if (url.includes("unsplash.com")) {
    let lqip = url;
    
    // Set tiny width (16px)
    if (lqip.includes("w=")) {
      lqip = lqip.replace(/w=\d+/, "w=16");
    } else {
      lqip += "&w=16";
    }
    
    // Extremely low quality (15)
    if (lqip.includes("q=")) {
      lqip = lqip.replace(/q=\d+/, "q=15");
    } else {
      lqip += "&q=15";
    }
    
    // Set format to WebP
    if (lqip.includes("auto=format")) {
      lqip = lqip.replace("auto=format", "fm=webp");
    } else if (!lqip.includes("fm=")) {
      lqip += "&fm=webp";
    }
    
    // Request image-side blurring filter
    if (!lqip.includes("blur=")) {
      lqip += "&blur=10";
    }
    
    return lqip;
  }
  
  // Clean off-white/gray elegant loading background
  return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%232a2e39'/></svg>";
}

/**
 * Compresses an image represented as a Base64 string using a canvas.
 * Reduces its dimensions and quality to ensure lightweight storage.
 */
export function compressImage(
  base64Str: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve) => {
    // If it's not a data URL or it's a small placeholder, resolve immediately
    if (!base64Str.startsWith("data:image")) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = base64Str;
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions keeping the aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Use JPEG for solid compression sizes
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Str);
      }
    };

    img.onerror = () => {
      resolve(base64Str);
    };
  });
}

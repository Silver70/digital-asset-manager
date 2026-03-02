use std::path::Path;
use image::ImageFormat;

/// Generates a 256×256 JPEG thumbnail from an image file.
///
/// Sync — must be called via `tokio::task::spawn_blocking` from async contexts.
///
/// Returns:
/// - `Ok(())` on success
/// - `Err(io_error)` if the file can't be read (file missing, permissions)
/// - `Ok(())` with `thumbnail_written = false` implied when format is unsupported
pub fn generate_image_thumbnail(src: &Path, dst: &Path) -> Result<(), String> {
    let img = match image::open(src) {
        Ok(img) => img,
        Err(image::ImageError::IoError(e)) => {
            return Err(format!("IO error reading '{}': {}", src.display(), e));
        }
        Err(e) => {
            // Unsupported format or decoding error — not a hard failure
            return Err(format!("Cannot decode '{}': {}", src.display(), e));
        }
    };

    // Resize to fit within 256×256, preserving aspect ratio
    let thumb = img.thumbnail(256, 256);

    // JPEG does not support alpha — convert to RGB8
    let rgb = thumb.to_rgb8();

    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create thumbnail dir: {e}"))?;
    }

    rgb.save_with_format(dst, ImageFormat::Jpeg)
        .map_err(|e| format!("Cannot save thumbnail '{}': {}", dst.display(), e))?;

    Ok(())
}

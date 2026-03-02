use std::path::Path;

use image::GenericImageView;

use crate::models::metadata::{ImageMetadata, VideoMetadata};

/// Extracts image dimensions and EXIF metadata from an image file.
///
/// Sync — must be called via `tokio::task::spawn_blocking` from async contexts.
///
/// On success, returns an `ImageMetadata` struct ready for DB insertion.
/// On failure, returns an error string (IO or format error).
pub fn extract_image_metadata(asset_id: i64, src: &Path) -> Result<ImageMetadata, String> {
    let img = match image::open(src) {
        Ok(img) => img,
        Err(image::ImageError::IoError(e)) => {
            return Err(format!("IO error reading '{}': {}", src.display(), e));
        }
        Err(e) => {
            return Err(format!("Cannot decode '{}': {}", src.display(), e));
        }
    };

    let (width, height) = img.dimensions();
    let has_alpha = img.color().has_alpha();

    let mut dpi: Option<f64> = None;
    let mut color_profile: Option<String> = None;

    // Best-effort EXIF extraction — failures are silently skipped
    if let Ok(file) = std::fs::File::open(src) {
        let mut bufreader = std::io::BufReader::new(file);
        let exifreader = exif::Reader::new();
        if let Ok(exif_data) = exifreader.read_from_container(&mut bufreader) {
            // XResolution → DPI
            if let Some(field) = exif_data.get_field(exif::Tag::XResolution, exif::In::PRIMARY) {
                if let exif::Value::Rational(v) = &field.value {
                    if let Some(r) = v.first() {
                        if r.denom != 0 {
                            dpi = Some(r.num as f64 / r.denom as f64);
                        }
                    }
                }
            }
            // ColorSpace → human-readable profile string
            if let Some(field) = exif_data.get_field(exif::Tag::ColorSpace, exif::In::PRIMARY) {
                match &field.value {
                    exif::Value::Short(v) => {
                        color_profile = Some(match v.first().copied() {
                            Some(1) => "sRGB".to_string(),
                            Some(65535) => "Uncalibrated".to_string(),
                            Some(n) => format!("ColorSpace({})", n),
                            None => "Unknown".to_string(),
                        });
                    }
                    _ => {
                        color_profile = Some(field.display_value().to_string());
                    }
                }
            }
        }
    }

    Ok(ImageMetadata {
        asset_id,
        width: Some(width as i32),
        height: Some(height as i32),
        color_profile,
        dpi,
        has_alpha,
    })
}

/// Parses `ffprobe -print_format json -show_streams` JSON output into `VideoMetadata`.
///
/// Sync — data is already in memory, no I/O required.
pub fn parse_ffprobe_json(asset_id: i64, json_bytes: &[u8]) -> Result<VideoMetadata, String> {
    let val: serde_json::Value =
        serde_json::from_slice(json_bytes).map_err(|e| format!("ffprobe JSON parse error: {e}"))?;

    let streams = val["streams"]
        .as_array()
        .ok_or_else(|| "ffprobe output missing 'streams' array".to_string())?;

    let video = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("video"));
    let audio = streams
        .iter()
        .find(|s| s["codec_type"].as_str() == Some("audio"));

    let (width, height, codec, duration, frame_rate, bit_rate) = match video {
        Some(s) => {
            let width = s["width"].as_i64().map(|v| v as i32);
            let height = s["height"].as_i64().map(|v| v as i32);
            let codec = s["codec_name"].as_str().map(|v| v.to_string());
            let duration = s["duration"]
                .as_str()
                .and_then(|d| d.parse::<f64>().ok());
            let frame_rate = s["r_frame_rate"].as_str().and_then(parse_frame_rate);
            let bit_rate = s["bit_rate"]
                .as_str()
                .and_then(|b| b.parse::<i64>().ok());
            (width, height, codec, duration, frame_rate, bit_rate)
        }
        None => (None, None, None, None, None, None),
    };

    let audio_codec = audio.and_then(|s| s["codec_name"].as_str().map(|v| v.to_string()));

    Ok(VideoMetadata {
        asset_id,
        width,
        height,
        duration,
        frame_rate,
        codec,
        audio_codec,
        bit_rate,
    })
}

/// Parses a fraction frame-rate string like "30000/1001" or "25/1" into f64 fps.
fn parse_frame_rate(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let num: f64 = parts[0].parse().ok()?;
        let den: f64 = parts[1].parse().ok()?;
        if den != 0.0 {
            Some(num / den)
        } else {
            None
        }
    } else {
        s.parse().ok()
    }
}

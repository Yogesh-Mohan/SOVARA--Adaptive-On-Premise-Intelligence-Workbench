use std::path::Path;
use std::fs::File;
use std::io::Read;

/// Reads a local file and returns its text content.
/// Supports: .txt, .md, .json, .csv, .rs, .ts, .js, .py
/// For PDF and DOCX: returns a placeholder (full OCR/parsing is a separate pipeline stage).
#[tauri::command]
pub fn read_file_content(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("FILE_NOT_FOUND: {}", file_path));
    }

    if !path.is_file() {
        return Err(format!("NOT_A_FILE: {}", file_path));
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        // Plain text formats — read directly
        "txt" | "md" | "json" | "csv" | "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "toml"
        | "yaml" | "yml" | "xml" | "html" | "htm" | "log" => {
            let bytes = std::fs::read(&path)
                .map_err(|e| format!("READ_ERROR: {}", e))?;

            // Try UTF-8 first, then fall back to lossy conversion
            let content = String::from_utf8(bytes)
                .unwrap_or_else(|e| String::from_utf8_lossy(e.as_bytes()).to_string());

            // Truncate to ~12,000 chars to fit within a 2048 token context
            const MAX_CHARS: usize = 12_000;
            if content.len() > MAX_CHARS {
                let truncated = &content[..MAX_CHARS];
                Ok(format!(
                    "{}\n\n[Document truncated at {} characters to fit model context window]",
                    truncated, MAX_CHARS
                ))
            } else {
                Ok(content)
            }
        }

        // Binary formats — inform the user that full parsing is a future pipeline stage
        "pdf" => Err(
            "PDF_NOT_SUPPORTED_YET: PDF text extraction (OCR pipeline) is not yet enabled. Please copy-paste the text content directly.".to_string()
        ),
        "docx" => {
            let file = File::open(&path).map_err(|e| format!("READ_ERROR: {}", e))?;
            let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("ZIP_ERROR: {}", e))?;
            
            let mut document_xml = archive.by_name("word/document.xml").map_err(|_| "DOCX_ERROR: Could not find word/document.xml".to_string())?;
            let mut xml_content = String::new();
            document_xml.read_to_string(&mut xml_content).map_err(|e| format!("READ_ERROR: {}", e))?;
            
            // Very basic XML tag stripping to extract text from <w:t> tags
            let mut text_content = String::new();
            let mut in_tag = false;
            let mut is_text_node = false;
            let mut current_tag = String::new();
            
            for c in xml_content.chars() {
                if c == '<' {
                    in_tag = true;
                    current_tag.clear();
                } else if c == '>' {
                    in_tag = false;
                    is_text_node = current_tag.starts_with("w:t>") || current_tag.starts_with("w:t ") || current_tag == "w:t";
                    if current_tag == "w:p" {
                        text_content.push('\n'); // Add newline for paragraphs
                    }
                } else if in_tag {
                    current_tag.push(c);
                } else if is_text_node {
                    text_content.push(c);
                }
            }
            
            const MAX_CHARS: usize = 12_000;
            if text_content.len() > MAX_CHARS {
                Ok(format!(
                    "{}\n\n[Document truncated at {} characters to fit model context window]",
                    &text_content[..MAX_CHARS], MAX_CHARS
                ))
            } else {
                Ok(text_content.trim().to_string())
            }
        },
        "doc" => Err(
            "DOC_NOT_SUPPORTED_YET: Legacy .doc format is not supported. Please save as .docx or .txt and re-attach.".to_string()
        ),
        "xlsx" | "xls" => Err(
            "XLSX_NOT_SUPPORTED_YET: Excel parsing is not yet enabled. Please export as .csv and re-attach.".to_string()
        ),
        "png" | "jpg" | "jpeg" | "gif" | "webp" => Err(
            "IMAGE_FILE: This is an image file. Vision pipeline is not yet enabled.".to_string()
        ),

        // Unknown extension — try reading as text anyway
        _ => {
            let bytes = std::fs::read(&path)
                .map_err(|e| format!("READ_ERROR: {}", e))?;
            let content = String::from_utf8_lossy(&bytes).to_string();
            const MAX_CHARS: usize = 12_000;
            if content.len() > MAX_CHARS {
                Ok(format!(
                    "{}\n\n[Document truncated at {} characters]",
                    &content[..MAX_CHARS], MAX_CHARS
                ))
            } else {
                Ok(content)
            }
        }
    }
}

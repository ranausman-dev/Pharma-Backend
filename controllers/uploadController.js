// controllers/uploadController.js

// Single file upload
export const uploadSingleImage = (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({
      message: "Single file uploaded successfully",
      file: req.file,
    });
  };
  
  // Multiple files upload
  export const uploadMultipleImages = (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    res.json({
      message: "Multiple files uploaded successfully",
      files: req.files,
    });
  };
  
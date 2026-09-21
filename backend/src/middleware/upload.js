const multer = require('multer');

// Memory storage: files land in req.file.buffer rather than on disk, since
// the serverless runtime has no persistent filesystem to write to. Capped
// at 15MB, comfortable for docx handouts, PDFs, and slide decks while
// keeping request handling fast.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

module.exports = upload;

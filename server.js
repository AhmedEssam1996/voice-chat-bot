import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

if (!process.env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY is not set in the environment.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".webm";
    cb(null, `${Date.now()}${ext}`);
  },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend.html"));
});

const upload = multer({ storage });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ------------------ /chat ------------------
app.post("/chat", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ reply: "Message is required" });

        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // موديل موثّق في Groq
            messages: [{ role: "user", content: message }],
            temperature: 0.2,
        });

        console.log("/chat raw response:", JSON.stringify(response, null, 2));

        const choice = response?.choices?.[0];
        const replyText =
          choice?.message?.content ||
          choice?.message ||
          choice?.content ||
          "I couldn't generate a reply.";

        res.json({ reply: replyText });
    } catch (error) {
        console.error("Error in /chat:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});

// ------------------ /voice-to-text ------------------
app.post("/voice-to-text", upload.single("audio"), async (req, res) => {
    let file;
    try {
        file = req.file;
        if (!file) return res.status(400).json({ error: "Audio file is required." });

        const translation = await groq.audio.transcriptions.create({
            file: fs.createReadStream(file.path),
            model: "whisper-large-v3-turbo",
        });

        res.json({ text: translation.text || "" });
    } catch (error) {
        console.error("Error in /voice-to-text:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    } finally {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

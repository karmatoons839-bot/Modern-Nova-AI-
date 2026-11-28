import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from renderer import safe_url, compose, run

class RendererTests(unittest.TestCase):
    def test_requires_exact_https_host(self):
        self.assertEqual(safe_url("https://media.example.com/file", {"media.example.com"}), "https://media.example.com/file")
        for url in ["http://media.example.com/file", "https://evil.example.com/file", "https://media.example.com@evil.com/file", "https://127.0.0.1/file"]:
            with self.assertRaises(ValueError):
                safe_url(url, {"media.example.com"})

    def test_actual_silent_merge_strips_provider_audio(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            video = root / "input.mp4"
            run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=1280x720:d=0.4", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.4", "-c:v", "libx264", "-c:a", "aac", "-shortest", str(video)])
            output = root / "final.mp4"
            result = compose([{"video": video, "audio": []}, {"video": video, "audio": []}], output, "16:9", False)
            streams = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(output)]))["streams"]
            self.assertGreater(result["seconds"], 0.7)
            self.assertEqual(result["voice_seconds"], 0)
            self.assertFalse(any(s["codec_type"] == "audio" for s in streams))

    def test_rejects_dialogue_overflow(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); video=root/"short.mp4"; audio=root/"long.wav"
            run(["ffmpeg","-y","-v","error","-f","lavfi","-i","color=s=1280x720:d=0.2","-c:v","libx264",str(video)])
            run(["ffmpeg","-y","-v","error","-f","lavfi","-i","sine=duration=0.6",str(audio)])
            with self.assertRaisesRegex(ValueError,"Dialogue exceeds"):
                compose([{"video":video,"audio":[audio]}],root/"out.mp4","16:9",True)

if __name__ == "__main__":
    unittest.main()
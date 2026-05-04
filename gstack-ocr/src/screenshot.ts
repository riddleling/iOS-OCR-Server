import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execAsync = promisify(exec);

export async function captureScreen(): Promise<string | null> {
  const outputPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);

  try {
    const platform = process.platform;

    if (platform === "darwin") {
      // macOS: screencapture
      await execAsync(`screencapture -x "${outputPath}"`);
    } else if (platform === "linux") {
      // Linux: gnome-screenshot 或 import (ImageMagick)
      try {
        await execAsync(`gnome-screenshot -f "${outputPath}"`);
      } catch {
        await execAsync(`import -window root "${outputPath}"`);
      }
    } else {
      // Windows: PowerShell
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bitmap.Save("${outputPath.replace(/\\/g, "\\\\")}")
      `;
      const scriptPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.ps1`);
      fs.writeFileSync(scriptPath, ps);
      await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
      fs.unlinkSync(scriptPath);
    }

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
    return null;
  } catch (err) {
    console.error("[Screenshot] Failed:", err);
    return null;
  }
}

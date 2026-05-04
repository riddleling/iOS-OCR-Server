import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execAsync = promisify(exec);

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function captureScreen(region?: Region): Promise<string | null> {
  const outputPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);

  try {
    const platform = process.platform;

    if (platform === "darwin") {
      // macOS: screencapture supports -x (silent) and -R (region)
      if (region) {
        await execAsync(`screencapture -x -R${region.x},${region.y},${region.width},${region.height} "${outputPath}"`);
      } else {
        await execAsync(`screencapture -x "${outputPath}"`);
      }
    } else if (platform === "linux") {
      if (region) {
        // ImageMagick import supports cropping
        await execAsync(`import -window root -crop ${region.width}x${region.height}+${region.x}+${region.y} "${outputPath}"`);
      } else {
        try {
          await execAsync(`gnome-screenshot -f "${outputPath}"`);
        } catch {
          await execAsync(`import -window root "${outputPath}"`);
        }
      }
    } else {
      // Windows: PowerShell
      const x = region?.x ?? 0;
      const y = region?.y ?? 0;
      const w = region?.width ?? 1920;
      const h = region?.height ?? 1080;
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $bmp = New-Object System.Drawing.Bitmap(${w}, ${h})
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen(${x}, ${y}, 0, 0, [System.Drawing.Size]::new(${w}, ${h}))
        $bmp.Save("${outputPath.replace(/\\/g, "\\\\")}")
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

export async function captureClipboard(): Promise<string | null> {
  const outputPath = path.join(os.tmpdir(), `clipboard_${Date.now()}.png`);

  try {
    const platform = process.platform;

    if (platform === "darwin") {
      // macOS: pbpaste to save image
      const imgExists = await execAsync(`osascript -e 'exists (clipboard as record)'`).then(r => r.stdout.includes('true')).catch(() => false);
      if (!imgExists) return null;
      await execAsync(`osascript -e 'set theFile to (open for access POSIX file "${outputPath}" with write permission)' -e 'try' -e 'write (clipboard as PNG) to theFile' -e 'end try' -e 'close access theFile'`);
    } else if (platform === "linux") {
      // Linux: xclip or xwd
      await execAsync(`xclip -selection clipboard -t image/png -o > "${outputPath}" 2>/dev/null`);
    } else {
      // Windows: PowerShell
      const ps = `
        Add-Type -AssemblyName System.Windows.Forms
        if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
          $img = [System.Windows.Forms.Clipboard]::GetImage()
          $img.Save("${outputPath.replace(/\\/g, "\\\\")}", [System.Drawing.Imaging.ImageFormat]::Png)
        }
      `;
      const scriptPath = path.join(os.tmpdir(), `clipboard_${Date.now()}.ps1`);
      fs.writeFileSync(scriptPath, ps);
      await execAsync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`);
      fs.unlinkSync(scriptPath);
    }

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return outputPath;
    }
    return null;
  } catch (err) {
    console.error("[Clipboard] Failed:", err);
    return null;
  }
}

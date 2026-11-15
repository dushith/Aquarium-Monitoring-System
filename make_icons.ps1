Add-Type -AssemblyName System.Drawing

function Generate-Icon {
    param([int]$size, [string]$filePath)
    
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $p1 = New-Object System.Drawing.Point(0, 0)
    $p2 = New-Object System.Drawing.Point($size, $size)
    $c1 = [System.Drawing.Color]::FromArgb(2, 132, 199)
    $c2 = [System.Drawing.Color]::FromArgb(8, 47, 73)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($p1, $p2, $c1, $c2)
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    $penColor = [System.Drawing.Color]::FromArgb(125, 211, 252)
    $tankPen = New-Object System.Drawing.Pen($penColor, [float]($size * 0.04))
    $margin = [int]($size * 0.18)
    $width = $size - (2 * $margin)
    $height = [int]($size * 0.55)
    $top = [int]($size * 0.25)
    $g.DrawRectangle($tankPen, $margin, $top, $width, $height)

    $waterColor = [System.Drawing.Color]::FromArgb(180, 56, 189, 248)
    $waterBrush = New-Object System.Drawing.SolidBrush($waterColor)
    $g.FillRectangle($waterBrush, [int]($margin + ($size * 0.03)), [int]($top + ($size * 0.15)), [int]($width - ($size * 0.06)), [int]($height - ($size * 0.17)))

    $fishColor = [System.Drawing.Color]::FromArgb(251, 146, 60)
    $fishBrush = New-Object System.Drawing.SolidBrush($fishColor)
    $fx = [int]($size * 0.42)
    $fy = [int]($size * 0.50)
    $fw = [int]($size * 0.24)
    $fh = [int]($size * 0.14)
    $g.FillEllipse($fishBrush, $fx, $fy, $fw, $fh)

    $bubbleColor = [System.Drawing.Color]::FromArgb(180, 224, 242, 254)
    $bubbleBrush = New-Object System.Drawing.SolidBrush($bubbleColor)
    $g.FillEllipse($bubbleBrush, [int]($size * 0.32), [int]($size * 0.60), [int]($size * 0.04), [int]($size * 0.04))
    $g.FillEllipse($bubbleBrush, [int]($size * 0.35), [int]($size * 0.45), [int]($size * 0.03), [int]($size * 0.03))

    $bmp.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $filePath"
}

$iconDir = Join-Path $PSScriptRoot "icons"
if (!(Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir | Out-Null
}

Generate-Icon -size 192 -filePath (Join-Path $iconDir "icon-192.png")
Generate-Icon -size 512 -filePath (Join-Path $iconDir "icon-512.png")

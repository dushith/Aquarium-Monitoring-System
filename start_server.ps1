# AquaSense Local Server Launcher for Android & PC Testing
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   AquaSense Smart Aquarium - Local Server        " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

# Find local IPv4 address
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*", "Ethernet*", "vEthernet*" | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress

if (-not $ip) {
    $ip = "localhost"
}

$port = 8080
$url = "http://${ip}:${port}"
$localUrl = "http://localhost:${port}"

Write-Host "`n[+] Starting HTTP server on port $port..." -ForegroundColor Green
Write-Host "[+] Open on this PC:      " -NoNewline; Write-Host "$localUrl" -ForegroundColor Cyan
Write-Host "[+] Open on Android Phone: " -NoNewline; Write-Host "$url" -ForegroundColor Yellow
Write-Host "    (Make sure your phone is connected to the same Wi-Fi network)`n" -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop the server at any time.`n" -ForegroundColor DarkGray

Start-Process $localUrl

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://*:$port/")
try {
    $listener.Start()
} catch {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Prefixes.Add("http://${ip}:$port/")
    $listener.Start()
}

$currentDir = $PSScriptRoot

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $rawPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rawPath) -or $rawPath -eq "") {
        $rawPath = "index.html"
    }

    $filePath = Join-Path $currentDir $rawPath.Replace('/', '\')

    if (Test-Path $filePath -PathType Leaf) {
        $content = [System.IO.File]::ReadAllBytes($filePath)
        
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        switch ($ext) {
            ".html" { $response.ContentType = "text/html; charset=utf-8" }
            ".css"  { $response.ContentType = "text/css" }
            ".js"   { $response.ContentType = "application/javascript" }
            ".json" { $response.ContentType = "application/json" }
            ".png"  { $response.ContentType = "image/png" }
            ".svg"  { $response.ContentType = "image/svg+xml" }
            ".ico"  { $response.ContentType = "image/x-icon" }
            default { $response.ContentType = "application/octet-stream" }
        }

        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Service-Worker-Allowed", "/")
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
    } else {
        $response.StatusCode = 404
        $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
    }
    $response.Close()
}

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinRect {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
$targetHandle = if ($args.Count -gt 0) { [IntPtr][int]$args[0] } else { [IntPtr]525184 }
$p = Get-Process | Where-Object { $_.MainWindowHandle -eq $targetHandle } | Select-Object -First 1
$chrome = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($chrome) { [WinRect]::ShowWindow($chrome.MainWindowHandle,6) | Out-Null }
$codex = Get-Process | Where-Object { $_.MainWindowTitle -eq 'ChatGPT' } | Select-Object -First 1
if ($codex) { [WinRect]::ShowWindow($codex.MainWindowHandle,6) | Out-Null }
[WinRect]::ShowWindow($p.MainWindowHandle,3) | Out-Null
[WinRect]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 500
$r = New-Object WinRect+RECT
[WinRect]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
$w=$r.Right-$r.Left; $h=$r.Bottom-$r.Top
$bmp=New-Object Drawing.Bitmap $w,$h
$g=[Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left,$r.Top,0,0,$bmp.Size)
$out=Join-Path (Get-Location) '.tmp-pob-user-window.png'
$bmp.Save($out,[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "$($p.Id) $($p.MainWindowHandle) $($r.Left),$($r.Top),$w,$h $out"

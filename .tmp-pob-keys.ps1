param([int]$Handle,[string]$Keys)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public class KeyWin { [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
"@
$h=[IntPtr]$Handle; [KeyWin]::ShowWindow($h,3)|Out-Null; [KeyWin]::SetForegroundWindow($h)|Out-Null; Start-Sleep -Milliseconds 100
[Windows.Forms.SendKeys]::SendWait($Keys); Start-Sleep -Milliseconds 500

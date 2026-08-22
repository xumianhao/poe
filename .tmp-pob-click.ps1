param([int]$Handle,[int]$X,[int]$Y)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseCtl {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint data,UIntPtr extra);
}
"@
$h=[IntPtr]$Handle; $r=New-Object MouseCtl+RECT
[MouseCtl]::ShowWindow($h,3)|Out-Null; [MouseCtl]::SetForegroundWindow($h)|Out-Null; Start-Sleep -Milliseconds 150
[MouseCtl]::GetWindowRect($h,[ref]$r)|Out-Null
[MouseCtl]::SetCursorPos($r.Left+$X,$r.Top+$Y)|Out-Null
[MouseCtl]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [MouseCtl]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 300

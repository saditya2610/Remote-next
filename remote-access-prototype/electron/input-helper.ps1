# ============================================================
# input-helper.ps1 — NexLink Input Injection via Win32 API
# Reads JSON commands from stdin, executes via P/Invoke
# ============================================================

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class NexInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,uint d,int e);
    [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte scan,uint flags,int e);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);

    public const uint ML_DOWN  = 0x0002;
    public const uint ML_UP    = 0x0004;
    public const uint MR_DOWN  = 0x0008;
    public const uint MR_UP    = 0x0010;
    public const uint MM_DOWN  = 0x0020;
    public const uint MM_UP    = 0x0040;
    public const uint M_SCROLL = 0x0800;
    public const uint K_UP     = 0x0002;

    public static void Move(int x, int y)          { SetCursorPos(x, y); }
    public static void LDown()                     { mouse_event(ML_DOWN,0,0,0,0); }
    public static void LUp()                       { mouse_event(ML_UP,0,0,0,0); }
    public static void RDown()                     { mouse_event(MR_DOWN,0,0,0,0); }
    public static void RUp()                       { mouse_event(MR_UP,0,0,0,0); }
    public static void MDown()                     { mouse_event(MM_DOWN,0,0,0,0); }
    public static void MUp()                       { mouse_event(MM_UP,0,0,0,0); }
    public static void Scroll(int delta)           { mouse_event(M_SCROLL,0,0,(uint)delta,0); }
    public static void KDown(byte vk)              { keybd_event(vk,0,0,0); }
    public static void KUp(byte vk)                { keybd_event(vk,0,K_UP,0); }
}
"@ -ErrorAction Stop

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Signal ready
Write-Output "READY"
[Console]::Out.Flush()

# Process command loop
while ($true) {
    $line = [Console]::ReadLine()
    if ($null -eq $line) { break }

    try {
        $cmd = $line | ConvertFrom-Json
        switch ($cmd.t) {
            'mv' { [NexInput]::Move($cmd.x, $cmd.y) }
            'ld' { [NexInput]::LDown() }
            'lu' { [NexInput]::LUp() }
            'rd' { [NexInput]::RDown() }
            'ru' { [NexInput]::RUp() }
            'md' { [NexInput]::MDown() }
            'mu' { [NexInput]::MUp() }
            'sc' { [NexInput]::Scroll($cmd.d) }
            'kd' { [NexInput]::KDown($cmd.v) }
            'ku' { [NexInput]::KUp($cmd.v) }
        }
    } catch {}
}

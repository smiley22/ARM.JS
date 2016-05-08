# Example call: ./buildjs .\integration.c -Format Binary -VarName bootImage
param (
  [Parameter(Mandatory=$true)][string]$files,
  [string]$format         = "elf",
  [string]$out            = "a.out",
  [string]$varname        = "a_out",
  [int]$numColumns        = 10,
  [int]$numIndent         = 4,
  [int]$numBaseIndent     = 0,
  [bool]$copyToClipboard  = $true
)

function To-Js {
  param (
    [Parameter(Mandatory=$true)][string]$filename,
    [Parameter(Mandatory=$true)][string]$varname,
    [int]$numColumns = 10,
    [int]$numIndent = 4,
    [int]$numBaseIndent = 0
  )
  $path  = Resolve-Path $filename
  $bytes = [System.IO.File]::ReadAllBytes($path)

  $out = New-Object System.Text.StringBuilder
  $null = $out.Append(' ', $numBaseIndent).Append("var $varname = [")
  for ($i = 0; $i -lt $bytes.Length; $i++) {
    if ($i % $numColumns -eq 0) {
      $null = $out.AppendLine().Append(' ', $numBaseIndent + $numIndent)
    }
    $null = $out.AppendFormat("0x{0:X2}", $bytes[$i])
    if ($i -lt $bytes.Length - 1) {
      $null = $out.Append(", ")
    }
  }
  $out.AppendLine().Append(' ', $numBaseIndent).Append("];").ToString()
}

function Compile {
  param (
    [Parameter(Mandatory=$true)][string]$files,
    [string]$outname = "a.out"
  )
  Write-Host "Assembling startup.s"
  & "arm-none-eabi-as" startup.s -o startup.o
  if($LastExitcode -ne 0) {
    Throw "arm-none-eabi-as failed with $LastExitcode"
  }
  Write-Host "Compiling and linking $files into $outname..."
  & "arm-none-eabi-gcc" -Wall $files -o $outname -nostdlib -Xlinker -nostdlib -Xlinker -T./linker.ld -Xlinker -n
  if($LastExitcode -ne 0) {
    Throw "arm-none-eabi-gcc failed with $LastExitcode"
  }
  Remove-Item "*.o"
  $outname
}

function FlatBinary {
  param (
    [Parameter(Mandatory=$true)][string]$elf,
    [string]$outname = "flat.bin"
  )
  Write-Host "Stripping ELF headers"
  & "arm-none-eabi-objcopy" -O binary -j .text -j .data $elf $outname
  if($LastExitcode -ne 0) {
    Throw "arm-none-eabi-objcopy failed with $LastExitcode"
  }
  $outname
}

$outfile = Compile $files $out
if ($format -eq "Binary") {
  $outfile = FlatBinary $outfile
}
$formattedJs = To-Js $outfile $varname $numColumns $numIndent $numBaseIndent
Write-Host $formattedJs
if ($copyToClipboard -eq $true) {
  Write-Host "Copying formatted JS into clipboard"
  $formattedJS | clip
}
Remove-Item * -include *.out, *.o, *.elf, *.bin

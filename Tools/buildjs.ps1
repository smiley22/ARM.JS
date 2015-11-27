if($args.Length -ne 1) {
	Write-Host "usage: buildjs <file>";
	exit;
}
if(!(Test-Path $args[0])) {
	Write-Host $args[0]": file does not exist";
	exit;
}
$N = [System.IO.Path]::GetFileNameWithoutExtension($args[0]);

& "arm-none-eabi-gcc" -Wall ../startup.s -o startup.o -nostdlib -c
if($LastExitcode -ne 0) {
	Write-Host "Assembling startup.s failed";
	exit;
}
& "arm-none-eabi-gcc" -Wall ../crt0.s -o crt0.o -nostdlib -c
if($LastExitcode -ne 0) {
	Write-Host "Assembling crt0.s failed";
	exit;
}
& "arm-none-eabi-gcc" -Wall $args[0] -o $N".elf" -nostdlib -Xlinker -nostdlib -Xlinker -T./tests/linker.ld -Xlinker -n
if($LastExitcode -ne 0) {
	Write-Host "Compilation failed";
	exit;
}

& "./bin2js" $N".elf"
& "rm" tests/startup.o
& "rm" tests/crt0.o

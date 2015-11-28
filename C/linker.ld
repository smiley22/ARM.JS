SECTIONS
{
  . = 0x00;
  .startup . : { startup.o(.text) }
  .text : { *(.text) }
  . = 0x40000;
  .data : { *(.data) }
  .bss : { *(.bss) }
}